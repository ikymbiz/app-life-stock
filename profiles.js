/* profiles.js — Health Cards & QR Code Page */
const ProfilesPage = (() => {

  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', '不明'];
  const FOOD_ALLERGIES = ['小麦','卵','乳製品','そば','落花生','エビ','カニ','木の実'];

  async function render() {
    const profiles = await DB.Profiles.getAll();
    const el = document.getElementById('page-profiles');

    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">健康カード</div>
        <div style="font-size:13px;color:var(--txt-3);margin-top:2px;">家族・ペットの緊急医療情報</div>
      </div>

      <!-- Emergency hint -->
      <div class="card" style="background:var(--red-dim);border-color:var(--red-border);margin-top:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">💡</span>
          <div style="font-size:13px;color:var(--txt-2);">
            各カードの<strong style="color:var(--txt-1);">QRコード</strong>を救急隊員に提示することで、素早く医療情報を共有できます
          </div>
        </div>
      </div>

      <!-- Profile list -->
      <div id="profiles-list" style="margin-top:14px;"></div>
    </div>`;

    renderList(profiles);
  }

  function renderList(profiles) {
    const el = document.getElementById('profiles-list');
    if (!el) return;

    if (!profiles.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-title">登録された人物がいません</div>
        <div class="empty-sub">＋ボタンから家族・ペットを登録してください</div>
      </div>`;
      return;
    }

    el.innerHTML = profiles.map(p => {
      const tags = [];
      if (p.blood_type && p.blood_type !== '不明') tags.push(`<span class="profile-tag allergy">🩸 ${p.blood_type}</span>`);
      if (p.allergies_food) tags.push(`<span class="profile-tag allergy">⚠️ アレルギー</span>`);
      if (p.conditions) tags.push(`<span class="profile-tag condition">🏥 持病あり</span>`);
      if (p.medications) tags.push(`<span class="profile-tag">💊 常用薬あり</span>`);
      const avatar = p.is_pet ? '🐾' : (p.gender === 'female' ? '👩' : '👨');

      return `<div class="profile-card" onclick="ProfilesPage.openDetail(${p.id})">
        <div class="profile-card-inner">
          <div class="profile-avatar">${avatar}</div>
          <div class="profile-info">
            <div class="profile-name">${Utils.escape(p.owner_name)}</div>
            <div style="font-size:12px;color:var(--txt-3);">
              ${p.dob ? `${calcAge(p.dob)}歳` : ''}
              ${p.is_pet && p.pet_species ? ` · ${Utils.escape(p.pet_species)}` : ''}
            </div>
            <div class="profile-tags">${tags.join('')}</div>
          </div>
          <div class="profile-arrow">›</div>
        </div>
      </div>`;
    }).join('');
  }

  function calcAge(dob) {
    if (!dob) return '';
    const b = new Date(dob);
    const n = new Date();
    let age = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
    return age;
  }

  async function openDetail(id) {
    const p = await DB.Profiles.get(id);
    if (!p) return;

    const html = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div class="profile-avatar" style="width:60px;height:60px;font-size:32px;">
          ${p.is_pet ? '🐾' : '👤'}
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:22px;font-weight:700;">${Utils.escape(p.owner_name)}</div>
          <div style="font-size:13px;color:var(--txt-3);">${p.dob ? `${calcAge(p.dob)}歳` : ''}</div>
        </div>
      </div>

      <div class="medical-section">
        <div class="medical-section-title">基本情報</div>
        ${medRow('血液型', p.blood_type)}
        ${medRow('生年月日', p.dob ? Utils.formatDate(p.dob) : '')}
        ${p.is_pet ? medRow('種類', p.pet_species) : ''}
      </div>

      ${p.allergies_food || p.allergies_drug ? `
      <div class="medical-section">
        <div class="medical-section-title" style="color:var(--amber);">⚠️ アレルギー情報</div>
        ${p.allergies_food ? medRow('食物アレルギー', p.allergies_food, 'amber') : ''}
        ${p.allergies_drug ? medRow('薬物アレルギー', p.allergies_drug, 'amber') : ''}
      </div>` : ''}

      ${p.conditions || p.medications ? `
      <div class="medical-section">
        <div class="medical-section-title" style="color:var(--red);">🏥 医療情報</div>
        ${p.conditions ? medRow('持病', p.conditions, 'red') : ''}
        ${p.medications ? medRow('常用薬', p.medications, 'red') : ''}
      </div>` : ''}

      ${p.doctor_name || p.doctor_phone ? `
      <div class="medical-section">
        <div class="medical-section-title">🩺 かかりつけ医</div>
        ${medRow('医院名', p.doctor_name)}
        ${medRow('電話番号', p.doctor_phone)}
      </div>` : ''}

      ${p.emergency_contact ? `
      <div class="medical-section">
        <div class="medical-section-title">📞 緊急連絡先</div>
        ${medRow('連絡先', p.emergency_contact)}
      </div>` : ''}

      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="ProfilesPage.showQRCard(${JSON.stringify(p).replace(/"/g,'&quot;')})">
          🔲 QRコードを表示
        </button>
        <button class="btn btn-secondary btn-sm" onclick="ProfilesPage.openEditModal(${p.id})">編集</button>
      </div>
    `;

    Modal.open(`👤 ${Utils.escape(p.owner_name)}`, html);
  }

  function medRow(key, val, color = '') {
    if (!val) return '';
    const style = color ? `style="color:var(--${color})"` : '';
    return `<div class="medical-row">
      <div class="medical-key">${key}</div>
      <div class="medical-val" ${style}>${Utils.escape(String(val))}</div>
    </div>`;
  }

  function showQRCard(pOrId) {
    // Accept object or id
    const p = typeof pOrId === 'object' ? pOrId : null;
    if (!p) { DB.Profiles.get(pOrId).then(showQRCard); return; }

    const qrData = JSON.stringify({
      name:            p.owner_name,
      dob:             p.dob || '',
      blood_type:      p.blood_type || '',
      allergies_food:  p.allergies_food || '',
      allergies_drug:  p.allergies_drug || '',
      conditions:      p.conditions || '',
      medications:     p.medications || '',
      emergency_contact: p.emergency_contact || '',
      doctor:          [p.doctor_name, p.doctor_phone].filter(Boolean).join(' / '),
    });

    const html = `
      <p style="font-size:13px;color:var(--txt-3);margin-bottom:14px;text-align:center;">
        スクリーンショットを撮って保存するか、救急隊員にそのまま提示してください
      </p>

      <div class="qr-card">
        <h3>🆘 緊急医療情報 / MEDICAL ALERT</h3>
        <p style="margin-bottom:4px;">${p.owner_name}</p>
        <div id="qr-display"></div>
        <p style="font-size:10px;color:#888;margin-top:4px;">このQRコードをスキャンして医療情報を確認</p>
      </div>

      <div class="card" style="margin-bottom:16px;">
        ${p.blood_type ? `<div class="medical-row">${medRow('血液型', p.blood_type)}</div>` : ''}
        ${p.allergies_food ? `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--amber);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">⚠️ アレルギー</div>
          <div style="font-size:13px;margin-top:4px;">${Utils.escape(p.allergies_food)}</div>
        </div>` : ''}
        ${p.conditions ? `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--red);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">🏥 持病</div>
          <div style="font-size:13px;margin-top:4px;">${Utils.escape(p.conditions)}</div>
        </div>` : ''}
        ${p.medications ? `<div style="padding:8px 0;">
          <div style="font-size:11px;color:var(--txt-3);font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">💊 常用薬</div>
          <div style="font-size:13px;margin-top:4px;">${Utils.escape(p.medications)}</div>
        </div>` : ''}
      </div>

      <button class="btn btn-secondary" onclick="Modal.close()">閉じる</button>
    `;

    Modal.open(`🔲 ${Utils.escape(p.owner_name)} の緊急カード`, html, null);

    // Generate QR after DOM update
    setTimeout(() => {
      const qrEl = document.getElementById('qr-display');
      if (!qrEl) return;
      qrEl.innerHTML = '';
      try {
        new QRCode(qrEl, {
          text: qrData,
          width: 200,
          height: 200,
          colorDark: '#1a1a2e',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      } catch (e) {
        qrEl.textContent = 'QRコードの生成に失敗しました';
      }
    }, 100);
  }

  function profileFormHTML(p = null) {
    const edit = !!p;
    const v = (f, def = '') => edit && p[f] != null ? Utils.escape(String(p[f])) : def;

    return `
      <div class="form-group">
        <label class="form-check" style="margin-bottom:12px;">
          <input type="checkbox" id="f-is-pet" ${p?.is_pet?'checked':''} onchange="ProfilesPage.togglePetFields()">
          <span class="form-check-label">🐾 ペットとして登録</span>
        </label>
      </div>

      <div class="form-group">
        <label class="form-label">氏名 / ニックネーム *</label>
        <input id="f-name" class="form-input" value="${v('owner_name')}" placeholder="例: 山田 太郎">
      </div>

      <div id="pet-fields" style="${p?.is_pet?'':'display:none'}">
        <div class="form-group">
          <label class="form-label">動物の種類</label>
          <input id="f-pet-species" class="form-input" value="${v('pet_species')}" placeholder="例: 柴犬・ミックス">
        </div>
      </div>

      <div id="human-fields" style="${p?.is_pet?'display:none':''}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">生年月日</label>
            <input id="f-dob" type="date" class="form-input" value="${v('dob')}">
          </div>
          <div class="form-group">
            <label class="form-label">性別</label>
            <select id="f-gender" class="form-select">
              <option value="male"   ${p?.gender==='male'?'selected':''}>男性</option>
              <option value="female" ${p?.gender==='female'?'selected':''}>女性</option>
              <option value="other"  ${p?.gender==='other'?'selected':''}>その他</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">血液型</label>
        <div class="blood-type-grid">
          ${BLOOD_TYPES.map(bt => `<button type="button" class="blood-btn ${p?.blood_type===bt?'active':''}"
            onclick="ProfilesPage.selectBloodType(this,'${bt}')">${bt}</button>`).join('')}
        </div>
        <input type="hidden" id="f-blood-type" value="${v('blood_type','不明')}">
      </div>

      <div class="form-group">
        <label class="form-label">食物アレルギー</label>
        <div class="form-toggle-group" style="margin-bottom:8px;">
          ${FOOD_ALLERGIES.map(a => {
            const active = p?.allergies_food && p.allergies_food.includes(a);
            return `<button type="button" class="form-toggle ${active?'active':''}"
              onclick="this.classList.toggle('active')">${a}</button>`;
          }).join('')}
        </div>
        <input id="f-allergy-food-other" class="form-input" value="${v('allergies_food')}" placeholder="その他のアレルギーを入力...">
      </div>

      <div class="form-group">
        <label class="form-label">薬物アレルギー</label>
        <textarea id="f-allergy-drug" class="form-textarea" placeholder="例: ペニシリン系抗生物質、アスピリン...">${edit && p.allergies_drug ? p.allergies_drug : ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">持病・疾患名</label>
        <textarea id="f-conditions" class="form-textarea" placeholder="例: 高血圧、2型糖尿病...">${edit && p.conditions ? p.conditions : ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">常用薬（薬品名・用量）</label>
        <textarea id="f-medications" class="form-textarea" placeholder="例: アムロジピン 5mg 毎朝1錠...">${edit && p.medications ? p.medications : ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">かかりつけ医・医院名</label>
        <input id="f-doctor-name" class="form-input" value="${v('doctor_name')}" placeholder="例: 田中クリニック">
      </div>
      <div class="form-group">
        <label class="form-label">かかりつけ医・電話番号</label>
        <input id="f-doctor-phone" class="form-input" type="tel" value="${v('doctor_phone')}" placeholder="03-XXXX-XXXX">
      </div>
      <div class="form-group">
        <label class="form-label">緊急連絡先（氏名 / 電話 / 続柄）</label>
        <textarea id="f-emergency-contact" class="form-textarea" placeholder="例: 山田花子 / 090-XXXX-XXXX / 配偶者">${edit && p.emergency_contact ? p.emergency_contact : ''}</textarea>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="ProfilesPage.saveProfile(${edit ? p.id : 'null'})">
          ${edit ? '💾 保存する' : '➕ 登録する'}
        </button>
        ${edit ? `<button class="btn btn-danger btn-sm" onclick="ProfilesPage.deleteProfile(${p.id})">削除</button>` : ''}
      </div>
    `;
  }

  function selectBloodType(btn, bt) {
    document.querySelectorAll('.blood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('f-blood-type').value = bt;
  }

  function togglePetFields() {
    const isPet = document.getElementById('f-is-pet')?.checked;
    document.getElementById('pet-fields').style.display   = isPet ? '' : 'none';
    document.getElementById('human-fields').style.display = isPet ? 'none' : '';
  }

  function openAddModal() {
    Modal.open('➕ 人物を登録', profileFormHTML(null));
  }

  async function openEditModal(id) {
    const p = await DB.Profiles.get(id);
    if (!p) return;
    Modal.close();
    setTimeout(() => Modal.open('✏️ 人物を編集', profileFormHTML(p)), 300);
  }

  async function saveProfile(idOrNull) {
    const nameEl = document.getElementById('f-name');
    if (!nameEl || !nameEl.value.trim()) { Toast.error('氏名を入力してください'); return; }

    // Collect allergy toggles
    const toggles = [...document.querySelectorAll('.form-toggle.active')].map(el => el.textContent.trim());
    const otherAllergy = document.getElementById('f-allergy-food-other')?.value.trim() || '';
    const allergyFood = [...new Set([...toggles, ...(otherAllergy ? [otherAllergy] : [])])].join('、');

    const data = {
      owner_name:        document.getElementById('f-name')?.value.trim() || '',
      is_pet:            document.getElementById('f-is-pet')?.checked || false,
      pet_species:       document.getElementById('f-pet-species')?.value.trim() || '',
      dob:               document.getElementById('f-dob')?.value || '',
      gender:            document.getElementById('f-gender')?.value || 'other',
      blood_type:        document.getElementById('f-blood-type')?.value || '不明',
      allergies_food:    allergyFood,
      allergies_drug:    document.getElementById('f-allergy-drug')?.value.trim() || '',
      conditions:        document.getElementById('f-conditions')?.value.trim() || '',
      medications:       document.getElementById('f-medications')?.value.trim() || '',
      doctor_name:       document.getElementById('f-doctor-name')?.value.trim() || '',
      doctor_phone:      document.getElementById('f-doctor-phone')?.value.trim() || '',
      emergency_contact: document.getElementById('f-emergency-contact')?.value.trim() || '',
    };

    if (idOrNull) {
      data.id = idOrNull;
      await DB.Profiles.update(data);
      Toast.success('✅ 更新しました');
    } else {
      await DB.Profiles.add(data);
      Toast.success('✅ 登録しました');
    }

    Modal.close();
    render();
  }

  async function deleteProfile(id) {
    if (!confirm('このプロフィールを削除しますか？')) return;
    await DB.Profiles.delete(id);
    Toast.success('削除しました');
    Modal.close();
    render();
  }

  return { render, openDetail, openAddModal, openEditModal, saveProfile, deleteProfile, showQRCard, selectBloodType, togglePetFields };
})();
