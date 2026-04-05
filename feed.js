/* feed.js — LifeStock フィード（お得情報・コラム・おすすめ） */
const FeedPage = (() => {

  let _cache     = null;
  let _cacheTime = 0;
  const CACHE_TTL = 30 * 60 * 1000; // 30分

  const TYPE_META = {
    deal:      { label:'🏷️ お得情報', bg:'var(--amber-dim)',  border:'var(--amber-border)',  color:'var(--amber)' },
    column:    { label:'📖 コラム',   bg:'var(--blue-dim)',   border:'var(--blue-border)',   color:'var(--blue)'  },
    recommend: { label:'✨ おすすめ', bg:'var(--green-dim)',  border:'var(--green-border)',  color:'var(--green)' },
  };

  // ── フィード取得（キャッシュ付き）──
  async function _fetchFeed(forceRefresh = false) {
    if (!forceRefresh && _cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
    const url = await DB.Settings.get('feed_url', '');
    if (!url) return null;
    const res = await fetch(url + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _cache     = await res.json();
    _cacheTime = Date.now();
    return _cache;
  }

  // ── 家族のアレルゲン一覧を取得 ──
  async function _getFamilyAllergens() {
    try {
      const profiles = await DB.Profiles.getAll();
      const set = new Set();
      for (const p of profiles) {
        (p.allergies_food || '').split(',').map(a => a.trim()).filter(Boolean).forEach(a => set.add(a));
      }
      return set;
    } catch { return new Set(); }
  }

  // 商品名・タイトル・本文に家族アレルゲンが含まれるか判定
  function _detectAllergens(text, familyAllergens) {
    if (!familyAllergens.size) return [];
    return [...familyAllergens].filter(a => text.includes(a));
  }

  // deal タイプのみ返す（shopping.js から利用）
  async function getDeals() {
    try {
      const feed = await _fetchFeed();
      return (feed?.items || []).filter(i => i.type === 'deal');
    } catch { return []; }
  }

  // ── ページ描画 ──
  async function render() {
    const el = document.getElementById('page-feed');
    if (!el) return;
    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:var(--font-display);font-size:22px;font-weight:700;">フィード</div>
          <div style="font-size:12px;color:var(--txt-3);margin-top:2px;">お得情報・コラム・おすすめ</div>
        </div>
        <button onclick="FeedPage._refresh()" style="
          padding:6px 12px;border-radius:8px;border:1px solid var(--border);
          background:var(--bg-2);color:var(--txt-2);font-size:12px;font-weight:700;cursor:pointer;">
          🔄 更新
        </button>
      </div>
      <div id="feed-list" style="margin-top:16px;">
        <div style="text-align:center;padding:48px 0;">
          <div style="font-size:36px;margin-bottom:10px;animation:pulse 1.2s infinite;">📡</div>
          <div style="font-size:13px;color:var(--txt-3);">読み込み中...</div>
        </div>
      </div>
    </div>`;
    await _loadAndRender();
  }

  async function _refresh() {
    _cache = null;
    const listEl = document.getElementById('feed-list');
    if (listEl) listEl.innerHTML = `<div style="text-align:center;padding:48px 0;">
      <div style="font-size:36px;margin-bottom:10px;animation:pulse 1.2s infinite;">📡</div>
      <div style="font-size:13px;color:var(--txt-3);">更新中...</div></div>`;
    await _loadAndRender();
  }

  async function _loadAndRender() {
    const listEl = document.getElementById('feed-list');
    if (!listEl) return;
    try {
      const [feed, familyAllergens] = await Promise.all([_fetchFeed(), _getFamilyAllergens()]);
      if (!feed) {
        listEl.innerHTML = `
          <div style="text-align:center;padding:48px 16px;">
            <div style="font-size:48px;margin-bottom:14px;">📡</div>
            <div style="font-size:16px;font-weight:700;margin-bottom:8px;">フィードが未設定です</div>
            <div style="font-size:13px;color:var(--txt-3);margin-bottom:20px;line-height:1.6;">
              設定からフィードURLを登録してください
            </div>
            <button class="btn btn-secondary" onclick="App.navigate('settings')">⚙️ 設定へ</button>
          </div>`;
        return;
      }
      const items = feed.items || [];
      if (!items.length) {
        listEl.innerHTML = `<div style="text-align:center;padding:48px;color:var(--txt-3);font-size:13px;">記事がありません</div>`;
        return;
      }
      if (feed.generated_at) {
        const d = new Date(feed.generated_at);
        const label = isNaN(d) ? '' :
          `最終更新: ${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        listEl.innerHTML = `<div style="font-size:11px;color:var(--txt-3);text-align:right;margin-bottom:12px;">${label}</div>`;
      } else {
        listEl.innerHTML = '';
      }

      // アレルギー家族がいる場合は注意バナー
      if (familyAllergens.size) {
        listEl.innerHTML += `<div style="background:var(--red-dim);border:1px solid var(--red-border);
          border-radius:10px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--red);">
          ⚠️ 商品名にアレルゲンが含まれる場合は警告を表示しています
        </div>`;
      }

      listEl.innerHTML += items.map(item => _cardHTML(item, familyAllergens)).join('');
    } catch (e) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:32px 16px;">
          <div style="font-size:36px;margin-bottom:10px;">⚠️</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:6px;">読み込みに失敗しました</div>
          <div style="font-size:12px;color:var(--txt-3);margin-bottom:16px;">${Utils.escape(e.message)}</div>
          <button class="btn btn-secondary" onclick="FeedPage._refresh()">🔄 再試行</button>
        </div>`;
    }
  }

  // ── 記事カード ──
  function _cardHTML(item, familyAllergens = new Set()) {
    const meta     = TYPE_META[item.type] || { label:'📰 その他', bg:'var(--bg-2)', border:'var(--border)', color:'var(--txt-2)' };
    const bodyTxt  = (item.body || '').replace(/\n/g, '<br>');
    const tagsHTML = (item.tags || []).map(t =>
      `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--bg-3);color:var(--txt-3);">${Utils.escape(t)}</span>`
    ).join('');

    // アレルギー配慮バッジ（allergen_free フィールド）
    const freeFor = (item.allergen_free || []).filter(a => familyAllergens.has(a));
    const allergenFreeBadge = freeFor.length
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:5px;
           background:var(--green-dim);border:1px solid var(--green-border);color:var(--green);font-weight:700;">
           ✅ ${freeFor.join('・')}不使用
         </span>`
      : '';

    // 商品名・タイトルにアレルゲンが含まれる場合の警告
    const titleAllergens = _detectAllergens(item.title + ' ' + (item.body || ''), familyAllergens);
    const allergenWarnBadge = titleAllergens.length
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:5px;
           background:var(--red-dim);border:1px solid var(--red-border);color:var(--red);font-weight:700;">
           ⚠️ ${titleAllergens.join('・')}含む可能性
         </span>`
      : '';

    const productsHTML  = _productsHTML(item.products, item.amazon_search_url, familyAllergens);
    const fallbackLinks = (!item.products || !item.products.length)
      ? (item.links || []).map(l => _linkBtnHTML(l)).join('') : '';

    return `<div style="background:#fff;border:1px solid var(--border);border-radius:14px;margin-bottom:14px;overflow:hidden;">
      <!-- ヘッダー -->
      <div style="padding:12px 14px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--bg-3);">
        <span style="font-size:11px;font-weight:700;color:${meta.color};background:${meta.bg};
          border:1px solid ${meta.border};padding:2px 8px;border-radius:5px;">${meta.label}</span>
        ${allergenFreeBadge}
        ${allergenWarnBadge}
        ${item.published_at ? `<span style="font-size:11px;color:var(--txt-3);margin-left:auto;">${Utils.escape(item.published_at)}</span>` : ''}
      </div>
      <!-- 本文 -->
      <div style="padding:12px 14px 10px;">
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;line-height:1.4;">${Utils.escape(item.title)}</div>
        <div style="font-size:13px;color:var(--txt-2);line-height:1.75;">${bodyTxt}</div>
      </div>
      <!-- 商品カード -->
      ${productsHTML}
      <!-- フォールバックリンク -->
      ${fallbackLinks ? `<div style="padding:0 14px 14px;display:flex;gap:8px;flex-wrap:wrap;">${fallbackLinks}</div>` : ''}
      <!-- タグ -->
      ${tagsHTML ? `<div style="padding:0 14px 12px;display:flex;gap:4px;flex-wrap:wrap;">${tagsHTML}</div>` : ''}
    </div>`;
  }

  // 楽天実商品カード + Amazonリンク（アレルゲン警告付き）
  function _productsHTML(products, amazonSearchUrl, familyAllergens = new Set()) {
    if (!products || !products.length) return '';
    const cards = products.map(p => {
      const detected = _detectAllergens(p.name, familyAllergens);
      const warnHTML = detected.length
        ? `<div style="font-size:10px;font-weight:700;color:var(--red);
             background:var(--red-dim);border-radius:4px;padding:2px 6px;margin-bottom:4px;display:inline-block;">
             ⚠️ ${detected.join('・')}含む可能性
           </div>` : '';
      const sourceBg  = p.source === 'amazon' ? '#FF9900' : '#BF0000';
      const sourceLbl = p.source === 'amazon' ? '🛒 Amazonで購入' : '🛒 楽天で購入';

      return `<div style="display:flex;gap:10px;align-items:flex-start;
        background:var(--bg-2);border-radius:10px;padding:10px;margin-bottom:8px;">
        ${p.image_url
          ? `<img src="${Utils.escape(p.image_url)}" alt="" loading="lazy"
              style="width:72px;height:72px;object-fit:contain;border-radius:6px;flex-shrink:0;background:#fff;">`
          : `<div style="width:72px;height:72px;border-radius:6px;background:#eee;flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:24px;">🛒</div>`}
        <div style="flex:1;min-width:0;">
          ${warnHTML}
          <div style="font-size:12px;font-weight:700;line-height:1.4;margin-bottom:4px;
            overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
            ${Utils.escape(p.name)}
          </div>
          ${p.price ? `<div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:6px;">
            ¥${Number(p.price).toLocaleString()}
            ${p.price_per_unit ? `<span style="font-size:10px;font-weight:400;color:var(--txt-3);">${Utils.escape(p.price_per_unit)}</span>` : ''}
          </div>` : ''}
          ${p.review_average ? `<div style="font-size:11px;color:var(--amber);margin-bottom:6px;">
            ${'★'.repeat(Math.round(p.review_average))}${'☆'.repeat(5-Math.round(p.review_average))}
            <span style="color:var(--txt-3);">${p.review_average}（${(p.review_count||0).toLocaleString()}件）</span>
          </div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <a href="${Utils.escape(p.url)}" target="_blank" rel="noopener noreferrer"
              style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;
                     background:${sourceBg};color:#fff;font-size:11px;font-weight:700;text-decoration:none;">
              ${sourceLbl}
            </a>
            ${p.source !== 'amazon' && amazonSearchUrl
              ? `<a href="${Utils.escape(amazonSearchUrl)}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;
                         background:#FF9900;color:#fff;font-size:11px;font-weight:700;text-decoration:none;">
                  🔍 Amazonで検索
                </a>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div style="padding:0 14px 10px;">${cards}</div>`;
  }

  function _linkBtnHTML(l) {
    const bg  = l.type === 'amazon' ? '#FF9900' : l.type === 'rakuten' ? '#BF0000' : 'var(--green)';
    const lbl = l.type === 'amazon' ? '🔍 Amazonで検索' : l.type === 'rakuten' ? '🛒 楽天で購入' : Utils.escape(l.label);
    return `<a href="${Utils.escape(l.url)}" target="_blank" rel="noopener noreferrer"
      style="display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:8px;
             background:${bg};color:#fff;font-size:12px;font-weight:700;text-decoration:none;">${lbl}</a>`;
  }

  // ── shopping.js 用コンパクトカード（アレルゲン対応）──
  function dealCardCompactHTML(item, familyAllergens = new Set(), highlightAllergenFree = false) {
    const products     = item.products || [];
    const shortBody    = (item.body || '').slice(0, 80) + ((item.body || '').length > 80 ? '...' : '');

    // アレルギー配慮バッジ
    const freeFor = (item.allergen_free || []).filter(a => familyAllergens.has(a));
    const freeBadge = freeFor.length
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;
           background:var(--green-dim);border:1px solid var(--green-border);color:var(--green);">
           ✅ ${freeFor.join('・')}不使用</span>` : '';

    const borderColor = highlightAllergenFree
      ? 'var(--green-border)'
      : 'var(--amber-border)';

    if (products.length) {
      const p = products[0];
      const detected = _detectAllergens(p.name, familyAllergens);
      const warnBadge = detected.length
        ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;
             background:var(--red-dim);border:1px solid var(--red-border);color:var(--red);">
             ⚠️ ${detected.join('・')}含む</span>` : '';
      const sourceBg  = p.source === 'amazon' ? '#FF9900' : '#BF0000';
      const sourceLbl = p.source === 'amazon' ? '🛒 Amazon' : '🛒 楽天';
      const otherUrl  = p.source !== 'amazon' && item.amazon_search_url ? item.amazon_search_url : null;

      return `<div style="background:#fff;border:1px solid ${borderColor};border-radius:12px;
        padding:10px 12px;margin-bottom:10px;display:flex;gap:10px;align-items:center;">
        ${p.image_url
          ? `<img src="${Utils.escape(p.image_url)}" alt="" loading="lazy"
              style="width:54px;height:54px;object-fit:contain;border-radius:6px;flex-shrink:0;background:#f5f5f5;">`
          : `<div style="width:54px;height:54px;border-radius:6px;background:#eee;flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:20px;">🛒</div>`}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:3px;">${freeBadge}${warnBadge}</div>
          <div style="font-size:12px;font-weight:700;margin-bottom:2px;
            overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${Utils.escape(item.title)}</div>
          ${p.price ? `<div style="font-size:13px;font-weight:700;color:var(--red);">¥${Number(p.price).toLocaleString()}</div>` : ''}
          <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;">
            <a href="${Utils.escape(p.url)}" target="_blank" rel="noopener noreferrer"
              style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;
                     background:${sourceBg};color:#fff;text-decoration:none;">${sourceLbl}</a>
            ${otherUrl ? `<a href="${Utils.escape(otherUrl)}" target="_blank" rel="noopener noreferrer"
              style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;
                     background:#FF9900;color:#fff;text-decoration:none;">🔍 Amazon</a>` : ''}
          </div>
        </div>
      </div>`;
    }

    // 商品なしのフォールバック
    const linksHTML = (item.links || []).map(l => {
      const bg  = l.type === 'amazon' ? '#FF9900' : l.type === 'rakuten' ? '#BF0000' : 'var(--green)';
      const lbl = l.type === 'amazon' ? '🔍 Amazon' : l.type === 'rakuten' ? '🛒 楽天' : Utils.escape(l.label);
      return `<a href="${Utils.escape(l.url)}" target="_blank" rel="noopener noreferrer"
        style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;
               background:${bg};color:#fff;text-decoration:none;">${lbl}</a>`;
    }).join('');
    return `<div style="background:#fff;border:1px solid ${borderColor};border-radius:12px;
      padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">${freeBadge}</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${Utils.escape(item.title)}</div>
      <div style="font-size:12px;color:var(--txt-2);margin-bottom:${linksHTML ? '10px' : '0'};">${Utils.escape(shortBody)}</div>
      ${linksHTML ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${linksHTML}</div>` : ''}
    </div>`;
  }

  return { render, getDeals, dealCardCompactHTML, _getFamilyAllergens, _refresh };
})();
