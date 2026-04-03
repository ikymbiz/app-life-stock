/* inventory.js — Inventory Management Page */
const InventoryPage = (() => {
  let allItems = [];
  let activeFilter = 'all';

  const CATEGORIES = [
    { id: 'all',        label: 'すべて' },
    { id: 'water',      label: '💧 水' },
    { id: 'food',       label: '🍱 食料' },
    { id: 'medicine',   label: '💊 医薬品' },
    { id: 'sanitation', label: '🧴 衛生' },
    { id: 'disaster',   label: '🔦 防災' },
    { id: 'pet',        label: '🐾 ペット' },
    { id: 'other',      label: '📦 その他' },
  ];

  const UNITS = ['個', '本', '袋', '缶', '箱', 'L', 'mL', '枚', '食', 'セット', 'kg', 'g'];
  const LOCATIONS = ['玄関', 'キッチン', '食品庫', '寝室', 'リビング', 'クローゼット', '床下収納', '車内', 'ベランダ', 'その他'];

  async function render() {
    allItems = await DB.Items.getAll();
    const el = document.getElementById('page-inventory');

    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">
          備蓄品リスト
        </div>
      </div>

      <!-- Search -->
      <div style="position:relative;margin:12px 0 0;">
        <input id="inventory-search" class="form-input" placeholder="🔍 品名・場所で検索..." style="padding-left:14px;">
      </div>

      <!-- Filter chips -->
      <div class="filter-bar">
        ${CATEGORIES.map(c => `
          <button class="filter-chip ${activeFilter === c.id ? 'active' : ''}" onclick="InventoryPage.setFilter('${c.id}')">
            ${c.label}
          </button>
        `).join('')}
      </div>

      <!-- Items -->
      <div id="items-list"></div>
    </div>`;

    document.getElementById('inventory-search').addEventListener('input', (e) => renderItems(e.target.value));
    renderItems('');

    // Search field listener rebind
    const searchEl = document.getElementById('inventory-search');
    if (searchEl) searchEl.addEventListener('input', (e) => renderItems(e.target.value));
  }

  function renderItems(query = '') {
    const listEl = document.getElementById('items-list');
    if (!listEl) return;

    let filtered = allItems;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(i => i.category === activeFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.location || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }

    // Sort: expired first, then by expiry date, then by name
    filtered.sort((a, b) => {
      const da = a.expiry_date ? Utils.daysUntil(a.expiry_date) : 9999;
      const db = b.expiry_date ? Utils.daysUntil(b.expiry_date) : 9999;
      return da - db;
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">備蓄品がありません</div>
        <div class="empty-sub">右下の ＋ ボタンから<br>備蓄品を追加してください</div>
      </div>`;
      return;
    }

    listEl.innerHTML = filtered.map(item => {
      const exClass = item.expiry_date ? Utils.expiryClass(item.expiry_date) : 'expiry-none';
      const exLabel = item.expiry_date ? Utils.expiryLabel(item.expiry_date) : '';
      const isLow   = item.min_qty > 0 && item.qty < item.min_qty;
      const icon    = Utils.categoryIcon(item.category);
      return `<div class="item-card ${isLow ? 'item-low-stock' : ''}" onclick="InventoryPage.openEditModal(${item.id})">
        <div class="item-card-inner">
          <div class="item-cat-icon">${icon}</div>
          <div class="item-info">
            <div class="item-name">${Utils.escape(item.name)}</div>
            <div class="item-sub">
              ${item.location ? `📍${Utils.escape(item.location)}` : ''}
              ${item.location && item.expiry_date ? ' · ' : ''}
              ${item.expiry_date ? `期限: ${Utils.formatDate(item.expiry_date)}` : ''}
              ${item.notes ? ` · ${Utils.escape(item.notes).substring(0,20)}` : ''}
            </div>
          </div>
          <div class="item-right">
            <div class="item-qty">${item.qty}<span style="font-size:12px;color:var(--txt-3);"> ${Utils.escape(item.unit||'個')}</span></div>
            ${item.expiry_date ? `<span class="expiry-badge ${exClass}">${exLabel}</span>` : ''}
            ${isLow ? `<span class="expiry-badge expiry-warn">在庫不足</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function setFilter(cat) {
    activeFilter = cat;
    render();
  }

  function itemFormHTML(item = null) {
    const edit = !!item;
    const v = (f, def = '') => edit && item[f] != null ? Utils.escape(String(item[f])) : def;

    return `
      <div class="form-group">
        <label class="form-label">品名 *</label>
        <input id="f-name" class="form-input" value="${v('name')}" placeholder="例: ミネラルウォーター 2L">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">カテゴリー</label>
          <select id="f-category" class="form-select">
            <option value="water"      ${item?.category==='water'?'selected':''}>💧 水</option>
            <option value="food"       ${item?.category==='food'?'selected':''}>🍱 食料</option>
            <option value="medicine"   ${item?.category==='medicine'?'selected':''}>💊 医薬品</option>
            <option value="sanitation" ${item?.category==='sanitation'?'selected':''}>🧴 衛生用品</option>
            <option value="disaster"   ${item?.category==='disaster'?'selected':''}>🔦 防災グッズ</option>
            <option value="pet"        ${item?.category==='pet'?'selected':''}>🐾 ペット用品</option>
            <option value="other"      ${item?.category==='other'?'selected':''}>📦 その他</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">保管場所</label>
          <select id="f-location" class="form-select">
            <option value="">選択...</option>
            ${LOCATIONS.map(l => `<option value="${l}" ${item?.location===l?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">在庫数</label>
          <input id="f-qty" type="number" class="form-input" value="${v('qty','0')}" min="0" step="0.5">
        </div>
        <div class="form-group">
          <label class="form-label">単位</label>
          <select id="f-unit" class="form-select">
            ${UNITS.map(u => `<option ${item?.unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">目標数量（不足アラート）</label>
          <input id="f-min-qty" type="number" class="form-input" value="${v('min_qty','0')}" min="0" step="0.5">
        </div>
        <div class="form-group">
          <label class="form-label">賞味期限</label>
          <input id="f-expiry" type="date" class="form-input" value="${v('expiry_date')}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">メモ</label>
        <textarea id="f-notes" class="form-textarea" placeholder="保管方法、用途など...">${edit && item.notes ? item.notes : ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="f-rolling" ${item?.is_rolling?'checked':''}>
          <span class="form-check-label">🔄 ローリングストック対象</span>
        </label>
        <label class="form-check" style="margin-top:8px;">
          <input type="checkbox" id="f-emergency" ${item?.is_emergency?'checked':''}>
          <span class="form-check-label">🎒 非常用持ち出し袋に含む</span>
        </label>
        ${edit ? `<label class="form-check" style="margin-top:8px;">
          <input type="checkbox" id="f-consumed" ${item?.is_consumed?'checked':''}>
          <span class="form-check-label">✓ 消費済み（ローリング補充待ち）</span>
        </label>` : ''}
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="InventoryPage.saveItem(${edit ? item.id : 'null'})">
          ${edit ? '💾 保存する' : '➕ 追加する'}
        </button>
        ${edit ? `<button class="btn btn-danger btn-sm" onclick="InventoryPage.deleteItem(${item.id})">削除</button>` : ''}
      </div>
      ${edit ? `<button class="btn btn-secondary" style="margin-top:8px;" onclick="InventoryPage.addToShopping(${item.id})">
        🛒 買い物リストに追加
      </button>` : ''}
    `;
  }

  function openAddModal() {
    Modal.open('➕ 備蓄品を追加', itemFormHTML(null));
  }

  async function openEditModal(id) {
    const item = await DB.Items.get(id);
    if (!item) return;
    Modal.open('✏️ 備蓄品を編集', itemFormHTML(item));
  }

  async function saveItem(idOrNull) {
    const nameEl = document.getElementById('f-name');
    if (!nameEl || !nameEl.value.trim()) { Toast.error('品名を入力してください'); return; }

    const data = {
      name:        document.getElementById('f-name')?.value.trim() || '',
      category:    document.getElementById('f-category')?.value || 'other',
      location:    document.getElementById('f-location')?.value || '',
      qty:         parseFloat(document.getElementById('f-qty')?.value) || 0,
      unit:        document.getElementById('f-unit')?.value || '個',
      min_qty:     parseFloat(document.getElementById('f-min-qty')?.value) || 0,
      expiry_date: document.getElementById('f-expiry')?.value || '',
      notes:       document.getElementById('f-notes')?.value.trim() || '',
      is_rolling:  document.getElementById('f-rolling')?.checked || false,
      is_emergency:document.getElementById('f-emergency')?.checked || false,
      is_consumed: document.getElementById('f-consumed')?.checked || false,
    };

    if (idOrNull) {
      data.id = idOrNull;
      await DB.Items.update(data);
      Toast.success('✅ 更新しました');
    } else {
      await DB.Items.add(data);
      Toast.success('✅ 追加しました');
      // Auto-add to shopping if low qty matches min_qty
    }

    Modal.close();
    allItems = await DB.Items.getAll();
    render();
  }

  async function deleteItem(id) {
    if (!confirm('この備蓄品を削除しますか？')) return;
    await DB.Items.delete(id);
    await DB.ItemImages.deleteForItem(id);
    Toast.success('削除しました');
    Modal.close();
    allItems = await DB.Items.getAll();
    render();
  }

  async function addToShopping(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    await DB.Shopping.add({ name: item.name, qty_needed: 1, unit: item.unit });
    Toast.success('🛒 買い物リストに追加しました');
    Modal.close();
  }

  return { render, setFilter, openAddModal, openEditModal, saveItem, deleteItem, addToShopping };
})();
