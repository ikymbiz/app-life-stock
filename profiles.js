/* profiles.js — Health Profiles (simplified) */
const ProfilesPage = (() => {

  let allProfiles = [];

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
    h += '<input id="pf-dob" type="date" class="form-input" value="'+v('dob')+'"></div>';
    h += '<div class="form-group"><label class="form-label">性別</label>';
    h += '<select id="pf-gender" class="form-select">';
    h += '<option value="">未設定</option>';
    h += '<option value="男性"'+(gender==='男性'?' selected':'')+'>男性</option>';
    h += '<option value="女性"'+(gender==='女性'?' selected':'')+'>女性</option>';
    h += '<option value="その他"'+(gender==='その他'?' selected':'')+'>その他</option>';
    h += '</select></div></div>';

    // アレルギー
    h += '<div class="form-group">';
    h += '<label class="form-label">⚠️ アレルギー</label>';
    h += '<input id="pf-allergies" class="form-input" value="'+allergies+'" placeholder="例: 小麦, 卵, 乳（カンマ区切り）">';
    h += '<p class="text-[10px] text-on-surface-variant mt-1">備蓄品のアレルゲン照合に使用されます</p>';
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
      dob:            document.getElementById('pf-dob')?.value || '',
      gender:         document.getElementById('pf-gender')?.value || '',
      allergies_food: document.getElementById('pf-allergies')?.value.trim() || '',
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
    if (p.dob) sub.push(p.dob);
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

  return { render, openAddModal, openEditModal, save, remove, showQRCard };
})();
