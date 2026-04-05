/* billing.js — Google Play 課金ラッパー（Capacitor @capacitor-community/in-app-purchases）
 *
 * 商品ID: lifestock_premium（買い切り）
 * 購入後: AdMobManager.setPremium(true) を呼び広告を停止
 */

const BillingManager = (() => {

  const PRODUCT_ID   = 'lifestock_premium';
  const IS_NATIVE    = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  let _initialized   = false;

  // ── 初期化・購入状態の復元 ──
  async function init() {
    if (!IS_NATIVE) return;
    try {
      const { InAppPurchases } = Capacitor.Plugins;
      await InAppPurchases.initialize();
      _initialized = true;

      // 既購入の復元（アプリ起動時に自動チェック）
      await _restoreFromStore(false);
    } catch (e) {
      console.warn('[Billing] init failed:', e);
    }
  }

  // ── 商品情報を取得 ──
  async function getProduct() {
    if (!IS_NATIVE || !_initialized) return null;
    try {
      const { InAppPurchases } = Capacitor.Plugins;
      const res = await InAppPurchases.getProducts({ productIds: [PRODUCT_ID] });
      return res.products?.[0] || null;
    } catch (e) {
      console.warn('[Billing] getProduct failed:', e);
      return null;
    }
  }

  // ── 購入 ──
  async function purchase() {
    if (!IS_NATIVE || !_initialized) {
      Toast.error('この機能はアプリ版のみ利用できます');
      return false;
    }
    try {
      const { InAppPurchases } = Capacitor.Plugins;
      const result = await InAppPurchases.purchaseProduct({ productId: PRODUCT_ID });
      if (result.state === 'purchased' || result.state === 'restored') {
        await InAppPurchases.finishTransaction({ transactionId: result.transactionId });
        await AdMobManager.setPremium(true);
        Toast.success('✅ プレミアムへようこそ！広告が非表示になりました');
        return true;
      }
      return false;
    } catch (e) {
      if (e.code === 'USER_CANCELLED') return false;
      Toast.error('購入に失敗しました: ' + e.message);
      return false;
    }
  }

  // ── 購入復元 ──
  async function restore(showToast = true) {
    if (!IS_NATIVE || !_initialized) return false;
    return await _restoreFromStore(showToast);
  }

  async function _restoreFromStore(showToast) {
    try {
      const { InAppPurchases } = Capacitor.Plugins;
      const res = await InAppPurchases.restoreTransactions();
      const found = (res.transactions || []).some(t =>
        t.productId === PRODUCT_ID && (t.state === 'purchased' || t.state === 'restored')
      );
      if (found) {
        await AdMobManager.setPremium(true);
        if (showToast) Toast.success('✅ 購入を復元しました');
      } else {
        if (showToast) Toast.show('復元できる購入が見つかりませんでした');
      }
      return found;
    } catch (e) {
      console.warn('[Billing] restore failed:', e);
      if (showToast) Toast.error('復元に失敗しました');
      return false;
    }
  }

  return { init, getProduct, purchase, restore };
})();
