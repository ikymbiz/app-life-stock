/* app.js — LifeStock Router, Modal, Toast, Utilities */

// ── MODAL ──
const Modal = (() => {
  const bg    = document.getElementById('modal-bg');
  const title = document.getElementById('modal-title');
  const body  = document.getElementById('modal-body');
  let onClose = null;

  function open(titleText, html, closeCb = null) {
    title.textContent = titleText;
    body.innerHTML    = html;
    onClose = closeCb;
    bg.classList.remove('hidden');
    requestAnimationFrame(() => bg.classList.add('visible'));
    // Scroll to top
    body.scrollTop = 0;
  }

  function close() {
    bg.classList.remove('visible');
    setTimeout(() => {
      bg.classList.add('hidden');
      body.innerHTML = '';
      if (onClose) { onClose(); onClose = null; }
    }, 250);
  }

  function closeBg(e) {
    if (e.target === bg) close();
  }

  return { open, close, closeBg, body, bg };
})();

// ── TOAST ──
const Toast = (() => {
  const container = document.getElementById('toast-container');

  function show(msg, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  return { show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') };
})();

// ── UTILITIES ──
const Utils = {
  formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d)) return isoStr;
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  },

  daysUntil(isoStr) {
    if (!isoStr) return null;
    const diff = new Date(isoStr) - new Date();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },

  expiryClass(isoStr) {
    const d = this.daysUntil(isoStr);
    if (d === null) return 'expiry-none';
    if (d < 0)   return 'expiry-expired';
    if (d < 30)  return 'expiry-urgent';
    if (d < 90)  return 'expiry-warn';
    return 'expiry-ok';
  },

  expiryLabel(isoStr) {
    const d = this.daysUntil(isoStr);
    if (d === null) return '';
    if (d < 0)   return `期限切れ ${Math.abs(d)}日`;
    if (d === 0) return '本日期限';
    if (d < 90)  return `残${d}日`;
    return `残${d}日`;
  },

  categoryIcon(cat) {
    const map = {
      water:     '💧',
      food:      '🍱',
      medicine:  '💊',
      sanitation:'🧴',
      disaster:  '🔦',
      pet:       '🐾',
      other:     '📦',
    };
    return map[cat] || '📦';
  },

  categoryLabel(cat) {
    const map = {
      water:     '水',
      food:      '食料',
      medicine:  '医薬品',
      sanitation:'衛生用品',
      disaster:  '防災グッズ',
      pet:       'ペット用品',
      other:     'その他',
    };
    return map[cat] || cat;
  },

  escape(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  // Auto-detect expiry date pattern from OCR text
  detectExpiryDate(text) {
    const patterns = [
      /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,  // 2024/12/31
      /(\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,  // 24/12/31
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,             // 2024年12月31日
      /(\d{2})年(\d{1,2})月(\d{1,2})日/,             // 24年12月31日
      /(\d{4})\.(\d{2})/,                            // 2024.12
      /(\d{2})\.(\d{2})/,                            // 24.12
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let [,y,mo,d] = m;
        if (y.length === 2) y = '20' + y;
        if (!d) d = '01';
        return `${y}-${mo.padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      }
    }
    return null;
  }
};

// ── ROUTER / APP ──
const App = (() => {
  let currentPage = 'dashboard';

  const pages = {
    dashboard: { module: () => DashboardPage, label: 'ホーム' },
    inventory:  { module: () => InventoryPage, label: '備蓄品' },
    profiles:   { module: () => ProfilesPage, label: '健康カード' },
    shopping:   { module: () => ShoppingPage, label: '買い物リスト' },
    settings:   { module: () => SettingsPage, label: '設定' },
  };

  function navigate(page) {
    if (!pages[page]) return;
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target
    const el = document.getElementById(`page-${page}`);
    if (el) {
      el.classList.add('active');
      el.innerHTML = ''; // clear old content
    }

    // Activate nav item
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    currentPage = page;

    // Render page
    const mod = pages[page].module();
    if (mod && mod.render) mod.render();
  }

  function init() {
    // Nav buttons
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });

    // Add item center button
    document.querySelectorAll('.nav-item[data-action="add-item"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentPage === 'inventory') {
          InventoryPage.openAddModal();
        } else if (currentPage === 'profiles') {
          ProfilesPage.openAddModal();
        } else if (currentPage === 'shopping') {
          ShoppingPage.openAddModal();
        } else {
          navigate('inventory');
          setTimeout(() => InventoryPage.openAddModal(), 300);
        }
      });
    });

    // Initial page
    navigate('dashboard');
  }

  async function showEmergencyCard() {
    const profiles = await DB.Profiles.getAll();
    if (!profiles.length) {
      Toast.show('健康カードが登録されていません', 'error');
      return;
    }

    let html = `<p style="color:var(--txt-3);font-size:13px;margin-bottom:12px;">
      救急隊員に提示する緊急医療情報を選択してください</p>
      <div style="display:flex;flex-direction:column;gap:8px;">`;

    for (const p of profiles) {
      html += `<button class="btn btn-secondary" onclick="App.showQR(${p.id})">
        ${p.is_pet ? '🐾' : '👤'} ${Utils.escape(p.owner_name)} の緊急カードを表示
      </button>`;
    }
    html += '</div>';
    Modal.open('🆘 緊急カード選択', html);
  }

  async function showQR(profileId) {
    const p = await DB.Profiles.get(profileId);
    if (!p) return;
    Modal.close();
    setTimeout(() => ProfilesPage.showQRCard(p), 300);
  }

  return { init, navigate, showEmergencyCard, showQR, currentPage: () => currentPage };
})();
