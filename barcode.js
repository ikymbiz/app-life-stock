/* barcode.js — JAN バーコードスキャン + Open Food Facts 照合 */
const BarcodeScanner = (() => {
  let activeScanner = null;

  // ── アレルゲン: OFF API tags → 日本語 ──
  const ALLERGEN_TAG_MAP = {
    'en:gluten': '小麦', 'en:wheat': '小麦',
    'en:eggs': '卵', 'en:egg': '卵',
    'en:milk': '乳', 'en:dairy': '乳', 'en:lactose': '乳',
    'en:soybeans': '大豆', 'en:soya': '大豆', 'en:soy': '大豆',
    'en:peanuts': '落花生', 'en:peanut': '落花生',
    'en:crustaceans': 'えび', 'en:shellfish': 'えび', 'en:shrimp': 'えび',
    'en:fish': 'さけ',
    'en:nuts': 'くるみ', 'en:walnuts': 'くるみ',
    'en:sesame': 'ごま', 'en:sesame-seeds': 'ごま',
    'en:almonds': 'アーモンド',
    'en:cashew-nuts': 'カシューナッツ',
    'en:macadamia-nuts': 'マカダミアナッツ',
    'en:pistachios': 'ピスタチオ',
    'en:celery': 'セロリ',
    'en:mustard': 'からし',
    'en:molluscs': 'あわび',
    'en:sulphites': '亜硫酸塩',
    'en:lupin': 'ルピナス',
    'en:banana': 'バナナ',
    'en:kiwi': 'キウイ',
    'en:peach': 'もも',
    'en:apple': 'りんご',
    'en:beef': '牛肉',
    'en:pork': '豚肉',
    'en:chicken': '鶏肉',
    'en:gelatin': 'ゼラチン',
    'en:mackerel': 'さば',
    'en:salmon': 'さけ',
  };

  const ALLERGENS_JP = [
    '小麦','卵','乳','そば','落花生','ピーナッツ','えび','かに','くるみ',
    'アーモンド','あわび','いか','いくら','オレンジ','カシューナッツ','キウイ',
    '牛肉','ごま','さけ','さば','大豆','鶏肉','バナナ','豚肉','もも',
    'やまいも','りんご','ゼラチン','マカダミアナッツ','まつたけ',
  ];

  // Open Food Facts カテゴリ → 内部カテゴリ
  function mapCategory(tags = []) {
    const s = tags.join(' ').toLowerCase();
    if (/water|mineral|drink|beverage|juice|tea|water|飲料|水/.test(s)) return 'water';
    if (/medicine|drug|supplement|vitamin|薬|サプリ/.test(s))          return 'medicine';
    if (/sanitation|hygiene|soap|detergent|toilet|衛生/.test(s))       return 'sanitation';
    if (/pet|dog|cat|animal|ペット/.test(s))                            return 'pet';
    if (/food|meal|noodle|rice|bread|snack|cereal|can|食品|麺|米|缶/.test(s)) return 'food';
    return 'food';
  }

  function extractAllergens(tags = [], ingredientsText = '') {
    const fromTags = tags.map(t => ALLERGEN_TAG_MAP[t]).filter(Boolean);
    const fromText = ALLERGENS_JP.filter(a => ingredientsText.includes(a));
    return [...new Set([...fromTags, ...fromText])];
  }

  // ── Open Food Facts API ──
  async function lookupBarcode(code) {
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_ja,allergens_tags,categories_tags,ingredients_text,ingredients_text_ja`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      const name      = p.product_name_ja || p.product_name || '';
      const category  = mapCategory(p.categories_tags);
      const ingText   = p.ingredients_text_ja || p.ingredients_text || '';
      const allergens = extractAllergens(p.allergens_tags, ingText);

      return { barcode: code, name, category, allergens };
    } catch (e) {
      console.warn('[OFF]', e);
      return null;
    }
  }

  // ── html5-qrcode のロード（遅延）──
  function loadHtml5Qrcode() {
    return new Promise((resolve, reject) => {
      if (typeof Html5Qrcode !== 'undefined') { resolve(); return; }
      const s = document.createElement('script');
      s.src     = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── スキャナーを停止（モーダルを閉じる前に必ず呼ぶ）──
  async function stopScanner() {
    if (activeScanner) {
      try { await activeScanner.stop(); } catch { /* ignore */ }
      activeScanner = null;
    }
  }

  // ── メインスキャナーUI ──
  async function openScanner(onResult) {
    // ライブラリを確保
    try { await loadHtml5Qrcode(); }
    catch { Toast.error('スキャナーの読み込みに失敗しました（オフライン？）'); return; }

    const html = `
      <p style="font-size:13px;color:var(--txt-3);text-align:center;margin-bottom:10px;">
        バーコードをカメラに向けてください<br>
        <span style="font-size:11px;">JAN / EAN-13 / QR / Code128 対応</span>
      </p>
      <div id="barcode-region" style="width:100%;border-radius:12px;overflow:hidden;background:#000;min-height:200px;"></div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="BarcodeScanner.cancelScan()">キャンセル</button>
        <button class="btn btn-ghost btn-sm" onclick="BarcodeScanner.scanFromFile()">
          📁 画像ファイルから読取
        </button>
      </div>
      <style>
        #barcode-region video { border-radius:12px; }
        #barcode-region img[alt="Info icon"] { display:none; }
        #html5-qrcode-button-camera-permission { display:none; }
        #html5-qrcode-anchor-scan-type-change { color:var(--blue) !important; }
      </style>`;

    Modal.open('📱 バーコードスキャン', html, () => stopScanner());

    setTimeout(async () => {
      const regionEl = document.getElementById('barcode-region');
      if (!regionEl) return;
      try {
        activeScanner = new Html5Qrcode('barcode-region');
        await activeScanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 260, height: 100 }, aspectRatio: 1.77 },
          async (code) => {
            await stopScanner();
            Modal.close();
            onResult(code);
          },
          () => {} // スキャン中エラーは無視
        );
      } catch (e) {
        Modal.close();
        if (e.name === 'NotAllowedError') Toast.error('カメラへのアクセスを許可してください');
        else Toast.error('カメラの起動に失敗しました');
      }
    }, 300);
  }

  // ── ファイルから読取（カメラ不可の場合のフォールバック）──
  async function scanFromFile() {
    await stopScanner();
    Modal.close();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await loadHtml5Qrcode();
        const scanner = new Html5Qrcode('__temp_scan__');
        const result  = await scanner.scanFile(file, false).catch(() => null);
        if (result) {
          await handleScanResult(result);
        } else {
          Toast.error('バーコードを検出できませんでした');
        }
      } catch { Toast.error('読み取りに失敗しました'); }
    };
    input.click();
  }

  async function cancelScan() {
    await stopScanner();
    Modal.close();
  }

  // ── スキャン結果処理 → Open Food Facts → フォームへ反映 ──
  async function handleScanResult(code) {
    Toast.show(`🔍 JANコード: ${code}  照合中...`);
    const product = await lookupBarcode(code);

    if (!product || !product.name) {
      Toast.show(`JANコード ${code} の商品情報が見つかりませんでした。手動で入力してください`);
      return;
    }

    // フォームへ反映
    const nameEl = document.getElementById('f-name');
    const catEl  = document.getElementById('f-category');
    if (nameEl && !nameEl.value) nameEl.value = product.name;
    if (catEl && product.category) catEl.value = product.category;

    // アレルゲン反映
    if (product.allergens.length) {
      const hidden = document.getElementById('f-allergens-hidden');
      if (hidden) {
        const current = hidden.value ? hidden.value.split(',').map(a=>a.trim()) : [];
        const merged  = [...new Set([...current, ...product.allergens])];
        hidden.value  = merged.join(',');
        if (typeof InventoryPage !== 'undefined') {
          InventoryPage.renderAllergenUI(merged);
        }
      }
    }

    const allergenMsg = product.allergens.length ? `  アレルゲン: ${product.allergens.join('・')}` : '';
    Toast.success(`✅ ${product.name}${allergenMsg}`);
  }

  // ── 外部から直接バーコードスキャンを起動（inventory.js から呼ぶ）──
  async function scanAndFill() {
    openScanner(handleScanResult);
  }

  return { scanAndFill, scanFromFile, cancelScan, lookupBarcode, handleScanResult };
})();
