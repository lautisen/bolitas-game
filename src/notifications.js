/**
 * notifications.js — Local notifications for retention: inactivity reminders,
 * quest resets and "lives are full".
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import analyticsManager from './analyticsManager.js';
import { getNextDailyReset, getNextWeeklyReset } from './economy.js';
import { getFullRestoreTime } from './livesManager.js';
import { t } from './translations.js';

function getInactivityNotifications() {
  return [
    { id: 102, delayH: 24, title: t('notif_inact_24_title'), body: t('notif_inact_24_body') },
    { id: 103, delayH: 48, title: t('notif_inact_48_title'), body: t('notif_inact_48_body') },
    { id: 104, delayH: 72, title: t('notif_inact_72_title'), body: t('notif_inact_72_body') },
    { id: 105, delayH: 120, title: t('notif_inact_120_title'), body: t('notif_inact_120_body') },
    { id: 106, delayH: 168, title: t('notif_inact_168_title'), body: t('notif_inact_168_body') },
    { id: 107, delayH: 240, title: t('notif_inact_240_title'), body: t('notif_inact_240_body') },
  ];
}

// Ask for notification permission at app startup (does not schedule anything yet)
export async function requestNotificationPermission() {
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const result = await LocalNotifications.requestPermissions();
      analyticsManager.logCustomEvent(analyticsManager.Events.NOTIFICATION_PERMISSION, {
        [analyticsManager.Params.PERMISSION_STATUS]: result.display,
      });
    }
  } catch (e) {
    console.warn('Notification permission request failed:', e);
  }
}

export async function setupInactivityNotifications() {
  try {
    // Request permission if not determined/denied (Android 13+)
    let permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      permStatus = await LocalNotifications.requestPermissions();
      if (permStatus.display !== 'granted') return; // User denied
    }

    // Cancel all previously scheduled notifications to reset the timer
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // Schedule new ones
    const now = Date.now();
    let notificationsToSchedule = getInactivityNotifications().map((n) => {
      const scheduleTime = new Date(now + n.delayH * 60 * 60 * 1000);
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: scheduleTime },
      };
    });

    // Schedule Daily Quest Notification (Next 9 AM)
    notificationsToSchedule.push({
      id: 201,
      title: t('notif_daily_quests_title'),
      body: t('notif_daily_quests_body'),
      schedule: { at: new Date(getNextDailyReset()) },
    });

    // Schedule Weekly Quest Notification (Next Monday 9 AM)
    notificationsToSchedule.push({
      id: 202,
      title: t('notif_weekly_quests_title'),
      body: t('notif_weekly_quests_body'),
      schedule: { at: new Date(getNextWeeklyReset()) },
    });

    // Schedule Lives Full Notification
    await scheduleLivesNotification(notificationsToSchedule);

    await LocalNotifications.schedule({ notifications: notificationsToSchedule });
  } catch (e) {
    console.error('Error setup local notifications:', e);
  }
}

/**
 * Schedules or cancels the life-full notification (ID 301).
 * Can be called independently or as part of a batch.
 */
export async function scheduleLivesNotification(batch = null) {
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') return;

    const restoreTime = getFullRestoreTime();
    if (restoreTime) {
      const notif = {
        id: 301,
        title: t('lives_full_notif_title'),
        body: t('lives_full_notif_body'),
        schedule: { at: new Date(restoreTime) },
      };
      if (batch) {
        batch.push(notif);
      } else {
        await LocalNotifications.schedule({ notifications: [notif] });
      }
    } else {
      // Lives are already full or something went wrong, ensure no notification is pending
      if (!batch) {
        await LocalNotifications.cancel({ notifications: [{ id: 301 }] });
      }
    }
  } catch (e) {
    console.error('Error scheduling lives notification:', e);
  }
}
