import { describe, it, expect, beforeEach, vi } from 'vitest';

const LocalNotifications = {
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  getPending: vi.fn(async () => ({ notifications: [] })),
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => {}),
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications }));
vi.mock('@capacitor-firebase/analytics', () => ({
  FirebaseAnalytics: { setEnabled: vi.fn(async () => {}), logEvent: vi.fn(async () => {}) },
}));

const { setupInactivityNotifications, scheduleLivesNotification } =
  await import('../src/notifications.js');
const { useLife } = await import('../src/livesManager.js');

const scheduledIds = () =>
  LocalNotifications.schedule.mock.calls.flatMap(([arg]) => arg.notifications.map((n) => n.id));

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    LocalNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
  });

  it('schedules inactivity reminders and quest resets in one batch', async () => {
    await setupInactivityNotifications();
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(scheduledIds()).toEqual(
      expect.arrayContaining([102, 103, 104, 105, 106, 107, 201, 202]),
    );
  });

  it('schedules every notification in the future', async () => {
    const now = Date.now();
    await setupInactivityNotifications();
    const [{ notifications }] = LocalNotifications.schedule.mock.calls[0];
    notifications.forEach((n) => expect(n.schedule.at.getTime()).toBeGreaterThan(now));
  });

  it('cancels pending notifications before rescheduling', async () => {
    const pending = { notifications: [{ id: 102 }] };
    LocalNotifications.getPending.mockResolvedValueOnce(pending);
    await setupInactivityNotifications();
    expect(LocalNotifications.cancel).toHaveBeenCalledWith(pending);
  });

  it('schedules nothing when the player denies permission', async () => {
    LocalNotifications.checkPermissions.mockResolvedValue({ display: 'denied' });
    LocalNotifications.requestPermissions.mockResolvedValueOnce({ display: 'denied' });
    await setupInactivityNotifications();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it('cancels the "lives full" notification when lives are already full', async () => {
    await scheduleLivesNotification();
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 301 }] });
  });

  it('schedules the "lives full" notification after losing a life', async () => {
    useLife();
    await scheduleLivesNotification();
    expect(scheduledIds()).toEqual([301]);
  });
});
