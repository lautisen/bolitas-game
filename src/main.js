import './style.css';
import analyticsManager from './analyticsManager.js';
import {
  getLevelData,
  getBlockForLevel,
  generateBiomeBlock,
  getVisibleBiomeRange,
  isBiomeRevealed,
} from './biomes.js';
import {
  playSelectSound,
  playPopSound,
  playErrorSound,
  playGameOverSound,
  playWinSound,
  playCoinSound,
  playLevelUnlockSound,
} from './audio.js';
import { checkAppVersion } from './versionCheck.js';
import {
  MIN_GROUP,
  getGroup,
  pickSpawnColor,
  findValidGroups,
  findValidGroup,
  hasValidMove,
  isBoardClear,
  applyGravity,
  collapseEmptyColumns,
} from './board.js';
import {
  COMBO_MULTIPLIERS,
  COMBO_WINDOW_MS,
  calculatePoints,
  nextComboLevel,
  getStarCount,
  getStarProgress,
} from './scoring.js';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  initShop,
  openShop,
  renderShopItems,
  updateShopNotifications,
  registerCoinAdWatched,
} from './shop.js';
import {
  getCoins,
  addCoins,
  getXP,
  getPlayerLevel,
  getXPForNextLevel,
  getXPProgress,
  addXP,
  getDailyQuests,
  swapQuest,
  claimQuest,
  getWeeklyQuests,
  claimWeeklyQuest,
  swapWeeklyQuest,
  hasClaimableQuests,
  hasClaimableDailyQuests,
  hasClaimableWeeklyQuests,
  getNextDailyReset,
  getNextWeeklyReset,
  SHOP_BOOSTERS,
  getBoosterCount,
  useBooster,
  addBoosterFree,
  getXPToNextReward,
  trackPop,
  trackLevelComplete,
  trackBoardClear,
  trackScore,
  trackSingleGameScore,
  trackGamePlayed,
} from './economy.js';
import { t, updateLanguageUI, setLanguage, getLanguage } from './translations.js';
import {
  getLives,
  useLife,
  addLife,
  getRemainingTime,
  checkAndRefill,
  getFullRestoreTime,
} from './livesManager.js';
import {
  isTutorialActive,
  setTutorialActive,
  abortActiveTutorial,
  checkBoosterTutorial,
  showAdventureTutorial,
  handleTutorialProgress,
} from './tutorial.js';
import { initDailySpin } from './dailySpin.js';

const bgmAudio = new Audio('./assets/bgm.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0.4;

let prestartAdsThisTry = 0;
// Colors ordered by visual distinctiveness — levels using fewer colors get the first N entries
const COLORS = ['red', 'blue', 'yellow', 'green', 'pink', 'cyan'];
// AdMob Banner ID
const BANNER_ID = 'ca-app-pub-3539090903954344/8982185366';

// Level data is now generated dynamically from biomes.js
// Use getLevelData(globalLevel) for any level (1-indexed, infinite)
function getCurrentLevelConfig() {
  const globalLevel = currentLevelIndex + 1;
  const data = getLevelData(globalLevel);
  if (!data) {
    console.error('CRITICAL: No level data found for level', globalLevel);
  }
  return data;
}

// LevelData has no biome field — the biome name lives on the block
function getBiomeNameForLevel(globalLevel) {
  const { block } = getBlockForLevel(globalLevel);
  return block?.biomeName || 'unknown';
}

let currentMode = 'adventure'; // Only 'adventure' mode remains
let currentLevelIndex = 0;
let timerInterval = null;
let currentRows = 10;
let currentCols = 10;
let currentColors = 5;
let currentColorSet = COLORS; // which palette to use

let grid = [];
let score = 0;
let uiHeaderMode;
let uiGrid;
let isAnimating = false;
let selectedGroup = [];
let currentUser = null;
let comboMultiplier = 1;
let comboLevel = 0; // 0=none, 1=x1.5, 2=x2, 3=x2.5, 4=x3
let lastPopTime = 0;
let comboTimeout = null;
let shownQuestToasts = new Set();

let isAudioEnabled = localStorage.getItem('bolitasAudioEnabled') !== 'false';
let isColorblindEnabled = localStorage.getItem('bolitasColorblindEnabled') === 'true';
let hintTimeout = null;
const HINT_DELAY = 5000; // 5 seconds
let hasUsedRevive = false;
let isBannerCreated = false;
let isAdLoading = false;
let levelCompleted = false;
let boardClearThisLevel = false;
let activePowerup = null;
let boostersUsedInLevel = {};
let lastAdTimestamp = Date.now();

// Performance: O(1) element-to-position lookup instead of O(rows*cols) scan
let elementPositionMap = new WeakMap();
// Performance: track hinted elements to avoid querySelectorAll
let hintedElements = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    uiHeaderMode = document.getElementById('header-mode-display');
    uiGrid = document.getElementById('grid');
    const gameArea = document.querySelector('.game-area');
    if (gameArea) {
      new ResizeObserver(sizeGrid).observe(gameArea);
    } else {
      console.warn('[Main] .game-area not found during initialization');
    }

    // Initialize i18n and UI basics early
    updateLanguageUI();
    updateConfirmationHints();
    updateLangButtons();

    // Hide the native white/logo splash screen as our app's fancy splash is now rendered
    try {
      await SplashScreen.hide();
    } catch (e) {
      console.warn('SplashScreen hide failed', e);
    }

    // Initialize Crashlytics
    FirebaseCrashlytics.setEnabled({ enabled: true }).catch(() => {});

    // Check for updates - Wait for it to complete
    const isUpdateRequired = await checkAppVersion();

    // Log app open
    analyticsManager.logCustomEvent(analyticsManager.Events.APP_OPEN);

    if (isUpdateRequired) {
      console.log('[Main] App update required. Stopping initialization.');
      return;
    }

    // Ask for notification permission early, before the user starts playing
    requestNotificationPermission();

    // Configure Status Bar — let the OS handle text contrast automatically
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Default }).catch((e) =>
        console.warn('StatusBar not available', e),
      );
      StatusBar.setOverlaysWebView({ overlay: false }).catch((e) =>
        console.warn('StatusBar not available', e),
      );
    }

    // UI Handlers

    document.getElementById('pass-level-btn').addEventListener('click', () => {
      document.getElementById('pass-level-btn').classList.add('hidden');
      handleLevelComplete();
    });
    document.getElementById('play-again-btn').addEventListener('click', () => {
      const btn = document.getElementById('play-again-btn');
      if (btn.dataset.action === 'retry') {
        // The life was already consumed when the loss happened (showGameOver)
        analyticsManager.logCustomEvent(analyticsManager.Events.LEVEL_RETRY, {
          [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
        });
        document.getElementById('game-over').classList.add('hidden');
        showLevelPreStartScreen(currentLevelIndex);
      } else if (btn.dataset.action === 'next') {
        initGame();
      } else {
        returnToMainMenu();
      }
    });
    document.getElementById('reward-continue-btn').addEventListener('click', () => {
      const screen = document.getElementById('reward-ready-screen');
      const shouldRevive = screen.dataset.revive === 'true';
      screen.dataset.revive = 'false';
      screen.classList.add('hidden');
      if (shouldRevive) initGame(true);
    });

    // Language button listeners
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        setLanguage(lang);
        analyticsManager.setUserProperty('language', lang);
        updateLangButtons();
        // Re-render dynamic elements if needed
        if (!document.getElementById('quests-screen').classList.contains('hidden')) renderQuests();
        if (!document.getElementById('shop-screen').classList.contains('hidden')) {
          const activeTab = document.querySelector('.shop-tab.active');
          renderShopItems(activeTab ? activeTab.dataset.tab : 'boosters');
        }
        if (!document.getElementById('biome-map-screen').classList.contains('hidden'))
          showLevelSelect();

        // Update gameplay difficulty tag if playing
        const diffEl = document.getElementById('header-difficulty-tag');
        if (diffEl && !diffEl.classList.contains('hidden')) {
          const levelData = getCurrentLevelConfig();
          if (levelData) diffEl.innerText = t(`diff_${levelData.difficulty}`);
        }

        updateConfirmationHints();
      });
    });

    function updateLangButtons() {
      const current = getLanguage();
      document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === current);
      });
    }

    document.getElementById('login-btn').addEventListener('click', handleLogin);
    // User Settings overlay handlers
    document.getElementById('close-user-settings-btn').addEventListener('click', () => {
      document.getElementById('user-settings-screen').classList.add('hidden');
    });
    document.getElementById('user-settings-rename-btn').addEventListener('click', () => {
      document.getElementById('user-settings-screen').classList.add('hidden');
      changeName();
    });
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
      if (isTutorialActive()) return; // Block during tutorial
      abandonLevel();
    });
    const onShopClick = () => {
      if (isTutorialActive()) return;
      const isMapScreen = !document.getElementById('biome-map-screen').classList.contains('hidden');
      const isGameOver = !document.getElementById('game-over').classList.contains('hidden');
      const isWinScreen = !document.getElementById('win-screen').classList.contains('hidden');

      // If actively playing a level (not in map, not in game over, not in win screen)
      if (!isMapScreen && !isGameOver && !isWinScreen) {
        document.getElementById('shop-confirm-screen').classList.remove('hidden');
      } else {
        analyticsManager.logCustomEvent(analyticsManager.Events.SHOP_OPENED, { source: 'header' });
        openShop();
      }
    };

    document.getElementById('app-header-shop-btn')?.addEventListener('click', onShopClick);
    document.getElementById('header-shop-btn').addEventListener('click', onShopClick);

    // Shop Quit Level Confirmation Handlers
    document.getElementById('shop-stay-level-btn').addEventListener('click', () => {
      document.getElementById('shop-confirm-screen').classList.add('hidden');
    });
    document.getElementById('shop-quit-level-btn').addEventListener('click', () => {
      document.getElementById('shop-confirm-screen').classList.add('hidden');
      abandonLevel();
      analyticsManager.logCustomEvent(analyticsManager.Events.SHOP_OPENED, {
        source: 'quit_level',
      });
      openShop();
    });
    document.getElementById('celebration-continue-btn').addEventListener('click', () => {
      document.getElementById('clear-celebration').classList.add('hidden');
      document.getElementById('confetti-container').innerHTML = '';
      if (currentMode === 'adventure') {
        handleLevelComplete();
      } else {
        showGameOver(false);
      }
    });
    document.getElementById('exit-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-screen').classList.add('hidden');
    });

    // Settings Handlers (header button)
    document.getElementById('settings-btn').addEventListener('click', () => {
      if (isTutorialActive()) return; // Block during tutorial
      document.getElementById('settings-screen').classList.remove('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-screen').classList.add('hidden');
    });

    // Tap outside settings to close
    document.getElementById('settings-screen').addEventListener('click', (e) => {
      if (e.target.id === 'settings-screen') {
        document.getElementById('settings-screen').classList.add('hidden');
      }
    });

    // Overlay settings/leaderboard buttons (multiple across screens)
    document.querySelectorAll('.overlay-settings-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('settings-screen').classList.remove('hidden');
      });
    });
    document.querySelectorAll('.overlay-shop-btn').forEach((btn) => {
      btn.addEventListener('click', onShopClick);
    });

    const prestartScreen = document.getElementById('level-prestart-screen');
    document.getElementById('prestart-close-btn').addEventListener('click', () => {
      prestartScreen.classList.add('hidden');
    });
    document.getElementById('prestart-ad-buff-btn').addEventListener('click', () => {
      if (prestartAdsThisTry >= 2) {
        const btn = document.getElementById('prestart-ad-buff-btn');
        const originalText = btn.innerText;
        btn.innerText = t('limit_reached', { cur: 2, max: 2 });
        if (isAudioEnabled) playErrorSound();
        setTimeout(() => (btn.innerText = originalText), 2000);
        return;
      }
      // The counter increments in the onRewarded handler, once the reward is actually earned
      showRewardedAd('prestart_buff');
    });

    // Level selector listeners (these create the modal on pass level / retries)
    // `initGame` naturally progresses without map intervention unless menu is hit.

    // Initialize settings UI
    document.getElementById('audio-toggle').checked = isAudioEnabled;
    document.getElementById('colorblind-toggle').checked = isColorblindEnabled;
    if (isColorblindEnabled) document.body.classList.add('color-blind-mode');

    document.getElementById('audio-toggle').addEventListener('change', (e) => {
      isAudioEnabled = e.target.checked;
      localStorage.setItem('bolitasAudioEnabled', isAudioEnabled);
      if (isAudioEnabled) {
        if (currentMode && document.getElementById('login-screen').classList.contains('hidden')) {
          bgmAudio.play().catch(() => console.log('Autoplay prevented'));
        }
      } else {
        bgmAudio.pause();
      }
    });
    document.getElementById('colorblind-toggle').addEventListener('change', (e) => {
      isColorblindEnabled = e.target.checked;
      localStorage.setItem('bolitasColorblindEnabled', isColorblindEnabled);
      if (isColorblindEnabled) {
        document.body.classList.add('color-blind-mode');
      } else {
        document.body.classList.remove('color-blind-mode');
      }

      // Refresh shop UI if open
      if (!document.getElementById('shop-screen').classList.contains('hidden')) {
        renderShopItems('boosters');
      }
    });

    // Force dark mode (always on)
    document.body.classList.add('dark-theme');

    // Exit Confirmation Screen Handlers
    document.getElementById('exit-save-close-btn').addEventListener('click', () => {
      // Assuming economy state is already auto-saved by most actions,
      // we just ensure a final exit call.
      App.exitApp();
    });
    document.getElementById('exit-stay-btn').addEventListener('click', () => {
      document.getElementById('exit-confirm-screen').classList.add('hidden');
    });

    function updateConfirmationHints() {
      const params = {
        go_icon: '✅',
        go_text: t('shop_go'),
        stay_icon: '❌',
        stay_text: t('shop_stay'),
      };
      const hintText = t('shop_hint', params);

      const shopHint = document.getElementById('shop-confirm-hint');
      if (shopHint) shopHint.innerText = hintText;
    }

    // Android Back Button Logic
    let lastBackPress = 0;
    App.addListener('backButton', () => {
      const now = Date.now();

      // Check if any overlay is open and prioritize closing it
      const activeOverlays = Array.from(document.querySelectorAll('.overlay:not(.hidden)'));
      if (activeOverlays.length > 0) {
        // If the exit confirm screen is already open, just stay (or close the modal)
        if (!document.getElementById('exit-confirm-screen').classList.contains('hidden')) {
          document.getElementById('exit-confirm-screen').classList.add('hidden');
          return;
        }
        // Top-most = highest real z-index, not last in DOM order
        const topOverlay = activeOverlays.sort(
          (a, b) =>
            (parseInt(getComputedStyle(b).zIndex) || 0) -
            (parseInt(getComputedStyle(a).zIndex) || 0),
        )[0];
        // Game-over and win-screen sit on top of the game grid — closing them would
        // reveal a non-interactive completed/lost level. Go to map instead.
        if (topOverlay.id === 'game-over') {
          // Life already consumed at loss time — just leave
          returnToMainMenu();
          return;
        }
        if (topOverlay.id === 'win-screen') {
          returnToMainMenu();
          return;
        }
        // Otherwise, close the top-most overlay (basic stack logic)
        topOverlay.classList.add('hidden');
        // Shop and quests hide the biome map when opened — restore it on back
        if (topOverlay.id === 'shop-screen' || topOverlay.id === 'quests-screen') {
          document.getElementById('biome-map-screen').classList.remove('hidden');
          syncFooterTabs('map');
          scrollToCurrentBiome();
        }
        return;
      }

      // Double tap within 2 seconds to show the exit confirm screen
      if (now - lastBackPress < 2000) {
        document.getElementById('exit-confirm-screen').classList.remove('hidden');
        lastBackPress = 0; // Reset
      } else {
        lastBackPress = now;
        // Optional: show a small toast or message say "Press again to exit"
        // console.log('Press back again to exit');
      }
    });

    // Footer tab listeners
    document.getElementById('footer-tab-map').addEventListener('click', () => {
      document.getElementById('quests-screen').classList.add('hidden');
      document.getElementById('shop-screen').classList.add('hidden');
      document.getElementById('biome-map-screen').classList.remove('hidden');
      syncFooterTabs('map');
      scrollToCurrentBiome();
    });

    document.getElementById('footer-tab-quests').addEventListener('click', () => {
      openQuests();
    });

    document.getElementById('footer-tab-shop').addEventListener('click', () => {
      analyticsManager.logCustomEvent(analyticsManager.Events.SHOP_OPENED, { source: 'footer' });
      openShop();
    });

    document.getElementById('revive-btn').addEventListener('click', () => showRewardedAd());
    const pityBtn = document.getElementById('pity-revive-btn');
    if (pityBtn) {
      pityBtn.addEventListener('click', () => showPityRewardAd());
    }

    document
      .getElementById('out-of-lives-watch-ad-btn')
      .addEventListener('click', () => showRewardedAd('get_life'));
    document.getElementById('out-of-lives-close-btn').addEventListener('click', () => {
      window._pendingLevelIndex = undefined;
      document.getElementById('out-of-lives-screen').classList.add('hidden');
      returnToMainMenu();
    });
    document.getElementById('header-lives-map').addEventListener('click', () => {
      window._pendingLevelIndex = undefined; // Not starting a level from here
      const titleEl = document.getElementById('out-of-lives-title');
      if (titleEl)
        titleEl.innerText = getLives() <= 0 ? t('out_of_lives_title') : t('lives_info_title');
      document.getElementById('out-of-lives-screen').classList.remove('hidden');
    });

    // x2 Coins rewarded ad button on win screen
    document.getElementById('win-x2-btn').addEventListener('click', () => {
      if (window._winCoinsEarned > 0) {
        showRewardedAd('double_coins', window._winCoinsEarned);
      }
    });

    // --- New Economy UI Handlers ---

    // Set the localized hint for shop confirmation
    const shopHintEl = document.getElementById('shop-confirm-hint');
    if (shopHintEl) {
      shopHintEl.innerText = t('shop_hint', {
        go_icon: '✅',
        go_text: t('shop_go'),
        stay_icon: '❌',
        stay_text: t('shop_stay'),
      });
    }

    // x2 Coins rewarded ad button on win screen
    document.getElementById('win-continue-btn').addEventListener('click', async () => {
      document.getElementById('win-screen').classList.add('hidden');

      // Centralized interstitial policy:
      // Show every 10 levels OR if 7 minutes passed
      const globalLevel = (parseInt(localStorage.getItem('bolitasLevel')) || 0) + 1;
      const now = Date.now();
      const timeDiff = now - lastAdTimestamp;

      const shouldByLevel = globalLevel >= 10 && globalLevel % 10 === 0;
      const shouldByTime = timeDiff > 420000;

      if (shouldByLevel || shouldByTime) {
        console.log(`Ad triggered by ${shouldByLevel ? 'level' : 'time'}. Showing interstitial.`);
        await showInterstitialAd();
      }

      // Go back to level select — only animate unlock if this was a first-time completion
      const justUnlocked = window._justUnlockedLevel ?? null;
      window._justUnlockedLevel = null; // consume so replays never re-trigger
      showLevelSelect(justUnlocked);
    });
    // Init shop module
    initShop({ updateHeaderCoins, showRewardedAd });
    initDailySpin({ onCoinsUpdate: updateHeaderCoins, showRewardedAd });

    // Powerup buttons
    document.querySelectorAll('.powerup-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        handlePowerupClick(btn.dataset.booster);
      });
    });

    // Update header coins
    updateHeaderCoins();
    renderActiveStreakBadge();

    // Lives system: restore any pending lives and keep UI in sync
    checkAndRefill();
    updateLivesUI();
    setInterval(() => {
      checkAndRefill();
      updateLivesUI();
    }, 1000);

    checkExistingSession();
    // AdMob is native-only: its web stub always reports consent as REQUIRED,
    // which would lock the web build behind the consent screen
    if (Capacitor.isNativePlatform()) {
      initAdMob()
        .then(() => {
          // Show banner after a small delay to ensure native view is ready
          setTimeout(() => {
            showBannerAd().catch((e) => console.warn('Banner delayed init failed', e));
          }, 2000);
        })
        .catch((e) => console.error('initAdMob failed:', e));
    }

    // Consent Required Screen Handlers
    document.getElementById('retry-consent-btn').addEventListener('click', async () => {
      await AdMob.showConsentForm();
      await handleConsentFlow();
    });
    document.getElementById('exit-app-btn').addEventListener('click', () => {
      App.exitApp();
    });
    // End of initialization: hide splash screen after a short delay
    setTimeout(hideSplashScreen, 3000);
  } catch (err) {
    console.error('CRITICAL: App initialization failed:', err);
    hideSplashScreen(); // Ensure it disappears even on error
  }
});

function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    // Remove from DOM after fade animation to free resources
    setTimeout(() => splash.remove(), 800);
  }
}

async function handleConsentFlow() {
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

async function initAdMob() {
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

      if (type === 'swap_quest') {
        if (swapQuest(data)) {
          if (isAudioEnabled) playCoinSound();
          renderQuests();
        }
      } else if (type === 'daily_spin_respin') {
        // Delegate to the dailySpin module's respin reward handler
        if (window._dailySpinOnRespinAdRewarded) window._dailySpinOnRespinAdRewarded();
        if (isAudioEnabled) playCoinSound();
      } else if (type === 'swap_weekly_quest') {
        if (swapWeeklyQuest(data)) {
          if (isAudioEnabled) playCoinSound();
          renderQuests();
        }
      } else if (type === 'double_coins') {
        const extraCoins = data || 0;
        if (extraCoins > 0) {
          addCoins(extraCoins);
          window._winCoinsEarned = (window._winCoinsEarned || 0) + extraCoins;
          document.getElementById('win-coins').innerText = `+${window._winCoinsEarned}`;
          updateHeaderCoins();

          if (isAudioEnabled) playCoinSound();
          const headerCoins = document.getElementById('header-coin-count');
          headerCoins.classList.remove('reward-pulse');
          void headerCoins.offsetWidth;
          headerCoins.classList.add('reward-pulse');
        }
        document.getElementById('win-x2-btn').classList.add('hidden');
        document.getElementById('reward-ready-screen').classList.remove('hidden');
      } else if (type === 'get_xp') {
        const xpToGain = getXPForNextLevel();
        const res = addXP(xpToGain);
        updateMenuPlayerLevel();

        // Show confirmation
        const textEl = document.getElementById('reward-ready-text');
        textEl.innerHTML = `${t('bonus_xp_earned')}<br>✨ +${xpToGain} XP`;
        document.getElementById('reward-ready-screen').classList.remove('hidden');

        analyticsManager.logCustomEvent(analyticsManager.Events.XP_REWARD_CLAIMED, {
          amount: xpToGain,
          level: res.newLevel,
        });
        analyticsManager.setUserProperty('player_level', res.newLevel);
      } else if (type === 'pity_revive') {
        addBoosterFree('color_bomb', 1);
        applyReviveReward(true);
      } else if (type === 'shop_coins') {
        const rewardAmount = 100;
        addCoins(rewardAmount);
        registerCoinAdWatched();
        updateHeaderCoins();
        const shopCoinEl = document.getElementById('shop-coin-count');
        if (shopCoinEl) shopCoinEl.innerText = getCoins();

        if (isAudioEnabled) playCoinSound();
        const textEl = document.getElementById('reward-ready-text');
        textEl.innerHTML = `🪙 +${rewardAmount}`;
        document.getElementById('reward-ready-screen').classList.remove('hidden');

        analyticsManager.logCustomEvent(analyticsManager.Events.COIN_REWARD_CLAIMED, {
          amount: rewardAmount,
        });
        analyticsManager.setUserProperty('total_coins', getCoins());
      } else if (type === 'prestart_buff') {
        // Count against the 2-per-try limit only when the reward was actually earned
        prestartAdsThisTry++;
        // Grant a random unlocked booster (not shuffle, preferring more impactful ones)
        const buffBoosters = SHOP_BOOSTERS.filter((b) => b.id !== 'shuffle');
        const chosen = buffBoosters[Math.floor(Math.random() * buffBoosters.length)];
        addBoosterFree(chosen.id, 1);
        if (isAudioEnabled) playCoinSound();
        const textEl = document.getElementById('reward-ready-text');
        const boosterName = t(`booster_${chosen.id}_name`);
        textEl.innerHTML = `${chosen.icon} +1 ${boosterName}!`;
        document.getElementById('reward-ready-screen').classList.remove('hidden');

        analyticsManager.logCustomEvent(analyticsManager.Events.PRESTART_BUFF_CLAIMED, {
          booster: chosen.id,
        });
      } else if (type === 'revive') {
        applyReviveReward();
      } else if (type === 'get_life') {
        addLife(1);
        updateLivesUI();
        scheduleLivesNotification();
        document.getElementById('out-of-lives-screen').classList.add('hidden');

        // If they were trying to start a level, bring them back to the pre-start screen
        if (window._pendingLevelIndex !== undefined) {
          showLevelPreStartScreen(window._pendingLevelIndex);
          window._pendingLevelIndex = undefined;
        }
      }

      lastAdTimestamp = Date.now();
      _rewardActionType = null;
      _rewardActionData = null;
    };
    const hideLoading = () => {
      console.log('Hiding ad loading screen');
      isAdLoading = false; // Reset global flag
      document.getElementById('ad-loading-screen').classList.add('hidden');
      if (adLoadingTimeout) {
        clearTimeout(adLoadingTimeout);
        adLoadingTimeout = null;
      }
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
    const options = {
      adId: 'ca-app-pub-3539090903954344/2163380169',
      isTesting: false,
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
    };
    await AdMob.prepareInterstitial(options);
  } catch (err) {
    console.error('Prepare Interstitial Error', err);
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
      [analyticsManager.Params.AD_TYPE]: 'interstitial',
      error_code: err?.message ?? 'unknown',
    });
  }
}

// Global ad readiness tracker
window._rewardedAdsReady = {
  revive: false,
  shop_coins: false,
  pity_revive: false,
};

async function prepareRewarded(type = 'revive') {
  try {
    let adId = 'ca-app-pub-3539090903954344/5831162433'; // Default revive
    if (type === 'shop_coins') adId = 'ca-app-pub-3539090903954344/7787144841';
    else if (type === 'pity_revive') adId = 'ca-app-pub-3539090903954344/8952150762';

    const options = {
      adId: adId,
      isTesting: false,
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
    };
    await AdMob.prepareRewardVideoAd(options);
    window._rewardedAdsReady[type] = true;
    console.log(`[AdMob] Preloaded rewarded ad: ${type}`);
  } catch (err) {
    window._rewardedAdsReady[type] = false;
    console.error(`Prepare Rewarded Error (${type})`, err);
    analyticsManager.logCustomEvent(analyticsManager.Events.AD_FAILED, {
      [analyticsManager.Params.AD_TYPE]: `rewarded_${type}`,
      error_code: err?.message ?? 'unknown',
    });
  }
}

let adLoadingTimeout = null;

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

async function showPityRewardAd() {
  showRewardedAd('pity_revive');
}

let _rewardActionType = null;
let _rewardActionData = null;

async function showRewardedAd(type = 'revive', data = null) {
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

    let selectedAdId = 'ca-app-pub-3539090903954344/5831162433'; // Default revive ID
    if (type === 'shop_coins') {
      selectedAdId = 'ca-app-pub-3539090903954344/7787144841'; // Shop Coins ID
    } else if (type === 'pity_revive') {
      selectedAdId = 'ca-app-pub-3539090903954344/8952150762'; // Pity Lose ID
    }

    const options = {
      adId: selectedAdId,
      isTesting: false,
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
    };

    // Map type to the readiness key (multiple types share the same ad unit)
    const readinessKey =
      type === 'shop_coins' ? 'shop_coins' : type === 'pity_revive' ? 'pity_revive' : 'revive';

    // Optimization: If NOT already preloaded, call prepare which blocks until ready.
    // If it WAS preloaded, showRewardVideoAd should be instant.
    if (!window._rewardedAdsReady[readinessKey]) {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AD_TIMEOUT')), 10000),
      );
      await Promise.race([AdMob.prepareRewardVideoAd(options), timeoutPromise]);
    }
    // Mark as consumed so a second tap doesn't skip prepare on a spent ad
    window._rewardedAdsReady[readinessKey] = false;

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

// XP Ad Button Listener
document.getElementById('get-xp-ad-btn')?.addEventListener('click', () => {
  showRewardedAd('get_xp');
});

async function showBannerAd() {
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
      isTesting: false,
      tagForChildDirectedTreatment: true,
      maxAdContentRating: 'G',
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

function applyReviveReward(isPity = false) {
  // Hide Game Over
  document.getElementById('game-over').classList.add('hidden');
  hasUsedRevive = true;

  // Re-show banner (it may have been dismissed during ad playback)
  showBannerAd();

  // Show confirmation screen before resuming — flag it so Continuar calls initGame(true)
  const screen = document.getElementById('reward-ready-screen');
  const textEl = document.getElementById('reward-ready-text');
  textEl.innerHTML = isPity ? t('pity_revive_confirmation') : t('revive_confirmation');
  screen.dataset.revive = 'true'; // signal the continue button to resume the game
  screen.classList.remove('hidden');
}

async function shuffleBoard() {
  if (isAnimating) return;
  isAnimating = true;

  const bolitas = [];
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] && grid[r][c].el) {
        bolitas.push(grid[r][c]);
      }
    }
  }

  // Phase 1: Animate OUT
  bolitas.forEach((bol) => bol.el.classList.add('shuffling-out'));

  // Wait for out animation (CSS is 0.4s)
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Extract colors
  const flatItems = bolitas.map((bol) => bol.color);

  // Clear grid vertically
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] && grid[r][c].el && grid[r][c].el.parentNode) {
        grid[r][c].el.parentNode.removeChild(grid[r][c].el);
      }
      grid[r][c] = null;
    }
  }

  // Shuffle colors
  for (let i = flatItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flatItems[i], flatItems[j]] = [flatItems[j], flatItems[i]];
  }

  clearGridElements();
  elementPositionMap = new WeakMap();

  // Phase 2: Animate IN
  let index = 0;
  const newBolitas = [];
  for (let c = 0; c < currentCols; c++) {
    for (let r = currentRows - 1; r >= 0; r--) {
      if (index < flatItems.length) {
        createBolita(r, c, flatItems[index]);
        const newBol = grid[r][c];
        if (newBol && newBol.el) {
          newBol.el.classList.add('shuffling-in');
          newBolitas.push(newBol.el);
        }
        index++;
      }
    }
  }

  // Apply gravity/shift just in case of holes
  settleBoard();

  // Wait for in animation (CSS is 0.5s)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Phase 3: Cleanup
  newBolitas.forEach((el) => el.classList.remove('shuffling-in'));
  isAnimating = false;

  if (!hasValidMove(grid)) {
    // If still stuck, shuffle again (recursive but safe due to await)
    await shuffleBoard();
  }
}

function checkExistingSession() {
  const savedUser = localStorage.getItem('bolitasUser');
  currentLevelIndex = parseInt(localStorage.getItem('bolitasLevel')) || 0;

  // Update level display in map header if it exists
  const levelEl = document.getElementById('app-header-level');
  if (levelEl) levelEl.innerText = t('level_display', { val: currentLevelIndex + 1 });

  if (savedUser) {
    currentUser = savedUser;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('biome-map-screen').classList.remove('hidden');
    showLevelSelect();
    updateMapHeader();
    updateMenuPlayerLevel();
  } else {
    // New user: show login form
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('biome-map-screen').classList.add('hidden');
  }
}

function handleLogin() {
  const input = document.getElementById('username-input');
  const alias = input.value.trim();
  const errorMsg = document.getElementById('login-error');

  if (alias.length < 3) {
    errorMsg.innerText = `❌ ${t('min_chars')}`;
    errorMsg.classList.remove('hidden');
    return;
  }

  errorMsg.classList.add('hidden');
  currentUser = alias;
  localStorage.setItem('bolitasUser', alias);

  // Set Crashlytics user context (hashed — no PII sent)
  const _hashedAlias = btoa(alias).substring(0, 16);
  FirebaseCrashlytics.setUserId({ userId: _hashedAlias }).catch(() => {});
  FirebaseCrashlytics.setCustomKey({ key: 'username_hash', value: _hashedAlias }).catch(() => {});

  // Snapshot user properties at login
  analyticsManager.setUserProperty('language', getLanguage());
  const _savedMax = localStorage.getItem('bolitasLevel');
  if (_savedMax) analyticsManager.setUserProperty('highest_level', _savedMax);
  const _savedTotal = localStorage.getItem('bolitasTotalLevelsCompleted');
  if (_savedTotal) analyticsManager.setUserProperty('total_levels_completed', _savedTotal);

  // Safety: abort any potentially stuck tutorials
  abortActiveTutorial();

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('biome-map-screen').classList.remove('hidden');
  showLevelSelect();
  updateMapHeader();
  updateMenuPlayerLevel();
}

function changeName() {
  document.getElementById('username-input').value = currentUser || '';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('biome-map-screen').classList.add('hidden');
}

// --- Local Notifications (Retention) ---
// Built at schedule time (not module load) so they use the player's current language
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
async function requestNotificationPermission() {
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

async function setupInactivityNotifications() {
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
async function scheduleLivesNotification(batch = null) {
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

// Global Game Over Menu Button Listener
// The life was already consumed when the loss happened (showGameOver)
document.getElementById('game-over-menu-btn').addEventListener('click', () => {
  returnToMainMenu();
});
// ---------------------------------------

// Called when the player leaves a level mid-game (not via a natural win/lose flow)
function abandonLevel() {
  if (currentMode === 'adventure') {
    useLife();
    updateLivesUI();
    scheduleLivesNotification();
  }
  returnToMainMenu();
}

function returnToMainMenu() {
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('win-screen')?.classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('level-prestart-screen')?.classList.add('hidden');
  document.getElementById('biome-map-screen').classList.remove('hidden');
  document.querySelector('.game-area').classList.add('hidden');
  document.querySelector('#game-container > header')?.classList.add('hidden');
  document.getElementById('powerups-bar').classList.add('hidden');
  document.getElementById('powerups-bar').style.visibility = '';
  const passCont = document.getElementById('pass-level-container');
  passCont.classList.add('hidden');
  passCont.style.visibility = '';
  document.querySelector('.app-footer')?.classList.remove('hidden');
  clearInterval(timerInterval);
  bgmAudio.pause();
  showLevelSelect();
  updateMapHeader();
  updateHeaderCoins();
  updateMenuPlayerLevel();
  updateFooterQuestsGlow();
  renderActiveStreakBadge();
}

function initGame(isRevive = false, rerollAttempt = 0) {
  if (!isRevive) {
    analyticsManager.logCustomEvent(analyticsManager.Events.LEVEL_START, {
      [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
      [analyticsManager.Params.BIOME_NAME]: getBiomeNameForLevel(currentLevelIndex + 1),
    });
    // Keep Crashlytics informed of current level for crash context
    FirebaseCrashlytics.setCustomKey({
      key: 'current_level',
      value: String(currentLevelIndex + 1),
    }).catch(() => {});
    FirebaseCrashlytics.setCustomKey({
      key: 'current_biome',
      value: getBiomeNameForLevel(currentLevelIndex + 1),
    }).catch(() => {});
  }

  document.querySelector('.app-footer')?.classList.add('hidden');
  document.querySelector('#game-container > header')?.classList.remove('hidden');
  document.getElementById('game-over')?.classList.add('hidden');
  document.getElementById('pass-level-btn')?.classList.add('hidden');
  document.getElementById('win-quests-area')?.classList.add('hidden');
  // showBannerAd() moved to boot flow to prevent AdMob race condition crash

  // Ensure game components are visible
  document.querySelector('.game-area').classList.remove('hidden');
  const passCont = document.getElementById('pass-level-container');
  passCont.classList.remove('hidden');
  passCont.style.visibility = 'hidden';
  document.getElementById('powerups-bar').classList.remove('hidden');
  document.getElementById('powerups-bar').style.visibility = '';

  clearGridElements();
  elementPositionMap = new WeakMap(); // Clear position mapping for new game
  activePowerup = null;
  if (!isRevive) {
    boostersUsedInLevel = {};
  }
  renderPowerups();

  if (!isRevive) {
    score = 0;
    comboMultiplier = 1;
    comboLevel = 0;
    lastPopTime = 0;
    _lastStarCount = 0;
    hasUsedRevive = false;
    levelCompleted = false;
    boardClearThisLevel = false;
    window._levelCompleteHandled = false;
    shownQuestToasts = new Set();
    hideComboBadge();

    // Reset inactivity notifications timer
    setupInactivityNotifications();
  }

  updateScore(0);
  isAnimating = false;
  selectedGroup = [];
  hintedElements = [];
  clearInterval(timerInterval);

  // Configure grid based on mode — only adventure mode
  const level = getCurrentLevelConfig();
  currentRows = level.rows;
  currentCols = level.cols;
  currentColors = level.colors;

  // Update difficulty tag in header
  const diffEl = document.getElementById('header-difficulty-tag');
  if (diffEl) {
    diffEl.innerText = t(`diff_${level.difficulty}`).toUpperCase();
    diffEl.className = `header-diff-tag diff-text-${level.difficulty}`;
    diffEl.classList.remove('hidden');
  }

  // Apply biome background color
  const { block } = getBlockForLevel(currentLevelIndex + 1);
  if (block && block.themeColors && block.themeColors.length > 0) {
    const gradient = `linear-gradient(180deg, ${block.themeColors.join(', ')})`;
    document.getElementById('game-container').style.background = gradient;
  }

  currentColorSet = COLORS;
  if (uiHeaderMode)
    uiHeaderMode.innerText = `${t('level_display', { val: currentLevelIndex + 1 })}`;
  document.getElementById('header-shop-btn')?.classList.remove('hidden');
  // Booster container removed in UI refactor

  // Set CSS variables
  document.documentElement.style.setProperty('--rows', currentRows);
  document.documentElement.style.setProperty('--cols', currentCols);

  // Set aspect ratio based on dimension
  uiGrid.style.aspectRatio = `${currentCols} / ${currentRows}`;
  requestAnimationFrame(sizeGrid);

  grid = Array.from({ length: currentRows }, () => new Array(currentCols).fill(null));

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      const color = pickSpawnColor(grid, r, c, currentColorSet.slice(0, currentColors));
      createBolita(r, c, color);
    }
  }

  // Ensure at least 3 valid groups are available at start (capped so a pathological
  // config can never recurse forever — after 20 tries we accept the board as-is)
  if (findValidGroups(grid, 3).length < 3 && rerollAttempt < 20) {
    initGame(isRevive, rerollAttempt + 1);
  } else {
    resetHintTimer();
    // Check for booster tutorial after board is ready
    if (currentMode === 'adventure' && !isRevive) {
      setTimeout(() => {
        checkBoosterTutorial(currentLevelIndex + 1, {
          updateHeaderCoins,
          renderShopItems,
          setTutorialActive,
          renderPowerups,
        });
      }, 500);
    }
  }
}

// Remove every piece from the grid but keep the selection outline SVG that lives inside it
function clearGridElements() {
  const outline = document.getElementById('selection-outline');
  uiGrid.replaceChildren(...(outline ? [outline] : []));
}

function sizeGrid() {
  const gameArea = document.querySelector('.game-area');
  if (!gameArea || !uiGrid || !currentCols || !currentRows) return;

  const container = document.getElementById('game-container');
  const header = document.querySelector('#game-container header');
  const powerupsBar = document.getElementById('powerups-bar');
  if (!container) return;

  // Measure from stable fixed elements — avoids reading gameArea.clientHeight
  // which causes a circular ResizeObserver loop via the maxHeight we set at the end.
  const containerCS = getComputedStyle(container);
  const containerPadY = parseFloat(containerCS.paddingTop) + parseFloat(containerCS.paddingBottom);

  const gaCS = getComputedStyle(gameArea);
  const padX = parseFloat(gaCS.paddingLeft) + parseFloat(gaCS.paddingRight);
  const padY = parseFloat(gaCS.paddingTop) + parseFloat(gaCS.paddingBottom);

  const barVisible = powerupsBar && !powerupsBar.classList.contains('hidden');
  const barH = barVisible
    ? powerupsBar.offsetHeight + parseFloat(getComputedStyle(powerupsBar).marginTop || '0')
    : 0;

  const availW = container.clientWidth - padX;
  const availH =
    container.clientHeight - containerPadY - (header ? header.offsetHeight : 0) - barH - padY;

  if (availW <= 0 || availH <= 0) return;

  const w = Math.min(availW, (availH * currentCols) / currentRows);
  const h = Math.min(availH, (w * currentRows) / currentCols);
  uiGrid.style.width = Math.floor(w) + 'px';
  uiGrid.style.height = Math.floor(h) + 'px';

  // Constrain game-area height to remove dead vertical space on tall screens.
  // Safe because availH is computed from container (stable), not from gameArea itself.
  gameArea.style.maxHeight = Math.ceil(h) + padY + 'px';
}

function createBolita(r, c, color) {
  const el = document.createElement('div');
  el.className = 'bolita';

  el.dataset.color = color;
  el.dataset.row = r;
  el.dataset.col = c;
  el.style.setProperty('--row', r);
  el.style.setProperty('--col', c);

  el.addEventListener('click', () => handleBolitaClick(r, c, el));

  uiGrid.appendChild(el);

  const bolitaObj = {
    color,
    el,
    r,
    c,
  };
  grid[r][c] = bolitaObj;
  elementPositionMap.set(el, bolitaObj);
}

async function handleBolitaClick(startR, startC, el) {
  if (isAnimating) return;

  // Find current position in grid as it might have moved
  const currentPos = findBolitaByElement(el);
  if (!currentPos) return;

  // SOURCE OF TRUTH: Use dataset if available to match visual state perfectly
  let r = currentPos.r;
  let c = currentPos.c;
  if (el.dataset.row !== undefined && el.dataset.col !== undefined) {
    r = parseInt(el.dataset.row);
    c = parseInt(el.dataset.col);
  }

  if (activePowerup) {
    if (activePowerup === 'bomb') {
      activateBombAt(r, c);
      return;
    } else if (activePowerup === 'color_bomb') {
      activateColorBomb(grid[r][c].color);
      return;
    } else if (activePowerup === 'sniper') {
      activateSniper(r, c);
      return;
    } else if (activePowerup === 'magic_brush') {
      showMagicBrushPicker(r, c, el);
      return;
    }
  }

  // Check if it's already selected
  const isAlreadySelected = selectedGroup.some((b) => b.r === r && b.c === c);

  if (isAlreadySelected) {
    // Proceed to pop
    isAnimating = true;
    clearHint();
    clearTimeout(hintTimeout);

    // Pop animation
    const groupToPop = [...selectedGroup];
    selectedGroup = []; // clear selection
    clearSelectionOutline();
    const currentTime = Date.now();

    // Combo tracking
    clearTimeout(comboTimeout);
    comboLevel = nextComboLevel(comboLevel, lastPopTime > 0 ? currentTime - lastPopTime : null);
    comboMultiplier = COMBO_MULTIPLIERS[comboLevel];
    lastPopTime = currentTime;
    if (comboLevel > 0) {
      showComboBadge(comboMultiplier);
      comboTimeout = setTimeout(breakCombo, COMBO_WINDOW_MS);
    } else {
      hideComboBadge();
    }

    // Play Pop Sound + Haptic feedback on mobile
    if (isAudioEnabled) playPopSound(groupToPop.length);
    if (navigator.vibrate) {
      navigator.vibrate(groupToPop.length >= 8 ? 60 : 30);
    }

    // Screen shake for big pops (10+ bolitas)
    if (groupToPop.length >= 10) {
      uiGrid.classList.add('shake');
      setTimeout(() => uiGrid.classList.remove('shake'), 350);
    }

    // Particles and big-pop text
    spawnPopParticles(groupToPop);
    if (groupToPop.length >= 6) showBigPopText(groupToPop.length);

    groupToPop.forEach((bolita) => {
      bolita.el.classList.remove('selected');
      bolita.el.classList.add('popped');
      grid[bolita.r][bolita.c] = null;
    });

    // Track economy
    const popColor = groupToPop[0]?.color || 'red';
    trackPop(popColor, groupToPop.length);

    // Add Score (with combo multiplier)
    let points = Math.round(calculatePoints(groupToPop.length) * comboMultiplier);
    trackScore(points);
    updateScore(points);
    checkQuestToasts();

    // Spawn floating score visually at the clicked bolita
    spawnFloatingScore(points, comboMultiplier, el);

    // Wait for popping animation to start before moving others
    await new Promise((res) => setTimeout(res, 200));

    settleBoard();

    // Clean up DOM elements
    setTimeout(() => {
      groupToPop.forEach((bolita) => {
        if (bolita.el.parentNode) bolita.el.parentNode.removeChild(bolita.el);
      });
      isAnimating = false;

      // If tutorial is active, fire progress on pop completion
      if (isTutorialActive()) {
        handleTutorialProgress({ onComplete: returnToMainMenu });
        return;
      }

      // Check if the board is completely clear
      if (isBoardClear(grid)) {
        showCelebration();
        setTimeout(handleLevelComplete, 1500);
        return;
      }

      if (!hasValidMove(grid)) {
        const config = getCurrentLevelConfig();
        if (score >= config.target) {
          document.getElementById('pass-level-btn').classList.add('hidden');
          handleLevelComplete();
        } else {
          showGameOver(false);
        }
      } else {
        resetHintTimer();
      }
    }, 400); // 400ms matches CSS transition
  } else {
    // Select new group

    // Clear previous selection visually
    selectedGroup.forEach((b) => {
      if (b.el) b.el.classList.remove('selected');
    });
    selectedGroup = [];
    clearSelectionOutline();

    const group = getGroup(grid, r, c);

    if (group.length >= MIN_GROUP) {
      if (isAudioEnabled) playSelectSound();
      selectedGroup = group;
      selectedGroup.forEach((b) => b.el.classList.add('selected'));
      drawSelectionOutline(selectedGroup);
      // If tutorial is active, advance to 'pop' phase
      if (isTutorialActive()) {
        handleTutorialProgress({
          onComplete: returnToMainMenu,
        });
      }
    } else {
      if (isAudioEnabled) playErrorSound();
    }
    resetHintTimer();
  }
}

function spawnFloatingScore(points, combo, targetEl) {
  const floater = document.createElement('div');
  floater.className = 'floating-score';
  floater.innerText = combo > 1 ? `+${points} x${combo}!` : `+${points}`;

  // Position it where the click happened roughly
  const rect = targetEl.getBoundingClientRect();
  const parentRect = uiGrid.getBoundingClientRect();

  floater.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
  floater.style.top = `${rect.top - parentRect.top}px`;

  uiGrid.appendChild(floater);

  // Clean up
  setTimeout(() => {
    if (floater.parentNode) floater.parentNode.removeChild(floater);
  }, 1000);
}

// ─── COMBO BADGE ────────────────────────────────────────────────────────────

function showComboBadge(multiplier) {
  const badge = document.getElementById('combo-badge');
  if (!badge) return;
  badge.textContent = `COMBO x${multiplier}!`;
  badge.classList.remove('breaking');
  badge.classList.add('visible');
}

function hideComboBadge() {
  const badge = document.getElementById('combo-badge');
  if (!badge) return;
  badge.classList.remove('visible');
  badge.classList.remove('breaking');
}

function breakCombo() {
  if (comboLevel === 0) return;
  comboLevel = 0;
  comboMultiplier = 1;
  lastPopTime = 0;
  const badge = document.getElementById('combo-badge');
  if (!badge) return;
  badge.classList.remove('visible');
  badge.classList.add('breaking');
  setTimeout(() => badge.classList.remove('breaking'), 350);
}

// ─── PARTICLES ───────────────────────────────────────────────────────────────

const COLOR_HEX = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
  green: '#22c55e',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

function spawnPopParticles(group) {
  if (!group.length) return;
  const container = uiGrid;
  const containerRect = container.getBoundingClientRect();
  const count = group.length <= 5 ? 6 : group.length <= 9 ? 12 : 20;
  const color = COLOR_HEX[group[0].color] || '#fff';

  // Find center of the group
  let sumX = 0,
    sumY = 0;
  let validRects = 0;
  group.forEach((b) => {
    if (!b.el) return;
    const r = b.el.getBoundingClientRect();
    sumX += r.left + r.width / 2;
    sumY += r.top + r.height / 2;
    validRects++;
  });
  if (!validRects) return;
  const cx = sumX / validRects - containerRect.left;
  const cy = sumY / validRects - containerRect.top;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'pop-particle';
    const angle = (360 / count) * i + Math.random() * 20;
    const dist = 30 + Math.random() * 50;
    const rad = (angle * Math.PI) / 180;
    const px = Math.round(Math.cos(rad) * dist);
    const py = Math.round(Math.sin(rad) * dist);
    p.style.setProperty('--px', `${px}px`);
    p.style.setProperty('--py', `${py}px`);
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = color;
    const size = group.length >= 10 ? 10 : 7;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.animation = `particleBurst ${0.4 + Math.random() * 0.25}s ease-out forwards`;
    container.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

// ─── BIG POP TEXT ────────────────────────────────────────────────────────────

function showBigPopText(count) {
  const el = document.getElementById('big-pop-text');
  if (!el) return;
  el.textContent = count >= 10 ? t('big_pop_incredible') : t('big_pop_great');
  el.style.color = count >= 10 ? '#f59e0b' : '#22c55e';
  el.classList.remove('show');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('show');
}

// ─── IN-GAME TOAST ───────────────────────────────────────────────────────────

let toastTimeout = null;

function showIngameToast(msg) {
  const el = document.getElementById('ingame-toast');
  if (!el) return;
  clearTimeout(toastTimeout);
  el.textContent = msg;
  el.classList.add('show');
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── QUEST COMPLETION TOASTS ─────────────────────────────────────────────────

function checkQuestToasts() {
  try {
    const quests = getDailyQuests();
    quests.forEach((q) => {
      if (q.isComplete && !q.claimed && !shownQuestToasts.has(q.id)) {
        shownQuestToasts.add(q.id);
        showIngameToast(`✓ ${getQuestDescription(q)} +${q.reward} 🪙`);
      }
    });
  } catch (_) {
    // Quest toasts are cosmetic; never let them break the game loop
  }
}

function findBolitaByElement(el) {
  const obj = elementPositionMap.get(el);
  if (obj) return { r: obj.r, c: obj.c };
  return null;
}

// Apply gravity and column collapse, then move the pieces' elements to match
function settleBoard() {
  for (const { item, r, c } of [...applyGravity(grid), ...collapseEmptyColumns(grid)]) {
    item.r = r;
    item.c = c;
    item.el.dataset.row = r; // Sync for tutorials
    item.el.dataset.col = c;
    item.el.style.setProperty('--row', r);
    item.el.style.setProperty('--col', c);
  }
}

// --- Selection group outline (SVG marching ants) ---
function drawSelectionOutline(group) {
  const svg = document.getElementById('selection-outline');
  svg.innerHTML = '';
  if (!group || group.length === 0) return;

  const gridEl = document.getElementById('grid');
  const cw = gridEl.offsetWidth / currentCols;
  const ch = gridEl.offsetHeight / currentRows;

  const sel = new Set(group.map((b) => `${b.r},${b.c}`));
  let pathData = '';

  for (const b of group) {
    const { r, c } = b;
    const x = c * cw,
      y = r * ch;

    const edges = [
      [!sel.has(`${r - 1},${c}`), x, y, x + cw, y], // top
      [!sel.has(`${r + 1},${c}`), x, y + ch, x + cw, y + ch], // bottom
      [!sel.has(`${r},${c - 1}`), x, y, x, y + ch], // left
      [!sel.has(`${r},${c + 1}`), x + cw, y, x + cw, y + ch], // right
    ];

    for (const [draw, x1, y1, x2, y2] of edges) {
      if (!draw) continue;
      pathData += `M ${x1} ${y1} L ${x2} ${y2} `;
    }
  }

  if (pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }
}

function clearSelectionOutline() {
  const svg = document.getElementById('selection-outline');
  if (svg) svg.innerHTML = '';
}
// -------------------------------------------------------

let _lastStarCount = 0;

function updateStarDisplay() {
  const config = getCurrentLevelConfig();
  if (!config) return;
  const stars = getStarCount(score, config.target);
  const progress = getStarProgress(score, config.target);
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`hud-star-${i}`);
    if (el) el.classList.toggle('filled', i <= stars);
  }
  const fill = document.getElementById('star-bar-fill');
  if (fill) {
    fill.style.width = `${Math.min(progress, 1) * 100}%`;
    const ratio = score / config.target;
    fill.classList.toggle('urgent', ratio >= 0.85 && ratio < 1);
  }
  const scoreText = document.getElementById('hud-score-text');
  if (scoreText) scoreText.innerText = `${score} / ${config.target}`;

  // Toast when crossing a new star threshold
  if (stars > _lastStarCount && stars > 0) {
    showIngameToast(t(`star_toast_${stars}`));
  }
  _lastStarCount = stars;
}

function updateScore(points) {
  score += points;
  updateStarDisplay();
  // Show pass-level button when target is reached
  const config = getCurrentLevelConfig();
  if (score >= config.target) {
    if (!levelCompleted) {
      levelCompleted = true;
    }
    document.getElementById('pass-level-container').style.visibility = 'visible';
  }
}

// updateModeButtons removed — only Career mode exists now

// Hint system: highlight a valid group after inactivity
function resetHintTimer() {
  clearTimeout(hintTimeout);
  clearHint();
  hintTimeout = setTimeout(showHint, HINT_DELAY);
}

function clearHint() {
  for (const el of hintedElements) {
    el.classList.remove('hint');
  }
  hintedElements = [];
}

function showHint() {
  if (isTutorialActive()) return;
  const group = findValidGroup(grid);
  if (!group) return;

  group.forEach(({ r, c }) => {
    if (grid[r][c] && grid[r][c].el) {
      grid[r][c].el.classList.add('hint');
      hintedElements.push(grid[r][c].el);
    }
  });
}

async function showGameOver(isWin = false) {
  if (!isWin) {
    const _failConfig = getCurrentLevelConfig();
    analyticsManager.logCustomEvent(analyticsManager.Events.LEVEL_FAIL, {
      [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
      [analyticsManager.Params.BIOME_NAME]: getBiomeNameForLevel(currentLevelIndex + 1),
      [analyticsManager.Params.DIFFICULTY]: _failConfig?.difficulty || 'unknown',
      [analyticsManager.Params.FAIL_REASON]: 'no_moves',
      [analyticsManager.Params.SCORE_ACHIEVED]: score,
    });
  }

  document.querySelector('.app-footer')?.classList.add('hidden');
  // Clear-board win condition: if board is empty, it's ALWAYS a win
  if (!isWin && isBoardClear(grid)) {
    handleLevelComplete();
    return;
  }

  if (!isWin && isAudioEnabled) playGameOverSound();
  clearInterval(timerInterval);

  // Consume the life at the moment of the loss (not on the Retry/Menu buttons),
  // so force-closing the app on this screen can no longer dodge the cost.
  // After a revive the life was already paid on the first loss of this attempt.
  let livesBefore = getLives();
  if (currentMode === 'adventure' && !isWin && !hasUsedRevive) {
    useLife();
    updateLivesUI();
    scheduleLivesNotification();
  }

  const title = document.querySelector('#game-over h2');
  title.innerText = t('you_lose');

  // Lives countdown animation (adventure mode only)
  const livesWrap = document.getElementById('go-lives-wrap');
  if (livesWrap) {
    if (currentMode === 'adventure' && !isWin) {
      const livesAfter = getLives();
      const beforeEl = document.getElementById('go-lives-before');
      const afterEl = document.getElementById('go-lives-after');
      beforeEl.textContent = livesBefore;
      afterEl.textContent = livesAfter;
      beforeEl.classList.remove('go-fade-out');
      afterEl.classList.remove('go-fade-in');
      livesWrap.classList.remove('hidden');
      setTimeout(() => {
        beforeEl.classList.add('go-fade-out');
        afterEl.classList.add('go-fade-in');
      }, 900);
    } else {
      livesWrap.classList.add('hidden');
    }
  }

  const config = getCurrentLevelConfig();
  document.getElementById('final-score').innerText = score;
  document.getElementById('required-score').innerText = config.target;

  // "Solo un poco más" motivation message
  const motivationEl = document.getElementById('gameover-motivation');
  if (motivationEl && !isWin) {
    const missing = config.target - score;
    const pct = Math.round((score / config.target) * 100);
    if (pct >= 80) {
      motivationEl.textContent = t('go_motivation_close', { pct: 100 - pct });
    } else if (pct >= 50) {
      motivationEl.textContent = t('go_motivation_mid', { missing: missing.toLocaleString() });
    } else {
      motivationEl.textContent = t('go_motivation_far');
    }
    motivationEl.style.display = '';
  } else if (motivationEl) {
    motivationEl.style.display = 'none';
  }

  if (currentMode === 'adventure') {
    document.getElementById('play-again-btn').innerHTML =
      `<svg class="btn-icon"><use href="#icon-retry"></use></svg> ${t('retry')}`;
    document.getElementById('play-again-btn').dataset.action = 'retry';
  } else {
    document.getElementById('play-again-btn').innerHTML =
      `<svg class="btn-icon"><use href="#icon-home"></use></svg> ${t('back_to_menu')}`;
    document.getElementById('play-again-btn').dataset.action = 'menu';
  }

  const reviveBtn = document.getElementById('revive-btn');
  const pityBtn = document.getElementById('pity-revive-btn');
  let fails = parseInt(localStorage.getItem('bolitasLevelFails') || '0');

  if (currentMode === 'adventure' && !isWin) {
    // Increment fails for ad offers
    fails++;
    localStorage.setItem('bolitasLevelFails', fails);
  }

  if (currentMode === 'adventure' && !hasUsedRevive && score > 0) {
    if (fails >= 4) {
      // Show Pity Reward instead of normal revive
      reviveBtn.classList.add('hidden');
      if (pityBtn) {
        pityBtn.innerHTML = `<svg class="btn-icon"><use href="#icon-tv"></use></svg> ${t('pity_revive_btn')}`;
        pityBtn.classList.remove('hidden');
      }
    } else {
      // Normal Revive
      if (pityBtn) pityBtn.classList.add('hidden');
      reviveBtn.innerHTML = `<svg class="btn-icon"><use href="#icon-tv"></use></svg> ${t('revive_ad')}`;
      reviveBtn.classList.remove('hidden');
    }
    prepareRewarded(); // pre-load in background
  } else {
    reviveBtn.classList.add('hidden');
    if (pityBtn) pityBtn.classList.add('hidden');
  }

  document.getElementById('game-over').classList.remove('hidden');
}

function handleLevelComplete() {
  document.querySelector('.app-footer')?.classList.add('hidden');
  // Guard: prevent duplicate calls in the same game session
  if (window._levelCompleteHandled) return;
  window._levelCompleteHandled = true;

  updateActiveStreak();

  if (isAudioEnabled) playWinSound();
  clearInterval(timerInterval);

  const completedLevel = currentLevelIndex; // level just beaten (0-indexed)
  const savedMaxLevel = parseInt(localStorage.getItem('bolitasLevel')) || 0;
  const isNewLevel = completedLevel >= savedMaxLevel; // first-time completion

  // Only advance saved progress if this is a new level
  if (isNewLevel) {
    currentLevelIndex = completedLevel + 1;
    localStorage.setItem('bolitasLevel', currentLevelIndex);
    analyticsManager.setUserProperty('highest_level', String(currentLevelIndex));
    const totalCompleted = parseInt(localStorage.getItem('bolitasTotalLevelsCompleted') || '0') + 1;
    localStorage.setItem('bolitasTotalLevelsCompleted', totalCompleted);
    analyticsManager.setUserProperty('total_levels_completed', String(totalCompleted));
    FirebaseCrashlytics.setCustomKey({
      key: 'highest_level',
      value: String(currentLevelIndex),
    }).catch(() => {});
  } else {
    // Replaying old level — move to next level for the session but don't overwrite saved max
    currentLevelIndex = completedLevel + 1;
  }
  localStorage.removeItem('bolitasLevelFails');

  // Snapshot quest states before tracking
  const questsBefore = getDailyQuests().map((q) => q.isComplete);

  // Track economy
  trackLevelComplete();
  trackSingleGameScore(score);

  // Detect newly completed quests
  const questsAfter = getDailyQuests().map((q) => q.isComplete);
  const newlyCompleted = [];
  questsAfter.forEach((done, i) => {
    if (done && !questsBefore[i]) newlyCompleted.push(i);
  });

  const questsArea = document.getElementById('win-quests-area');
  if (newlyCompleted.length > 0) {
    window._questJustCompletedIndices = newlyCompleted;
    if (questsArea) {
      questsArea.classList.remove('hidden');
      renderWinQuests(newlyCompleted);
    }
  } else {
    if (questsArea) questsArea.classList.add('hidden');
  }

  // Log against the level just beaten — currentLevelIndex already points to the NEXT level here
  const _completeConfig = getLevelData(completedLevel + 1);
  analyticsManager.logCustomEvent(analyticsManager.Events.LEVEL_COMPLETE, {
    [analyticsManager.Params.LEVEL_NUMBER]: completedLevel + 1,
    [analyticsManager.Params.BIOME_NAME]: getBiomeNameForLevel(completedLevel + 1),
    [analyticsManager.Params.DIFFICULTY]: _completeConfig?.difficulty || 'unknown',
    [analyticsManager.Params.SCORE]: score,
    [analyticsManager.Params.BOOSTERS_USED]: Object.keys(boostersUsedInLevel).length,
  });

  // --- Show Win Screen with paced animations ---
  const levelToCheck = completedLevel + 1;
  const levelData = getLevelData(levelToCheck);
  const isBossLevel = levelToCheck > 0 && levelToCheck % 15 === 0;
  let baseCoins = 0;

  if (isBossLevel) {
    baseCoins = Math.floor(Math.random() * (80 - 50 + 1)) + 50;
  } else {
    const diff = levelData ? levelData.difficulty : 'medium';
    if (diff === 'easy') {
      baseCoins = Math.floor(Math.random() * (15 - 10 + 1)) + 10;
    } else if (diff === 'medium') {
      baseCoins = Math.floor(Math.random() * (20 - 15 + 1)) + 15;
    } else if (diff === 'hard') {
      baseCoins = Math.floor(Math.random() * (25 - 20 + 1)) + 20;
    } else if (diff === 'extreme') {
      baseCoins = Math.floor(Math.random() * (30 - 25 + 1)) + 25;
    } else {
      baseCoins = Math.floor(Math.random() * (20 - 15 + 1)) + 15;
    }
  }

  const coinsEarned = baseCoins;
  window._winCoinsEarned = coinsEarned; // Store for x2 ad

  const xpEarned = isNewLevel ? 100 + (completedLevel + 1) * 10 : 10; // Small XP for replays

  // Store unlock info for level select animation
  if (isNewLevel) {
    window._justUnlockedLevel = completedLevel + 1;
  }

  // Show win screen
  const WIN_TITLES = [
    t('win_great'),
    t('win_perfect'),
    t('win_winner'),
    t('win_amazing'),
    t('win_brilliant'),
    t('win_nailed_it'),
  ];
  document.getElementById('win-title').innerText =
    WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)];
  document.getElementById('win-score').innerText = score;
  document.getElementById('win-coins').innerText = coinsEarned > 0 ? `+${coinsEarned}` : '—';
  document.getElementById('win-xp').innerText = t('win_xp', { val: xpEarned });

  // Compute final stars using the completed level's target (before currentLevelIndex was incremented)
  const completedLevelData = getLevelData(completedLevel + 1);
  const scoreStars = getStarCount(score, completedLevelData?.target || 1);
  const finalStars = boardClearThisLevel ? 4 : scoreStars;
  const starsMap = JSON.parse(localStorage.getItem('bolitasStarsMap') || '{}');
  if (finalStars > (starsMap[completedLevel] || 0)) {
    starsMap[completedLevel] = finalStars;
    localStorage.setItem('bolitasStarsMap', JSON.stringify(starsMap));
  }

  // Animate win screen stars (1–3 normal, 4th golden for board clear)
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`win-star-${i}`);
    if (el) el.classList.remove('filled', 'pop', 'golden');
  }
  const starsToAnimate = boardClearThisLevel ? 4 : scoreStars;
  for (let i = 1; i <= starsToAnimate; i++) {
    setTimeout(
      () => {
        const el = document.getElementById(`win-star-${i}`);
        if (el) {
          el.classList.add('filled', 'pop');
          if (i === 4) el.classList.add('golden');
        }
      },
      300 + (i - 1) * 250,
    );
  }

  // Show or hide x2 button
  const x2Btn = document.getElementById('win-x2-btn');
  if (coinsEarned > 0) {
    x2Btn.classList.remove('hidden');
    prepareRewarded(); // pre-load rewarded ad
  } else {
    x2Btn.classList.add('hidden');
  }

  // Show existing XP bar state first
  const xpBefore = getXPProgress();
  const levelBefore = getPlayerLevel();
  document.getElementById('win-xp-bar').style.transition = 'none';
  document.getElementById('win-xp-bar').style.width = `${xpBefore * 100}%`;
  document.getElementById('win-level-label').innerText =
    `${t('player_level_display', { val: levelBefore })} — ${Math.round(getXP())}/${getXPForNextLevel()} XP`;

  // Hide reward elements initially to prevent flicker from previous level
  const rewardNotif = document.getElementById('win-reward-notif');
  if (rewardNotif) rewardNotif.classList.add('hidden');
  const milestoneText = document.getElementById('win-next-milestone');
  if (milestoneText) milestoneText.classList.add('hidden');

  const winScreen = document.getElementById('win-screen');
  winScreen.classList.remove('hidden');
  winScreen.style.display = 'flex';
  winScreen.style.zIndex = '50000';

  // Disable continue button until animation completes
  const continueBtn = document.getElementById('win-continue-btn');
  continueBtn.disabled = true;
  continueBtn.style.opacity = '0.3';
  continueBtn.style.pointerEvents = 'none';

  // Animate coins after 500ms
  setTimeout(() => {
    if (coinsEarned > 0) {
      // Hilera animation: coins fly from win screen to header
      const startEl = document.getElementById('win-coins');
      const endEl = document.getElementById('header-coin-count');
      if (startEl && endEl) {
        spawnFlyingCoins(Math.min(10, coinsEarned), startEl, endEl);
      }

      addCoins(coinsEarned);
      if (isAudioEnabled) playCoinSound();

      const headerCoins = document.getElementById('header-coin-count');
      headerCoins.classList.remove('reward-pulse');
      void headerCoins.offsetWidth;
      headerCoins.classList.add('reward-pulse');
    }
    updateHeaderCoins();
  }, 500);

  // Animate XP bar after 1000ms
  setTimeout(() => {
    const result = addXP(xpEarned);
    document.getElementById('win-xp-bar').style.transition =
      'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    document.getElementById('win-xp-bar').style.width = `${getXPProgress() * 100}%`;
    document.getElementById('win-level-label').innerText =
      `${t('player_level_display', { val: result.newLevel })} — ${result.newXP}/${getXPForNextLevel()} XP`;

    if (result.leveledUp) {
      document.getElementById('win-level-label').innerText += ` 🎉 ${t('level_up')}`;
    }

    // --- Milestone Rewards (Every 5 XP levels) ---
    const rewardNotif = document.getElementById('win-reward-notif');
    const milestoneText = document.getElementById('win-next-milestone');
    const playerLvl = getPlayerLevel();
    const nextRewardLvl = playerLvl + (5 - (playerLvl % 5));

    // Check if XP leveled up into a milestone
    const lastRewardedXPLevel = parseInt(localStorage.getItem('lastBoosterRewardLevel') || '0');
    const latestMilestone = Math.floor(playerLvl / 5) * 5;

    if (latestMilestone > 0 && latestMilestone > lastRewardedXPLevel) {
      // Award booster for reaching this XP level milestone
      const randIdx = Math.floor(Math.random() * SHOP_BOOSTERS.length);
      const booster = SHOP_BOOSTERS[randIdx];
      addBoosterFree(booster.id, 1);
      localStorage.setItem('lastBoosterRewardLevel', String(latestMilestone));

      if (rewardNotif) {
        rewardNotif.classList.remove('hidden');
        document.getElementById('win-reward-icon').innerText = booster.icon;
        document.getElementById('win-reward-text').innerText = t('milestone_booster_unlocked', {
          booster: t(`booster_${booster.id}_name`),
        });
      }
      if (milestoneText) {
        milestoneText.innerText = t('next_reward_at', { val: nextRewardLvl });
      }
    } else {
      if (rewardNotif) rewardNotif.classList.add('hidden');
      if (milestoneText) {
        if (playerLvl % 5 === 4) {
          const xpLeft = getXPToNextReward();
          milestoneText.innerText = t('xp_left_for_reward', { val: xpLeft });
          milestoneText.classList.remove('hidden');
        } else {
          milestoneText.classList.add('hidden');
        }
      }
    }

    // Enable continue button after XP bar animation finishes (1.5s transition)
    setTimeout(() => {
      continueBtn.disabled = false;
      continueBtn.style.opacity = '1';
      continueBtn.style.pointerEvents = 'auto';
    }, 1600);
  }, 1000);

  // Interstitial logic now handled in "Continuar" button click handler to avoid race conditions
}

function showCelebration() {
  clearInterval(timerInterval);
  clearTimeout(hintTimeout);
  boardClearThisLevel = true;
  trackBoardClear();

  document.getElementById('celebration-score').innerText = score;
  document.getElementById('clear-celebration').classList.remove('hidden');

  // Spawn confetti particles
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = [
    '#ff3b5c',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ff6b6b',
    '#06d6a0',
    '#ffd166',
  ];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${6 + Math.random() * 8}px`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}

function showTutorial() {
  // Mirror the DOM setup that initGame normally does
  document.querySelector('.app-footer')?.classList.add('hidden');
  document.querySelector('#game-container > header')?.classList.remove('hidden');
  document.getElementById('biome-map-screen')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('level-prestart-screen')?.classList.add('hidden');
  document.getElementById('game-over')?.classList.add('hidden');
  document.getElementById('pass-level-btn')?.classList.add('hidden');
  document.getElementById('powerups-bar')?.classList.add('hidden');
  document.querySelector('.game-area').classList.remove('hidden');

  // Reset game state that createBolita and click handlers depend on
  elementPositionMap = new WeakMap();
  activePowerup = null;
  isAnimating = false;
  selectedGroup = [];
  hintedElements = [];
  score = 0;
  comboMultiplier = 1;
  levelCompleted = false;
  window._levelCompleteHandled = false;

  // Set grid dimensions so sizeGrid() works
  currentRows = 3;
  currentCols = 3;

  showAdventureTutorial({
    uiGrid,
    createBolita,
    showBannerAd,
    clearGrid: (rows, cols) => {
      grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
      clearGridElements();
      return grid;
    },
    setHeaderMode: (text) => {
      if (uiHeaderMode) uiHeaderMode.innerText = text;
    },
    sizeGrid,
  });
}

// ======================== NEW UI FUNCTIONS ========================

function updateHeaderCoins() {
  const coins = getCoins();
  document.getElementById('header-coin-count').innerText = coins.toLocaleString();
  analyticsManager.setUserProperty('total_coins', coins);

  const mapEl = document.getElementById('header-coin-count-map');
  if (mapEl) mapEl.innerText = coins.toLocaleString();

  // Re-evaluation for shop claimables (calendar)
  updateShopNotifications();
}

/**
 * Creates a "hilera" (row) of flying coins from start point to destination.
 */
function spawnFlyingCoins(count, startEl, endEl) {
  const startRect = startEl.getBoundingClientRect();
  const endRect = endEl.getBoundingClientRect();
  const container = document.getElementById('game-container');
  const containerRect = container.getBoundingClientRect();

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      coin.className = 'flying-coin';
      coin.innerText = '🪙';
      coin.style.left = startRect.left + startRect.width / 2 - containerRect.left + 'px';
      coin.style.top = startRect.top + startRect.height / 2 - containerRect.top + 'px';
      container.appendChild(coin);

      // Play sound for each coin in the sequence
      if (isAudioEnabled) playCoinSound();

      // Force reflow
      void coin.offsetWidth;

      const destX = endRect.left + endRect.width / 2 - 10;
      const destY = endRect.top + endRect.height / 2 - 10;

      coin.style.transform = `translate(${destX - (startRect.left + startRect.width / 2)}px, ${destY - (startRect.top + startRect.height / 2)}px) scale(1.5)`;
      coin.style.opacity = '1';

      setTimeout(() => {
        coin.remove();
        // Visual feedback on total counter
        endEl.classList.remove('reward-pulse');
        void endEl.offsetWidth;
        endEl.classList.add('reward-pulse');
      }, 800);
    }, i * 100);
  }
}

function updateMenuPlayerLevel() {
  const currentLevel = getPlayerLevel();
  const xp = getXP();
  const xpNeeded = getXPForNextLevel();
  const pct = getXPProgress();

  analyticsManager.setUserProperty('player_level', currentLevel);

  // User Settings panel
  const settingsName = document.getElementById('user-settings-name');
  if (settingsName) settingsName.innerText = currentUser || '';
  const settingsLevel = document.getElementById('user-settings-level');
  if (settingsLevel) settingsLevel.innerText = t('player_level_display', { val: currentLevel });
  const settingsBar = document.getElementById('user-settings-xp-bar');
  if (settingsBar) settingsBar.style.width = `${pct * 100}%`;
  const settingsLabel = document.getElementById('user-settings-xp-label');
  if (settingsLabel) settingsLabel.innerText = t('xp_label', { current: xp, total: xpNeeded });

  updateFooterQuestsGlow();
}

function updateFooterQuestsGlow() {
  const questsTab = document.getElementById('footer-tab-quests');
  if (!questsTab) return;

  const hasRewards = hasClaimableQuests();
  questsTab.classList.toggle('glow-slow', hasRewards);

  // Also update shop sync for calendar notifications
  updateShopNotifications();
}

// openShop and renderShopItems are now imported from shop.js

let currentQuestTab = 'daily';

function openQuests() {
  currentQuestTab = 'daily';
  document.getElementById('shop-screen').classList.add('hidden');
  document.getElementById('biome-map-screen')?.classList.add('hidden');
  // Set up tab switching
  document.querySelectorAll('.quest-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.qtab === 'daily');
    tab.onclick = () => {
      currentQuestTab = tab.dataset.qtab;
      document
        .querySelectorAll('.quest-tab')
        .forEach((t) => t.classList.toggle('active', t === tab));
      renderQuests();
    };
  });
  renderQuests();
  updateQuestCountdown();
  document.getElementById('quests-screen').classList.remove('hidden');
  syncFooterTabs('quests');
  updateFooterQuestsGlow();
}

let questCountdownInterval = null;
function updateQuestCountdown() {
  if (questCountdownInterval) clearInterval(questCountdownInterval);

  const el = document.getElementById('quest-reset-countdown');
  const tick = () => {
    const isWeekly = currentQuestTab === 'weekly';
    const nextReset = isWeekly ? getNextWeeklyReset() : getNextDailyReset();
    const diff = nextReset - Date.now();

    if (diff <= 0) {
      el.innerText = t('refresh_available');
      renderQuests(); // Auto-refresh UI when timer hits zero
      return;
    }

    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    let timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (diff > 86400000) {
      const d = Math.floor(diff / 86400000);
      timeStr = `${d}d ${timeStr}`;
    }
    const resetLabel = isWeekly
      ? t('weekly_reset_in', { time: timeStr })
      : t('daily_reset_in', { time: timeStr });
    el.innerText = resetLabel;
  };

  tick();
  questCountdownInterval = setInterval(() => {
    if (document.getElementById('quests-screen').classList.contains('hidden')) {
      clearInterval(questCountdownInterval);
      return;
    }
    tick();
  }, 1000);
}

function getQuestDescription(quest) {
  const params = { target: quest.target };
  if (quest.color) params.color = t(`color_${quest.color}`);
  if (quest.minSize) params.minSize = quest.minSize;
  if (quest.mode) params.mode = t(quest.mode);

  return t(`quest_${quest.type}`, params);
}

function renderQuests() {
  const container = document.getElementById('quest-list-container');
  container.innerHTML = '';

  const isWeekly = currentQuestTab === 'weekly';
  const quests = isWeekly ? getWeeklyQuests() : getDailyQuests();
  const claimFn = isWeekly ? claimWeeklyQuest : claimQuest;

  quests.forEach((quest, index) => {
    const card = document.createElement('div');
    card.className = `quest-card ${quest.isComplete ? 'completed' : ''}`;
    const pct = Math.min((quest.progress / quest.target) * 100, 100);

    card.innerHTML = `
      <div class="quest-icon">${quest.icon}</div>
      <div class="quest-info">
        <div class="quest-name">${getQuestDescription(quest)}</div>
        <div class="quest-progress-text">${quest.progress}/${quest.target}</div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;">
        <div class="quest-reward">🪙 ${quest.reward}</div>
        ${
          quest.isComplete && !quest.claimed
            ? `<button class="quest-claim-btn" data-idx="${index}">${t('quest_claim')}</button>`
            : !quest.isComplete
              ? `<button class="quest-swap-btn" data-idx="${index}" title="${t('quest_swap_hint')}">🔄</button>`
              : '<span style="font-size:0.8rem;color:var(--clr-green);">✓</span>'
        }
      </div>
    `;

    // Claim button
    const claimBtn = card.querySelector('.quest-claim-btn');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const reward = claimFn(index);
        if (reward > 0) {
          if (isAudioEnabled) playCoinSound();

          card.classList.add('claiming');

          const headerCoins = document.getElementById('header-coin-count');
          headerCoins.classList.remove('reward-pulse');
          void headerCoins.offsetWidth;
          headerCoins.classList.add('reward-pulse');

          updateHeaderCoins();
          updateFooterQuestsGlow();
          setTimeout(() => {
            renderQuests();
          }, 400);
        }
      });
    }

    // Swap button
    const swapBtn = card.querySelector('.quest-swap-btn');
    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        if (isWeekly) {
          showRewardedAd('swap_weekly_quest', index);
        } else {
          showRewardedAd('swap_quest', index);
        }
      });
    }

    container.appendChild(card);
  });

  // Update tabs glow individually
  const dailyTab = document.querySelector('.quest-tab[data-qtab="daily"]');
  if (dailyTab) dailyTab.classList.toggle('glow-slow', hasClaimableDailyQuests());

  const weeklyTab = document.querySelector('.quest-tab[data-qtab="weekly"]');
  if (weeklyTab) weeklyTab.classList.toggle('glow-slow', hasClaimableWeeklyQuests());
}
function renderWinQuests(indices) {
  const container = document.getElementById('win-quests-list');
  if (!container) return;
  container.innerHTML = '';

  const quests = getDailyQuests();
  indices.forEach((index) => {
    const quest = quests[index];
    if (!quest) return;

    const card = document.createElement('div');
    card.className = `quest-card win-quest ${quest.isComplete ? 'completed' : ''}`;

    card.innerHTML = `
      <div class="quest-icon">${quest.icon}</div>
      <div class="quest-info">
        <div class="quest-name">${getQuestDescription(quest)}</div>
        <div class="quest-reward">🪙 ${quest.reward}</div>
      </div>
      ${
        quest.isComplete && !quest.claimed
          ? `<button class="quest-claim-btn" data-idx="${index}">${t('quest_claim')}</button>`
          : '<span class="quest-done-check">✓</span>'
      }
    `;

    const claimBtn = card.querySelector('.quest-claim-btn');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const reward = claimQuest(index);
        if (reward > 0) {
          if (isAudioEnabled) playCoinSound();
          card.classList.add('claiming');
          updateHeaderCoins();
          updateFooterQuestsGlow();
          setTimeout(() => {
            renderWinQuests(indices);
          }, 400);
        }
      });
    }
    container.appendChild(card);
  });
}

function updateLivesUI() {
  const lives = getLives();
  const secs = getRemainingTime();
  const timerText =
    secs > 0
      ? `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
      : '';

  const mapCount = document.getElementById('header-lives-count-map');
  const mapTimer = document.getElementById('header-lives-timer-map');
  if (mapCount) mapCount.textContent = lives;
  if (mapTimer) {
    mapTimer.textContent = timerText;
    mapTimer.classList.toggle('hidden', !timerText);
  }

  const gameCount = document.getElementById('header-lives-count');
  if (gameCount) gameCount.textContent = lives;

  const outTimerEl = document.getElementById('out-of-lives-timer-text');
  if (outTimerEl) {
    outTimerEl.textContent = secs > 0 ? t('out_of_lives_timer', { time: timerText }) : '';
  }
}

// Update the fixed header with current player state
function updateMapHeader() {
  const coins = getCoins();
  const headerCoinEl = document.getElementById('header-coin-count-map');
  if (headerCoinEl) headerCoinEl.innerText = coins.toLocaleString();
  const headerLevelEl = document.getElementById('app-header-level');
  if (headerLevelEl) {
    const pLvl = getPlayerLevel();
    headerLevelEl.innerText = `${currentUser || 'Player'} LVL ${pLvl}`;
  }
  updateLivesUI();
}
function showBiomeCompletedOverlay() {
  let overlay = document.getElementById('biome-completed-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'biome-completed-overlay';
    overlay.className = 'overlay';
    overlay.style.zIndex = '35000';
    overlay.style.background = 'rgba(0,0,0,0.85)';

    const panel = document.createElement('div');
    panel.style.textAlign = 'center';

    const title = document.createElement('h1');
    title.className = 'celebration-title';
    title.innerText = t('biome_completed') || 'Biome Completed!';

    const confettiLayer = document.createElement('div');
    confettiLayer.className = 'confetti-fx';

    panel.appendChild(title);
    overlay.appendChild(confettiLayer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  overlay.classList.remove('fade-out');
  overlay.classList.add('fade-in');

  const confettiLayer = overlay.querySelector('.confetti-fx');
  confettiLayer.innerHTML = '';
  const colors = ['#0ff', '#f0f', '#ff0', '#0f0'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'neon-confetti';
    p.style.left = Math.random() * 100 + '%';
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.boxShadow = `0 0 8px ${p.style.backgroundColor}`;
    confettiLayer.appendChild(p);
  }
}

function hideBiomeCompletedOverlay() {
  const overlay = document.getElementById('biome-completed-overlay');
  if (overlay) {
    overlay.classList.remove('fade-in');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.classList.add('hidden'), 500);
  }
}

function showLevelSelect(justUnlockedLevel = null) {
  currentMode = 'adventure';
  document.getElementById('powerups-bar').classList.add('hidden');
  document.querySelector('.app-footer')?.classList.remove('hidden');
  syncFooterTabs('map');
  const container = document.getElementById('biome-map-container');
  container.innerHTML = '';

  const milestoneEl = document.getElementById('level-select-milestone');
  if (milestoneEl) {
    try {
      const playerLvl = getPlayerLevel();
      if (playerLvl % 5 === 4) {
        const xpLeft = getXPToNextReward();
        milestoneEl.innerText = t('xp_left_for_reward', { val: xpLeft });
        milestoneEl.classList.remove('hidden');
      } else {
        milestoneEl.classList.add('hidden');
      }
    } catch (e) {
      console.error('Error updating milestone text:', e);
    }
  }

  // Safety: ensure no tutorials are locking the screen when we enter the map
  abortActiveTutorial();

  const maxUnlocked = parseInt(localStorage.getItem('bolitasLevel')) || 0;
  const starsMap = JSON.parse(localStorage.getItem('bolitasStarsMap') || '{}');
  const currentGlobalLevel = maxUnlocked + 1;
  const { currentBlock, maxVisibleBlock } = getVisibleBiomeRange(currentGlobalLevel);

  const totalVisible = maxVisibleBlock + 1;

  // Clean container
  container.innerHTML = '';

  for (let blockIdx = 0; blockIdx < totalVisible; blockIdx++) {
    const biomeBlock = generateBiomeBlock(blockIdx);
    const firstLevel = blockIdx * 15 + 1;
    const isRevealed = isBiomeRevealed(blockIdx, maxUnlocked);
    const isCurrentBiome = blockIdx === currentBlock;

    const card = document.createElement('div');
    card.className = 'biome-block-card';

    // Background image layer
    const bgDiv = document.createElement('div');
    bgDiv.className = 'biome-card-bg';
    if (biomeBlock.imagePath) {
      bgDiv.style.backgroundImage = `url(${biomeBlock.imagePath})`;
    } else if (biomeBlock.themeColors && biomeBlock.themeColors.length > 0) {
      bgDiv.style.background = `linear-gradient(135deg, ${biomeBlock.themeColors.join(', ')})`;
      bgDiv.style.opacity = '1';
    }
    card.appendChild(bgDiv);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'biome-card-content';

    if (isRevealed || isCurrentBiome) {
      card.classList.add('revealed');
    } else {
      card.classList.add('locked', 'fog-card');
    }
    if (isCurrentBiome) card.classList.add('current-biome');

    // Header with biome name
    const header = document.createElement('div');
    header.className = 'biome-block-header';
    header.style.pointerEvents = 'none'; // Ensure clicks pass through to grid behind if needed, though they are siblings

    const nameEl = document.createElement('div');
    nameEl.className = 'biome-block-name';
    nameEl.innerText =
      isRevealed || isCurrentBiome
        ? t(biomeBlock.biomeName)
        : `${t('biome_unknown')} #${biomeBlock.blockId}`;

    const idEl = document.createElement('div');
    idEl.className = 'biome-block-id';
    idEl.innerText = `#${biomeBlock.blockId}`;

    header.appendChild(nameEl);
    header.appendChild(idEl);
    content.appendChild(header);

    // Level grid (15 fragment slots in 5x3)
    const levelGrid = document.createElement('div');
    levelGrid.className = 'biome-level-grid';

    for (let i = 0; i < 15; i++) {
      const globalLevel = firstLevel + i;
      const levelIdx = globalLevel - 1;
      const levelData = biomeBlock.levels[i];

      const cell = document.createElement('div');
      cell.className = 'level-cell';

      if (levelIdx < maxUnlocked) {
        cell.classList.add('completed');
        if (levelData) cell.classList.add(`level-diff-${levelData.difficulty}`);
        cell.addEventListener('click', () => showLevelPreStartScreen(levelIdx));
        const numEl = document.createElement('span');
        numEl.className = 'cell-level-num';
        numEl.innerText = globalLevel;
        cell.appendChild(numEl);
        const cellStars = starsMap[levelIdx] || 0;
        if (cellStars === 4) {
          cell.classList.add('golden-clear');
          const superstarEl = document.createElement('div');
          superstarEl.className = 'cell-superstar';
          superstarEl.innerText = '★';
          cell.appendChild(superstarEl);
        } else {
          const starsEl = document.createElement('div');
          starsEl.className = 'cell-stars';
          for (let s = 1; s <= 3; s++) {
            const star = document.createElement('span');
            star.className = 'cell-star' + (s <= cellStars ? ' filled' : '');
            star.innerText = '★';
            starsEl.appendChild(star);
          }
          cell.appendChild(starsEl);
        }
      } else if (levelIdx === maxUnlocked) {
        cell.classList.add('current');
        if (levelData) cell.classList.add(`level-diff-${levelData.difficulty}`);
        cell.addEventListener('click', () => showLevelPreStartScreen(levelIdx));
        cell.innerText = globalLevel;
      } else {
        cell.classList.add('locked');
        cell.innerText = '🔒';
      }

      levelGrid.appendChild(cell);
    } // End of level cells loop (i)

    // Auto-reveal and handle biome animation if this was just unlocked
    if (justUnlockedLevel !== null) {
      // justUnlockedLevel is a 0-indexed levelIdx; globalLevel of unlocked = justUnlockedLevel + 1
      if (justUnlockedLevel + 1 >= firstLevel && justUnlockedLevel + 1 <= firstLevel + 14) {
        const relativeIdx = justUnlockedLevel - firstLevel + 1;
        const targetCell = levelGrid.children[relativeIdx];

        if (targetCell) {
          targetCell.classList.add('new-unlocked');
          // Lock UI during this whole sequence
          document.body.classList.add('ui-locked');

          setTimeout(() => {
            targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // If it's the first level of the block, that means we JUST finished the previous block!
            if (relativeIdx === 0 && firstLevel > 1) {
              // column-reverse flips the VISUAL order, not the DOM order: the biome
              // just completed (blockIdx - 1) is still the previous DOM sibling
              const prevCard = card.previousElementSibling;

              if (prevCard) {
                // Hide new card immediately so it doesn't flash before the reveal animation
                card.style.opacity = '0';
                card.style.pointerEvents = 'none';

                // Focus on previous card, which was just completed
                prevCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                prevCard.classList.add('biome-completed-glow');

                setTimeout(() => {
                  showBiomeCompletedOverlay();

                  setTimeout(() => {
                    hideBiomeCompletedOverlay();

                    setTimeout(() => {
                      // Now focus on the *new* card and reveal it
                      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      card.style.opacity = '';
                      card.style.pointerEvents = '';
                      card.classList.add('unlocked-reveal');
                      targetCell.classList.add('unlocked-reveal');
                      if (isAudioEnabled) playLevelUnlockSound();

                      setTimeout(() => {
                        document.body.classList.remove('ui-locked');
                        // TAREAS: No auto-opening next level, letting user tap
                      }, 1000);
                    }, 500);
                  }, 3000); // Overlay stays for 3s
                }, 1000); // Wait for card glow
              } else {
                card.classList.add('unlocked-reveal');
                targetCell.classList.add('unlocked-reveal');
                if (isAudioEnabled) playLevelUnlockSound();
                setTimeout(() => document.body.classList.remove('ui-locked'), 1000);
              }
            } else {
              // Normal level unlock (not an entire biome)
              targetCell.classList.add('unlocked-reveal');
              if (isAudioEnabled) playLevelUnlockSound();
              setTimeout(() => {
                document.body.classList.remove('ui-locked');
                // TAREAS: No auto-opening next level, letting user tap
              }, 1000);
            }
          }, 500);
        }
      }
    }

    content.appendChild(levelGrid);
    card.appendChild(content);
    container.appendChild(card);
  } // End of outer for loop (blockIdx)

  updateMapHeader();

  document.getElementById('biome-map-screen').classList.remove('hidden');

  // Initial scroll to current biome if not animating a specific new level
  if (justUnlockedLevel === null) {
    scrollToCurrentBiome();
  }
}

function scrollToCurrentBiome() {
  const container = document.getElementById('biome-map-scroll');
  const target = document.querySelector('.current-biome');
  if (container && target) {
    // Force a small reflow delay so display:block is settled
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function showLevelPreStartScreen(levelIndex) {
  // Reset per-try ad counter
  prestartAdsThisTry = 0;
  // Unlock UI whenever we open a modal or manual level select
  document.body.classList.remove('ui-locked');

  // Hide game elements to ensure clean background
  document.querySelector('.game-area').classList.add('hidden');
  document.getElementById('powerups-bar').classList.add('hidden');

  const prestartScreen = document.getElementById('level-prestart-screen');
  if (!prestartScreen) return;

  const config = getLevelData(levelIndex + 1);

  try {
    document.getElementById('prestart-level-title').innerText = t('level_display', {
      val: levelIndex + 1,
    });
    document.getElementById('prestart-target').innerText = `⭐ ${config.target}`;

    let diffKey = 'diff_easy';
    let diffColor = 'var(--clr-green)';
    if (config.difficulty === 'medium') {
      diffKey = 'diff_medium';
      diffColor = 'var(--clr-yellow)';
    }
    if (config.difficulty === 'hard') {
      diffKey = 'diff_hard';
      diffColor = 'var(--clr-orange)';
    }
    if (config.difficulty === 'extreme') {
      diffKey = 'diff_extreme';
      diffColor = 'var(--clr-red)';
    }

    const diffEl = document.getElementById('prestart-difficulty');
    const translatedDiff = t(diffKey);
    diffEl.innerText = translatedDiff.includes(':')
      ? translatedDiff.split(':')[1].trim().toUpperCase()
      : translatedDiff.toUpperCase();
    diffEl.style.color = diffColor;
    diffEl.style.border = `1px solid ${diffColor}`;

    // No recommendation block in new UI — ad buff button is always visible

    // Render quick daily quests preview
    const questsContainer = document.getElementById('prestart-quests-container');
    questsContainer.innerHTML = '';
    const dailyQuests = getDailyQuests().filter((q) => !q.claimed);
    if (dailyQuests.length === 0) {
      questsContainer.innerHTML = `<div style="font-size: 0.85rem; color: #fff; opacity: 0.7;">${t('all_quests_done')}</div>`;
    } else {
      dailyQuests.slice(0, 2).forEach((quest) => {
        const pct = Math.min((quest.progress / quest.target) * 100, 100);
        const div = document.createElement('div');
        div.style.cssText =
          'display:flex; justify-content:space-between; align-items:center; font-size: 0.85rem; width: 100%; color: #eee; line-height: 1.2;';
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.4rem; flex:1; min-width:0;">
             <span>${quest.icon}</span>
             <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${getQuestDescription(quest)}</span>
          </div>
          <div style="font-family: monospace; font-weight: bold; margin-left: 10px; color: ${pct >= 100 ? 'var(--clr-green)' : '#fff'};">
             ${quest.progress}/${quest.target}
          </div>
        `;
        questsContainer.appendChild(div);
      });
    }

    prestartScreen.classList.remove('hidden');

    // Handle Close
    const closeBtn = document.getElementById('prestart-close-btn');
    closeBtn.onclick = () => {
      prestartScreen.classList.add('hidden');
      returnToMainMenu();
    };

    // Handle Play
    const playBtn = document.getElementById('prestart-play-btn');
    playBtn.onclick = () => {
      prestartScreen.classList.add('hidden');
      startLevelFromSelect(levelIndex);
    };
  } catch (err) {
    console.error('Error opening level prestart:', err);
  }
}

function startLevelFromSelect(levelIndex) {
  if (getLives() <= 0) {
    window._pendingLevelIndex = levelIndex; // Store to restore after ad
    document.getElementById('level-prestart-screen').classList.add('hidden');
    document.getElementById('out-of-lives-screen').classList.remove('hidden');
    return;
  }
  currentLevelIndex = levelIndex;

  // Show tutorial on first ever play (level 1, adventure mode)
  if (levelIndex === 0 && !localStorage.getItem('bolitasTutorialDone')) {
    document.getElementById('biome-map-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    showTutorial();
    return;
  }

  document.getElementById('biome-map-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  if (isAudioEnabled) {
    bgmAudio.play().catch(() => {});
  }
  analyticsManager.logCustomEvent(analyticsManager.Events.LEVEL_START, {
    [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
  });
  trackGamePlayed('adventure');
  initGame();
}

function renderPowerups() {
  const bar = document.getElementById('powerups-bar');
  bar.classList.remove('hidden');

  document.querySelectorAll('.powerup-btn').forEach((btn) => {
    const bId = btn.dataset.booster;
    const booster = SHOP_BOOSTERS.find((b) => b.id === bId);

    let isLocked = false;
    const level = currentLevelIndex + 1;
    if (booster && booster.unlockLevel) {
      if (level < booster.unlockLevel) isLocked = true;
    }

    if (isLocked) {
      btn.style.setProperty('display', 'none', 'important');
      return;
    } else {
      btn.style.display = '';
    }

    const count = getBoosterCount(bId);
    btn.querySelector('.powerup-count').innerText = count;

    if (count <= 0) {
      btn.classList.add('empty');
    } else {
      btn.classList.remove('empty');
    }

    if (boostersUsedInLevel[bId]) {
      btn.classList.add('used');
    } else {
      btn.classList.remove('used');
    }

    if (activePowerup === bId) {
      btn.classList.add('active-target');
    } else {
      btn.classList.remove('active-target');
    }
  });
}

function handlePowerupClick(boosterId) {
  if (getBoosterCount(boosterId) <= 0) return;
  if (boostersUsedInLevel[boosterId]) {
    playErrorSound();
    return;
  }
  if (isAnimating) return;

  if (activePowerup === boosterId) {
    // Toggle off
    activePowerup = null;
    renderPowerups();
    return;
  }

  // Instant actions
  if (boosterId === 'shuffle') {
    useBooster('shuffle');
    analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
      [analyticsManager.Params.BOOSTER_NAME]: 'shuffle',
      [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
    });
    boostersUsedInLevel['shuffle'] = true;
    shuffleBoard();
    renderPowerups();
    return;
  }

  if (boosterId === 'hint_pack') {
    useBooster('hint_pack');
    analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
      [analyticsManager.Params.BOOSTER_NAME]: 'hint_pack',
      [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
    });
    showHint();
    renderPowerups();
    return;
  }

  // Target actions (Bomb, Color Bomb)
  activePowerup = boosterId;
  clearSelectionOutline();
  selectedGroup = [];
  renderPowerups();
}

async function activateBombAt(r, c) {
  isAnimating = true;
  useBooster('bomb');
  analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
    [analyticsManager.Params.BOOSTER_NAME]: 'bomb',
    [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
  });
  boostersUsedInLevel['bomb'] = true;
  activePowerup = null;
  renderPowerups();
  clearSelectionOutline();

  const toPop = [];
  for (let rr = Math.max(0, r - 1); rr <= Math.min(currentRows - 1, r + 1); rr++) {
    for (let cc = Math.max(0, c - 1); cc <= Math.min(currentCols - 1, c + 1); cc++) {
      if (grid[rr][cc]) toPop.push(grid[rr][cc]);
    }
  }

  await executePowerupPop(toPop);
}

async function activateColorBomb(color) {
  isAnimating = true;
  useBooster('color_bomb');
  analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
    [analyticsManager.Params.BOOSTER_NAME]: 'color_bomb',
    [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
  });
  boostersUsedInLevel['color_bomb'] = true;
  activePowerup = null;
  renderPowerups();
  clearSelectionOutline();

  const toPop = [];
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] && grid[r][c].color === color) {
        toPop.push(grid[r][c]);
      }
    }
  }

  await executePowerupPop(toPop);
}

// ======================== SNIPER ========================

/**
 * Sniper: removes a single bolita chosen by the player,
 * then applies gravity so balls fall to fill the gap.
 */
async function activateSniper(r, c) {
  if (!grid[r][c]) return;
  isAnimating = true;
  useBooster('sniper');
  analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
    [analyticsManager.Params.BOOSTER_NAME]: 'sniper',
    [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
  });
  boostersUsedInLevel['sniper'] = true;
  activePowerup = null;
  renderPowerups();
  clearSelectionOutline();

  const target = grid[r][c];
  await executePowerupPop([target]);
}

// ======================== MAGIC BRUSH ========================

/** Active state for Magic Brush — stores grid position of targeted bolita. */
let _magicBrushTarget = null;

/**
 * Shows an inline color-picker anchored near the tapped bolita.
 * Player picks the new color → bolita changes, surrounding groups are re-evaluated.
 */
function showMagicBrushPicker(r, c, el) {
  if (!grid[r][c]) return;

  // Remove any existing picker
  closeMagicBrushPicker();

  _magicBrushTarget = { r, c };

  // Build the colour options from the currently active palette
  const picker = document.createElement('div');
  picker.id = 'magic-brush-picker';
  picker.className = 'magic-brush-picker';

  const activeColors = currentColorSet.slice(0, currentColors);
  const currentColor = grid[r][c].color;

  activeColors.forEach((clr) => {
    if (clr === currentColor) return; // skip the same colour
    const swatch = document.createElement('button');
    swatch.className = `magic-brush-swatch bolita-color-${clr}`;
    swatch.title = t(`color_${clr}`);
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      applyMagicBrush(_magicBrushTarget.r, _magicBrushTarget.c, clr);
    });
    picker.appendChild(swatch);
  });

  // Cancel on outside tap
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'magic-brush-cancel';
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelMagicBrush();
  });
  picker.appendChild(cancelBtn);

  // Position near the bolita element
  const rect = el.getBoundingClientRect();
  const gameRect = document.getElementById('game-container').getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.left = `${Math.min(rect.left, gameRect.right - 200)}px`;
  picker.style.top = `${Math.max(rect.top - 60, gameRect.top + 4)}px`;
  picker.style.zIndex = '100005'; // Above tutorial overlays

  document.body.appendChild(picker);

  // Highlight the target bolita
  if (grid[r][c]?.el) grid[r][c].el.classList.add('magic-brush-selected');
}

function closeMagicBrushPicker() {
  const existing = document.getElementById('magic-brush-picker');
  if (existing) existing.remove();
  if (_magicBrushTarget) {
    const b = grid[_magicBrushTarget.r]?.[_magicBrushTarget.c];
    if (b?.el) b.el.classList.remove('magic-brush-selected');
  }
  _magicBrushTarget = null;
}

function cancelMagicBrush() {
  // Deactivate powerup mode without consuming a charge
  activePowerup = null;
  closeMagicBrushPicker();
  renderPowerups();
}

function applyMagicBrush(r, c, newColor) {
  closeMagicBrushPicker();

  const bolita = grid[r][c];
  if (!bolita) return;

  // Deduct the booster charge and commit
  useBooster('magic_brush');
  analyticsManager.logCustomEvent(analyticsManager.Events.BOOSTER_USED, {
    [analyticsManager.Params.BOOSTER_NAME]: 'magic_brush',
    [analyticsManager.Params.LEVEL_NUMBER]: currentLevelIndex + 1,
  });
  boostersUsedInLevel['magic_brush'] = true;
  activePowerup = null;
  renderPowerups();

  // Change the colour in state and DOM
  bolita.color = newColor;
  bolita.el.dataset.color = newColor;

  if (isAudioEnabled) playSelectSound();
  if (navigator.vibrate) navigator.vibrate(30);

  // Re-check for moves after color change
  if (!hasValidMove(grid)) {
    const config = getCurrentLevelConfig();
    if (score >= config.target) {
      handleLevelComplete();
    } else {
      showGameOver(false);
    }
  }
}

async function executePowerupPop(groupToPop) {
  if (isAudioEnabled) playPopSound(groupToPop.length);
  if (navigator.vibrate) navigator.vibrate(60);

  uiGrid.classList.add('shake');
  setTimeout(() => uiGrid.classList.remove('shake'), 350);

  groupToPop.forEach((bolita) => {
    bolita.el.classList.add('popped');
    grid[bolita.r][bolita.c] = null;
  });

  // Particles and big-pop text
  spawnPopParticles(groupToPop);
  if (groupToPop.length >= 6) showBigPopText(groupToPop.length);

  // Count as a single pop event for economy
  const popColor = groupToPop[0]?.color || 'red';
  trackPop(popColor, groupToPop.length);

  let points = Math.round(calculatePoints(groupToPop.length) * comboMultiplier);
  trackScore(points);
  updateScore(points);
  checkQuestToasts();

  if (groupToPop.length > 0) {
    spawnFloatingScore(points, comboMultiplier, groupToPop[0].el);
  }

  await new Promise((res) => setTimeout(res, 200));

  settleBoard();

  setTimeout(() => {
    groupToPop.forEach((bolita) => {
      if (bolita.el.parentNode) bolita.el.parentNode.removeChild(bolita.el);
    });
    isAnimating = false;

    if (isBoardClear(grid)) {
      showCelebration();
      setTimeout(handleLevelComplete, 1000);
    } else if (!hasValidMove(grid)) {
      const config = getCurrentLevelConfig();
      if (score >= config.target) {
        document.getElementById('pass-level-btn').classList.add('hidden');
        handleLevelComplete();
      } else {
        showGameOver(false);
      }
    }
  }, 400);
}

/**
 * Synchronizes the footer tab active state.
 */
function syncFooterTabs(activeTab) {
  document.querySelectorAll('.app-footer-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.id === `footer-tab-${activeTab}`);
  });
}

// ─── ACTIVE STREAK ───────────────────────────────────────────────────────────

const STREAK_KEY = 'gloop_active_streak';
const STREAK_REWARDS = [
  { day: 3, coins: 100 },
  { day: 7, coins: 300 },
  { day: 14, coins: 500 },
  { day: 30, coins: 1000 },
];

function getStreakData() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: null };
  } catch (_) {
    return { count: 0, lastDate: null };
  }
}

// Local calendar day (NOT UTC): the "day" must flip at the player's midnight
function todayDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateActiveStreak() {
  const data = getStreakData();
  const today = todayDateString();
  if (data.lastDate === today) return; // already updated today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = todayDateString(yesterday);

  if (data.lastDate === yesterdayStr) {
    data.count++;
  } else {
    data.count = 1; // reset or first day
  }
  data.lastDate = today;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));

  const reward = STREAK_REWARDS.find((r) => r.day === data.count);
  if (reward) {
    addCoins(reward.coins);
    showIngameToast(t('streak_toast', { days: data.count, coins: reward.coins }));
  }
}

function renderActiveStreakBadge() {
  const data = getStreakData();
  const badge = document.getElementById('active-streak-display');
  const countEl = document.getElementById('active-streak-count');
  if (!badge || !countEl) return;
  if (data.count >= 2) {
    countEl.textContent = data.count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
