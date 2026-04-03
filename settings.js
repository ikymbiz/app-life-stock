/* settings.js — Settings Page */
const SettingsPage = (() => {

  async function render() {
    const [adults, children, pets] = await Promise.all([
      DB.Settings.get('family_adults', '2'),
      DB.Settings.get('family_children', '0'),
      DB.Settings.get('family_pets', '0'),
    ]);

    const el = document.getElementById('page-settings');
    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 0;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">設定</div>
      </div>

      <!-- Family composition -->
      <div class="section-header">
        <span class="section-title">👨‍👩‍👧 家族構成</span>
      </div>
      <div class="card">
        <div style="font-size:13px;color:var(--txt-3);margin-bottom:14px;">
          サバイバルシミュレーターの計算に使用されます
        </div>
        <div class="form-group">
          <label class="form-label">大人（18歳以上）</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('adults', -1)">－</button>
            <span id="count-adults" style="font-family:var(--font-display);font-size:28px;font-weight:700;width:40px;text-align:center;">${adults}</span>
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('adults', 1)">＋</button>
            <span style="font-size:13px;color:var(--txt-3);">人</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">子供（18歳未満）</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('children', -1)">－</button>
            <span id="count-children" style="font-family:var(--font-display);font-size:28px;font-weight:700;width:40px;text-align:center;">${children}</span>
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('children', 1)">＋</button>
            <span style="font-size:13px;color:var(--txt-3);">人</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">ペット</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('pets', -1)">－</button>
            <span id="count-pets" style="font-family:var(--font-display);font-size:28px;font-weight:700;width:40px;text-align:center;">${pets}</span>
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.adjustFamily('pets', 1)">＋</button>
            <span style="font-size:13px;color:var(--txt-3);">匹</span>
          </div>
        </div>
      </div>

      <!-- Data management -->
      <div class="section-header">
        <span class="section-title">💾 データ管理</span>
      </div>
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

      <!-- About -->
      <div class="section-header">
        <span class="section-title">ℹ️ アプリ情報</span>
      </div>
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <svg viewBox="0 0 32 32" fill="none" style="width:40px;height:40px;">
            <path d="M16 2L4 8v8c0 7.2 5.2 13.9 12 15.5C23.8 29.9 28 23.2 28 16V8L16 2z" fill="var(--red)" opacity="0.9"/>
            <path d="M13 16l2.5 2.5L20 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:700;">LifeStock</div>
            <div style="font-size:12px;color:var(--txt-3);">v1.0.0 — 防災・備蓄管理アプリ</div>
          </div>
        </div>
        <div class="medical-row">
          <div class="medical-key">コンセプト</div>
          <div class="medical-val">「もしも」の時に、物と健康を迷わず守る</div>
        </div>
        <div class="medical-row">
          <div class="medical-key">データ保存</div>
          <div class="medical-val">端末内のみ（サーバー送信なし）</div>
        </div>
        <div class="medical-row">
          <div class="medical-key">オフライン</div>
          <div class="medical-val">完全対応（通信不要）</div>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="section-header">
        <span class="section-title" style="color:var(--red);">⚠️ 危険操作</span>
      </div>
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

  async function adjustFamily(type, delta) {
    const key = `family_${type}`;
    const current = parseInt(await DB.Settings.get(key, '0')) || 0;
    const next = Math.max(0, current + delta);
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
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `lifestock-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('📤 エクスポートしました');
    } catch (e) {
      Toast.error('エクスポートに失敗しました');
    }
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('現在のデータをすべて上書きしてインポートしますか？\nこの操作は元に戻せません。')) {
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data);
      Toast.success('📥 インポート完了しました');
      render();
    } catch (e) {
      Toast.error('インポートに失敗しました。ファイルを確認してください');
    }
    event.target.value = '';
  }

  async function clearAllData() {
    if (!confirm('本当に全データを削除しますか？\nこの操作は元に戻せません。')) return;
    if (!confirm('最終確認：全ての備蓄品・健康カード・設定が削除されます。')) return;
    try {
      await DB.importAll({ items:[], profiles:[], shopping:[], settings:[] });
      Toast.success('削除しました');
      render();
    } catch (e) {
      Toast.error('削除に失敗しました');
    }
  }

  return { render, adjustFamily, exportData, importData, clearAllData };
})();
