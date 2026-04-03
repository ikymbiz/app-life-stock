/* inventory.js — Inventory: Barcode + Vision AI + multi-stock + photo gallery */
const InventoryPage = (() => {
  let allItems            = [];
  let activeFilter        = 'all';
  let currentStockEntries = [];
  let currentItemImages   = [];
  let allergenWarningMap  = new Map();

  const CATEGORIES = [
    {id:'all',label:'すべて'},{id:'water',label:'💧 水'},{id:'food',label:'🍱 食料'},
    {id:'medicine',label:'💊 医薬品'},{id:'sanitation',label:'🧴 衛生'},
    {id:'disaster',label:'🔦 防災'},{id:'pet',label:'🐾 ペット'},{id:'other',label:'📦 その他'},
  ];
  const UNITS     = ['個','本','袋','缶','箱','食','L','mL','枚','セット','kg','g','カップ'];
  const LOCATIONS = ['玄関','キッチン','食品庫','寝室','リビング','クローゼット','床下収納','車内','ベランダ','その他'];

  const ALLERGEN_LIST = [
    {id:'小麦',  label:'🌾 小麦',  major:true},{id:'卵',    label:'🥚 卵',    major:true},
    {id:'乳',    label:'🥛 乳',    major:true},{id:'そば',  label:'🍜 そば',  major:true},
    {id:'落花生',label:'🥜 落花生',major:true},{id:'えび',  label:'🦐 えび',  major:true},
    {id:'かに',  label:'🦀 かに',  major:true},{id:'くるみ',label:'🌰 くるみ',major:true},
    {id:'アーモンド',label:'アーモンド'},{id:'あわび',label:'あわび'},{id:'いか',label:'いか'},
    {id:'いくら',label:'いくら'},{id:'オレンジ',label:'🍊 オレンジ'},
    {id:'カシューナッツ',label:'カシューナッツ'},{id:'キウイ',label:'🥝 キウイ'},
    {id:'牛肉',label:'🥩 牛肉'},{id:'ごま',label:'ごま'},{id:'さけ',label:'さけ'},
    {id:'さば',label:'さば'},{id:'大豆',label:'大豆'},{id:'鶏肉',label:'鶏肉'},
    {id:'豚肉',label:'豚肉'},{id:'バナナ',label:'🍌 バナナ'},{id:'もも',label:'🍑 もも'},
    {id:'やまいも',label:'やまいも'},{id:'りんご',label:'🍎 りんご'},
    {id:'ゼラチン',label:'ゼラチン'},{id:'マカダミアナッツ',label:'マカダミア'},
    {id:'まつたけ',label:'まつたけ'},{id:'ピーナッツ',label:'🥜 ピーナッツ'},
  ];

  // ── アレルゲン照合 ──
  async function buildAllergenWarnings(items) {
    const profiles = await DB.Profiles.getAll();
    allergenWarningMap.clear();
    for (const item of items) {
      if (!item.allergens) continue;
      const ia = item.allergens.split(',').map(a=>a.trim()).filter(Boolean);
      for (const allergen of ia) {
        for (const p of profiles) {
          const txt = [p.allergies_food, p.allergies_drug].filter(Boolean).join('、');
          if (txt && txt.includes(allergen)) {
            if (!allergenWarningMap.has(item.id)) allergenWarningMap.set(item.id, []);
            const ex = allergenWarningMap.get(item.id);
            if (!ex.find(e => e.allergen===allergen && e.who===p.owner_name))
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
        ${CATEGORIES.map(c=>`<button class="filter-chip ${activeFilter===c.id?'active':''}"
          onclick="InventoryPage.setFilter('${c.id}')">${c.label}</button>`).join('')}
      </div>
      <div id="items-list"></div>
    </div>`;
    document.getElementById('inventory-search').addEventListener('input', e => renderItems(e.target.value));
    renderItems('');
  }

  function renderItems(query='') {
    const listEl = document.getElementById('items-list');
    if (!listEl) return;
    let filtered = activeFilter==='all' ? [...allItems] : allItems.filter(i=>i.category===activeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(i => (i.name||'').toLowerCase().includes(q)||(i.location||'').toLowerCase().includes(q));
    }
    filtered.sort((a,b) => {
      const aw = allergenWarningMap.has(b.id) ? 1 : allergenWarningMap.has(a.id) ? -1 : 0;
      if (aw !== 0) return aw;
      const da = a.nearest_expiry ? Utils.daysUntil(a.nearest_expiry) : 9999;
      const db = b.nearest_expiry ? Utils.daysUntil(b.nearest_expiry) : 9999;
      return da - db;
    });
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">備蓄品がありません</div>
        <div class="empty-sub">右下の ＋ ボタンから追加してください</div>
      </div>`; return;
    }
    listEl.innerHTML = filtered.map(item => {
      const warnings = allergenWarningMap.get(item.id) || [];
      const exClass  = item.nearest_expiry ? Utils.expiryClass(item.nearest_expiry) : 'expiry-none';
      const exLabel  = item.nearest_expiry ? Utils.expiryLabel(item.nearest_expiry) : '';
      const isLow    = item.min_qty > 0 && item.total_qty < item.min_qty;
      const lotTag   = item.is_rolling && (item.stocks||[]).length > 1
        ? `<span class="expiry-badge expiry-warn">🔄${item.stocks.length}ロット</span>` : '';
      const warnTag  = warnings.length ? `<span class="allergen-badge">⚠️ アレルギー</span>` : '';
      return `<div class="item-card ${isLow?'item-low-stock':''} ${warnings.length?'item-allergen-warn':''}"
          onclick="InventoryPage.openEditModal(${item.id})">
        <div class="item-card-inner">
          <div class="item-cat-icon">${Utils.categoryIcon(item.category)}</div>
          <div class="item-info">
            <div class="item-name">${Utils.escape(item.name)}</div>
            <div class="item-sub">
              ${item.location?`📍${Utils.escape(item.location)}`:''}
              ${item.location&&item.nearest_expiry?' · ':''}
              ${item.nearest_expiry?`期限:${Utils.formatDate(item.nearest_expiry)}`:''}
            </div>
            ${warnings.length ? `<div class="allergen-who">
              ${[...new Set(warnings.map(w=>w.who))].map(n=>`<span class="allergen-who-badge">${Utils.escape(n)}</span>`).join('')}
              ${[...new Set(warnings.map(w=>w.allergen))].map(a=>`<span class="allergen-item-badge">${Utils.escape(a)}</span>`).join('')}
            </div>` : ''}
          </div>
          <div class="item-right">
            <div class="item-qty">${item.total_qty}<span style="font-size:12px;color:var(--txt-3);"> ${Utils.escape(item.unit||'個')}</span></div>
            ${item.nearest_expiry?`<span class="expiry-badge ${exClass}">${exLabel}</span>`:''}
            ${lotTag}${warnTag}
            ${isLow?`<span class="expiry-badge expiry-warn">在庫不足</span>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function setFilter(cat) { activeFilter = cat; render(); }

  // ── 画像圧縮 ──
  function compressImage(file, maxW=900, quality=0.72) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w=img.width, h=img.height;
        if (w>maxW||h>maxW) { if(w>h){h=Math.round(h*maxW/w);w=maxW;}else{w=Math.round(w*maxW/h);h=maxW;} }
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg',quality));
      };
      img.onerror=()=>{URL.revokeObjectURL(url);resolve(null);};
      img.src=url;
    });
  }

  // ── 写真UI ──
  function renderPhotos() {
    const el = document.getElementById('photo-gallery');
    if (!el) return;
    const visible = currentItemImages.filter(i=>!i.toDelete);
    if (!visible.length) {
      el.innerHTML=`<div style="color:var(--txt-3);font-size:12px;padding:4px 0;">写真なし</div>`; return;
    }
    el.innerHTML = visible.map((img,i)=>`
      <div class="photo-thumb-wrap">
        <img class="photo-thumb" src="${img.base64}" alt="${img.caption}">
        <div class="photo-caption">${captionLabel(img.caption)}</div>
        <button class="photo-delete-btn" onclick="InventoryPage.removePhoto(${i})">✕</button>
      </div>`).join('');
  }
  function captionLabel(c) {
    return {package:'📦パッケージ',ingredients:'📋成分表',storage:'📍保管場所',other:'📸その他'}[c]||'📸';
  }
  async function addPhoto(captionType) {
    const input=document.createElement('input');
    input.type='file'; input.accept='image/*'; input.capture='environment';
    input.onchange=async e=>{
      const file=e.target.files[0]; if(!file) return;
      const b64=await compressImage(file); if(!b64){Toast.error('画像読込失敗');return;}
      currentItemImages.push({id:null,base64:b64,caption:captionType,isNew:true,toDelete:false});
      renderPhotos(); Toast.success('📸 写真を追加しました');
    };
    input.click();
  }
  function removePhoto(idx) {
    const visible=currentItemImages.filter(i=>!i.toDelete);
    const target=visible[idx]; if(!target) return;
    if(target.id) target.toDelete=true; else currentItemImages.splice(currentItemImages.indexOf(target),1);
    renderPhotos();
  }

  // ── Vision AI スキャン ──
  async function triggerVisionScan(type) {
    const provider = await DB.Settings.get('ai_provider','none');
    if (provider === 'none') {
      Toast.show('⚙️ 設定画面でAIプロバイダーとAPIキーを設定してください');
      App.navigate('settings');
      return;
    }
    const input=document.createElement('input');
    input.type='file'; input.accept='image/*'; input.capture='environment';
    input.onchange=async e=>{
      const file=e.target.files[0]; if(!file) return;
      const b64=await compressImage(file); if(!b64) return;
      // 写真を自動で追加
      const cap=type==='allergens'?'ingredients':'package';
      currentItemImages.push({id:null,base64:b64,caption:cap,isNew:true,toDelete:false});
      renderPhotos();
      await runVisionAI(b64, type);
    };
    input.click();
  }

  async function runVisionAI(base64, type) {
    const indicator = document.getElementById('vision-indicator');
    if (indicator) { indicator.style.display='block'; indicator.textContent='🤖 AI解析中...'; }

    try {
      const result = await VisionAI.analyze(`data:image/jpeg;base64,${base64}`, type);
      applyVisionResult(result, type);
    } catch(e) {
      if (e.message==='NO_PROVIDER') {
        Toast.show('⚙️ 設定画面でAIプロバイダーを設定してください');
      } else if (e.message==='NO_KEY') {
        Toast.error('APIキーが設定されていません');
      } else {
        Toast.error(`AI解析エラー: ${e.message}`);
      }
    } finally {
      if (indicator) indicator.style.display='none';
    }
  }

  function applyVisionResult(result, type) {
    let found = false;
    // 賞味期限
    if (result.expiry_date && type !== 'allergens') {
      let filled=false;
      for(let i=0;i<currentStockEntries.length;i++){
        if(!currentStockEntries[i].expiry_date){
          currentStockEntries[i].expiry_date=result.expiry_date;
          const el=document.getElementById(`se-expiry-${i}`);
          if(el) el.value=result.expiry_date;
          filled=true; break;
        }
      }
      if(!filled) currentStockEntries.push({id:null,qty:1,expiry_date:result.expiry_date,note:''});
      renderStockEntries();
      Toast.success(`📅 賞味期限: ${Utils.formatDate(result.expiry_date)}`);
      found=true;
    }
    // アレルゲン
    if (result.allergens && result.allergens.length) {
      const current = getSelectedAllergens();
      const merged  = [...new Set([...current, ...result.allergens])];
      setSelectedAllergens(merged);
      renderAllergenUI(merged);
      Toast.success(`⚠️ アレルゲン: ${result.allergens.join('・')}`);
      found=true;
    }
    // 商品名
    if (result.name) {
      const nameEl=document.getElementById('f-name');
      if(nameEl && !nameEl.value.trim()){ nameEl.value=result.name; Toast.success(`📦 品名: ${result.name}`); found=true; }
    }
    if(!found) Toast.show('テキストを検出できませんでした');
  }

  // ── アレルゲンUI ──
  function getSelectedAllergens() {
    const h=document.getElementById('f-allergens-hidden');
    return h&&h.value ? h.value.split(',').map(a=>a.trim()).filter(Boolean) : [];
  }
  function setSelectedAllergens(arr) {
    const h=document.getElementById('f-allergens-hidden');
    if(h) h.value=arr.join(',');
  }
  function toggleAllergen(id) {
    let sel=getSelectedAllergens();
    sel=sel.includes(id) ? sel.filter(a=>a!==id) : [...sel,id];
    setSelectedAllergens(sel);
    renderAllergenUI(sel);
  }
  function renderAllergenUI(selected) {
    const chips=document.getElementById('allergen-selected-chips');
    if(chips) chips.innerHTML=selected.length
      ? selected.map(a=>`<span class="allergen-chip-selected" onclick="InventoryPage.toggleAllergen('${a}')">${a} ✕</span>`).join('')
      : '<span style="color:var(--txt-3);font-size:12px;">なし</span>';
    document.querySelectorAll('.allergen-toggle-btn').forEach(btn=>{
      btn.classList.toggle('active', selected.includes(btn.dataset.id));
    });
  }

  // ── Stock entries ──
  function renderStockEntries() {
    const el=document.getElementById('stock-entries-list');
    if(!el) return;
    if(!currentStockEntries.length){
      el.innerHTML=`<div style="color:var(--txt-3);font-size:12px;padding:4px 0;">＋ エントリーを追加</div>`; return;
    }
    el.innerHTML=currentStockEntries.map((entry,idx)=>`
      <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:8px;">
        <div style="flex:1;">
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="number" id="se-qty-${idx}" value="${entry.qty||''}" min="0.5" step="0.5"
              class="form-input" style="width:80px;" placeholder="数量"
              oninput="InventoryPage.syncStock(${idx},'qty',this.value)">
            <input type="date" id="se-expiry-${idx}" value="${entry.expiry_date||''}"
              class="form-input" style="flex:1;"
              oninput="InventoryPage.syncStock(${idx},'expiry_date',this.value)">
          </div>
          ${entry.expiry_date?`<div style="margin-top:3px;font-size:11px;" class="${Utils.expiryClass(entry.expiry_date)}">${Utils.expiryLabel(entry.expiry_date)}</div>`:''}
        </div>
        <button type="button" onclick="InventoryPage.removeStockEntry(${idx})"
          style="flex-shrink:0;background:var(--red-dim);border:1px solid var(--red-border);color:var(--red);
          border-radius:6px;padding:7px 10px;cursor:pointer;font-size:13px;margin-top:2px;">✕</button>
      </div>`).join('');
  }
  function syncStock(idx,field,val){
    if(!currentStockEntries[idx]) return;
    currentStockEntries[idx][field]=field==='qty'?parseFloat(val)||0:val;
    if(field==='expiry_date') setTimeout(()=>renderStockEntries(),30);
  }
  function addStockEntry(){currentStockEntries.push({id:null,qty:1,expiry_date:'',note:''});renderStockEntries();}
  function removeStockEntry(idx){currentStockEntries.splice(idx,1);renderStockEntries();}

  // ── Item Form ──
  function itemFormHTML(item=null) {
    const edit=!!item;
    const v=(f,def='')=>edit&&item[f]!=null?Utils.escape(String(item[f])):def;
    const unitVal=edit?(item.unit||'個'):'個';
    const existing=item?.allergens?item.allergens.split(',').map(a=>a.trim()).filter(Boolean):[];

    return `
    <!-- ① バーコード・AIスキャン -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <button type="button" class="scan-btn-primary" onclick="BarcodeScanner.scanAndFill()">
        <span style="font-size:20px;">📱</span>
        <span style="font-size:13px;font-weight:700;">バーコードスキャン</span>
        <span style="font-size:10px;opacity:.75;">商品名・アレルゲン自動入力</span>
      </button>
      <button type="button" class="scan-btn-ai" onclick="InventoryPage.triggerVisionScan('full')">
        <span style="font-size:20px;">🤖</span>
        <span style="font-size:13px;font-weight:700;">AI写真解析</span>
        <span style="font-size:10px;opacity:.75;">賞味期限・アレルゲン読取</span>
      </button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <button type="button" class="scan-btn-sub" onclick="InventoryPage.triggerVisionScan('expiry')">
        📅 賞味期限のみ読取
      </button>
      <button type="button" class="scan-btn-sub" onclick="InventoryPage.triggerVisionScan('allergens')">
        ⚠️ 成分表・アレルゲンのみ
      </button>
    </div>
    <div id="vision-indicator" style="display:none;text-align:center;padding:8px;
      background:var(--blue-dim);border-radius:8px;font-size:13px;color:var(--blue);margin-bottom:10px;"></div>

    <!-- ② 品名 -->
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
        <label class="form-label">単位</label>
        <select id="f-unit" class="form-select">
          ${UNITS.map(u=>`<option ${unitVal===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">保管場所</label>
        <select id="f-location" class="form-select">
          <option value="">選択...</option>
          ${LOCATIONS.map(l=>`<option ${item?.location===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">目標数量</label>
        <input id="f-min-qty" type="number" class="form-input" value="${v('min_qty','0')}" min="0" step="0.5">
      </div>
    </div>

    <!-- ③ アレルゲン -->
    <div class="form-group">
      <label class="form-label">⚠️ アレルゲン（含まれるもの）</label>
      <input type="hidden" id="f-allergens-hidden" value="${existing.join(',')}">
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;color:var(--txt-3);margin-bottom:5px;">選択中：</div>
        <div id="allergen-selected-chips" style="display:flex;flex-wrap:wrap;gap:4px;min-height:22px;">
          ${existing.length
            ? existing.map(a=>`<span class="allergen-chip-selected" onclick="InventoryPage.toggleAllergen('${a}')">${a} ✕</span>`).join('')
            : '<span style="color:var(--txt-3);font-size:12px;">なし</span>'}
        </div>
      </div>
      <div style="font-size:11px;color:var(--txt-3);margin-bottom:5px;">特定原材料（タップで追加）：</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
        ${ALLERGEN_LIST.filter(a=>a.major).map(a=>`
          <button type="button" class="allergen-toggle-btn ${existing.includes(a.id)?'active':''}"
            data-id="${a.id}" onclick="InventoryPage.toggleAllergen('${a.id}')">${a.label}</button>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${ALLERGEN_LIST.filter(a=>!a.major).map(a=>`
          <button type="button" class="allergen-toggle-btn ${existing.includes(a.id)?'active':''}"
            data-id="${a.id}" onclick="InventoryPage.toggleAllergen('${a.id}')">${a.label}</button>`).join('')}
      </div>
    </div>

    <!-- ④ 写真ギャラリー -->
    <div class="form-group">
      <label class="form-label">📸 写真</label>
      <div id="photo-gallery" style="display:flex;flex-wrap:wrap;gap:8px;min-height:40px;margin-bottom:8px;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('package')">📦<br><span>パッケージ</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('ingredients')">📋<br><span>成分表</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('storage')">📍<br><span>保管場所</span></button>
        <button type="button" class="photo-add-btn" onclick="InventoryPage.addPhoto('other')">📸<br><span>その他</span></button>
      </div>
    </div>

    <!-- ⑤ チェック -->
    <div class="form-group">
      <label class="form-check">
        <input type="checkbox" id="f-rolling" ${item?.is_rolling?'checked':''}>
        <span class="form-check-label">🔄 ローリングストック対象</span>
      </label>
      <label class="form-check" style="margin-top:8px;">
        <input type="checkbox" id="f-emergency" ${item?.is_emergency?'checked':''}>
        <span class="form-check-label">🎒 非常用持ち出し袋に含む</span>
      </label>
    </div>

    <!-- ⑥ 在庫エントリー -->
    <div style="margin-top:4px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div class="form-label" style="margin-bottom:1px;">📦 在庫エントリー（ロット別）</div>
          <div style="font-size:11px;color:var(--txt-3);">ローリングストックの賞味期限ロットごとに登録</div>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryPage.addStockEntry()">＋ 追加</button>
      </div>
      <div id="stock-entries-list"></div>
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label class="form-label">メモ</label>
      <textarea id="f-notes" class="form-textarea" placeholder="保管方法、用途など...">${edit&&item.notes?item.notes:''}</textarea>
    </div>

    <div class="btn-row" style="margin-top:4px;">
      <button class="btn btn-primary" onclick="InventoryPage.saveItem(${edit?item.id:'null'})">
        ${edit?'💾 保存する':'➕ 追加する'}
      </button>
      ${edit?`<button class="btn btn-danger btn-sm" onclick="InventoryPage.deleteItem(${item.id})">削除</button>`:''}
    </div>
    ${edit?`<button class="btn btn-secondary" style="margin-top:8px;" onclick="InventoryPage.addToShopping(${item.id})">
      🛒 買い物リストに追加</button>`:''}`;
  }

  function openAddModal() {
    currentStockEntries=[{id:null,qty:1,expiry_date:'',note:''}];
    currentItemImages=[];
    Modal.open('➕ 備蓄品を追加', itemFormHTML(null));
    setTimeout(()=>{renderStockEntries();renderPhotos();},50);
  }

  async function openEditModal(id) {
    const item=await DB.Items.get(id);
    if(!item) return;
    currentStockEntries=(item.stocks||[]).map(s=>({id:s.id,qty:s.qty,expiry_date:s.expiry_date||'',note:s.note||''}));
    if(!currentStockEntries.length) currentStockEntries=[{id:null,qty:item.total_qty||1,expiry_date:'',note:''}];
    const imgs=await DB.ItemImages.getForItem(id);
    currentItemImages=imgs.map(img=>({id:img.id,base64:img.image,caption:img.caption,isNew:false,toDelete:false}));
    Modal.open('✏️ 備蓄品を編集', itemFormHTML(item));
    setTimeout(()=>{renderStockEntries();renderPhotos();},50);
  }

  async function saveItem(idOrNull) {
    const nameEl=document.getElementById('f-name');
    if(!nameEl||!nameEl.value.trim()){Toast.error('品名を入力してください');return;}
    currentStockEntries.forEach((entry,idx)=>{
      const qEl=document.getElementById(`se-qty-${idx}`);
      const eEl=document.getElementById(`se-expiry-${idx}`);
      if(qEl) entry.qty=parseFloat(qEl.value)||0;
      if(eEl) entry.expiry_date=eEl.value||'';
    });
    const allergens=getSelectedAllergens();
    const data={
      name:       nameEl.value.trim(),
      category:   document.getElementById('f-category')?.value||'other',
      location:   document.getElementById('f-location')?.value||'',
      unit:       document.getElementById('f-unit')?.value||'個',
      min_qty:    parseFloat(document.getElementById('f-min-qty')?.value)||0,
      is_rolling: document.getElementById('f-rolling')?.checked||false,
      is_emergency:document.getElementById('f-emergency')?.checked||false,
      allergens:  allergens.join(','),
      notes:      document.getElementById('f-notes')?.value.trim()||'',
    };
    let itemId;
    if(idOrNull){ data.id=idOrNull; await DB.Items.update(data); itemId=idOrNull; Toast.success('✅ 更新しました'); }
    else { itemId=await DB.Items.add(data); Toast.success('✅ 追加しました'); }
    await DB.ItemStocks.replaceForItem(itemId, currentStockEntries.filter(e=>(parseFloat(e.qty)||0)>0));
    for(const img of currentItemImages){
      if(img.toDelete&&img.id) await DB.ItemImages.delete(img.id);
      else if(img.isNew) await DB.ItemImages.add({item_id:itemId,image:img.base64,caption:img.caption,sort_order:0});
    }
    Modal.close();
    allItems=await DB.Items.getAll();
    await buildAllergenWarnings(allItems);
    render();
  }

  async function deleteItem(id) {
    if(!confirm('この備蓄品を削除しますか？')) return;
    await DB.Items.delete(id);
    await DB.ItemStocks.deleteForItem(id);
    await DB.ItemImages.deleteForItem(id);
    Toast.success('削除しました'); Modal.close();
    allItems=await DB.Items.getAll();
    await buildAllergenWarnings(allItems);
    render();
  }

  async function addToShopping(id) {
    const item=allItems.find(i=>i.id===id); if(!item) return;
    await DB.Shopping.add({name:item.name,qty_needed:1,unit:item.unit});
    Toast.success('🛒 買い物リストに追加しました'); Modal.close();
  }

  function getAllergenWarnings(){return allergenWarningMap;}

  return {
    render, setFilter, openAddModal, openEditModal, saveItem, deleteItem, addToShopping,
    addStockEntry, removeStockEntry, syncStock,
    triggerVisionScan, addPhoto, removePhoto,
    toggleAllergen, renderAllergenUI, getAllergenWarnings,
  };
})();
