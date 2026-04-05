/* admob.js — AdMob ラッパー（Capacitor @capacitor-community/admob）
 *
 * 動作環境:
 *   - Capacitor ネイティブ（Android）→ AdMob バナーを表示
 *   - Web ブラウザ → 何もしない（AdSense は index.html で別途対応）
 *
 * 使い方:
 *   await AdMobManager.showBanner('dashboard');
 *   await AdMobManager.hideBanner();
 */

const AdMobManager = (() => {

  let _config      = null;
  let _initialized = false;
  let _isPremium   = false;

  // Capacitor ネイティブ環境かどうか
  const IS_NATIVE = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  // ── config 読み込み ──
  async function _loadConfig() {
    if (_config) return _config;
    try {
      const res = await fetch('./admob-config.json');
      _config = await res.json();
    } catch (e) {
      console.warn('[AdMob] config load failed:', e);
      _config = {};
    }
    return _config;
  }

  function _adUnitId(page) {
    const mode = _config?._test_mode ? 'test' : 'prod';
    return _config?.android?.banner?.[page]?.[mode] || '';
  }

  function _appId() {
    const mode = _config?._test_mode ? 'test' : 'prod';
    return _config?.android?.app_id?.[mode] || '';
  }

  // ── 初期化 ──
  async function init() {
    if (!IS_NATIVE) return;
    await _loadConfig();

    // プレミアム判定
    _isPremium = (await DB.Settings.get('is_premium', 'false')) === 'true';
    if (_isPremium) { console.log('[AdMob] Premium user – ads disabled'); return; }

    try {
      const { AdMob } = Capacitor.Plugins;
      await AdMob.initialize({
        requestTrackingAuthorization: false, // Android は不要
        testingDevices: [],
        initializeForTesting: !!_config._test_mode,
      });
      _initialized = true;
      console.log('[AdMob] initialized');
    } catch (e) {
      console.warn('[AdMob] initialize failed:', e);
    }
  }

  // ── バナー表示 ──
  async function showBanner(page = 'dashboard') {
    if (!IS_NATIVE || !_initialized || _isPremium) return;
    const adUnitId = _adUnitId(page);
    if (!adUnitId) return;
    try {
      const { AdMob, AdMobBannerSize, AdMobBannerPosition } = Capacitor.Plugins;
      await AdMob.showBanner({
        adId:     adUnitId,
        adSize:   'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin:   0,
        isTesting: !!_config._test_mode,
      });
    } catch (e) {
      console.warn('[AdMob] showBanner failed:', e);
    }
  }

  // ── バナー非表示 ──
  async function hideBanner() {
    if (!IS_NATIVE || !_initialized) return;
    try {
      const { AdMob } = Capacitor.Plugins;
      await AdMob.hideBanner();
    } catch (e) {}
  }

  // ── バナー削除 ──
  async function removeBanner() {
    if (!IS_NATIVE || !_initialized) return;
    try {
      const { AdMob } = Capacitor.Plugins;
      await AdMob.removeBanner();
    } catch (e) {}
  }

  // ── プレミアム状態を更新 ──
  async function setPremium(value) {
    _isPremium = value;
    await DB.Settings.set('is_premium', value ? 'true' : 'false');
    if (value) await removeBanner();
  }

  function isPremium() { return _isPremium; }
  function isNative()  { return IS_NATIVE; }

  return { init, showBanner, hideBanner, removeBanner, setPremium, isPremium, isNative };
})();
