import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const listeners = {};
const AdMob = {
  initialize: vi.fn(async () => {}),
  requestConsentInfo: vi.fn(async () => ({ status: 'OBTAINED', isConsentFormAvailable: false })),
  showConsentForm: vi.fn(async () => {}),
  prepareInterstitial: vi.fn(async () => {}),
  showInterstitial: vi.fn(async () => {}),
  prepareRewardVideoAd: vi.fn(async () => {}),
  showRewardVideoAd: vi.fn(async () => {}),
  showBanner: vi.fn(async () => {}),
  addListener: vi.fn((name, fn) => {
    (listeners[name] ??= []).push(fn);
  }),
};

vi.mock('@capacitor-community/admob', () => ({
  AdMob,
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
}));
vi.mock('@capacitor-firebase/analytics', () => ({
  FirebaseAnalytics: { setEnabled: vi.fn(async () => {}), logEvent: vi.fn(async () => {}) },
}));
vi.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: { recordException: vi.fn(async () => {}) },
}));

const fire = (name, payload) => (listeners[name] ?? []).forEach((fn) => fn(payload));

// The module keeps ad state at import time, so load a fresh copy for each test
async function loadAds() {
  vi.resetModules();
  return import('../src/ads.js');
}

describe('ads', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.clearAllMocks();
    for (const k of Object.keys(listeners)) delete listeners[k];
    document.body.innerHTML = `
      <div id="consent-required-screen" class="hidden"></div>
      <div id="ad-loading-screen" class="hidden"></div>
      <button id="revive-btn">Revive</button>`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('interstitial policy', () => {
    it('shows an interstitial every 10 levels', async () => {
      const ads = await loadAds();
      await ads.maybeShowInterstitial(10);
      await ads.maybeShowInterstitial(20);
      expect(AdMob.showInterstitial).toHaveBeenCalledTimes(2);
    });

    it('skips other levels while the last ad is recent', async () => {
      const ads = await loadAds();
      await ads.maybeShowInterstitial(7);
      expect(AdMob.showInterstitial).not.toHaveBeenCalled();
    });

    it('shows one when more than 7 minutes passed since the last ad', async () => {
      const ads = await loadAds();
      vi.advanceTimersByTime(7 * 60 * 1000 + 1);
      await ads.maybeShowInterstitial(7);
      expect(AdMob.showInterstitial).toHaveBeenCalledTimes(1);

      // The timer restarts after showing it
      await ads.maybeShowInterstitial(8);
      expect(AdMob.showInterstitial).toHaveBeenCalledTimes(1);
    });
  });

  describe('consent', () => {
    it('blocks the game behind the consent screen when consent is still required', async () => {
      AdMob.requestConsentInfo.mockResolvedValue({
        status: 'REQUIRED',
        isConsentFormAvailable: true,
      });
      const ads = await loadAds();
      expect(await ads.handleConsentFlow()).toBe(false);
      expect(AdMob.showConsentForm).toHaveBeenCalled();
      expect(document.getElementById('consent-required-screen').classList).not.toContain('hidden');
      AdMob.requestConsentInfo.mockResolvedValue({ status: 'OBTAINED' });
    });

    it('preloads ads once consent is obtained', async () => {
      const ads = await loadAds();
      expect(await ads.handleConsentFlow()).toBe(true);
      expect(AdMob.prepareInterstitial).toHaveBeenCalled();
      expect(AdMob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    });
  });

  describe('rewarded ads', () => {
    it('passes the reward type and data to onReward when the user earns it', async () => {
      const onReward = vi.fn();
      const ads = await loadAds();
      await ads.initAdMob({ onReward });

      const shown = ads.showRewardedAd('double_coins', 40);
      await vi.runAllTimersAsync();
      await shown;
      fire('rewardVideoAdReward', { amount: 1 });

      expect(onReward).toHaveBeenCalledWith('double_coins', 40);
    });

    it('restores the button after the ad closes', async () => {
      const ads = await loadAds();
      const btn = document.getElementById('revive-btn');
      const shown = ads.showRewardedAd('revive');
      expect(btn.disabled).toBe(true);
      await vi.runAllTimersAsync();
      await shown;
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('Revive');
    });

    it('ignores a second tap while an ad is loading', async () => {
      const ads = await loadAds();
      const first = ads.showRewardedAd('revive');
      const second = ads.showRewardedAd('revive');
      await vi.runAllTimersAsync();
      await Promise.all([first, second]);
      expect(AdMob.showRewardVideoAd).toHaveBeenCalledTimes(1);
    });
  });
});
