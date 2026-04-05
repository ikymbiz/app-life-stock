/* profiles.js — Health Profiles (simplified) */
const ProfilesPage = (() => {

  let allProfiles = [];

  const ALLERGENS_28 = [
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
  ];
  const ALLERGEN_IDS = ALLERGENS_28.map(function(a){ return a.id; });

  async function render() {
    const el = document.getElementById('page-profiles');
    if (!el) return;
    allProfiles = await DB.Profiles.getAll();

    let h = '<div style="padding:16px 0 0;margin-bottom:12px;">';
    h += '<div class="font-headline text-xl font-bold text-on-surface">家族の情報</div>';
    h += '<p class="text-xs text-on-surface-variant mt-1">緊急時にQRコードで医療情報を共有できます</p>';
    h += '</div>';

    if (!allProfiles.length) {
      h += '<div class="text-center py-16 text-on-surface-variant">';
      h += '<span class="material-symbols-rounded text-5xl mb-3 block" style="font-variation-settings:\'FILL\' 1;">person_add</span>';
      h += '<div class="font-bold text-base mb-1">まだ登録がありません</div>';
      h += '<div class="text-xs mb-4">家族の情報を登録しましょう</div>';
      h += '<button onclick="ProfilesPage.openAddModal()" class="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-transform">＋ 追加する</button>';
      h += '</div>';
    } else {
      h += '<div class="space-y-3">';
      for (var i = 0; i < allProfiles.length; i++) {
        var p = allProfiles[i];
        var age = p.dob ? calcAge(p.dob) : null;
        var allergyTxt = p.allergies_food || '';
        h += '<div class="bg-white border border-secondary-container rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer" onclick="ProfilesPage.openEditModal('+p.id+')">';
        h += '<div class="flex items-center gap-3">';
        h += '<div class="w-11 h-11 rounded-full bg-primary-container flex items-center justify-center"><span class="material-symbols-rounded text-primary text-xl" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
        h += '<div class="flex-1 min-w-0">';
        h += '<div class="font-bold text-sm">'+esc(p.owner_name)+'</div>';
        h += '<div class="text-[11px] text-on-surface-variant">';
        var sub = [];
        if (p.gender) sub.push(p.gender);
        if (age !== null) sub.push(age + '歳');
        h += sub.join(' · ') || '情報未設定';
        h += '</div>';
        if (allergyTxt) {
          h += '<div class="flex flex-wrap gap-1 mt-2">';
          var tags = allergyTxt.split(',');
          for (var j = 0; j < Math.min(tags.length, 4); j++) {
            h += '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-error/10 text-error">'+esc(tags[j].trim())+'</span>';
          }
          if (tags.length > 4) h += '<span class="text-[10px] text-on-surface-variant">+' + (tags.length-4) + '</span>';
          h += '</div>';
        }
        h += '</div>';
        h += '<span class="material-symbols-rounded text-on-surface-variant text-lg">chevron_right</span>';
        h += '</div></div>';
      }
      h += '</div>';
    }

    el.innerHTML = h;
  }

  function esc(s) { return Utils.escape(s || ''); }

  // ── 生年月日 入力ヘルパー ──
  function _fmtDob(el) {
    const d = el.value.replace(/\D/g, '').slice(0, 8);
    let v = d;
    if (d.length > 6) v = d.slice(0,4)+'/'+d.slice(4,6)+'/'+d.slice(6);
    else if (d.length > 4) v = d.slice(0,4)+'/'+d.slice(4);
    el.value = v;
  }
  function _dobToISO(v) {
    const d = v.replace(/\D/g, '');
    if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8);
    return '';
  }
  function _isoToDob(iso) { return iso ? iso.replace(/-/g, '/') : ''; }

  function calcAge(dob) {
    try {
      var d = new Date(dob), now = new Date();
      var age = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
      return age >= 0 ? age : null;
    } catch(e) { return null; }
  }

  // ── フォーム ──
  function formHTML(p) {
    var edit = !!p;
    var v = function(f, def) { return edit && p[f] != null ? esc(String(p[f])) : (def || ''); };
    var gender = edit ? (p.gender || '') : '';
    var allergies = v('allergies_food');
    var favFoods = v('favorite_foods');
    var disFoods = v('disliked_foods');

    var h = '';

    // 名前
    h += '<div class="form-group">';
    h += '<label class="form-label">名前（ニックネーム） *</label>';
    h += '<input id="pf-name" class="form-input" value="'+v('owner_name')+'" placeholder="例: たろう">';
    h += '</div>';

    // 生年月日・性別
    h += '<div class="form-row">';
    h += '<div class="form-group"><label class="form-label">生年月日</label>';
    h += '<input id="pf-dob" type="text" inputmode="numeric" maxlength="10" class="form-input" value="'+_isoToDob(edit ? (p.dob||'') : '')+'" placeholder="YYYYMMDD" oninput="ProfilesPage._fmtDob(this)"></div>';
    h += '<div class="form-group"><label class="form-label">性別</label>';
    h += '<select id="pf-gender" class="form-select">';
    h += '<option value="">未設定</option>';
    h += '<option value="男性"'+(gender==='男性'?' selected':'')+'>男性</option>';
    h += '<option value="女性"'+(gender==='女性'?' selected':'')+'>女性</option>';
    h += '<option value="その他"'+(gender==='その他'?' selected':'')+'>その他</option>';
    h += '</select></div></div>';

    // アレルギー — 既存データを「26品目」と「その他」に分離
    var existingAll = allergies ? allergies.split(',').map(function(a){return a.trim();}).filter(Boolean) : [];
    var selectedIds = existingAll.filter(function(a){ return ALLERGEN_IDS.indexOf(a) >= 0; });
    var otherText   = existingAll.filter(function(a){ return ALLERGEN_IDS.indexOf(a) < 0; }).join(', ');

    h += '<div class="form-group">';
    h += '<label class="form-label">⚠️ アレルギー</label>';
    h += '<input type="hidden" id="pf-allergen-selected" value="'+selectedIds.join(',')+'">';
    h += '<p class="text-[10px] text-on-surface-variant mb-2">備蓄品のアレルゲン照合に使用されます</p>';

    // 特定原材料8品目
    h += '<div class="text-[11px] text-on-surface-variant font-bold mb-1">特定原材料（8品目）</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">';
    for (var ai=0; ai<ALLERGENS_28.length; ai++) {
      var a = ALLERGENS_28[ai];
      if (!a.major) continue;
      var on = selectedIds.indexOf(a.id) >= 0;
      h += '<button type="button" class="allergen-toggle-btn'+(on?' active':'')+'" data-aid="'+a.id+'" onclick="ProfilesPage.toggleAllergen(\''+a.id+'\')">' +a.label+'</button>';
    }
    h += '</div>';

    // 準ずるもの20品目
    h += '<div class="text-[11px] text-on-surface-variant font-bold mb-1">特定原材料に準ずるもの（20品目）</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
    for (var ai2=0; ai2<ALLERGENS_28.length; ai2++) {
      var a2 = ALLERGENS_28[ai2];
      if (a2.major) continue;
      var on2 = selectedIds.indexOf(a2.id) >= 0;
      h += '<button type="button" class="allergen-toggle-btn'+(on2?' active':'')+'" data-aid="'+a2.id+'" onclick="ProfilesPage.toggleAllergen(\''+a2.id+'\')">' +a2.label+'</button>';
    }
    h += '</div>';

    // その他（自由記述）
    h += '<div class="text-[11px] text-on-surface-variant font-bold mb-1">その他</div>';
    h += '<input id="pf-allergen-other" class="form-input" value="'+esc(otherText)+'" placeholder="上記以外があればカンマ区切りで入力">';
    h += '</div>';

    // 好きな食べ物
    h += '<div class="form-group">';
    h += '<label class="form-label">😋 好きな食べ物</label>';
    h += '<input id="pf-fav" class="form-input" value="'+favFoods+'" placeholder="例: カレー, ラーメン">';
    h += '</div>';

    // 嫌いな食べ物
    h += '<div class="form-group">';
    h += '<label class="form-label">😣 嫌いな食べ物</label>';
    h += '<input id="pf-dis" class="form-input" value="'+disFoods+'" placeholder="例: ピーマン, セロリ">';
    h += '</div>';

    // ボタン
    h += '<div class="btn-row" style="margin-top:8px;">';
    h += '<button class="btn btn-primary" onclick="ProfilesPage.save('+(edit?p.id:'null')+')">'+(edit?'💾 保存':'➕ 追加')+'</button>';
    if (edit) h += '<button class="btn btn-danger btn-sm" onclick="ProfilesPage.remove('+p.id+')">削除</button>';
    h += '</div>';

    if (edit) {
      h += '<button class="btn btn-secondary" style="width:100%;margin-top:10px;" onclick="ProfilesPage.showQRCard('+p.id+')">🆘 緊急QRコードを表示</button>';
    }

    return h;
  }

  function openAddModal() {
    Modal.open('➕ 家族を追加', formHTML(null));
  }

  async function openEditModal(id) {
    var p = await DB.Profiles.get(id);
    if (!p) return;
    Modal.open('✏️ 情報を編集', formHTML(p));
  }

  async function save(idOrNull) {
    var nameEl = document.getElementById('pf-name');
    if (!nameEl || !nameEl.value.trim()) { Toast.error('名前を入力してください'); return; }

    var data = {
      owner_name:     nameEl.value.trim(),
      dob:            _dobToISO(document.getElementById('pf-dob')?.value || ''),
      gender:         document.getElementById('pf-gender')?.value || '',
      allergies_food: getAllergiesValue(),
      favorite_foods: document.getElementById('pf-fav')?.value.trim() || '',
      disliked_foods: document.getElementById('pf-dis')?.value.trim() || '',
      // 互換性のため残すが空文字
      is_pet: 0,
      blood_type: '',
      allergies_drug: '',
      conditions: '',
      medications: '',
    };

    if (idOrNull) {
      data.id = idOrNull;
      await DB.Profiles.update(data);
      Toast.success('✅ 更新しました');
    } else {
      await DB.Profiles.add(data);
      Toast.success('✅ 追加しました');
    }
    Modal.close();
    render();
  }

  async function remove(id) {
    if (!confirm('この情報を削除しますか？')) return;
    await DB.Profiles.delete(id);
    Toast.success('削除しました');
    Modal.close();
    render();
  }

  // ── QRコード表示 ──
  async function showQRCard(pOrId) {
    var p = typeof pOrId === 'object' ? pOrId : await DB.Profiles.get(pOrId);
    if (!p) return;

    var qrData = {
      name: p.owner_name,
      dob: p.dob || '',
      gender: p.gender || '',
      allergies: p.allergies_food || '',
      favorite_foods: p.favorite_foods || '',
      disliked_foods: p.disliked_foods || '',
    };

    var age = p.dob ? calcAge(p.dob) : null;

    var h = '';
    h += '<div class="text-center mb-6">';
    h += '<div class="font-headline font-bold text-lg mb-1">'+esc(p.owner_name)+'</div>';
    var sub = [];
    if (p.gender) sub.push(p.gender);
    if (age !== null) sub.push(age + '歳');
    if (p.dob) sub.push(_isoToDob(p.dob));
    h += '<div class="text-xs text-on-surface-variant">'+sub.join(' · ')+'</div>';
    h += '</div>';

    // QRコード
    h += '<div id="qr-container" class="flex justify-center mb-6"></div>';

    // 情報カード
    if (p.allergies_food) {
      h += '<div class="p-3 rounded-xl bg-error/5 border border-error/20 mb-3">';
      h += '<div class="text-xs font-bold text-error mb-1">⚠️ アレルギー</div>';
      h += '<div class="text-sm font-bold">'+esc(p.allergies_food)+'</div></div>';
    }
    if (p.favorite_foods) {
      h += '<div class="p-3 rounded-xl bg-primary-container/30 mb-3">';
      h += '<div class="text-xs font-bold text-primary mb-1">😋 好きな食べ物</div>';
      h += '<div class="text-sm">'+esc(p.favorite_foods)+'</div></div>';
    }
    if (p.disliked_foods) {
      h += '<div class="p-3 rounded-xl bg-surface-variant mb-3">';
      h += '<div class="text-xs font-bold text-on-surface-variant mb-1">😣 嫌いな食べ物</div>';
      h += '<div class="text-sm">'+esc(p.disliked_foods)+'</div></div>';
    }

    h += '<p class="text-[10px] text-center text-on-surface-variant mt-4">QRコードは端末内で生成されています。<br>外部サーバーには送信されません。</p>';

    Modal.open('🆘 '+esc(p.owner_name)+' の緊急カード', h);

    // QRコード生成
    setTimeout(function() {
      var container = document.getElementById('qr-container');
      if (container && typeof QRCode !== 'undefined') {
        container.innerHTML = '';
        new QRCode(container, {
          text: JSON.stringify(qrData),
          width: 180, height: 180,
          colorDark: '#1A1C1C', colorLight: '#FFFFFF',
        });
      }
    }, 100);
  }

  // ── アレルゲン選択UI ──
  function toggleAllergen(id) {
    var hidden = document.getElementById('pf-allergen-selected');
    if (!hidden) return;
    var arr = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
    var idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(id);
    hidden.value = arr.join(',');
    // ボタンの見た目を更新
    document.querySelectorAll('.allergen-toggle-btn').forEach(function(btn) {
      if (btn.getAttribute('data-aid') === id) {
        btn.classList.toggle('active', arr.indexOf(id) >= 0);
      }
    });
  }

  function getAllergiesValue() {
    var hidden = document.getElementById('pf-allergen-selected');
    var otherEl = document.getElementById('pf-allergen-other');
    var selected = hidden && hidden.value ? hidden.value.split(',').filter(Boolean) : [];
    var other = otherEl ? otherEl.value.trim().split(/[,、]/).map(function(s){return s.trim();}).filter(Boolean) : [];
    return selected.concat(other).join(',');
  }

  return { render, openAddModal, openEditModal, save, remove, showQRCard, toggleAllergen, _fmtDob };
})();
