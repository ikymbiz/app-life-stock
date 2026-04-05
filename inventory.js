/* inventory.js — Inventory: Staging Quick Add + form */
const InventoryPage = (() => {
  let allItems            = [];
  let activeFilter        = 'all';
  let currentStockEntries = [];
  let currentItemImages   = [];
  let allergenWarningMap  = new Map();
  let _quickState         = {};
  let _stagingPhotos      = []; // { aiImg, storageImg, checked }

  const MAX_STAGING = 5;

  const CATEGORIES = [
    { id:'all',        label:'すべて'    },
    { id:'water',      label:'💧 水'     },
    { id:'food',       label:'🍱 食料'   },
    { id:'medicine',   label:'💊 医薬品'  },
    { id:'sanitation', label:'🧴 衛生'   },
    { id:'disaster',   label:'🔦 防災'   },
    { id:'pet',        label:'🐾 ペット'  },
    { id:'other',      label:'📦 その他'  },
  ];
  const COUNT_UNITS  = ['個','本','袋','缶','箱','食','枚','セット'];
  const VOLUME_UNITS = ['L','mL','kg','g','カップ'];
  const LOCATIONS    = ['玄関','キッチン','食品庫','寝室','リビング','クローゼット','床下収納','車内','ベランダ','その他'];

  // 特定原材料8品目＋準ずるもの20品目＝計28品目（2024年現在の公式リスト）
  const ALLERGEN_LIST = [
    // 特定原材料 8品目（major: true）
    { id:'小麦',           label:'🌾 小麦',           major:true },
    { id:'卵',             label:'🥚 卵',             major:true },
    { id:'乳',             label:'🥛 乳',             major:true },
    { id:'そば',           label:'🍜 そば',           major:true },
    { id:'落花生',         label:'🥜 落花生',         major:true },
    { id:'えび',           label:'🦐 えび',           major:true },
    { id:'かに',           label:'🦀 かに',           major:true },
    { id:'くるみ',         label:'🌰 くるみ',         major:true },
    // 特定原材料に準ずるもの 20品目
    { id:'アーモンド',     label:'アーモンド'         },
    { id:'あわび',         label:'あわび'             },
    { id:'いか',           label:'いか'               },
    { id:'いくら',         label:'いくら'             },
    { id:'オレンジ',       label:'🍊 オレンジ'        },
    { id:'カシューナッツ', label:'カシューナッツ'     },
    { id:'キウイ',         label:'🥝 キウイ'          },
    { id:'牛肉',           label:'🥩 牛肉'            },
    { id:'ごま',           label:'ごま'               },
    { id:'さけ',           label:'さけ'               },
    { id:'さば',           label:'さば'               },
    { id:'大豆',           label:'大豆'               },
    { id:'鶏肉',           label:'鶏肉'               },
    { id:'豚肉',           label:'豚肉'               },
    { id:'バナナ',         label:'🍌 バナナ'          },
    { id:'もも',           label:'🍑 もも'            },
    { id:'やまいも',       label:'やまいも'           },
    { id:'りんご',         label:'🍎 りんご'          },
    { id:'ゼラチン',       label:'ゼラチン'           },
    { id:'マカダミアナッツ',label:'マカダミアナッツ'  },
  ];

  // ── アレルゲン照合 ──
  async function buildAllergenWarnings(items) {
    const profiles = await DB.Profiles.getAll();
    allergenWarningMap.clear();
    for (const item of items) {
      if (!item.allergens) continue;
      const ia = item.allergens.split(',').map(a => a.trim()).filter(Boolean);
      for (const allergen of ia) {
        for (const p of profiles) {
          const txt = (p.allergies_food || '');
          if (txt && txt.includes(allergen)) {
            if (!allergenWarningMap.has(item.id)) allergenWarningMap.set(item.id, []);
            const ex = allergenWarningMap.get(item.id);
            if (!ex.find(e => e.allergen === allergen && e.who === p.owner_name))
              ex.push({ allergen, who: p.owner_name });
          }
        }
      }
    }
  }

  // ── Page render ──
  async function render() {
    allItems = await DB.Items.getAll();
    await buildAllergenWarnings(allItems);
    const el = document.getElementById('page-inventory');
    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;">備蓄品リスト</div>
      </div>
      <div style="margin:12px 0 0;">
        <input id="inventory-search" class="form-input" placeholder="🔍 品名・場所で検索...">
      </div>
      <div class="filter-bar">
        ${CATEGORIES.map(c => `<button class="filter-chip ${activeFilter === c.id ? 'active' : ''}"
          onclick="InventoryPage.setFilter('${c.id}')">${c.label}</button>`).join('')}
      </div>
      <div id="items-list"></div>
    </div>`;
    document.getElementById('inventory-search').addEventListener('input', e => renderItems(e.target.value));
    renderItems('');
  }

  function renderItems(query = '') {
    const listEl = document.getElementById('items-list');
    if (!listEl) return;
    let filtered = activeFilter === 'all' ? [...allItems] : allItems.filter(i => i.category === activeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(q) || (i.location || '').toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      const aw = allergenWarningMap.has(b.id) ? 1 : allergenWarningMap.has(a.id) ? -1 : 0;
      if (aw !== 0) return aw;
      const da = a.nearest_expiry ? Utils.daysUntil(a.nearest_expiry) : 9999;
      const db = b.nearest_expiry ? Utils.daysUntil(b.nearest_expiry) : 9999;
      return da - db;
    });
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div>
        <div class="empty-title">備蓄品がありません</div>
        <div class="empty-sub">右下の ＋ ボタンから追加してください</div></div>`;
      return;
    }
    listEl.innerHTML = filtered.map(item => {
      const warnings  = allergenWarningMap.get(item.id) || [];
      const exClass   = item.nearest_expiry ? Utils.expiryClass(item.nearest_expiry) : 'expiry-none';
      const exLabel   = item.nearest_expiry ? Utils.expiryLabel(item.nearest_expiry) : '';
      const isLow     = item.min_qty > 0 && item.total_count < item.min_qty;
      const lotTag    = item.is_rolling && (item.stocks || []).length > 1
        ? `<span class="expiry-badge expiry-warn">🔄${item.stocks.length}ロット</span>` : '';
      const warnTag   = warnings.length ? '<span class="allergen-badge">⚠️ アレルギー</span>' : '';
      const volLabel  = item.volume ? ` ${item.volume}${Utils.escape(item.volume_unit || '')}` : '';
      return `<div class="item-card ${isLow ? 'item-low-stock' : ''} ${warnings.length ? 'item-allergen-warn' : ''}"
          onclick="InventoryPage.openEditModal(${item.id})">
        <div class="item-card-inner">
          <div class="item-cat-icon">${Utils.categoryIcon(item.category)}</div>
          <div class="item-info">
            <div class="item-name">${Utils.escape(item.name)}</div>
            <div class="item-sub">
              ${item.location ? `📍${Utils.escape(item.location)}` : ''}
              ${item.location && item.nearest_expiry ? ' · ' : ''}
              ${item.nearest_expiry ? `期限:${Utils.formatDate(item.nearest_expiry)}` : ''}
            </div>
            ${warnings.length ? `<div class="allergen-who">
              ${[...new Set(warnings.map(w => w.who))].map(n => `<span class="allergen-who-badge">${Utils.escape(n)}</span>`).join('')}
              ${[...new Set(warnings.map(w => w.allergen))].map(a => `<span class="allergen-item-badge">${Utils.escape(a)}</span>`).join('')}
            </div>` : ''}
          </div>
          <div class="item-right">
            <div class="item-qty">${item.total_count}<span style="font-size:12px;color:var(--txt-3);"> ${Utils.escape(item.count_unit || '個')}</span></div>
            ${volLabel ? `<div style="font-size:11px;color:var(--txt-3);">${volLabel}/個</div>` : ''}
            ${item.nearest_expiry ? `<span class="expiry-badge ${exClass}">${exLabel}</span>` : ''}
            ${lotTag}${warnTag}
            ${isLow ? '<span class="expiry-badge expiry-warn">在庫不足</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function setFilter(cat) { activeFilter = cat; render(); }

  // ═══════════════════════════════════════════════════
  //  📸 ステージング・クイック登録フロー
  // ═══════════════════════════════════════════════════

  async function showAddMethodSheet() {
    const provider = await DB.Settings.get('ai_provider', 'none');
    const apiKey   = provider !== 'none' ? await DB.Settings.get('ai_key_' + provider, '') : '';
    const aiReady  = provider !== 'none' && !!apiKey;

    let h = '<div style="display:flex;flex-direction:column;gap:10px;">';
    if (aiReady) {
      h += `<button type="button" onclick="InventoryPage.startQuickCapture()" style="
        display:flex;align-items:center;gap:14px;padding:18px 16px;border-radius:var(--radius-sm);
        background:var(--green-dim);border:1.5px solid var(--green-border);cursor:pointer;text-align:left;">
        <span style="font-size:32px;">📸</span>
        <div><div style="font-weight:700;font-size:16px;color:var(--green);">撮るだけ登録</div>
        <div style="font-size:12px;color:var(--txt-3);margin-top:2px;">写真を撮るだけでAIが自動入力</div></div></button>`;
    } else {
      h += `<div style="padding:14px 16px;border-radius:var(--radius-sm);background:var(--bg-3);border:1px dashed var(--border-med);text-align:center;">
        <div style="font-size:13px;color:var(--txt-3);margin-bottom:8px;">📸 撮るだけ登録を使うにはAI設定が必要です</div>
        <button class="btn btn-secondary btn-sm" onclick="Modal.close();App.navigate('settings');">⚙️ AI設定へ</button></div>`;
    }
    h += `<button type="button" onclick="Modal.close();setTimeout(function(){InventoryPage.openAddModal();},300);" style="
      display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--radius-sm);
      background:var(--bg-2);border:1px solid var(--border);cursor:pointer;text-align:left;">
      <span style="font-size:24px;">✏️</span>
      <div><div style="font-weight:700;font-size:14px;color:var(--txt-1);">手動入力</div>
      <div style="font-size:11px;color:var(--txt-3);">すべての項目を自分で入力</div></div></button>`;
    h += '</div>';
    Modal.open('➕ 備蓄品を追加', h);
  }

  // 1枚目を撮影してステージング画面へ
  function startQuickCapture() {
    Modal.close();
    _stagingPhotos = [];
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const [aiImg, storageImg] = await Promise.all([
        VisionAI.compressForAI(file), VisionAI.compressForStorage(file),
      ]);
      if (!aiImg || !storageImg) { Toast.error('画像の読み込みに失敗しました'); return; }
      _stagingPhotos.push({ aiImg, storageImg, checked: false });
      _showStagingSheet();
    };
    setTimeout(() => input.click(), 350);
  }

  function _showStagingSheet() {
    Modal.open('📸 撮るだけ登録', _buildStagingHTML());
  }

  function _buildStagingHTML() {
    const addDisabled = _stagingPhotos.length >= MAX_STAGING;

    let h = `<div style="margin-bottom:12px;font-size:13px;color:var(--txt-3);">
      AIで解析したい写真をタップして選択してください</div>`;

    // サムネイルグリッド
    h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">`;
    _stagingPhotos.forEach((photo, idx) => {
      const chk = photo.checked;
      h += `<div style="position:relative;">
        <div onclick="InventoryPage.toggleStagingCheck(${idx})" style="
          position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;
          border:2.5px solid ${chk ? '#2D918B' : '#E0F2F1'};">
          <img src="${photo.storageImg}" style="width:100%;height:100%;object-fit:cover;display:block;">
          ${chk ? `<div style="position:absolute;top:5px;right:5px;width:22px;height:22px;
            border-radius:50%;background:#2D918B;display:flex;align-items:center;
            justify-content:center;color:#fff;font-size:13px;font-weight:700;">✓</div>` : ''}
        </div>
        <label onclick="InventoryPage.toggleStagingCheck(${idx})" style="
          display:flex;align-items:center;gap:4px;margin-top:5px;font-size:11px;cursor:pointer;
          color:${chk ? '#2D918B' : 'var(--txt-3)'};font-weight:${chk ? '700' : '400'};">
          <span style="
            width:14px;height:14px;border-radius:3px;flex-shrink:0;
            display:inline-flex;align-items:center;justify-content:center;
            border:1.5px solid ${chk ? '#2D918B' : '#ccc'};
            background:${chk ? '#2D918B' : '#fff'};">
            ${chk ? '<span style="color:#fff;font-size:9px;line-height:1;">✓</span>' : ''}
          </span>
          AI解析
        </label>
        <button onclick="InventoryPage.removeStagingPhoto(${idx})" style="
          position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:50%;
          background:rgba(0,0,0,.55);color:#fff;font-size:11px;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
      </div>`;
    });
    h += `</div>`;

    // 追加ボタン
    h += `<button type="button" onclick="InventoryPage.addStagingPhoto()" style="
      width:100%;padding:12px;border-radius:10px;margin-bottom:16px;font-size:13px;font-weight:700;
      border:1.5px dashed ${addDisabled ? '#ccc' : '#2D918B'};
      background:${addDisabled ? 'var(--bg-3)' : '#F8FBFB'};
      color:${addDisabled ? '#ccc' : '#2D918B'};
      cursor:${addDisabled ? 'not-allowed' : 'pointer'};"
      ${addDisabled ? 'disabled' : ''}>
      ＋ もう1枚追加（${_stagingPhotos.length} / ${MAX_STAGING}）
    </button>`;

    // アクションボタン
    h += `<div style="display:flex;flex-direction:column;gap:8px;">
      <button class="btn btn-primary" onclick="InventoryPage.runStagingAnalysis()">🤖 AI解析する</button>
      <button class="btn btn-ghost" onclick="Modal.close();setTimeout(function(){InventoryPage.openAddModal();},300);">✏️ 手動入力へ</button>
    </div>`;

    return h;
  }

  function toggleStagingCheck(idx) {
    if (!_stagingPhotos[idx]) return;
    _stagingPhotos[idx].checked = !_stagingPhotos[idx].checked;
    const bodyEl = document.getElementById('modal-body');
    if (bodyEl) bodyEl.innerHTML = _buildStagingHTML();
  }

  function removeStagingPhoto(idx) {
    _stagingPhotos.splice(idx, 1);
    if (_stagingPhotos.length === 0) { Modal.close(); return; }
    const bodyEl = document.getElementById('modal-body');
    if (bodyEl) bodyEl.innerHTML = _buildStagingHTML();
  }

  async function addStagingPhoto() {
    if (_stagingPhotos.length >= MAX_STAGING) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const [aiImg, storageImg] = await Promise.all([
        VisionAI.compressForAI(file), VisionAI.compressForStorage(file),
      ]);
      if (!aiImg || !storageImg) { Toast.error('画像の読み込みに失敗しました'); return; }
      _stagingPhotos.push({ aiImg, storageImg, checked: false });
      const bodyEl = document.getElementById('modal-body');
      if (bodyEl) bodyEl.innerHTML = _buildStagingHTML();
    };
    input.click();
  }

  async function runStagingAnalysis() {
    const selected = _stagingPhotos.filter(p => p.checked);
    if (selected.length === 0) {
      Toast.error('解析する写真を選択してください');
      return;
    }
    const aiImgs      = selected.map(p => p.aiImg);
    const storageImgs = _stagingPhotos.map(p => p.storageImg); // 全写真を保存
    await _processQuickCapture(aiImgs, storageImgs);
  }

  async function _processQuickCapture(aiImgs, storageImgs) {
    Modal.open('📸 撮るだけ登録', `<div style="text-align:center;padding:32px 0;">
      <div style="font-size:48px;margin-bottom:16px;animation:pulse 1.2s infinite;">🤖</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px;">AI解析中...</div>
      <div style="font-size:12px;color:var(--txt-3);">写真から備蓄品情報を読み取っています</div></div>`);
    try {
      const result = await VisionAI.analyze(aiImgs, 'quick');
      showQuickConfirm(result, storageImgs);
    } catch (e) {
      Modal.close();
      if (e.message === 'NO_PROVIDER') { Toast.show('⚙️ AI設定が必要です'); App.navigate('settings'); }
      else if (e.message === 'NO_KEY') { Toast.error('APIキーが未設定です'); }
      else { Toast.error('AI解析エラー: ' + e.message); }
    }
  }

  function showQuickConfirm(result, storageImgs) {
    if (!Array.isArray(storageImgs)) storageImgs = [storageImgs];
    const name        = result.name        || '';
    const category    = result.category    || 'other';
    const expiry      = result.expiry_date || '';
    const allergens   = result.allergens   || [];
    const count_unit  = result.count_unit  || '個';
    const count       = result.count       || 1;
    const volume      = result.volume      || null;
    const volume_unit = result.volume_unit || null;
    _quickState = { storageImgs, allergens };

    const catLabel = c => ({ water:'💧 水', food:'🍱 食料', medicine:'💊 医薬品', sanitation:'🧴 衛生', disaster:'🔦 防災', pet:'🐾 ペット', other:'📦 その他' }[c] || '📦 その他');

    // 写真プレビュー（横スクロール）
    let h = `<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:2px;">
      ${storageImgs.map(img => `<img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;">`).join('')}
    </div>`;

    h += `<div class="form-group"><label class="form-label">品名 *</label>
      <input id="qf-name" class="form-input" value="${Utils.escape(name)}" placeholder="品名を入力"></div>`;

    h += '<div class="form-row">';
    h += `<div class="form-group"><label class="form-label">カテゴリー</label><select id="qf-category" class="form-select">
      ${['water','food','medicine','sanitation','disaster','pet','other'].map(c => `<option value="${c}" ${category === c ? 'selected' : ''}>${catLabel(c)}</option>`).join('')}
      </select></div>`;
    h += `<div class="form-group"><label class="form-label">単位</label><select id="qf-count-unit" class="form-select">
      ${COUNT_UNITS.map(u => `<option ${count_unit === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select></div>`;
    h += '</div>';

    h += '<div class="form-row">';
    h += `<div class="form-group"><label class="form-label">数量</label>
      <input id="qf-count" type="number" class="form-input" value="${count}" min="0.5" step="0.5"></div>`;
    h += `<div class="form-group"><label class="form-label">賞味期限</label>
      <input type="text" inputmode="numeric" id="qf-expiry" class="form-input" value="${_isoToDisplay(expiry)}" placeholder="YYYYMMDD" maxlength="10" oninput="InventoryPage._fmtExpiryInput(this)">
      <div id="qf-expiry-badge" style="margin-top:3px;font-size:11px;" class="${expiry ? Utils.expiryClass(expiry) : ''}">${expiry ? Utils.expiryLabel(expiry) : ''}</div></div>`;
    h += '</div>';

    h += '<div class="form-row">';
    h += `<div class="form-group"><label class="form-label">容量・重量</label>
      <input id="qf-volume" type="number" class="form-input" value="${volume || ''}" min="0" step="any" placeholder="例: 2"></div>`;
    h += `<div class="form-group"><label class="form-label">容量単位</label>
      <select id="qf-volume-unit" class="form-select">
        <option value="">なし</option>
        ${VOLUME_UNITS.map(u => `<option ${volume_unit === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select></div>`;
    h += '</div>';

    h += `<div class="form-group"><label class="form-label">保管場所</label><select id="qf-location" class="form-select">
      <option value="">選択...</option>${LOCATIONS.map(l => `<option>${l}</option>`).join('')}</select></div>`;

    if (allergens.length) {
      h += `<div class="form-group"><label class="form-label">⚠️ 検出アレルゲン</label>
        <div style="display:flex;flex-wrap:wrap;gap:5px;">
        ${allergens.map(a => `<span style="font-size:12px;padding:3px 8px;border-radius:4px;background:var(--red-dim);border:1px solid var(--red-border);color:var(--red);">${Utils.escape(a)}</span>`).join('')}
        </div></div>`;
    }

    h += `<div style="display:flex;gap:8px;margin-top:4px;">
      <button class="btn btn-primary" style="flex:2;" onclick="InventoryPage.saveQuickItem()">✅ 登録する</button>
      <button class="btn btn-secondary" style="flex:1;" onclick="InventoryPage.quickToFull()">✏️ 詳細編集</button></div>`;

    Modal.open('📸 撮るだけ登録', h);
  }

  async function saveQuickItem() {
    const nameEl = document.getElementById('qf-name');
    if (!nameEl || !nameEl.value.trim()) { Toast.error('品名を入力してください'); return; }
    const count       = parseFloat(document.getElementById('qf-count')?.value) || 1;
    const count_unit  = document.getElementById('qf-count-unit')?.value || '個';
    const expiry      = _displayToISO(document.getElementById('qf-expiry')?.value || '');
    const volVal      = parseFloat(document.getElementById('qf-volume')?.value);
    const volume      = (volVal > 0) ? volVal : null;
    const volume_unit = volume ? (document.getElementById('qf-volume-unit')?.value || null) : null;
    const data = {
      name:      nameEl.value.trim(),
      category:  document.getElementById('qf-category')?.value || 'other',
      location:  document.getElementById('qf-location')?.value || '',
      count_unit, volume, volume_unit,
      min_qty: 0, is_rolling: false, is_emergency: false,
      allergens: (_quickState.allergens || []).join(','),
      notes: '',
    };
    const itemId = await DB.Items.add(data);
    await DB.ItemStocks.replaceForItem(itemId, [{ id: null, count, expiry_date: expiry, note: '' }]);
    for (const img of (_quickState.storageImgs || [])) {
      await DB.ItemImages.add({ item_id: itemId, image: img, caption: 'package', sort_order: 0 });
    }
    Toast.success('✅ 登録しました');
    Modal.close(); _quickState = {}; _stagingPhotos = [];
    allItems = await DB.Items.getAll(); await buildAllergenWarnings(allItems); render();
  }

  function quickToFull() {
    const name        = document.getElementById('qf-name')?.value        || '';
    const category    = document.getElementById('qf-category')?.value    || 'other';
    const count_unit  = document.getElementById('qf-count-unit')?.value  || '個';
    const count       = parseFloat(document.getElementById('qf-count')?.value) || 1;
    const expiry      = _displayToISO(document.getElementById('qf-expiry')?.value || '');
    const location    = document.getElementById('qf-location')?.value    || '';
    const volVal      = parseFloat(document.getElementById('qf-volume')?.value);
    const volume      = (volVal > 0) ? volVal : null;
    const volume_unit = volume ? (document.getElementById('qf-volume-unit')?.value || null) : null;
    const allergens   = _quickState.allergens  || [];
    const storageImgs = _quickState.storageImgs || [];
    Modal.close(); _quickState = {};
    setTimeout(() => {
      currentStockEntries = [{ id: null, count, expiry_date: expiry, note: '' }];
      currentItemImages   = storageImgs.map(img => ({ id: null, base64: img, caption: 'package', isNew: true, toDelete: false }));
      Modal.open('➕ 備蓄品を追加', itemFormHTML(null));
      setTimeout(() => {
        const ne = document.getElementById('f-name');        if (ne && name)         ne.value = name;
        const ce = document.getElementById('f-category');    if (ce)                 ce.value = category;
        const cu = document.getElementById('f-count-unit');  if (cu)                 cu.value = count_unit;
        const le = document.getElementById('f-location');    if (le)                 le.value = location;
        const vo = document.getElementById('f-volume');      if (vo && volume)       vo.value = volume;
        const vu = document.getElementById('f-volume-unit'); if (vu && volume_unit)  vu.value = volume_unit;
        if (allergens.length) { setSelectedAllergens(allergens); renderAllergenUI(allergens); }
        renderStockEntries(); renderPhotos();
      }, 80);
    }, 300);
  }

  // ═══════════════════════════════════
  //  既存機能
  // ═══════════════════════════════════

  function compressImage(file, maxW = 900, quality = 0.72) {
    return new Promise(resolve => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxW) { if (w > h) { h = Math.round(h * maxW / w); w = maxW; } else { w = Math.round(w * maxW / h); h = maxW; } }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); }; img.src = url;
    });
  }

  // ── 賞味期限 入力ヘルパー ──
  // YYYY-MM-DD ↔ YYYY/MM/DD 変換
  function _isoToDisplay(iso) { return iso ? iso.replace(/-/g, '/') : ''; }
  function _displayToISO(v) {
    const d = v.replace(/\D/g, '');
    if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8);
    if (d.length === 6) return d.slice(0,4)+'-'+d.slice(4,6)+'-01';
    return '';
  }
  // 数字入力 → YYYY/MM/DD に自動整形
  function _fmtExpiryInput(el) {
    const d = el.value.replace(/\D/g, '').slice(0, 8);
    let v = d;
    if (d.length > 6) v = d.slice(0,4)+'/'+d.slice(4,6)+'/'+d.slice(6);
    else if (d.length > 4) v = d.slice(0,4)+'/'+d.slice(4);
    el.value = v;
  }
  // 在庫エントリーの期限入力用（フォーマット＋バッジ更新）
  function _onStockExpiryInput(el, idx) {
    _fmtExpiryInput(el);
    const iso = _displayToISO(el.value);
    if (currentStockEntries[idx]) currentStockEntries[idx].expiry_date = iso;
    const badge = document.getElementById('se-expiry-badge-'+idx);
    if (badge) {
      badge.className = iso ? Utils.expiryClass(iso) : '';
      badge.style.fontSize = '11px'; badge.style.marginTop = '3px';
      badge.textContent = iso ? Utils.expiryLabel(iso) : '';
    }
  }

  function renderPhotos() {
    const el = document.getElementById('photo-gallery'); if (!el) return;
    const visible = currentItemImages.filter(i => !i.toDelete);
    if (!visible.length) { el.innerHTML = '<div style="color:var(--txt-3);font-size:12px;padding:4px 0;">写真なし</div>'; return; }
    el.innerHTML = visible.map((img, i) => `<div class="photo-thumb-wrap">
      <img class="photo-thumb" src="${img.base64}" alt="${img.caption}">
      <div class="photo-caption">${({ package:'📦', ingredients:'📋', storage:'📍', other:'📸' }[img.caption]) || '📸'}</div>
      <button class="photo-delete-btn" onclick="InventoryPage.removePhoto(${i})">✕</button></div>`).join('');
  }

  async function addPhoto(captionType) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const b64 = await compressImage(file); if (!b64) { Toast.error('画像読込失敗'); return; }
      currentItemImages.push({ id: null, base64: b64, caption: captionType, isNew: true, toDelete: false });
      renderPhotos(); Toast.success('📸 写真を追加しました');
    }; input.click();
  }

  function removePhoto(idx) {
    const visible = currentItemImages.filter(i => !i.toDelete);
    const target  = visible[idx]; if (!target) return;
    if (target.id) target.toDelete = true; else currentItemImages.splice(currentItemImages.indexOf(target), 1);
    renderPhotos();
  }

  // ── Vision AI（フォーム内から使う用）──
  async function triggerVisionScan(type) {
    const provider = await DB.Settings.get('ai_provider', 'none');
    if (provider === 'none') { Toast.show('⚙️ 設定でAIを有効にしてください'); App.navigate('settings'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const [aiB64, stB64] = await Promise.all([VisionAI.compressForAI(file), VisionAI.compressForStorage(file)]);
      if (!aiB64 || !stB64) return;
      currentItemImages.push({ id: null, base64: stB64, caption: type === 'allergens' ? 'ingredients' : 'package', isNew: true, toDelete: false });
      renderPhotos();
      const ind = document.getElementById('vision-indicator');
      if (ind) { ind.style.display = 'block'; ind.textContent = '🤖 AI解析中...'; }
      try { applyVisionResult(await VisionAI.analyze(aiB64, type), type); }
      catch (e) { Toast.error('AI解析エラー: ' + e.message); }
      finally { if (ind) ind.style.display = 'none'; }
    }; input.click();
  }

  function applyVisionResult(result, type) {
    let found = false;
    if (result.expiry_date && type !== 'allergens') {
      let filled = false;
      for (let i = 0; i < currentStockEntries.length; i++) {
        if (!currentStockEntries[i].expiry_date) {
          currentStockEntries[i].expiry_date = result.expiry_date;
          const el = document.getElementById('se-expiry-' + i);
          if (el) {
            el.value = _isoToDisplay(result.expiry_date);
            const badge = document.getElementById('se-expiry-badge-' + i);
            if (badge) { badge.className = Utils.expiryClass(result.expiry_date); badge.style.fontSize = '11px'; badge.style.marginTop = '3px'; badge.textContent = Utils.expiryLabel(result.expiry_date); }
          }
          filled = true; break;
        }
      }
      if (!filled) currentStockEntries.push({ id: null, count: 1, expiry_date: result.expiry_date, note: '' });
      renderStockEntries();
      Toast.success('📅 賞味期限: ' + Utils.formatDate(result.expiry_date)); found = true;
    }
    if (result.allergens && result.allergens.length) {
      const merged = [...new Set([...getSelectedAllergens(), ...result.allergens])];
      setSelectedAllergens(merged); renderAllergenUI(merged);
      Toast.success('⚠️ アレルゲン: ' + result.allergens.join('・')); found = true;
    }
    if (result.name)        { const ne = document.getElementById('f-name');        if (ne && !ne.value.trim()) { ne.value = result.name; found = true; } }
    if (result.category)    { const ce = document.getElementById('f-category');    if (ce) ce.value = result.category; }
    if (result.count_unit)  { const cu = document.getElementById('f-count-unit');  if (cu) cu.value = result.count_unit; }
    if (result.volume != null) { const vo = document.getElementById('f-volume');   if (vo) vo.value = result.volume; }
    if (result.volume_unit) { const vu = document.getElementById('f-volume-unit'); if (vu) vu.value = result.volume_unit; }
    if (!found) Toast.show('テキストを検出できませんでした');
  }

  // ── アレルゲンUI ──
  function getSelectedAllergens() {
    const h = document.getElementById('f-allergens-hidden');
    return h && h.value ? h.value.split(',').map(a => a.trim()).filter(Boolean) : [];
  }
  function setSelectedAllergens(arr) { const h = document.getElementById('f-allergens-hidden'); if (h) h.value = arr.join(','); }
  function toggleAllergen(id) {
    let sel = getSelectedAllergens();
    sel = sel.includes(id) ? sel.filter(a => a !== id) : [...sel, id];
    setSelectedAllergens(sel); renderAllergenUI(sel);
  }
  function renderAllergenUI(selected) {
    const chips = document.getElementById('allergen-selected-chips');
    if (chips) chips.innerHTML = selected.length
      ? selected.map(a => `<span class="allergen-chip-selected" onclick="InventoryPage.toggleAllergen('${a}')">${a} ✕</span>`).join('')
      : '<span style="color:var(--txt-3);font-size:12px;">なし</span>';
    document.querySelectorAll('.allergen-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', selected.includes(btn.dataset.id));
    });
  }

  // ── 在庫エントリー ──
  function renderStockEntries() {
    const el = document.getElementById('stock-entries-list'); if (!el) return;
    if (!currentStockEntries.length) { el.innerHTML = '<div style="color:var(--txt-3);font-size:12px;padding:4px 0;">＋ エントリーを追加</div>'; return; }
    el.innerHTML = currentStockEntries.map((entry, idx) => `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:8px;">
      <div style="flex:1;"><div style="display:flex;gap:6px;align-items:center;">
        <input type="number" id="se-count-${idx}" value="${entry.count || ''}" min="0.5" step="0.5" class="form-input" style="width:80px;" placeholder="数量" oninput="InventoryPage.syncStock(${idx},'count',this.value)">
        <input type="text" inputmode="numeric" id="se-expiry-${idx}" value="${_isoToDisplay(entry.expiry_date)}" placeholder="YYYYMMDD" maxlength="10" class="form-input" style="flex:1;" oninput="InventoryPage._onStockExpiryInput(this,${idx})">
      </div><div id="se-expiry-badge-${idx}" style="margin-top:3px;font-size:11px;" class="${entry.expiry_date ? Utils.expiryClass(entry.expiry_date) : ''}">${entry.expiry_date ? Utils.expiryLabel(entry.expiry_date) : ''}</div></div>
      <button type="button" onclick="InventoryPage.removeStockEntry(${idx})" style="flex-shrink:0;background:var(--red-dim);border:1px solid var(--red-border);color:var(--red);border-radius:6px;padding:7px 10px;cursor:pointer;font-size:13px;margin-top:2px;">✕</button>
    </div>`).join('');
  }
  function syncStock(idx, field, val) {
    if (!currentStockEntries[idx]) return;
    currentStockEntries[idx][field] = field === 'count' ? parseFloat(val) || 0 : val;
  }
  function addStockEntry()       { currentStockEntries.push({ id: null, count: 1, expiry_date: '', note: '' }); renderStockEntries(); }
  function removeStockEntry(idx) { currentStockEntries.splice(idx, 1); renderStockEntries(); }

  // ══════════════════════════════════════════
  //  フォームHTML
  // ══════════════════════════════════════════

  function itemFormHTML(item = null) {
    const edit          = !!item;
    const v             = (f, def = '') => edit && item[f] != null ? Utils.escape(String(item[f])) : def;
    const count_unit_val = edit ? (item.count_unit || '個') : '個';
    const existing      = item?.allergens ? item.allergens.split(',').map(a => a.trim()).filter(Boolean) : [];

    return `
    <!-- AI読取ボタン -->
    <div style="margin-bottom:14px;">
      <button type="button" class="scan-btn-ai" style="width:100%;" onclick="InventoryPage.triggerVisionScan('full')">
        <span style="font-size:18px;">🤖</span>
        <span style="font-size:13px;font-weight:700;">AI写真解析で自動入力</span>
      </button>
    </div>
    <div id="vision-indicator" style="display:none;text-align:center;padding:8px;
      background:var(--blue-dim);border-radius:8px;font-size:13px;color:var(--blue);margin-bottom:10px;"></div>

    <!-- 品名 -->
    <div class="form-group">
      <label class="form-label">品名 *</label>
      <input id="f-name" class="form-input" value="${v('name')}" placeholder="例: ミネラルウォーター 2L">
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">カテゴリー</label>
        <select id="f-category" class="form-select">
          <option value="water"      ${item?.category === 'water'      ? 'selected' : ''}>💧 水</option>
          <option value="food"       ${item?.category === 'food'       ? 'selected' : ''}>🍱 食料</option>
          <option value="medicine"   ${item?.category === 'medicine'   ? 'selected' : ''}>💊 医薬品</option>
          <option value="sanitation" ${item?.category === 'sanitation' ? 'selected' : ''}>🧴 衛生用品</option>
          <option value="disaster"   ${item?.category === 'disaster'   ? 'selected' : ''}>🔦 防災グッズ</option>
          <option value="pet"        ${item?.category === 'pet'        ? 'selected' : ''}>🐾 ペット用品</option>
          <option value="other"      ${item?.category === 'other'      ? 'selected' : ''}>📦 その他</option>
        </select></div>
      <div class="form-group"><label class="form-label">個数単位</label>
        <select id="f-count-unit" class="form-select">
          ${COUNT_UNITS.map(u => `<option ${count_unit_val === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">保管場所</label>
        <select id="f-location" class="form-select"><option value="">選択...</option>
          ${LOCATIONS.map(l => `<option ${item?.location === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">目標数量</label>
        <input id="f-min-qty" type="number" class="form-input" value="${v('min_qty', '0')}" min="0" step="0.5"></div>
    </div>

    <!-- 容量・重量 -->
    <div class="form-row">
      <div class="form-group"><label class="form-label">容量・重量</label>
        <input id="f-volume" type="number" class="form-input" value="${v('volume', '')}" min="0" step="any" placeholder="例: 2"></div>
      <div class="form-group"><label class="form-label">容量単位</label>
        <select id="f-volume-unit" class="form-select">
          <option value="">なし</option>
          ${VOLUME_UNITS.map(u => `<option ${item?.volume_unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select></div>
    </div>

    <!-- アレルゲン -->
    <div class="form-group">
      <label class="form-label">⚠️ アレルゲン</label>
      <input type="hidden" id="f-allergens-hidden" value="${existing.join(',')}">
      <div id="allergen-selected-chips" style="display:flex;flex-wrap:wrap;gap:4px;min-height:22px;margin-bottom:6px;">
        ${existing.length
          ? existing.map(a => `<span class="allergen-chip-selected" onclick="InventoryPage.toggleAllergen('${a}')">${a} ✕</span>`).join('')
          : '<span style="color:var(--txt-3);font-size:12px;">なし</span>'}
      </div>
      <div style="font-size:11px;color:var(--txt-3);font-weight:700;margin-bottom:4px;">特定原材料（8品目）</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
        ${ALLERGEN_LIST.filter(a => a.major).map(a =>
          `<button type="button" class="allergen-toggle-btn ${existing.includes(a.id) ? 'active' : ''}" data-id="${a.id}" onclick="InventoryPage.toggleAllergen('${a.id}')">${a.label}</button>`
        ).join('')}
      </div>
      <div style="font-size:11px;color:var(--txt-3);font-weight:700;margin-bottom:4px;">準ずるもの（20品目）</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${ALLERGEN_LIST.filter(a => !a.major).map(a =>
          `<button type="button" class="allergen-toggle-btn ${existing.includes(a.id) ? 'active' : ''}" data-id="${a.id}" onclick="InventoryPage.toggleAllergen('${a.id}')">${a.label}</button>`
        ).join('')}
      </div>
    </div>

    <!-- 写真 -->
    <div class="form-group">
      <label class="form-label">📸 写真</label>
      <div id="photo-gallery" style="display:flex;flex-wrap:wrap;gap:8px;min-height:32px;margin-bottom:8px;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('package')">📦<br><span>パッケージ</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('ingredients')">📋<br><span>成分表</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('storage')">📍<br><span>保管場所</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('other')">📸<br><span>その他</span></button>
      </div>
    </div>

    <!-- チェック -->
    <div class="form-group">
      <label class="form-check"><input type="checkbox" id="f-rolling" ${item?.is_rolling ? 'checked' : ''}><span class="form-check-label">🔄 ローリングストック対象</span></label>
      <label class="form-check" style="margin-top:8px;"><input type="checkbox" id="f-emergency" ${item?.is_emergency ? 'checked' : ''}><span class="form-check-label">🎒 非常用持ち出し袋に含む</span></label>
    </div>

    <!-- 在庫エントリー -->
    <div style="margin-top:4px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="form-label" style="margin-bottom:0;">📦 在庫エントリー</div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryPage.addStockEntry()">＋ 追加</button>
      </div>
      <div id="stock-entries-list"></div>
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label class="form-label">メモ</label>
      <textarea id="f-notes" class="form-textarea" placeholder="保管方法、用途など...">${edit && item.notes ? item.notes : ''}</textarea>
    </div>

    <div class="btn-row" style="margin-top:4px;">
      <button class="btn btn-primary" onclick="InventoryPage.saveItem(${edit ? item.id : 'null'})">${edit ? '💾 保存する' : '➕ 追加する'}</button>
      ${edit ? `<button class="btn btn-danger btn-sm" onclick="InventoryPage.deleteItem(${item.id})">削除</button>` : ''}
    </div>
    ${edit ? `<button class="btn btn-secondary" style="margin-top:8px;" onclick="InventoryPage.addToShopping(${item.id})">🛒 買い物リストに追加</button>` : ''}`;
  }

  function openAddModal() {
    currentStockEntries = [{ id: null, count: 1, expiry_date: '', note: '' }];
    currentItemImages   = [];
    Modal.open('➕ 備蓄品を追加', itemFormHTML(null));
    setTimeout(() => { renderStockEntries(); renderPhotos(); }, 50);
  }

  async function openEditModal(id) {
    const item = await DB.Items.get(id); if (!item) return;
    currentStockEntries = (item.stocks || []).map(s => ({ id: s.id, count: s.count, expiry_date: s.expiry_date || '', note: s.note || '' }));
    if (!currentStockEntries.length) currentStockEntries = [{ id: null, count: item.total_count || 1, expiry_date: '', note: '' }];
    const imgs = await DB.ItemImages.getForItem(id);
    currentItemImages = imgs.map(img => ({ id: img.id, base64: img.image, caption: img.caption, isNew: false, toDelete: false }));
    Modal.open('✏️ 備蓄品を編集', itemFormHTML(item));
    setTimeout(() => { renderStockEntries(); renderPhotos(); }, 50);
  }

  async function saveItem(idOrNull) {
    const nameEl = document.getElementById('f-name');
    if (!nameEl || !nameEl.value.trim()) { Toast.error('品名を入力してください'); return; }
    currentStockEntries.forEach((entry, idx) => {
      const qEl = document.getElementById('se-count-' + idx);
      const eEl = document.getElementById('se-expiry-' + idx);
      if (qEl) entry.count = parseFloat(qEl.value) || 0;
      if (eEl) entry.expiry_date = _displayToISO(eEl.value) || '';
    });
    const volVal      = parseFloat(document.getElementById('f-volume')?.value);
    const volume      = (volVal > 0) ? volVal : null;
    const volume_unit = volume ? (document.getElementById('f-volume-unit')?.value || null) : null;
    const data = {
      name:        nameEl.value.trim(),
      category:    document.getElementById('f-category')?.value    || 'other',
      location:    document.getElementById('f-location')?.value    || '',
      count_unit:  document.getElementById('f-count-unit')?.value  || '個',
      volume, volume_unit,
      min_qty:     parseFloat(document.getElementById('f-min-qty')?.value) || 0,
      is_rolling:  document.getElementById('f-rolling')?.checked   || false,
      is_emergency:document.getElementById('f-emergency')?.checked || false,
      allergens:   getSelectedAllergens().join(','),
      notes:       document.getElementById('f-notes')?.value.trim() || '',
    };
    let itemId;
    if (idOrNull) { data.id = idOrNull; await DB.Items.update(data); itemId = idOrNull; Toast.success('✅ 更新しました'); }
    else          { itemId = await DB.Items.add(data);                                  Toast.success('✅ 追加しました'); }
    await DB.ItemStocks.replaceForItem(itemId, currentStockEntries.filter(e => (parseFloat(e.count) || 0) > 0));
    for (const img of currentItemImages) {
      if (img.toDelete && img.id) await DB.ItemImages.delete(img.id);
      else if (img.isNew)         await DB.ItemImages.add({ item_id: itemId, image: img.base64, caption: img.caption, sort_order: 0 });
    }
    Modal.close(); allItems = await DB.Items.getAll(); await buildAllergenWarnings(allItems); render();
  }

  async function deleteItem(id) {
    if (!confirm('この備蓄品を削除しますか？')) return;
    await DB.Items.delete(id); await DB.ItemStocks.deleteForItem(id); await DB.ItemImages.deleteForItem(id);
    Toast.success('削除しました'); Modal.close();
    allItems = await DB.Items.getAll(); await buildAllergenWarnings(allItems); render();
  }

  async function addToShopping(id) {
    const item = allItems.find(i => i.id === id); if (!item) return;
    await DB.Shopping.add({ name: item.name, qty_needed: 1, unit: item.count_unit || '個' });
    Toast.success('🛒 買い物リストに追加しました'); Modal.close();
  }

  function getAllergenWarnings() { return allergenWarningMap; }

  return {
    render, setFilter,
    showAddMethodSheet, startQuickCapture, saveQuickItem, quickToFull,
    addStagingPhoto, toggleStagingCheck, removeStagingPhoto, runStagingAnalysis,
    openAddModal, openEditModal, saveItem, deleteItem, addToShopping,
    addStockEntry, removeStockEntry, syncStock,
    _fmtExpiryInput, _onStockExpiryInput,
    triggerVisionScan, addPhoto, removePhoto,
    toggleAllergen, renderAllergenUI, getAllergenWarnings,
  };
})();
