/* shopping.js — Shopping List Page */
const ShoppingPage = (() => {

  // ── 楽天商品キャッシュ ──
  // 1層目: メモリキャッシュ（セッション中は再検索しない）
  // 2層目: IndexedDB キャッシュ（TTL 7日、アプリ再起動後も保持）
  const _memCache = new Map(); // keyword → products[]
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7日

  function _cacheKey(keyword) {
    return 'rakuten_products:' + keyword.toLowerCase().trim();
  }

  async function _getCached(keyword) {
    const key = _cacheKey(keyword);
    // 1. メモリキャッシュ（同期）
    if (_memCache.has(key)) return _memCache.get(key);
    // 2. IndexedDB 専用キャッシュストア（product_cache）
    try {
      const raw = await DB.ProductCache.get(key);
      if (raw) {
        const { products, cached_at } = JSON.parse(raw);
        if (Date.now() - cached_at < CACHE_TTL) {
          _memCache.set(key, products); // メモリにも載せる
          return products;
        }
      }
    } catch {}
    return null;
  }

  async function _setCached(keyword, products) {
    const key = _cacheKey(keyword);
    _memCache.set(key, products);
    try {
      // product_cache 専用ストアに保存（settings とは分離）
      await DB.ProductCache.set(key, JSON.stringify({ products, cached_at: Date.now() }));
    } catch {}
  }

  // ── 楽天商品検索（キャッシュ付き）──
  async function _searchRakuten(keyword, hits = 2) {
    // キャッシュヒット → APIを叩かずに返す
    const cached = await _getCached(keyword);
    if (cached) return cached;

    const appId = await DB.Settings.get('rakuten_app_id', '');
    const affId = await DB.Settings.get('rakuten_affiliate_id', '');
    if (!appId) return [];
    const params = new URLSearchParams({
      applicationId: appId,
      keyword,
      hits,
      sort: '-reviewCount',
      availability: 1,
      imageFlag: 1,
    });
    const res = await fetch(
      'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?' + params
    );
    if (!res.ok) return [];
    const data = await res.json();
    const products = (data.Items || []).map(({ Item: i }) => {
      const affUrl = affId
        ? 'https://hb.afl.rakuten.co.jp/hgc/' + affId + '/?pc=' + encodeURIComponent(i.itemUrl)
        : i.itemUrl;
      return {
        name:           i.itemName.slice(0, 50),
        price:          i.itemPrice,
        image_url:      i.mediumImageUrls?.[0]?.imageUrl || null,
        url:            affUrl,
        review_average: i.reviewAverage || null,
        review_count:   i.reviewCount   || null,
      };
    });

    // キャッシュに保存（空配列も保存して再APIを防ぐ）
    await _setCached(keyword, products);
    return products;
  }

  // 楽天商品コンパクトカード（アイテム下に表示）
  function _rakutenProductHTML(product) {
    const stars = product.review_average
      ? '★'.repeat(Math.round(product.review_average)) + '☆'.repeat(5 - Math.round(product.review_average))
      : '';
    return `<a href="${Utils.escape(product.url)}" target="_blank" rel="noopener noreferrer"
      style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:8px;
             background:#fff;border:1px solid #ffd0d0;text-decoration:none;margin-bottom:6px;">
      ${product.image_url
        ? `<img src="${Utils.escape(product.image_url)}" alt="" loading="lazy"
            style="width:48px;height:48px;object-fit:contain;border-radius:5px;flex-shrink:0;background:#f5f5f5;">`
        : `<div style="width:48px;height:48px;border-radius:5px;background:#eee;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;font-size:18px;">🛒</div>`}
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;color:var(--txt-1);font-weight:600;line-height:1.4;
          overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${Utils.escape(product.name)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
          ${product.price ? `<span style="font-size:13px;font-weight:700;color:var(--red);">¥${Number(product.price).toLocaleString()}</span>` : ''}
          ${stars ? `<span style="font-size:10px;color:var(--amber);">${stars}</span>` : ''}
        </div>
      </div>
      <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;
        background:#BF0000;color:#fff;flex-shrink:0;">楽天</span>
    </a>`;
  }

  // アイテムごとの楽天商品をロード（キャッシュ優先）
  async function _loadItemProducts(itemId, keyword) {
    const el = document.getElementById('shop-products-' + itemId);
    if (!el) return;
    try {
      const products = await _searchRakuten(keyword);
      if (!products.length) { el.remove(); return; }
      el.innerHTML =
        '<div style="font-size:11px;color:var(--txt-3);font-weight:700;margin-bottom:6px;">🛍️ 楽天おすすめ商品</div>' +
        products.map(_rakutenProductHTML).join('');
    } catch {
      el.remove();
    }
  }

  // ── ページ描画 ──
  async function render() {
    const [shopping, items] = await Promise.all([
      DB.Shopping.getAll(),
      DB.Items.getAll(),
    ]);

    const suggestions = items.filter(i =>
      i.min_qty > 0 && i.total_count < i.min_qty &&
      !shopping.some(s => s.name === i.name && !s.is_bought)
    );

    const el      = document.getElementById('page-shopping');
    const pending = shopping.filter(s => !s.is_bought);
    const bought  = shopping.filter(s => s.is_bought);

    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">買い物リスト</div>
            <div style="font-size:13px;color:var(--txt-3);margin-top:2px;">未購入 ${pending.length}件</div>
          </div>
          ${bought.length ? `<button class="btn btn-ghost btn-sm" onclick="ShoppingPage.clearBought()">✓ 購入済みを削除</button>` : ''}
        </div>
      </div>

      ${suggestions.length ? `
      <div class="section-header">
        <span class="section-title">📉 在庫不足（提案）</span>
      </div>
      <div class="card" style="background:var(--amber-dim);border-color:var(--amber-border);margin-bottom:14px;">
        <div style="font-size:13px;color:var(--amber);font-weight:700;margin-bottom:10px;">
          在庫が目標数を下回っているアイテムです
        </div>
        ${suggestions.map(i => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
            <div>
              <div style="font-size:14px;font-weight:600;">${Utils.escape(i.name)}</div>
              <div style="font-size:12px;color:var(--txt-3);">在庫 ${i.total_count}${i.count_unit || '個'} / 目標 ${i.min_qty}${i.count_unit || '個'}</div>
            </div>
            <button class="btn btn-sm" style="background:var(--amber);color:white;"
              onclick="ShoppingPage.addSuggestion(${i.id})">追加</button>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="section-header">
        <span class="section-title">🛒 購入リスト</span>
        <button class="section-action" onclick="ShoppingPage.openAddModal()">＋ 手動追加</button>
      </div>

      <div id="shopping-list">
        ${pending.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <div class="empty-title">買い物リストは空です</div>
          <div class="empty-sub">在庫が不足すると自動で追加されます<br>または右上の ＋ から手動追加</div>
        </div>` :
        pending.map(item => {
          // _memCache を同期チェック：ヒットすれば商品 HTML を即埋め込み
          const key = _cacheKey(item.name);
          if (_memCache.has(key)) {
            const products = _memCache.get(key);
            return shoppingItemHTML(item, _buildProductsHTML(products));
          }
          // 未キャッシュ → null を渡してプレースホルダーを表示（後で非同期ロード）
          return shoppingItemHTML(item, null);
        }).join('')}
      </div>

      ${bought.length ? `
      <div class="section-header" style="margin-top:20px;">
        <span class="section-title">✅ 購入済み</span>
      </div>
      ${bought.map(item => shoppingItemHTML(item)).join('')}` : ''}

      <!-- フィードセクション（非同期） -->
      <div id="shopping-feed-sections"></div>
    </div>`;

    // 楽天商品ロード：_memCache にないアイテムのみ非同期で取得
    // （_memCache にあるアイテムは上の shoppingItemHTML で既に埋め込み済み）
    const rakutenAppId = await DB.Settings.get('rakuten_app_id', '');
    if (rakutenAppId) {
      // _memCache に存在しないアイテムだけを抽出（同期チェック）
      const needFetch = pending.filter(item => !_memCache.has(_cacheKey(item.name)));

      if (needFetch.length) {
        // IndexedDB キャッシュもチェックして分類
        const cached   = [];
        const uncached = [];
        for (const item of needFetch) {
          const hit = await _getCached(item.name);
          if (hit !== null) cached.push(item);
          else              uncached.push(item);
        }
        // IndexedDB キャッシュ済みは並列で即表示
        cached.forEach(item => _loadItemProducts(item.id, item.name));
        // 未キャッシュは順番に（400ms 間隔でAPIを叩く）
        (async () => {
          for (let i = 0; i < uncached.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 400));
            await _loadItemProducts(uncached[i].id, uncached[i].name);
          }
        })();
      }
    }

    // フィードセクション非同期ロード
    _loadFeedSections(shopping);
  }

  // ── フィードセクション（お得情報 / おすすめ / アレルギー配慮）──
  async function _loadFeedSections(shopping) {
    const el = document.getElementById('shopping-feed-sections');
    if (!el) return;
    try {
      const [allItems, familyAllergens] = await Promise.all([
        FeedPage.getDeals().then(d => d).catch(() => []),
        FeedPage._getFamilyAllergens(),
      ]);
      const feedItems = await (async () => {
        try {
          // deal + recommend 両方取得
          const feed = await FeedPage._fetchFeedPublic();
          return feed?.items || [];
        } catch { return []; }
      })();

      if (!feedItems.length) return;

      const deals     = feedItems.filter(i => i.type === 'deal');
      const recommends = feedItems.filter(i => i.type === 'recommend');
      const shopNames  = shopping.map(s => s.name.toLowerCase());
      let html = '';

      // ── 関連お得情報 ──
      const scoredDeals = deals.map(d => {
        const tags  = (d.tags || []).map(t => t.toLowerCase());
        const score = tags.reduce((s, t) => s + (shopNames.some(n => n.includes(t) || t.includes(n)) ? 1 : 0), 0);
        return { deal: d, score };
      });
      const topDeals = scoredDeals.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.deal);
      if (topDeals.length) {
        html += `<div class="section-header" style="margin-top:20px;">
          <span class="section-title">🏷️ 関連お得情報</span>
          <button class="section-action" onclick="App.navigate('feed')">すべて見る →</button>
        </div>
        ${topDeals.map(d => FeedPage.dealCardCompactHTML(d, familyAllergens, false)).join('')}`;
      }

      // ── おすすめ（フィード recommend）──
      if (recommends.length) {
        html += `<div class="section-header" style="margin-top:20px;">
          <span class="section-title">✨ おすすめ</span>
          <button class="section-action" onclick="App.navigate('feed')">すべて見る →</button>
        </div>
        ${recommends.slice(0, 3).map(d => FeedPage.dealCardCompactHTML(d, familyAllergens, false)).join('')}`;
      }

      // ── アレルギー配慮おすすめ ──
      if (familyAllergens.size) {
        const allergenDeals = deals
          .filter(d => (d.allergen_free || []).some(a => familyAllergens.has(a)))
          .filter(d => !topDeals.includes(d))
          .slice(0, 3);
        if (allergenDeals.length) {
          html += `<div class="section-header" style="margin-top:20px;">
            <span class="section-title">✅ アレルギー配慮おすすめ</span>
          </div>
          <div style="font-size:12px;color:var(--txt-3);margin-bottom:10px;">
            ${[...familyAllergens].join('・')}を避けた商品のご提案
          </div>
          ${allergenDeals.map(d => FeedPage.dealCardCompactHTML(d, familyAllergens, true)).join('')}`;
        }
      }

      if (html) el.innerHTML = html;
    } catch { /* フィード未設定時は無視 */ }
  }

  // キャッシュ済み商品の HTML を同期的に生成（render() 内で使用）
  function _buildProductsHTML(products) {
    if (!products || !products.length) return '';
    return '<div style="font-size:11px;color:var(--txt-3);font-weight:700;margin-bottom:6px;">🛍️ 楽天おすすめ商品</div>' +
      products.map(_rakutenProductHTML).join('');
  }

  // preloadedHTML: _memCache にヒットした場合に呼び出し元から渡される商品 HTML
  //               null  → まだ未取得（非同期ロードのプレースホルダーを表示）
  //               ''    → 取得済みだが商品なし（プレースホルダー自体を省略）
  function shoppingItemHTML(item, preloadedHTML = null) {
    const amName   = encodeURIComponent(item.name);
    const amUrl    = 'https://www.amazon.co.jp/s?k=' + amName;
    const rakuUrl  = 'https://search.rakuten.co.jp/search/mall/' + amName + '/';
    const isBought = item.is_bought;
    const linksRow = isBought ? '' :
      '<div class="shop-row-links">' +
        '<a href="' + amUrl   + '" target="_blank" rel="noopener noreferrer" class="shop-buy-btn shop-buy-amazon">🛒 Amazon で探す</a>' +
        '<a href="' + rakuUrl + '" target="_blank" rel="noopener noreferrer" class="shop-buy-btn shop-buy-rakuten">🛒 楽天で探す</a>' +
      '</div>';

    // 楽天商品エリア（購入済みは非表示）
    // preloadedHTML が渡された場合 → 即座に商品を埋め込み（ローディング表示なし）
    // null の場合               → 非同期ロード用プレースホルダーを表示
    let productsPlaceholder = '';
    if (!isBought) {
      if (preloadedHTML === null) {
        // 未キャッシュ：非同期で後からロード
        productsPlaceholder =
          '<div id="shop-products-' + item.id + '" style="padding:0 0 10px;">' +
            '<div class="shop-products-loading" style="font-size:11px;color:var(--txt-3);padding:4px 0;">🔍 関連商品を読み込み中...</div>' +
          '</div>';
      } else if (preloadedHTML !== '') {
        // キャッシュ済みで商品あり：そのまま埋め込む（再取得不要）
        productsPlaceholder =
          '<div id="shop-products-' + item.id + '" style="padding:0 0 10px;">' +
            preloadedHTML +
          '</div>';
      }
      // preloadedHTML === '' → 商品なし → プレースホルダー不要
    }

    return '<div class="shopping-item ' + (isBought ? 'bought' : '') + '" id="shop-' + item.id + '">' +
      '<div class="shop-row-top">' +
        '<div class="shop-check ' + (isBought ? 'checked' : '') + '" onclick="ShoppingPage.toggleBought(' + item.id + ', ' + !isBought + ')"></div>' +
        '<div class="shop-info">' +
          '<div class="shop-name">' + Utils.escape(item.name) + '</div>' +
          '<div class="shop-sub">' + (item.qty_needed || 1) + (item.unit ? Utils.escape(item.unit) : '個') + '</div>' +
        '</div>' +
        '<button class="shop-delete-btn" onclick="ShoppingPage.deleteItem(' + item.id + ')">✕</button>' +
      '</div>' +
      linksRow +
      productsPlaceholder +
    '</div>';
  }

  function openAddModal() {
    const html = `
      <div class="form-group">
        <label class="form-label">品名 *</label>
        <input id="s-name" class="form-input" placeholder="例: ミネラルウォーター 2L">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">数量</label>
          <input id="s-qty" type="number" class="form-input" value="1" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">単位</label>
          <select id="s-unit" class="form-select">
            ${['個','本','袋','缶','箱','枚','食','セット'].map(u=>`<option>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="ShoppingPage.addManual()">➕ 追加する</button>
    `;
    Modal.open('➕ 手動で追加', html);
  }

  async function addManual() {
    const name = document.getElementById('s-name')?.value.trim();
    if (!name) { Toast.error('品名を入力してください'); return; }
    await DB.Shopping.add({
      name,
      qty_needed: parseFloat(document.getElementById('s-qty')?.value) || 1,
      unit: document.getElementById('s-unit')?.value || '個',
    });
    Toast.success('🛒 追加しました');
    Modal.close();
    render();
  }

  async function addSuggestion(itemId) {
    const item = await DB.Items.get(itemId);
    if (!item) return;
    await DB.Shopping.add({
      name:       item.name,
      qty_needed: item.min_qty - item.total_count,
      unit:       item.count_unit || '個',
    });
    Toast.success('🛒 リストに追加しました');
    render();
  }

  async function toggleBought(id, isBought) {
    const all  = await DB.Shopping.getAll();
    const item = all.find(s => s.id === id);
    if (!item) return;
    item.is_bought = isBought;
    await DB.Shopping.update(item);
    render();
  }

  async function deleteItem(id) {
    await DB.Shopping.delete(id);
    render();
  }

  async function clearBought() {
    await DB.Shopping.clearBought();
    Toast.success('購入済みを削除しました');
    render();
  }

  return { render, openAddModal, addManual, addSuggestion, toggleBought, deleteItem, clearBought };
})();
