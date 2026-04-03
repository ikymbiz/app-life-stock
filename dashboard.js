/* dashboard.js — Dashboard Page */
const DashboardPage = (() => {

  async function render() {
    const el = document.getElementById('page-dashboard');

    const [items, profiles, shopping, adults, children, pets] = await Promise.all([
      DB.Items.getAll(),
      DB.Profiles.getAll(),
      DB.Shopping.getAll(),
      DB.Settings.get('family_adults', '2'),
      DB.Settings.get('family_children', '0'),
      DB.Settings.get('family_pets', '0'),
    ]);

    const now = new Date();
    const expiring30  = items.filter(i => i.expiry_date && Utils.daysUntil(i.expiry_date) >= 0 && Utils.daysUntil(i.expiry_date) < 30);
    const expiring90  = items.filter(i => i.expiry_date && Utils.daysUntil(i.expiry_date) >= 30 && Utils.daysUntil(i.expiry_date) < 90);
    const expired     = items.filter(i => i.expiry_date && Utils.daysUntil(i.expiry_date) < 0);
    const pendingShopping = shopping.filter(s => !s.is_bought).length;
    const lowStock    = items.filter(i => i.min_qty > 0 && i.qty < i.min_qty);

    // Simulator
    const totalAdults   = parseInt(adults) || 0;
    const totalChildren = parseInt(children) || 0;
    const totalPeople   = totalAdults + totalChildren;

    const waterItems = items.filter(i => i.category === 'water' && !i.is_consumed);
    const foodItems  = items.filter(i => i.category === 'food' && !i.is_consumed);

    // Water: 3L/person/day
    const totalWaterL = waterItems.reduce((acc, i) => {
      const qty = parseFloat(i.qty) || 0;
      if (i.unit === 'L') return acc + qty;
      if (i.unit === '本' || i.unit === '個') return acc + qty * 0.5; // assume 500ml
      return acc + qty;
    }, 0);

    // Food: rough approximation by item count (avg 500kcal/item, need 1800kcal/day)
    const totalFoodItems = foodItems.reduce((acc, i) => acc + (parseFloat(i.qty) || 0), 0);
    const foodDays  = totalPeople > 0 ? Math.floor((totalFoodItems * 500) / (1800 * totalPeople)) : 0;
    const waterDays = totalPeople > 0 ? Math.floor(totalWaterL / (3 * totalPeople)) : 0;
    const simDays   = Math.min(foodDays, waterDays);

    // Sort alerts
    const alertItems = [...expiring30, ...expiring90, ...expired]
      .sort((a, b) => (Utils.daysUntil(a.expiry_date) ?? 9999) - (Utils.daysUntil(b.expiry_date) ?? 9999))
      .slice(0, 6);

    const waterPct = Math.min(100, totalPeople > 0 ? Math.round((waterDays / 7) * 100) : 0);
    const foodPct  = Math.min(100, totalPeople > 0 ? Math.round((foodDays / 7) * 100) : 0);

    el.innerHTML = `<div class="page-inner">
      <!-- Greeting -->
      <div style="padding:16px 0 4px;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">
          備蓄ダッシュボード
        </div>
        <div style="font-size:13px;color:var(--txt-3);margin-top:2px;">
          ${now.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}
        </div>
      </div>

      <!-- Alert Banner -->
      ${expiring30.length || expired.length ? `
      <div class="card card-accent-red" style="background:var(--red-dim);border-color:var(--red-border);margin-top:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">⚠️</span>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--red);">
              ${expired.length ? `期限切れ ${expired.length}件` : ''}
              ${expiring30.length ? ` 30日以内に期限 ${expiring30.length}件` : ''}
            </div>
            <div style="font-size:12px;color:var(--txt-2);">備蓄品リストを確認してください</div>
          </div>
          <button onclick="App.navigate('inventory')" class="btn btn-sm btn-danger" style="margin-left:auto;white-space:nowrap;">確認 →</button>
        </div>
      </div>` : ''}

      <!-- Stats -->
      <div class="stat-grid" style="margin-top:14px;">
        <div class="stat-card" onclick="App.navigate('inventory')">
          <div class="stat-num blue">${items.length}</div>
          <div class="stat-label">備蓄品</div>
        </div>
        <div class="stat-card" onclick="App.navigate('inventory')">
          <div class="stat-num ${expiring30.length || expired.length ? 'red' : 'amber'}">${expiring30.length + expired.length}</div>
          <div class="stat-label">要確認</div>
        </div>
        <div class="stat-card" onclick="App.navigate('profiles')">
          <div class="stat-num green">${profiles.length}</div>
          <div class="stat-label">登録人物</div>
        </div>
      </div>

      <!-- Simulator -->
      <div class="section-header">
        <span class="section-title">🧮 サバイバル計算</span>
        <button class="section-action" onclick="App.navigate('settings')">家族設定</button>
      </div>
      <div class="sim-card">
        <div class="sim-title">現在の備蓄で生存できる推定日数</div>
        <div class="sim-day-display">
          <div class="sim-day-num" style="color:${simDays >= 7 ? 'var(--green)' : simDays >= 3 ? 'var(--amber)' : 'var(--red)'}">${simDays}</div>
          <div class="sim-day-unit">日分</div>
        </div>
        <div class="sim-bar-wrap">
          <div class="sim-bar-label"><span>💧 水</span><span>${waterDays}日分 (${totalWaterL.toFixed(1)}L)</span></div>
          <div class="sim-bar"><div class="sim-bar-fill ${waterPct>=100?'green':waterPct>=50?'amber':'red'}" style="width:${waterPct}%"></div></div>
        </div>
        <div class="sim-bar-wrap" style="margin-top:8px;">
          <div class="sim-bar-label"><span>🍱 食料</span><span>${foodDays}日分 (${totalFoodItems}個)</span></div>
          <div class="sim-bar"><div class="sim-bar-fill ${foodPct>=100?'green':foodPct>=50?'amber':'red'}" style="width:${foodPct}%"></div></div>
        </div>
        <div style="font-size:11px;color:var(--txt-3);margin-top:10px;">
          ※ 対象：大人${adults}人 / 子供${children}人 | 目標7日分 | 水3L/人/日
        </div>
      </div>

      <!-- Expiry Alerts -->
      ${alertItems.length ? `
      <div class="section-header">
        <span class="section-title">⏰ 期限アラート</span>
      </div>
      <div class="card">
        ${alertItems.map(item => {
          const days = Utils.daysUntil(item.expiry_date);
          const cls  = days < 0 ? 'red' : days < 30 ? 'red' : 'amber';
          let label  = days < 0 ? `${Math.abs(days)}日前に期限切れ` : `残${days}日`;
          return `<div class="alert-item" onclick="App.navigate('inventory')">
            <div class="alert-dot ${cls}"></div>
            <div class="alert-name">${Utils.escape(item.name)}</div>
            <div class="alert-days ${days < 0 ? 'urgent' : days < 30 ? 'urgent' : 'warn'}">${label}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- Low Stock -->
      ${lowStock.length ? `
      <div class="section-header">
        <span class="section-title">📉 在庫不足</span>
      </div>
      <div class="card">
        ${lowStock.map(item => `
          <div class="alert-item" onclick="App.navigate('shopping')">
            <div class="alert-dot amber"></div>
            <div class="alert-name">${Utils.escape(item.name)}</div>
            <div class="alert-days warn">${item.qty}/${item.min_qty}${item.unit}</div>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Quick Actions -->
      <div class="section-header">
        <span class="section-title">⚡ クイックアクション</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <button class="btn btn-secondary" onclick="App.navigate('inventory');setTimeout(()=>InventoryPage.openAddModal(),300)">
          ＋ 備蓄品を追加
        </button>
        <button class="btn btn-secondary" onclick="App.navigate('profiles');setTimeout(()=>ProfilesPage.openAddModal(),300)">
          ＋ 人物を登録
        </button>
        <button class="btn btn-secondary" onclick="App.showEmergencyCard()">
          🆘 緊急カード表示
        </button>
        <button class="btn btn-secondary" onclick="App.navigate('shopping')">
          🛒 買い物リスト (${pendingShopping}件)
        </button>
      </div>

      <!-- Disaster Links -->
      <div class="section-header">
        <span class="section-title">🌐 防災情報リンク</span>
      </div>
      <div class="disaster-links" style="margin-bottom:20px;">
        <a href="https://www.jma.go.jp/bosai/" target="_blank" class="disaster-link">
          <span class="disaster-link-icon">🌡️</span><span>気象庁<br>防災情報</span>
        </a>
        <a href="https://www.nhk.or.jp/sokuho/" target="_blank" class="disaster-link">
          <span class="disaster-link-icon">📺</span><span>NHK<br>速報ニュース</span>
        </a>
        <a href="https://www.bousai.go.jp/" target="_blank" class="disaster-link">
          <span class="disaster-link-icon">🏛️</span><span>内閣府<br>防災情報</span>
        </a>
        <a href="https://www.fdma.go.jp/" target="_blank" class="disaster-link">
          <span class="disaster-link-icon">🚒</span><span>消防庁<br>情報</span>
        </a>
      </div>
    </div>`;
  }

  return { render };
})();
