/* dashboard.js — Home Dashboard with Survival Simulator */
const DashboardPage = (() => {

  async function render() {
    const el = document.getElementById('page-dashboard');
    if (!el) return;

    // DB からデータ取得
    let items = [], adults = 2, children = 0, targetDays = 7;
    try {
      items      = await DB.Items.getAll();
      adults     = parseInt(await DB.Settings.get('family_adults', '2')) || 2;
      children   = parseInt(await DB.Settings.get('family_children', '0')) || 0;
      targetDays = parseInt(await DB.Settings.get('target_days', '7')) || 7;
    } catch(e) {}

    const people = adults + children;

    // カテゴリ別集計
    const totals = { water:0, food:0, medicine:0, sanitation:0, disaster:0, pet:0, other:0 };
    let expiringCount = 0, expiredCount = 0, lowStockCount = 0;
    const expiringItems = [];

    for (const item of items) {
      const cat = item.category || 'other';
      const qty = item.total_qty || 0;
      if (totals[cat] !== undefined) totals[cat] += qty;

      if (item.nearest_expiry) {
        const days = Utils.daysUntil(item.nearest_expiry);
        if (days !== null && days < 0) expiredCount++;
        else if (days !== null && days <= 30) { expiringCount++; expiringItems.push(item); }
      }
      if (item.min_qty > 0 && qty < item.min_qty) lowStockCount++;
    }

    // シミュレーション計算
    const waterPerDay  = people * 3; // 1人3L/日
    const foodPerDay   = people * 3; // 1人3食/日
    const waterDays    = waterPerDay > 0 ? Math.floor(totals.water / waterPerDay) : 0;
    const foodDays     = foodPerDay > 0 ? Math.floor(totals.food / foodPerDay) : 0;
    const survivalDays = Math.min(waterDays, foodDays);

    const waterNeeded  = waterPerDay * targetDays;
    const foodNeeded   = foodPerDay * targetDays;
    const waterPct     = waterNeeded > 0 ? Math.min(100, Math.round(totals.water / waterNeeded * 100)) : 0;
    const foodPct      = foodNeeded > 0 ? Math.min(100, Math.round(totals.food / foodNeeded * 100)) : 0;

    const totalItems = items.length;
    const statusColor = survivalDays >= targetDays ? 'text-primary' : survivalDays >= 3 ? 'text-tertiary' : 'text-error';
    const statusMsg = survivalDays >= targetDays
      ? '目標日数を達成しています。'
      : survivalDays >= 3
        ? `目標まであと${targetDays - survivalDays}日分の備蓄が必要です。`
        : '備蓄が不足しています。早めの補充をおすすめします。';

    // 円グラフ SVG パラメータ
    const circum = 251; // 2π×40
    const waterOffset = circum - (circum * waterPct / 100);
    const foodOffset  = circum - (circum * foodPct / 100);

    // 期限切れアイテムリスト（上位5件）
    expiringItems.sort((a, b) => {
      const da = Utils.daysUntil(a.nearest_expiry);
      const db = Utils.daysUntil(b.nearest_expiry);
      return (da || 9999) - (db || 9999);
    });
    const topExpiring = expiringItems.slice(0, 5);

    el.innerHTML = `
    <!-- ═══ ヒーロー: 生存可能日数 ═══ -->
    <section class="mb-10 text-center">
      <p class="font-headline text-primary font-bold tracking-wide text-xs uppercase mb-1">
        <span class="material-symbols-rounded text-sm align-middle">shield</span> Survival Capacity
      </p>
      <div class="flex items-center justify-center gap-3">
        <span class="font-headline text-7xl md:text-8xl font-bold ${statusColor} tracking-tight">
          ${String(survivalDays).padStart(2, '0')}
        </span>
        <span class="font-headline text-2xl font-bold text-secondary self-end mb-3">日</span>
      </div>
      <p class="text-on-surface-variant font-medium mt-3 max-w-sm mx-auto text-sm">${statusMsg}</p>
    </section>

    <!-- ═══ クイックステータス ═══ -->
    <div class="grid grid-cols-3 gap-3 mb-8">
      <div class="bg-surface border border-secondary-container rounded-2xl p-4 text-center">
        <span class="material-symbols-rounded text-primary mb-1" style="font-variation-settings:'FILL' 1;">inventory_2</span>
        <div class="font-headline font-bold text-xl text-on-surface">${totalItems}</div>
        <div class="text-[10px] text-on-surface-variant font-bold">備蓄アイテム</div>
      </div>
      <div class="bg-surface border border-secondary-container rounded-2xl p-4 text-center ${expiringCount > 0 ? 'border-tertiary/40' : ''}">
        <span class="material-symbols-rounded ${expiringCount > 0 ? 'text-tertiary' : 'text-primary'} mb-1" style="font-variation-settings:'FILL' 1;">schedule</span>
        <div class="font-headline font-bold text-xl ${expiringCount > 0 ? 'text-tertiary' : 'text-on-surface'}">${expiringCount}</div>
        <div class="text-[10px] text-on-surface-variant font-bold">期限間近</div>
      </div>
      <div class="bg-surface border border-secondary-container rounded-2xl p-4 text-center ${expiredCount > 0 ? 'border-error/40' : ''}">
        <span class="material-symbols-rounded ${expiredCount > 0 ? 'text-error' : 'text-primary'} mb-1" style="font-variation-settings:'FILL' 1;">warning</span>
        <div class="font-headline font-bold text-xl ${expiredCount > 0 ? 'text-error' : 'text-on-surface'}">${expiredCount}</div>
        <div class="text-[10px] text-on-surface-variant font-bold">期限切れ</div>
      </div>
    </div>

    <!-- ═══ 水・食料ゲージ ═══ -->
    <div class="grid grid-cols-2 gap-4 mb-8">
      <!-- 飲料水カード -->
      <div class="bg-white border border-secondary-container rounded-2xl p-5 shadow-sm">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h4 class="font-headline font-bold text-base text-on-surface">飲料水</h4>
            <p class="text-[10px] text-primary font-bold tracking-widest uppercase">Water</p>
          </div>
          <span class="material-symbols-rounded text-primary" style="font-variation-settings:'FILL' 1;">water_drop</span>
        </div>
        <div class="relative h-20 w-20 mx-auto mb-4">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="transparent" stroke="#F0F4F4" stroke-width="8"/>
            <circle cx="48" cy="48" r="40" fill="transparent" stroke="#2D918B" stroke-width="8"
              stroke-dasharray="${circum}" stroke-dashoffset="${waterOffset}" stroke-linecap="round"
              class="transition-all duration-700"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="font-headline font-bold text-lg text-primary">${waterPct}%</span>
          </div>
        </div>
        <div class="space-y-1 text-xs font-bold">
          <div class="flex justify-between"><span class="text-on-surface-variant">現在</span><span>${totals.water} L</span></div>
          <div class="flex justify-between"><span class="text-on-surface-variant">必要 (${targetDays}日)</span><span class="${totals.water >= waterNeeded ? 'text-primary' : 'text-error'}">${waterNeeded} L</span></div>
        </div>
      </div>

      <!-- 食料カード -->
      <div class="bg-white border border-secondary-container rounded-2xl p-5 shadow-sm">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h4 class="font-headline font-bold text-base text-on-surface">食料</h4>
            <p class="text-[10px] text-tertiary font-bold tracking-widest uppercase">Food</p>
          </div>
          <span class="material-symbols-rounded text-tertiary" style="font-variation-settings:'FILL' 1;">restaurant</span>
        </div>
        <div class="relative h-20 w-20 mx-auto mb-4">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="transparent" stroke="#F0F4F4" stroke-width="8"/>
            <circle cx="48" cy="48" r="40" fill="transparent" stroke="#F2994A" stroke-width="8"
              stroke-dasharray="${circum}" stroke-dashoffset="${foodOffset}" stroke-linecap="round"
              class="transition-all duration-700"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="font-headline font-bold text-lg text-tertiary">${foodPct}%</span>
          </div>
        </div>
        <div class="space-y-1 text-xs font-bold">
          <div class="flex justify-between"><span class="text-on-surface-variant">現在</span><span>${totals.food} 食</span></div>
          <div class="flex justify-between"><span class="text-on-surface-variant">必要 (${targetDays}日)</span><span class="${totals.food >= foodNeeded ? 'text-primary' : 'text-error'}">${foodNeeded} 食</span></div>
        </div>
      </div>
    </div>

    <!-- ═══ カテゴリ別備蓄 ═══ -->
    <div class="bg-white border border-secondary-container rounded-2xl overflow-hidden shadow-sm mb-8">
      <div class="p-5">
        <h3 class="font-headline text-sm font-bold tracking-wide text-primary mb-5 flex items-center gap-2">
          <span class="material-symbols-rounded text-lg">inventory</span> カテゴリ別備蓄
        </h3>
        <div class="space-y-4">
          ${renderCategoryBar('💊', '医薬品', totals.medicine, '点')}
          ${renderCategoryBar('🧴', '衛生用品', totals.sanitation, '点')}
          ${renderCategoryBar('🔦', '防災グッズ', totals.disaster, '点')}
          ${renderCategoryBar('🐾', 'ペット用品', totals.pet, '点')}
        </div>
      </div>
    </div>

    <!-- ═══ 期限間近アイテム ═══ -->
    ${topExpiring.length > 0 ? `
    <div class="bg-white border border-secondary-container rounded-2xl overflow-hidden shadow-sm mb-8">
      <div class="p-5">
        <h3 class="font-headline text-sm font-bold tracking-wide text-tertiary mb-4 flex items-center gap-2">
          <span class="material-symbols-rounded text-lg">event_busy</span> 期限間近のアイテム
        </h3>
        <div class="space-y-3">
          ${topExpiring.map(item => {
            const d = Utils.daysUntil(item.nearest_expiry);
            const cls = d < 0 ? 'bg-error text-white' : d < 7 ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary';
            const label = d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '本日' : `残${d}日`;
            return `<div class="flex items-center gap-3 p-3 rounded-xl bg-surface-variant/50" onclick="App.navigate('inventory')">
              <span class="text-xl">${Utils.categoryIcon(item.category)}</span>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm truncate">${Utils.escape(item.name)}</div>
                <div class="text-[11px] text-on-surface-variant">${Utils.formatDate(item.nearest_expiry)}</div>
              </div>
              <span class="text-[11px] font-bold px-2 py-1 rounded-lg ${cls}">${label}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      ${expiringItems.length > 5 ? `<div class="px-5 pb-4"><button class="text-xs text-primary font-bold" onclick="App.navigate('inventory')">すべて表示 →</button></div>` : ''}
    </div>` : ''}

    <!-- ═══ アドバイス ═══ -->
    <div class="bg-primary-container/30 border border-primary/10 rounded-2xl px-5 py-4 flex items-start gap-3 mb-8">
      <span class="material-symbols-rounded text-primary text-xl mt-0.5" style="font-variation-settings:'FILL' 1;">tips_and_updates</span>
      <div class="text-xs font-medium text-on-surface-variant leading-relaxed">
        ${getAdvice(totals, waterNeeded, foodNeeded, targetDays, lowStockCount, expiredCount)}
      </div>
    </div>

    <!-- ═══ クイックアクション ═══ -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <button onclick="InventoryPage.showAddMethodSheet()" class="flex items-center gap-3 bg-white border border-secondary-container rounded-2xl p-4 shadow-sm active:scale-95 transition-transform">
        <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
          <span class="material-symbols-rounded text-primary">add_a_photo</span>
        </div>
        <div class="text-left">
          <div class="font-bold text-sm">撮るだけ登録</div>
          <div class="text-[10px] text-on-surface-variant">写真で備蓄品を追加</div>
        </div>
      </button>
      <button onclick="App.navigate('settings')" class="flex items-center gap-3 bg-white border border-secondary-container rounded-2xl p-4 shadow-sm active:scale-95 transition-transform">
        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
          <span class="material-symbols-rounded text-primary">tune</span>
        </div>
        <div class="text-left">
          <div class="font-bold text-sm">設定</div>
          <div class="text-[10px] text-on-surface-variant">家族構成・AI設定</div>
        </div>
      </button>
    </div>
    `;
  }

  function renderCategoryBar(icon, label, qty, unit) {
    const maxQty = 30;
    const pct = Math.min(100, Math.round((qty / maxQty) * 100));
    return `<div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-sm">${icon}</div>
      <div class="flex-1">
        <div class="flex justify-between mb-1 text-xs font-bold">
          <span class="text-on-surface">${label}</span>
          <span class="text-on-surface-variant">${qty} ${unit}</span>
        </div>
        <div class="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all duration-500" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
  }

  function getAdvice(totals, waterNeeded, foodNeeded, targetDays, lowStockCount, expiredCount) {
    const msgs = [];
    if (totals.water < waterNeeded) {
      const deficit = waterNeeded - totals.water;
      msgs.push(`飲料水が <strong class="text-primary">${deficit}L</strong> 不足しています。2Lペットボトル <strong>${Math.ceil(deficit / 2)}本</strong> の追加を推奨します。`);
    }
    if (totals.food < foodNeeded) {
      const deficit = foodNeeded - totals.food;
      msgs.push(`食料が <strong class="text-tertiary">${deficit}食</strong> 不足しています。`);
    }
    if (expiredCount > 0) msgs.push(`<strong class="text-error">期限切れ${expiredCount}件</strong>があります。早めに交換してください。`);
    if (lowStockCount > 0) msgs.push(`在庫不足のアイテムが <strong>${lowStockCount}件</strong> あります。`);
    if (!msgs.length) msgs.push(`すべての備蓄が目標${targetDays}日分を満たしています。定期的な確認を続けましょう。`);
    return msgs.join(' ');
  }

  return { render };
})();
