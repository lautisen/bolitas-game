/**
 * ads.js — AdMob integration: UMP consent, banner, interstitial and rewarded ads.
 *
 * Ads only run on native platforms. This module owns the ad state; what a
 * rewarded ad grants is decided by the onReward callback passed to initAdMob.
 */
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import analyticsManager from './analyticsManager.js';
import { t } from './translations.js';

const BANNER_ID = 'ca-app-pub-3539090903954344/8982185366';
const INTERSTITIAL_ID = 'ca-app-pub-3539090903954344/2163380169';
// Several reward types share the revive ad unit
const REWARDED_IDS = {
  revive: 'ca-app-pub-3539090903954344/5831162433',
  shop_coins: 'ca-app-pub-3539090903954344/7787144841',
  pity_revive: 'ca-app-pub-3539090903954344/8952150762',
};
const AD_OPTIONS = {
  isTesting: false,
  tagForChildDirectedTreatment: true,
  maxAdContentRating: 'G',
};

// Interstitial policy: every 10 levels, or when 7 minutes passed since the last ad
const INTERSTITIAL_LEVEL_INTERVAL = 10;
const INTERSTITIAL_MIN_GAP_MS = 7 * 60 * 1000;

let isBannerCreated = false;
let isAdLoading = false;
let lastAdTimestamp = Date.now();
let _rewardActionType = null;
let _rewardActionData = null;
let _onReward = () => {};
const rewardedAdsReady = { revive: false, shop_coins: false, pity_revive: false };

function rewardedSlot(type) {
  return type === 'shop_coins' || type === 'pity_revive' ? type : 'revive';
}

export async function handleConsentFlow() {
  try {
    // 1. Request consent info
    const consentInfo = await AdMob.requestConsentInfo();
    console.log('Consent Info:', consentInfo);

    // 2. Show consent form if required (and not already shown/dismissed)
    let finalInfo = consentInfo;
    if (consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
      await AdMob.showConsentForm();
      // Re-verify after showing
      const updatedInfo = await AdMob.requestConsentInfo();
      if (updatedInfo.status === 'REQUIRED' || updatedInfo.status === 'UNKNOWN') {
        document.getElementById('consent-required-screen').classList.remove('hidden');
        return false;
      }
      finalInfo = updatedInfo; // Use post-form status for all subsequent checks
    }

    // 3. Evaluate consent status using the most recent info
    if (finalInfo.status === 'REQUIRED' || finalInfo.status === 'UNKNOWN') {
      document.getElementById('consent-required-screen').classList.remove('hidden');
      return false;
    }

    // If we reach here, consent is OBTAINED or NOT_REQUIRED
    document.getElementById('consent-required-screen').classList.add('hidden');

    const isConsentObtained =
      finalInfo.status === 'OBTAINED' || finalInfo.status === 'NOT_REQUIRED';
    await FirebaseAnalytics.setEnabled({ enabled: isConsentObtained });

    if (isConsentObtained) {
      // Pre-load ads
      prepareInterstitial();
      prepareRewarded('revive'); // Preload default revive
      prepareRewarded('shop_coins'); // Preload shop coins
      showBannerAd();
    }

    return true;
  } catch (err) {
    console.error('Consent flow error:', err);
    // If it fails, we might want to fail open or closed depending on policy.
    // Here we proceed but log the error.
    return true;
  }
}

/**
 * @param {{ onReward: (type: string, data: any) => void }} options
 *   onReward runs when the user earns a rewarded ad's reward.
 */
export async function initAdMob({ onReward }) {
  _onReward = onReward;
  try {
    // Initialize AdMob with COPPA compliance settings
    await AdMob.initialize({
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
    });
    console.log('AdMob initialized');

    // Handle GDPR/UMP Consent Flow
    const canProceed = await handleConsentFlow();
    if (!canProceed) return;

    analyticsManager.logCustomEvent(analyticsManager.Events.ADMOB_INITIALIZED);

    // Rewarded ad listeners (v8 event names from source)
    const onRewarded = (rewardItem) => {
      const type = _rewardActionType || 'unknown';
      const data = _rewardActionData;
      console.log('User was rewarded for:', type, rewardItem);

      // Log ad reward watched event
      analyticsManager.logCustomEvent('ad_reward_watched', {
        placement: type,
      });

      _onReward(type, data);

      lastAdTimestamp = Date.now();
      _rewardActionType = null;
      _rewardActionData = null;
    };
    const hideLoading = () => {
      console.log('Hiding ad loading screen');
      isAdLoading = false;
      document.getElementById('ad-loading-screen').classList.add('hidden');
      showBannerAd();
    };

    // Try both naming conventions for robustness across versions
    const events = [
      'interstitialAdDismissed',
      'onInterstitialAdDismissed',
      'interstitialAdFailedToLoad',
      'onInterstitialAdFailedToLoad',
      'interstitialAdFailedToShow',
      'onInterstitialAdFailedToShow',
      'rewardVideoAdDismissed',
      'onRewardedVideoAdDismissed',
      'rewardVideoAdFailedToLoad',
      'onRewardedVideoAdFailedToLoad',
      'rewardVideoAdFailedToShow',
      'onRewardedVideoAdFailedToShow',
    ];

    events.forEach((eventName) => {
      AdMob.addListener(eventName, (info) => {
        console.log(`[AdMob] Event: ${eventName}`, info);
        hideLoading();
      });
    });

    // Keep the reward listener as is since it doesn't hide the loading screen (dismissal does)
    AdMob.addListener('onRewardedVideoAdReward', onRewarded);
    AdMob.addListener('rewardVideoAdReward', onRewarded);

    AdMob.addListener('rewardVideoAdDismissed', () => {
      console.log('[AdMob] Ad dismissed, preloading next...');
      prepareRewarded('revive');
      prepareRewarded('shop_coins');
    });

    AdMob.addListener('rewardVideoAdFailedToLoad', (info) => {
      console.warn('[AdMob] Reward ad failed to load:', info);
      analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
        [analyticsManager.Params.AD_TYPE]: 'rewarded',
        error_code: info?.errorCode ?? 'unknown',
      });
      FirebaseCrashlytics.recordException({
        message: `Ad failed to load: rewarded - ${info?.errorCode}`,
      }).catch(() => {});
      setTimeout(() => prepareRewarded('revive'), 15000);
    });

    AdMob.addListener('onRewardedVideoAdFailedToLoad', (info) => {
      console.warn('[AdMob] Reward ad failed to load (legacy):', info);
      analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
        [analyticsManager.Params.AD_TYPE]: 'rewarded_legacy',
        error_code: info?.errorCode ?? 'unknown',
      });
    });

    // Update --banner-height to match actual native banner size
    AdMob.addListener('bannerAdLoaded', (size) => {
      if (size && size.height) {
        document.documentElement.style.setProperty(
          '--banner-height',
          `${Math.ceil(size.height)}px`,
        );
      }
    });

    // Show banner globally as soon as initialized
    showBannerAd();
  } catch (err) {
    console.error('AdMob initialization failed', err);
  }
}

async function prepareInterstitial() {
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, ...AD_OPTIONS });
  } catch (err) {
    console.error('Prepare Interstitial Error', err);
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
      [analyticsManager.Params.AD_TYPE]: 'interstitial',
      error_code: err?.message ?? 'unknown',
    });
  }
}

export async function prepareRewarded(type = 'revive') {
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_IDS[rewardedSlot(type)], ...AD_OPTIONS });
    rewardedAdsReady[type] = true;
    console.log(`[AdMob] Preloaded rewarded ad: ${type}`);
  } catch (err) {
    rewardedAdsReady[type] = false;
    console.error(`Prepare Rewarded Error (${type})`, err);
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
      [analyticsManager.Params.AD_TYPE]: `rewarded_${type}`,
      error_code: err?.message ?? 'unknown',
    });
  }
}

async function showInterstitialAd() {
  if (isAdLoading) return;
  isAdLoading = true;

  let loadingTimeout = null;
  try {
    // Only show loading screen if the ad doesn't open within 250ms
    loadingTimeout = setTimeout(() => {
      document.getElementById('ad-loading-screen').classList.remove('hidden');
    }, 250);

    // No need to await prepare again here if we pre-load it elsewhere,
    // but the plugin handles it fine if it's already cached.
    await AdMob.showInterstitial();

    lastAdTimestamp = Date.now();
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_IMPRESSION, {
      [analyticsManager.Params.AD_TYPE]: 'interstitial',
    });
  } catch (err) {
    console.error('Show Interstitial Error', err);
  } finally {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    isAdLoading = false;
    document.getElementById('ad-loading-screen').classList.add('hidden');
  }
}

/** Shows an interstitial after a won level when the frequency policy allows it. */
export async function maybeShowInterstitial(globalLevel) {
  const shouldByLevel =
    globalLevel >= INTERSTITIAL_LEVEL_INTERVAL && globalLevel % INTERSTITIAL_LEVEL_INTERVAL === 0;
  const shouldByTime = Date.now() - lastAdTimestamp > INTERSTITIAL_MIN_GAP_MS;

  if (shouldByLevel || shouldByTime) {
    console.log(`Ad triggered by ${shouldByLevel ? 'level' : 'time'}. Showing interstitial.`);
    await showInterstitialAd();
  }
}

export async function showPityRewardAd() {
  showRewardedAd('pity_revive');
}

export async function showRewardedAd(type = 'revive', data = null) {
  if (isAdLoading) return; // Prevent multiple taps
  isAdLoading = true;

  _rewardActionType = type;
  _rewardActionData = data;

  let btn = null;
  let originalText = '';

  if (type === 'revive') btn = document.getElementById('revive-btn');
  else if (type === 'get_xp') btn = document.getElementById('get-xp-ad-btn');
  else if (type === 'daily_spin_respin') btn = document.getElementById('respin-btn');
  else if (type === 'prestart_buff') btn = document.getElementById('prestart-ad-buff-btn');
  else if (type === 'shop_coins') btn = document.getElementById('watch-ad-btn');
  else if (type === 'double_coins') btn = document.getElementById('win-x2-btn');

  if (btn) {
    originalText = btn.innerHTML; // Save full HTML to preserve SVGs
    btn.innerHTML = `⏳ ${t('ad_loading')}`;
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    btn.disabled = true;
  }

  let loadingTimeout = null;
  let adTimedOut = false;
  try {
    // Only show loading screen if the ad doesn't open within 250ms
    loadingTimeout = setTimeout(() => {
      document.getElementById('ad-loading-screen').classList.remove('hidden');
    }, 250);

    // Explicitly set the reward type again inside the try block to be safe
    _rewardActionType = type;
    _rewardActionData = data;

    const slot = rewardedSlot(type);

    // Optimization: If NOT already preloaded, call prepare which blocks until ready.
    // If it WAS preloaded, showRewardVideoAd should be instant.
    if (!rewardedAdsReady[slot]) {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AD_TIMEOUT')), 10000),
      );
      await Promise.race([
        AdMob.prepareRewardVideoAd({ adId: REWARDED_IDS[slot], ...AD_OPTIONS }),
        timeoutPromise,
      ]);
    }
    // Mark as consumed so a second tap doesn't skip prepare on a spent ad
    rewardedAdsReady[slot] = false;

    await AdMob.showRewardVideoAd();

    analyticsManager.logCustomEvent(analyticsManager.Events.AD_IMPRESSION, {
      [analyticsManager.Params.AD_TYPE]: 'rewarded',
    });
  } catch (err) {
    const isNoFill =
      err.message === 'AD_TIMEOUT' ||
      err.message?.includes('No fill') ||
      err.message?.includes('eCPM floor') ||
      err.message?.includes('No ads');
    if (isNoFill) {
      adTimedOut = true;
      const loadingScreen = document.getElementById('ad-loading-screen');
      const spinner = loadingScreen?.querySelector('.loader-spinner');
      const msgEl = loadingScreen?.querySelector('#ad-loading-messages');
      if (spinner) spinner.style.display = 'none';
      if (msgEl) msgEl.innerHTML = `<p>⚠️ ${t('ad_unavailable')}</p>`;
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      console.error('Show Rewarded Error', err);
    }
  } finally {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    isAdLoading = false;
    const loadingScreen = document.getElementById('ad-loading-screen');
    if (adTimedOut) {
      // Reset the loading screen state for next time
      const spinner = loadingScreen?.querySelector('.loader-spinner');
      const msgEl = loadingScreen?.querySelector('#ad-loading-messages');
      if (spinner) spinner.style.display = '';
      if (msgEl)
        msgEl.innerHTML = `<p data-i18n="ad_support_message">${t('ad_support_message')}</p>`;
    }
    loadingScreen?.classList.add('hidden');
    if (btn) {
      btn.innerHTML = originalText;
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.disabled = false;
    }
  }
}

export async function showBannerAd() {
  if (isAdLoading) return;
  try {
    const consentInfo = await AdMob.requestConsentInfo();
    if (consentInfo.status !== 'OBTAINED' && consentInfo.status !== 'NOT_REQUIRED') {
      return;
    }

    // Safety check to prevent double banner
    if (isBannerCreated) return;

    await AdMob.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      width: Math.round(window.screen.width),
      ...AD_OPTIONS,
    });
    isBannerCreated = true;
    // Estimate adaptive banner height (overridden by bannerAdLoaded event with real value)
    const estimatedBannerH = Math.min(90, Math.max(50, Math.floor(window.innerWidth * 0.15)));
    document.documentElement.style.setProperty('--banner-height', `${estimatedBannerH}px`);
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_IMPRESSION, {
      [analyticsManager.Params.AD_TYPE]: 'banner',
    });
  } catch (e) {
    console.warn('AdMob Banner error (non-fatal):', e);
  }
}

/** Re-opens the consent form from the "Consent Required" screen. */
export async function retryConsent() {
  await AdMob.showConsentForm();
  await handleConsentFlow();
}
