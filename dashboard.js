/* dashboard.js — Dashboard with fixed Survival Simulator */
const DashboardPage = (() => {

  async function render() {
    const el = document.getElementById('page-dashboard');

    const [items, profiles, shopping, adults, children] = await Promise.all([
      DB.Items.getAll(),
      DB.Profiles.getAll(),
      DB.Shopping.getAll(),
      DB.Settings.get('family_adults', '2'),
      DB.Settings.get('family_children', '0'),
    ]);

    const now = new Date();
    const totalAdults   = Math.max(0, parseInt(adults)   || 0);
    const totalChildren = Math.max(0, parseInt(children) || 0);
    const totalPeople   = totalAdults + totalChildren;

    // ── アラート集計 ──
    const expiryAlerts = [];
    for (const item of items) {
      for (const stock of (item.stocks || [])) {
        if (!stock.expiry_date) continue;
        const days = Utils.daysUntil(stock.expiry_date);
        if (days < 90) expiryAlerts.push({ item, stock, days });
      }
    }
    expiryAlerts.sort((a, b) => a.days - b.days);
    const expiredCount = expiryAlerts.filter(a => a.days < 0).length;
    const urgentCount  = expiryAlerts.filter(a => a.days >= 0 && a.days < 30).length;
    const warnCount    = expiryAlerts.filter(a => a.days >= 30 && a.days < 90).length;
    const lowStock     = items.filter(i => i.min_qty > 0 && i.total_qty < i.min_qty);
    const pendingShop  = shopping.filter(s => !s.is_bought).length;

    // ── アレルゲン照合 ──
    const allergenAlerts = []; // { item, allergen, who }
    for (const item of items) {
      if (!item.allergens) continue;
      const ia = item.allergens.split(',').map(a=>a.trim()).filter(Boolean);
      for (const allergen of ia) {
        for (const p of profiles) {
          const txt = [p.allergies_food, p.allergies_drug].filter(Boolean).join('、');
          if (txt && txt.includes(allergen)) {
            if (!allergenAlerts.find(a=>a.item.id===item.id&&a.allergen===allergen&&a.who===p.owner_name)) {
              allergenAlerts.push({ item, allergen, who: p.owner_name });
            }
          }
        }
      }
    }

    // ── サバイバル計算 (item_stocks ベース) ──
    let totalWaterL = 0;
    let totalFoodServings = 0;

    for (const item of items) {
      const stocks = item.stocks || [];
      const totalQty = stocks.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0);
      if (totalQty <= 0) continue;

      if (item.category === 'water') {
        const unit = item.unit || '本';
        if      (unit === 'L')   totalWaterL += totalQty;
        else if (unit === 'mL')  totalWaterL += totalQty / 1000;
        else if (unit === '缶')  totalWaterL += totalQty * 0.35;
        else if (unit === 'カップ') totalWaterL += totalQty * 0.2;
        else                     totalWaterL += totalQty * 0.5; // 本/個/袋 → 500mL 想定
      } else if (item.category === 'food') {
        const unit = item.unit || '個';
        if      (unit === '食')  totalFoodServings += totalQty;
        else if (unit === '袋')  totalFoodServings += totalQty * 3;  // 1袋=約3食
        else if (unit === '缶')  totalFoodServings += totalQty * 2;  // 1缶=約2食
        else if (unit === '箱')  totalFoodServings += totalQty * 6;  // 1箱=約6食
        else if (unit === 'kg')  totalFoodServings += totalQty * 10; // 1kg=約10食
        else                     totalFoodServings += totalQty;      // 個/本 → 1食
      }
    }

    // 1人あたり: 水3L/日、食事3食/日
    const waterDays = totalPeople > 0
      ? Math.floor(totalWaterL / (3 * (totalAdults + totalChildren * 0.7)))
      : 0;
    const mealsPerDay = totalAdults * 3 + totalChildren * 2;
    const foodDays = mealsPerDay > 0
      ? Math.floor(totalFoodServings / mealsPerDay)
      : 0;
    const simDays = (totalWaterL > 0 || totalFoodServings > 0)
      ? Math.min(
          totalWaterL > 0 ? waterDays : 9999,
          totalFoodServings > 0 ? foodDays : 9999
        )
      : 0;

    const TARGET_DAYS = 7;
    const waterPct = Math.min(100, Math.round((waterDays / TARGET_DAYS) * 100));
    const foodPct  = Math.min(100, Math.round((foodDays  / TARGET_DAYS) * 100));
    const barColor = (pct) => pct >= 100 ? 'green' : pct >= 50 ? 'amber' : 'red';
    const dayColor = simDays >= TARGET_DAYS ? 'var(--green)' : simDays >= 3 ? 'var(--amber)' : 'var(--red)';

    el.innerHTML = `<div class="page-inner">
      <div style="padding:16px 0 4px;">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.02em;">備蓄ダッシュボード</div>
        <div style="font-size:13px;color:var(--txt-3);margin-top:2px;">${now.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}</div>
      </div>

      ${(expiredCount || urgentCount) ? `
      <div class="card" style="background:var(--red-dim);border-color:var(--red-border);margin-top:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">⚠️</span>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--red);">
              ${expiredCount ? `期限切れ ${expiredCount}件` : ''}
              ${urgentCount  ? ` 30日以内 ${urgentCount}件` : ''}
            </div>
            <div style="font-size:12px;color:var(--txt-2);">備蓄品リストを確認してください</div>
          </div>
          <button onclick="App.navigate('inventory')" class="btn btn-sm btn-danger" style="margin-left:auto;">確認→</button>
        </div>
      </div>` : ''}

      <div class="stat-grid" style="margin-top:14px;">
        <div class="stat-card" onclick="App.navigate('inventory')">
          <div class="stat-num blue">${items.length}</div>
          <div class="stat-label">備蓄品</div>
        </div>
        <div class="stat-card" onclick="App.navigate('inventory')">
          <div class="stat-num ${expiredCount||urgentCount ? 'red':'amber'}">${expiredCount + urgentCount}</div>
          <div class="stat-label">要確認</div>
        </div>
        <div class="stat-card" onclick="App.navigate('profiles')">
          <div class="stat-num green">${profiles.length}</div>
          <div class="stat-label">登録人物</div>
        </div>
      </div>

      <!-- ── サバイバル計算 ── -->
      <div class="section-header">
        <span class="section-title">🧮 サバイバル計算</span>
        <button class="section-action" onclick="App.navigate('settings')">家族設定 →</button>
      </div>
      <div class="sim-card">
        <div class="sim-title">現在の備蓄で推定生存可能日数</div>
        <div class="sim-day-display">
          <div class="sim-day-num" style="color:${dayColor};">${simDays}</div>
          <div class="sim-day-unit">日分</div>
          ${simDays >= TARGET_DAYS
            ? `<span style="font-size:13px;color:var(--green);margin-left:8px;">✓ 目標達成</span>`
            : `<span style="font-size:13px;color:var(--red);margin-left:8px;">目標: ${TARGET_DAYS}日</span>`}
        </div>

        <div class="sim-bar-wrap">
          <div class="sim-bar-label">
            <span>💧 水 <span style="color:var(--txt-3);font-size:11px;">(3L/人/日)</span></span>
            <span>${totalWaterL.toFixed(1)}L → <strong>${waterDays}日分</strong></span>
          </div>
          <div class="sim-bar"><div class="sim-bar-fill ${barColor(waterPct)}" style="width:${waterPct}%"></div></div>
        </div>

        <div class="sim-bar-wrap" style="margin-top:10px;">
          <div class="sim-bar-label">
            <span>🍱 食料 <span style="color:var(--txt-3);font-size:11px;">(3食/人/日)</span></span>
            <span>${totalFoodServings.toFixed(0)}食分 → <strong>${foodDays}日分</strong></span>
          </div>
          <div class="sim-bar"><div class="sim-bar-fill ${barColor(foodPct)}" style="width:${foodPct}%"></div></div>
        </div>

        <div style="margin-top:12px;padding:10px;background:var(--bg-3);border-radius:8px;">
          <div style="font-size:11px;color:var(--txt-3);line-height:1.7;">
            👥 大人 ${totalAdults}人 / 子供 ${totalChildren}人 ／ 目標 ${TARGET_DAYS}日分<br>
            💧 本・個 → 500mL / 缶 → 350mL ／ 🍱 袋 → 3食 / 缶 → 2食 / 箱 → 6食 として計算
          </div>
        </div>
      </div>

      ${expiryAlerts.length ? `
      <div class="section-header"><span class="section-title">⏰ 期限アラート</span></div>
      <div class="card">
        ${expiryAlerts.slice(0,8).map(({item, stock, days}) => {
          const cls = days < 0 ? 'red' : days < 30 ? 'red' : 'amber';
          const label = days < 0
            ? `${Math.abs(days)}日前に期限切れ`
            : days === 0 ? '本日期限'
            : `残${days}日`;
          return `<div class="alert-item" onclick="InventoryPage.openEditModal(${item.id})">
            <div class="alert-dot ${cls}"></div>
            <div class="alert-name">${Utils.escape(item.name)}</div>
            <div style="font-size:11px;color:var(--txt-3);margin-left:4px;">${stock.qty}${Utils.escape(item.unit||'個')}</div>
            <div class="alert-days ${days<30?'urgent':'warn'}" style="margin-left:auto;">${label}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${lowStock.length ? `
      <div class="section-header"><span class="section-title">📉 在庫不足</span></div>
      <div class="card">
        ${lowStock.map(item => `
          <div class="alert-item" onclick="App.navigate('shopping')">
            <div class="alert-dot amber"></div>
            <div class="alert-name">${Utils.escape(item.name)}</div>
            <div class="alert-days warn">${item.total_qty}/${item.min_qty}${Utils.escape(item.unit||'')}</div>
          </div>
        `).join('')}
      </div>` : ''}

      ${allergenAlerts.length ? `
      <div class="section-header">
        <span class="section-title">⚠️ アレルゲン注意</span>
        <button class="section-action" onclick="App.navigate('inventory')">備蓄品リスト →</button>
      </div>
      <div class="card" style="background:rgba(245,156,42,0.06);border-color:var(--amber-border);">
        <div style="font-size:12px;color:var(--amber);font-weight:700;margin-bottom:10px;">
          家族のアレルギーに該当する備蓄品が見つかりました
        </div>
        ${[...new Map(allergenAlerts.map(a=>[a.item.id+a.allergen, a])).values()].slice(0,8).map(({item, allergen, who}) => `
          <div class="alert-item" onclick="InventoryPage.openEditModal(${item.id})">
            <span style="font-size:18px;flex-shrink:0;">⚠️</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(item.name)}</div>
              <div style="font-size:11px;color:var(--txt-3);">含む: <span style="color:var(--amber);font-weight:700;">${Utils.escape(allergen)}</span></div>
            </div>
            <div style="flex-shrink:0;text-align:right;">
              <span class="allergen-who-badge">${Utils.escape(who)}</span>
            </div>
          </div>`).join('')}
      </div>` : ''}

      <div class="section-header"><span class="section-title">⚡ クイックアクション</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <button class="btn btn-secondary" onclick="App.navigate('inventory');setTimeout(()=>InventoryPage.openAddModal(),300)">＋ 備蓄品を追加</button>
        <button class="btn btn-secondary" onclick="App.navigate('profiles');setTimeout(()=>ProfilesPage.openAddModal(),300)">＋ 人物を登録</button>
        <button class="btn btn-secondary" onclick="App.showEmergencyCard()">🆘 緊急カード表示</button>
        <button class="btn btn-secondary" onclick="App.navigate('shopping')">🛒 買い物 (${pendingShop}件)</button>
      </div>

      <div class="section-header"><span class="section-title">🌐 防災情報</span></div>
      <div class="disaster-links" style="margin-bottom:20px;">
        <a href="https://www.jma.go.jp/bosai/" target="_blank" class="disaster-link"><span class="disaster-link-icon">🌡️</span><span>気象庁<br>防災情報</span></a>
        <a href="https://www.nhk.or.jp/sokuho/" target="_blank" class="disaster-link"><span class="disaster-link-icon">📺</span><span>NHK<br>速報ニュース</span></a>
        <a href="https://www.bousai.go.jp/" target="_blank" class="disaster-link"><span class="disaster-link-icon">🏛️</span><span>内閣府<br>防災情報</span></a>
        <a href="https://www.fdma.go.jp/" target="_blank" class="disaster-link"><span class="disaster-link-icon">🚒</span><span>消防庁<br>情報</span></a>
      </div>
    </div>`;
  }

  return { render };
})();
