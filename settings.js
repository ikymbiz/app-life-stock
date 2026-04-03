/* settings.js — Settings Page incl. AI provider + model config */
const SettingsPage = (() => {

  const PROVIDERS = [
    { id:'gemini', label:'Google Gemini',    badge:'Google',    badgeColor:'#4285f4', note:'無料枠あり・高速' },
    { id:'openai', label:'OpenAI GPT',       badge:'OpenAI',    badgeColor:'#10a37f', note:'安定・画像コスト最安' },
    { id:'claude', label:'Anthropic Claude', badge:'Anthropic', badgeColor:'#d97706', note:'日本語OCR精度◎' },
    { id:'none',   label:'使用しない',        badge:'オフライン', badgeColor:'#4e6280', note:'AIスキャン無効' },
  ];

  // モデル選択用 <select> を構築
  function buildModelSelect(pid, selectedModel) {
    const models = (VisionAI.MODELS[pid]) || [];
    if (!models.length) return '';
    let opts = '';
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const cy = VisionAI.estimateCostYenForModel(pid, m.id);
      const cs = cy < 1 ? cy.toFixed(2) : cy.toFixed(1);
      const sel = m.id === selectedModel ? ' selected' : '';
      opts += '<option value="' + m.id + '"' + sel + '>' + m.label + '（' + m.cost + ' 約' + cs + '円/回）</option>';
    }
    return '<div class="form-group">'
      + '<label class="form-label">モデル</label>'
      + '<select class="form-select" onchange="SettingsPage.selectModel(\'' + pid + '\',this.value)">'
      + opts + '</select></div>';
  }

  async function render() {
    const el = document.getElementById('page-settings');
    if (!el) return;

    let adults, children, aiProvider, keyGemini, keyOpenAI, keyClaude, mGemini, mOpenAI, mClaude;
    try {
      adults     = await DB.Settings.get('family_adults', '2');
      children   = await DB.Settings.get('family_children', '0');
      aiProvider = await DB.Settings.get('ai_provider', 'none');
      keyGemini  = await DB.Settings.get('ai_key_gemini', '');
      keyOpenAI  = await DB.Settings.get('ai_key_openai', '');
      keyClaude  = await DB.Settings.get('ai_key_claude', '');
      mGemini    = await DB.Settings.get('ai_model_gemini', VisionAI.getDefaultModel('gemini'));
      mOpenAI    = await DB.Settings.get('ai_model_openai', VisionAI.getDefaultModel('openai'));
      mClaude    = await DB.Settings.get('ai_model_claude', VisionAI.getDefaultModel('claude'));
    } catch(e) {
      adults='2'; children='0'; aiProvider='none';
      keyGemini=''; keyOpenAI=''; keyClaude='';
      mGemini=''; mOpenAI=''; mClaude='';
    }

    const keys   = { gemini:keyGemini, openai:keyOpenAI, claude:keyClaude };
    const models = { gemini:mGemini, openai:mOpenAI, claude:mClaude };

    // 利用統計
    let scanCount = 0, costPerScan = 0, monthlyCost = 0;
    try {
      scanCount   = await VisionAI.getScanCount();
      costPerScan = await VisionAI.estimateCostYen();
      monthlyCost = Math.round(scanCount * costPerScan * 100) / 100;
    } catch(e) {}

    // ── HTML組み立て ──
    let html = '<div class="page-inner">';
    html += '<div style="padding:16px 0 0;"><div style="font-family:var(--font-display);font-size:22px;font-weight:700;">設定</div></div>';

    // 家族構成
    html += '<div class="section-header"><span class="section-title">👨‍👩‍👧 家族構成</span></div>';
    html += '<div class="card">';
    html += '<div style="font-size:12px;color:var(--txt-3);margin-bottom:14px;">サバイバルシミュレーターの計算に使用</div>';
    html += familyCounter('adults', '大人（18歳以上）', adults, '人');
    html += familyCounter('children', '子供（18歳未満）', children, '人');
    html += '</div>';

    // AI設定
    html += '<div class="section-header"><span class="section-title">🤖 AI スキャン設定</span></div>';

    // 利用統計カード
    if (aiProvider !== 'none') {
      const costStr = monthlyCost < 1 ? monthlyCost.toFixed(2) : String(Math.round(monthlyCost));
      const perStr  = costPerScan < 1 ? costPerScan.toFixed(2) : costPerScan.toFixed(1);
      html += '<div class="card" style="margin-bottom:8px;background:var(--green-dim);border-color:var(--green-border);">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div><div style="font-size:12px;color:var(--txt-3);">今月のスキャン</div>'
        + '<div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--green);">' + scanCount + '<span style="font-size:13px;font-weight:400;"> 回</span></div></div>'
        + '<div style="text-align:right;"><div style="font-size:12px;color:var(--txt-3);">推定コスト</div>'
        + '<div style="font-family:var(--font-display);font-size:18px;font-weight:700;">約' + costStr + '<span style="font-size:12px;font-weight:400;"> 円</span></div>'
        + '<div style="font-size:10px;color:var(--txt-3);">（1回 約' + perStr + '円）</div></div>'
        + '</div></div>';
    }

    html += '<div class="card" style="margin-bottom:8px;">';
    html += '<div style="font-size:13px;color:var(--txt-2);margin-bottom:16px;line-height:1.6;">'
      + '写真から備蓄品情報を自動読取するAIを選択。<br>'
      + '<span style="color:var(--txt-3);font-size:12px;">APIキーは端末内にのみ保存されます。</span></div>';

    // プロバイダー選択
    html += '<div class="form-label">プロバイダー</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">';
    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i];
      const active = aiProvider === p.id;
      html += '<label style="display:flex;align-items:center;gap:12px;padding:12px;'
        + 'background:' + (active ? 'var(--bg-3)' : 'var(--bg-2)') + ';'
        + 'border:1px solid ' + (active ? 'var(--blue)' : 'var(--border)') + ';'
        + 'border-radius:var(--radius-sm);cursor:pointer;" '
        + 'onclick="SettingsPage.selectProvider(\'' + p.id + '\')">'
        + '<input type="radio" name="ai_provider" value="' + p.id + '"' + (active ? ' checked' : '') + ' style="accent-color:var(--blue);width:16px;height:16px;">'
        + '<div style="flex:1;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">'
        + '<span style="font-weight:700;font-size:14px;">' + p.label + '</span>';
      if (p.badge) {
        html += '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;'
          + 'background:' + p.badgeColor + '22;color:' + p.badgeColor + ';border:1px solid ' + p.badgeColor + '44;">' + p.badge + '</span>';
      }
      html += '</div><div style="font-size:12px;color:var(--txt-3);">' + p.note + '</div></div></label>';
    }
    html += '</div>';

    // 各プロバイダーのモデル選択 + APIキー
    const providerList = ['gemini', 'openai', 'claude'];
    for (let i = 0; i < providerList.length; i++) {
      const pid = providerList[i];
      const pInfo = PROVIDERS.find(x => x.id === pid);
      const vis = aiProvider === pid ? '' : 'display:none;';
      html += '<div id="key-section-' + pid + '" style="' + vis + '">';
      // モデル選択
      html += buildModelSelect(pid, models[pid]);
      // APIキー
      html += '<div class="form-group"><label class="form-label">' + pInfo.label + ' APIキー</label>'
        + '<div style="display:flex;gap:8px;">'
        + '<input type="password" id="key-input-' + pid + '" class="form-input" value="' + Utils.escape(keys[pid]) + '" placeholder="APIキーを入力" style="flex:1;font-family:monospace;font-size:13px;">'
        + '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.toggleKeyVisibility(\'' + pid + '\')">👁</button></div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;">'
        + '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.saveApiKey(\'' + pid + '\')">💾 保存</button>'
        + '<button class="btn btn-ghost btn-sm" onclick="SettingsPage.testConnection(\'' + pid + '\')">🔌 接続テスト</button></div>'
        + '<div id="test-result-' + pid + '" style="margin-top:6px;font-size:12px;"></div></div>';
      html += '</div>';
    }
    html += '</div>';

    // APIキー取得リンク
    html += '<div class="card" style="margin-bottom:8px;background:var(--blue-dim);border-color:rgba(77,166,255,.2);">'
      + '<div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;font-weight:700;">🔑 APIキーの取得先</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;">'
      + '<a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">→ Google AI Studio（Gemini）※無料枠あり</a>'
      + '<a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">→ OpenAI Platform（GPT）</a>'
      + '<a href="https://console.anthropic.com/account/keys" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none;">→ Anthropic Console（Claude）</a>'
      + '</div></div>';

    // データ管理
    html += '<div class="section-header"><span class="section-title">💾 データ管理</span></div>'
      + '<div class="settings-group">'
      + '<div class="settings-item" onclick="SettingsPage.exportData()"><div class="settings-item-left"><span class="settings-item-icon">📤</span><div class="settings-item-info"><div class="settings-item-title">データをエクスポート</div><div class="settings-item-sub">全データをJSONファイルで保存</div></div></div><span class="settings-item-arrow">›</span></div>'
      + '<div class="settings-item" onclick="document.getElementById(\'import-file\').click()"><div class="settings-item-left"><span class="settings-item-icon">📥</span><div class="settings-item-info"><div class="settings-item-title">データをインポート</div><div class="settings-item-sub">バックアップJSONから復元</div></div></div><span class="settings-item-arrow">›</span></div>'
      + '<input type="file" id="import-file" accept=".json" style="display:none" onchange="SettingsPage.importData(event)">'
      + '</div>';

    // アプリ情報
    html += '<div class="section-header"><span class="section-title">ℹ️ アプリ情報</span></div>'
      + '<div class="card" style="margin-bottom:12px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'
      + '<svg viewBox="0 0 32 32" fill="none" style="width:40px;height:40px;"><path d="M16 2L4 8v8c0 7.2 5.2 13.9 12 15.5C23.8 29.9 28 23.2 28 16V8L16 2z" fill="var(--red)" opacity="0.9"/><path d="M13 16l2.5 2.5L20 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div><div style="font-family:var(--font-display);font-size:20px;font-weight:700;">LifeStock</div><div style="font-size:12px;color:var(--txt-3);">v2.1.0 — 防災・備蓄管理</div></div></div>'
      + '<div class="medical-row"><div class="medical-key">データ保存</div><div class="medical-val">端末内のみ</div></div>'
      + '<div class="medical-row"><div class="medical-key">API通信</div><div class="medical-val">AIスキャン使用時のみ</div></div>'
      + '<div class="medical-row"><div class="medical-key">オフライン</div><div class="medical-val">基本機能は完全対応</div></div></div>';

    // 危険操作
    html += '<div class="section-header"><span class="section-title" style="color:var(--red);">⚠️ 危険操作</span></div>'
      + '<div class="settings-item danger-zone" onclick="SettingsPage.clearAllData()"><div class="settings-item-left"><span class="settings-item-icon">🗑️</span><div class="settings-item-info"><div class="settings-item-title">全データを削除</div><div class="settings-item-sub" style="color:var(--txt-3);">この操作は元に戻せません</div></div></div><span class="settings-item-arrow" style="color:var(--red);">›</span></div>'
      + '<div style="height:20px;"></div>';

    html += '</div>';
    el.innerHTML = html;
  }

  function familyCounter(type, label, value, unit) {
    return '<div class="form-group"><label class="form-label">' + label + '</label>'
      + '<div style="display:flex;align-items:center;gap:12px;">'
      + '<button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily(\'' + type + '\',-1)">－</button>'
      + '<span id="count-' + type + '" style="font-family:var(--font-display);font-size:28px;font-weight:700;width:40px;text-align:center;">' + value + '</span>'
      + '<button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily(\'' + type + '\',1)">＋</button>'
      + '<span style="font-size:13px;color:var(--txt-3);">' + unit + '</span></div></div>';
  }

  async function selectProvider(id) {
    await DB.Settings.set('ai_provider', id);
    // キーセクション切替
    ['gemini','openai','claude'].forEach(p => {
      const sec = document.getElementById('key-section-' + p);
      if (sec) sec.style.display = p === id ? '' : 'none';
    });
    document.querySelectorAll('input[name="ai_provider"]').forEach(r => { r.checked = r.value === id; });
    Toast.success('✅ ' + VisionAI.providerLabel(id) + ' に設定');
  }

  async function selectModel(provider, modelId) {
    await DB.Settings.set('ai_model_' + provider, modelId);
    Toast.success('✅ ' + VisionAI.modelLabel(provider, modelId) + ' に設定');
  }

  function toggleKeyVisibility(p) {
    const inp = document.getElementById('key-input-' + p);
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  async function saveApiKey(p) {
    const inp = document.getElementById('key-input-' + p);
    if (!inp) return;
    await DB.Settings.set('ai_key_' + p, inp.value.trim());
    Toast.success('💾 APIキーを保存しました');
  }

  async function testConnection(p) {
    const inp = document.getElementById('key-input-' + p);
    const res = document.getElementById('test-result-' + p);
    if (!inp || !inp.value.trim()) { Toast.error('APIキーを入力してください'); return; }
    await DB.Settings.set('ai_key_' + p, inp.value.trim());
    await DB.Settings.set('ai_provider', p);
    if (res) res.innerHTML = '<span style="color:var(--txt-3);">接続テスト中...</span>';
    try {
      await VisionAI.testConnection();
      if (res) res.innerHTML = '<span style="color:var(--green);">✅ 接続成功</span>';
      Toast.success('✅ 接続テスト成功');
    } catch(e) {
      const msg = e.message === 'NO_KEY' ? 'APIキーが未設定です' : '接続失敗: ' + e.message;
      if (res) res.innerHTML = '<span style="color:var(--red);">❌ ' + Utils.escape(msg) + '</span>';
      Toast.error('❌ ' + msg);
    }
  }

  async function adjustFamily(type, delta) {
    const key = 'family_' + type;
    const current = parseInt(await DB.Settings.get(key, '0')) || 0;
    const next = Math.max(0, current + delta);
    await DB.Settings.set(key, String(next));
    const el = document.getElementById('count-' + type);
    if (el) { el.textContent = next; el.style.transform = 'scale(1.3)'; setTimeout(() => el.style.transform = '', 150); }
  }

  async function exportData() {
    try {
      const data = await DB.exportAll();
      if (data.settings) data.settings = data.settings.filter(s => !s.key.startsWith('ai_key_'));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'lifestock-backup-' + new Date().toISOString().split('T')[0] + '.json';
      a.click(); URL.revokeObjectURL(a.href);
      Toast.success('📤 エクスポートしました');
    } catch(e) { Toast.error('エクスポートに失敗しました'); }
  }

  async function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!confirm('現在のデータをすべて上書きしますか？')) { event.target.value=''; return; }
    try { await DB.importAll(JSON.parse(await file.text())); Toast.success('📥 インポート完了'); render(); }
    catch(e) { Toast.error('インポートに失敗しました'); }
    event.target.value = '';
  }

  async function clearAllData() {
    if (!confirm('本当に全データを削除しますか？')) return;
    if (!confirm('最終確認：全ての備蓄品・健康カード・設定が削除されます。')) return;
    try { await DB.importAll({items:[],item_stocks:[],profiles:[],shopping:[],settings:[]}); Toast.success('削除しました'); render(); }
    catch(e) { Toast.error('削除に失敗しました'); }
  }

  return { render, selectProvider, selectModel, toggleKeyVisibility, saveApiKey, testConnection, adjustFamily, exportData, importData, clearAllData };
})();
