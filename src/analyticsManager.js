import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

/**
 * AnalyticsManager (Singleton)
 *
 * Industry-standard wrapper for Firebase Analytics.
 * Features:
 * - Centralized Event Registry to prevent magic strings.
 * - Persistent User Properties for cross-event segmenting.
 * - Safe, non-blocking execution.
 */
class AnalyticsManager {
  // Centralized event names to avoid typos and magic strings
  static Events = {
    LEVEL_START: 'level_start',
    LEVEL_FAIL: 'level_fail',
    LEVEL_COMPLETE: 'level_complete',
    LEVEL_RETRY: 'level_retry',
    ECONOMY_SINK: 'economy_sink',
    BOOSTER_USED: 'booster_used',
    AD_IMPRESSION: 'ad_impression',
    AD_REWARD_WATCHED: 'ad_reward_watched',
    AD_FAILED: 'ad_failed',
    DAILY_FEATURE_USED: 'daily_feature_used',
    APP_OPEN: 'app_open',
    SHOP_OPENED: 'shop_opened',
    NOTIFICATION_PERMISSION: 'notification_permission',
    XP_REWARD_CLAIMED: 'xp_reward_claimed',
    COIN_REWARD_CLAIMED: 'coin_reward_claimed',
    PRESTART_BUFF_CLAIMED: 'prestart_buff_claimed',
    ADMOB_INITIALIZED: 'admob_initialized',
  };

  // Standard parameter keys
  static Params = {
    LEVEL_NUMBER: 'level_number',
    BIOME_NAME: 'biome_name',
    DIFFICULTY: 'difficulty',
    TURNS_LEFT: 'turns_left',
    SCORE: 'score',
    SCORE_ACHIEVED: 'score_achieved',
    FAIL_REASON: 'fail_reason',
    BOOSTERS_USED: 'boosters_used',
    ITEM_BOUGHT: 'item_bought',
    COST: 'cost',
    CURRENCY: 'currency',
    BOOSTER_NAME: 'booster_name',
    PLACEMENT: 'placement',
    FEATURE_NAME: 'feature_name',
    AD_TYPE: 'ad_type',
    PERMISSION_STATUS: 'permission_status',
  };

  constructor() {
    if (AnalyticsManager.instance) {
      return AnalyticsManager.instance;
    }
    this.debugMode = false;

    // Attach registries to instance for easier access from imports
    this.Events = AnalyticsManager.Events;
    this.Params = AnalyticsManager.Params;

    AnalyticsManager.instance = this;
  }

  /**
   * Log a custom event with sanitized parameters.
   */
  async logCustomEvent(eventName, parameters = {}) {
    try {
      if (!eventName || typeof eventName !== 'string') {
        if (this.debugMode) console.warn('[Analytics] Invalid event name:', eventName);
        return;
      }

      const sanitizedParams = this._sanitizeParameters(parameters);

      if (this.debugMode) {
        console.log(`[Analytics] Event: ${eventName}`, sanitizedParams);
      }

      FirebaseAnalytics.logEvent({
        name: eventName,
        params: sanitizedParams,
      }).catch((err) => {
        if (this.debugMode) console.error(`[Analytics] Firebase Error (${eventName}):`, err);
      });
    } catch (error) {
      if (this.debugMode) console.error(`[Analytics] Fatal Error:`, error);
    }
  }

  /**
   * Set a persistent user property (e.g. player_level, high_score).
   */
  async setUserProperty(name, value) {
    try {
      if (this.debugMode) {
        console.log(`[Analytics] UserProperty ${name} -> ${value}`);
      }

      FirebaseAnalytics.setUserProperty({
        key: name,
        value: String(value),
      }).catch((err) => {
        if (this.debugMode) console.error(`[Analytics] UserProperty Error (${name}):`, err);
      });
    } catch (error) {
      if (this.debugMode) console.error(`[Analytics] Fatal UserProperty Error:`, error);
    }
  }

  _sanitizeParameters(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');

      if (value === null || value === undefined) continue;

      if (typeof value === 'object') {
        sanitized[safeKey] = JSON.stringify(value).substring(0, 100);
      } else if (typeof value === 'boolean') {
        sanitized[safeKey] = value ? 1 : 0;
      } else {
        sanitized[safeKey] = value;
      }
    }
    return sanitized;
  }

  setDebugMode(enabled) {
    this.debugMode = !!enabled;
  }

  static getInstance() {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }
}

const analyticsManager = AnalyticsManager.getInstance();
export default analyticsManager;
