/* shopping.js — Shopping List Page */
const ShoppingPage = (() => {

  async function render() {
    const [shopping, items] = await Promise.all([
      DB.Shopping.getAll(),
      DB.Items.getAll(),
    ]);

    // Auto-suggest low stock items
    const suggestions = items.filter(i =>
      i.min_qty > 0 && i.total_count < i.min_qty &&
      !shopping.some(s => s.name === i.name && !s.is_bought)
    );

    const el = document.getElementById('page-shopping');
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

      <!-- Low stock suggestions -->
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

      <!-- Pending items -->
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
        pending.map(item => shoppingItemHTML(item)).join('')}
      </div>

      <!-- Bought items -->
      ${bought.length ? `
      <div class="section-header" style="margin-top:20px;">
        <span class="section-title">✅ 購入済み</span>
      </div>
      ${bought.map(item => shoppingItemHTML(item)).join('')}` : ''}

      <!-- お得情報（非同期で後付け） -->
      <div id="shopping-deals"></div>
    </div>`;

    _loadDeals(shopping);
  }

  async function _loadDeals(shopping) {
    const dealsEl = document.getElementById('shopping-deals');
    if (!dealsEl) return;
    try {
      const [deals, familyAllergens] = await Promise.all([
        FeedPage.getDeals(),
        FeedPage._getFamilyAllergens(),
      ]);
      if (!deals.length) return;

      let html = '';

      // ── Section 1: 関連お得情報（買い物リストのアイテムと tag 照合）──
      const shopNames = shopping.map(s => s.name.toLowerCase());
      const scored = deals.map(deal => {
        const tags = (deal.tags || []).map(t => t.toLowerCase());
        const score = tags.reduce((s, t) => s + (shopNames.some(n => n.includes(t) || t.includes(n)) ? 1 : 0), 0);
        return { deal, score };
      });
      const top = scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.deal);

      if (top.length) {
        html += `
          <div class="section-header" style="margin-top:20px;">
            <span class="section-title">🏷️ 関連お得情報</span>
            <button class="section-action" onclick="App.navigate('feed')">すべて見る →</button>
          </div>
          ${top.map(d => FeedPage.dealCardCompactHTML(d, familyAllergens, false)).join('')}`;
      }

      // ── Section 2: アレルギー配慮おすすめ（家族にアレルゲンがある場合のみ）──
      if (familyAllergens.size) {
        // allergen_free フィールドに家族のアレルゲンが含まれる deal を優先
        const allergenDeals = deals
          .filter(d => {
            const freeFor = d.allergen_free || [];
            return [...familyAllergens].some(a => freeFor.includes(a));
          })
          .filter(d => !top.includes(d)) // 関連お得情報と重複排除
          .slice(0, 3);

        if (allergenDeals.length) {
          const allergenNames = [...familyAllergens].join('・');
          html += `
            <div class="section-header" style="margin-top:20px;">
              <span class="section-title">✅ アレルギー配慮おすすめ</span>
            </div>
            <div style="font-size:12px;color:var(--txt-3);margin-bottom:10px;">
              ${allergenNames}を避けた商品のご提案
            </div>
            ${allergenDeals.map(d => FeedPage.dealCardCompactHTML(d, familyAllergens, true)).join('')}`;
        }
      }

      if (html) dealsEl.innerHTML = html;
    } catch { /* フィード未設定時は無視 */ }
  }

  function shoppingItemHTML(item) {
    const amName = encodeURIComponent(item.name);
    return `<div class="shopping-item ${item.is_bought ? 'bought' : ''}" id="shop-${item.id}">
      <div class="shop-check ${item.is_bought ? 'checked' : ''}" onclick="ShoppingPage.toggleBought(${item.id}, ${!item.is_bought})"></div>
      <div class="shop-info">
        <div class="shop-name">${Utils.escape(item.name)}</div>
        <div class="shop-sub">${item.qty_needed || 1}${item.unit ? Utils.escape(item.unit) : '個'}</div>
      </div>
      <div class="shop-actions">
        <a href="https://www.amazon.co.jp/s?k=${amName}" target="_blank" class="shop-link-btn">Amazon</a>
        <a href="https://search.rakuten.co.jp/search/mall/${amName}/" target="_blank" class="shop-link-btn">楽天</a>
        <button class="shop-delete-btn" onclick="ShoppingPage.deleteItem(${item.id})">✕</button>
      </div>
    </div>`;
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
      name: item.name,
      qty_needed: item.min_qty - item.total_count,
      unit: item.count_unit || '個',
    });
    Toast.success('🛒 リストに追加しました');
    render();
  }

  async function toggleBought(id, isBought) {
    const all = await DB.Shopping.getAll();
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
