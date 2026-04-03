/* settings.js — Settings Page incl. AI provider config */
const SettingsPage = (() => {

  const PROVIDERS = [
    { id:'gemini', label:'Gemini 2.0 Flash', badge:'Google', badgeColor:'#4285f4', note:'無料枠あり・高速・日本語◎' },
    { id:'openai', label:'GPT-4o mini',       badge:'OpenAI', badgeColor:'#10a37f', note:'安定・多言語◎' },
    { id:'claude', label:'Claude Haiku',       badge:'Anthropic', badgeColor:'#d97706', note:'文脈理解◎' },
    { id:'none',   label:'使用しない',          badge:'オフライン', badgeColor:'#4e6280', note:'AIスキャンが無効になります' },
  ];

  async function render() {
    const [adults, children, aiProvider,
           keyGemini, keyOpenAI, keyClaude] = await Promise.all([
      DB.Settings.get('family_adults',  '2'),
      DB.Settings.get('family_children','0'),
      DB.Settings.get('ai_provider',    'none'),
      DB.Settings.get('ai_key_gemini',  ''),
      DB.Settings.get('ai_key_openai',  ''),
      DB.Settings.get('ai_key_claude',  ''),
    ]);
    const keys = { gemini: keyGemini, openai: keyOpenAI, claude: keyClaude };

    const el = document.getElementById('page-settings');
    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;">設定</div>
      </div>

      <!-- ── 家族構成 ── -->
      <div class="section-header"><span class="section-title">👨‍👩‍👧 家族構成</span></div>
      <div class="card">
        <div style="font-size:12px;color:var(--txt-3);margin-bottom:14px;">サバイバルシミュレーターの計算に使用されます</div>
        ${familyCounter('adults',   '大人（18歳以上）', adults,   '人')}
        ${familyCounter('children', '子供（18歳未満）', children, '人')}
      </div>

      <!-- ── AI Vision API ── -->
      <div class="section-header"><span class="section-title">🤖 AI スキャン設定</span></div>
      <div class="card" style="margin-bottom:8px;">
        <div style="font-size:13px;color:var(--txt-2);margin-bottom:16px;line-height:1.6;">
          写真から賞味期限・アレルゲンを読み取るAIプロバイダーを選択してください。<br>
          <span style="color:var(--txt-3);font-size:12px;">APIキーは端末内にのみ保存されます。外部へは送信されません。</span>
        </div>

        <!-- プロバイダー選択 -->
        <div class="form-label">プロバイダー</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${PROVIDERS.map(p => `
            <label style="display:flex;align-items:center;gap:12px;padding:12px;
              background:${aiProvider===p.id?'var(--bg-3)':'var(--bg-2)'};
              border:1px solid ${aiProvider===p.id?'var(--blue)':'var(--border)'};
              border-radius:var(--radius-sm);cursor:pointer;transition:all .15s;"
              onclick="SettingsPage.selectProvider('${p.id}')">
              <input type="radio" name="ai_provider" value="${p.id}" ${aiProvider===p.id?'checked':''}
                style="accent-color:var(--blue);width:16px;height:16px;">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span style="font-weight:700;font-size:14px;">${p.label}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;
                    background:${p.badgeColor}22;color:${p.badgeColor};border:1px solid ${p.badgeColor}44;">${p.badge}</span>
                </div>
                <div style="font-size:12px;color:var(--txt-3);">${p.note}</div>
              </div>
            </label>`).join('')}
        </div>

        <!-- APIキー入力 -->
        ${PROVIDERS.filter(p=>p.id!=='none').map(p=>`
          <div id="key-section-${p.id}" class="form-group" style="${aiProvider===p.id?'':'display:none'}">
            <label class="form-label">${p.label} APIキー</label>
            <div style="display:flex;gap:8px;">
              <input type="password" id="key-input-${p.id}" class="form-input"
                value="${keys[p.id]||''}"
                placeholder="sk-... / AIza... などAPIキーを入力"
                style="flex:1;font-family:monospace;font-size:13px;">
              <button class="btn btn-secondary btn-sm"
                onclick="SettingsPage.toggleKeyVisibility('${p.id}')">👁</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-secondary btn-sm" onclick="SettingsPage.saveApiKey('${p.id}')">💾 保存</button>
              <button class="btn btn-ghost btn-sm" onclick="SettingsPage.testConnection('${p.id}')">🔌 接続テスト</button>
            </div>
            <div id="test-result-${p.id}" style="margin-top:6px;font-size:12px;"></div>
          </div>`).join('')}
      </div>

      <!-- APIキー取得リンク -->
      <div class="card" style="margin-bottom:8px;background:var(--blue-dim);border-color:rgba(77,166,255,.2);">
        <div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;font-weight:700;">🔑 APIキーの取得先</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <a href="https://aistudio.google.com/apikey" target="_blank"
            style="color:var(--blue);font-size:12px;text-decoration:none;">
            → Google AI Studio（Gemini） ※無料枠あり
          </a>
          <a href="https://platform.openai.com/api-keys" target="_blank"
            style="color:var(--blue);font-size:12px;text-decoration:none;">
            → OpenAI Platform（GPT）
          </a>
          <a href="https://console.anthropic.com/account/keys" target="_blank"
            style="color:var(--blue);font-size:12px;text-decoration:none;">
            → Anthropic Console（Claude）
          </a>
        </div>
      </div>

      <!-- ── データ管理 ── -->
      <div class="section-header"><span class="section-title">💾 データ管理</span></div>
      <div class="settings-group">
        <div class="settings-item" onclick="SettingsPage.exportData()">
          <div class="settings-item-left">
            <span class="settings-item-icon">📤</span>
            <div class="settings-item-info">
              <div class="settings-item-title">データをエクスポート</div>
              <div class="settings-item-sub">全データをJSONファイルで保存</div>
            </div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" onclick="document.getElementById('import-file').click()">
          <div class="settings-item-left">
            <span class="settings-item-icon">📥</span>
            <div class="settings-item-info">
              <div class="settings-item-title">データをインポート</div>
              <div class="settings-item-sub">バックアップJSONから復元</div>
            </div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none" onchange="SettingsPage.importData(event)">
      </div>

      <!-- ── アプリ情報 ── -->
      <div class="section-header"><span class="section-title">ℹ️ アプリ情報</span></div>
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <svg viewBox="0 0 32 32" fill="none" style="width:40px;height:40px;">
            <path d="M16 2L4 8v8c0 7.2 5.2 13.9 12 15.5C23.8 29.9 28 23.2 28 16V8L16 2z" fill="var(--red)" opacity="0.9"/>
            <path d="M13 16l2.5 2.5L20 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">LifeStock</div>
            <div style="font-size:12px;color:var(--txt-3);">v2.0.0 — 防災・備蓄管理</div>
          </div>
        </div>
        <div class="medical-row"><div class="medical-key">データ保存</div><div class="medical-val">端末内のみ</div></div>
        <div class="medical-row"><div class="medical-key">API通信</div><div class="medical-val">AIスキャン使用時のみ</div></div>
        <div class="medical-row"><div class="medical-key">オフライン</div><div class="medical-val">基本機能は完全対応</div></div>
      </div>

      <!-- ── 危険操作 ── -->
      <div class="section-header"><span class="section-title" style="color:var(--red);">⚠️ 危険操作</span></div>
      <div class="settings-item danger-zone" onclick="SettingsPage.clearAllData()">
        <div class="settings-item-left">
          <span class="settings-item-icon">🗑️</span>
          <div class="settings-item-info">
            <div class="settings-item-title">全データを削除</div>
            <div class="settings-item-sub" style="color:var(--txt-3);">この操作は元に戻せません</div>
          </div>
        </div>
        <span class="settings-item-arrow" style="color:var(--red);">›</span>
      </div>
      <div style="height:20px;"></div>
    </div>`;
  }

  function familyCounter(type, label, value, unit) {
    return `<div class="form-group">
      <label class="form-label">${label}</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('${type}',-1)">－</button>
        <span id="count-${type}" style="font-family:var(--font-display);font-size:28px;font-weight:700;width:40px;text-align:center;">${value}</span>
        <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('${type}',1)">＋</button>
        <span style="font-size:13px;color:var(--txt-3);">${unit}</span>
      </div>
    </div>`;
  }

  // ── プロバイダー選択 ──
  async function selectProvider(id) {
    await DB.Settings.set('ai_provider', id);
    // キーセクション表示切替
    ['gemini','openai','claude'].forEach(p => {
      const sec = document.getElementById(`key-section-${p}`);
      if (sec) sec.style.display = p === id ? '' : 'none';
    });
    // ラジオボタン更新
    document.querySelectorAll('input[name="ai_provider"]').forEach(r => {
      r.checked = r.value === id;
    });
    Toast.success(`✅ ${VisionAI.providerLabel(id)} に設定しました`);
  }

  function toggleKeyVisibility(p) {
    const inp = document.getElementById(`key-input-${p}`);
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function saveApiKey(p) {
    const inp = document.getElementById(`key-input-${p}`);
    if (!inp) return;
    await DB.Settings.set(`ai_key_${p}`, inp.value.trim());
    Toast.success('💾 APIキーを保存しました');
  }

  async function testConnection(p) {
    const inp = document.getElementById(`key-input-${p}`);
    const res = document.getElementById(`test-result-${p}`);
    if (!inp || !inp.value.trim()) { Toast.error('APIキーを入力してください'); return; }

    // 一時保存してテスト
    await DB.Settings.set(`ai_key_${p}`, inp.value.trim());
    await DB.Settings.set('ai_provider', p);
    if (res) res.innerHTML = '<span style="color:var(--txt-3);">接続テスト中...</span>';

    try {
      await VisionAI.testConnection();
      if (res) res.innerHTML = '<span style="color:var(--green);">✅ 接続成功</span>';
      Toast.success('✅ 接続テスト成功');
    } catch (e) {
      const msg = e.message === 'NO_KEY' ? 'APIキーが未設定です' : `接続失敗: ${e.message}`;
      if (res) res.innerHTML = `<span style="color:var(--red);">❌ ${Utils.escape(msg)}</span>`;
      Toast.error(`❌ ${msg}`);
    }
  }

  async function adjustFamily(type, delta) {
    const key     = `family_${type}`;
    const current = parseInt(await DB.Settings.get(key, '0')) || 0;
    const next    = Math.max(0, current + delta);
    await DB.Settings.set(key, String(next));
    const el = document.getElementById(`count-${type}`);
    if (el) {
      el.textContent = next;
      el.style.transform = 'scale(1.3)';
      setTimeout(() => el.style.transform = '', 150);
    }
  }

  async function exportData() {
    try {
      const data = await DB.exportAll();
      // APIキーをエクスポートから除外
      if (data.settings) data.settings = data.settings.filter(s => !s.key.startsWith('ai_key_'));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `lifestock-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      Toast.success('📤 エクスポートしました（APIキーは除外）');
    } catch { Toast.error('エクスポートに失敗しました'); }
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('現在のデータをすべて上書きしてインポートしますか？\nこの操作は元に戻せません。')) { event.target.value=''; return; }
    try {
      const data = JSON.parse(await file.text());
      await DB.importAll(data);
      Toast.success('📥 インポート完了');
      render();
    } catch { Toast.error('インポートに失敗しました'); }
    event.target.value = '';
  }

  async function clearAllData() {
    if (!confirm('本当に全データを削除しますか？\nAPIキー設定も含めすべて失われます。')) return;
    if (!confirm('最終確認：全ての備蓄品・健康カード・設定が削除されます。')) return;
    try {
      await DB.importAll({ items:[], item_stocks:[], profiles:[], shopping:[], settings:[] });
      Toast.success('削除しました');
      render();
    } catch { Toast.error('削除に失敗しました'); }
  }

  return { render, selectProvider, toggleKeyVisibility, saveApiKey, testConnection, adjustFamily, exportData, importData, clearAllData };
})();
