/* db.js — LifeStock IndexedDB v2 */
const DB = (() => {
  const DB_NAME = 'lifestockDB';
  const DB_VER  = 2;
  let db = null;

  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        const t = e.target.transaction;
        const old = e.oldVersion;
        if (old < 1) {
          const itemS = d.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
          itemS.createIndex('category', 'category');
          itemS.createIndex('location', 'location');
          const imgS = d.createObjectStore('item_images', { keyPath: 'id', autoIncrement: true });
          imgS.createIndex('item_id', 'item_id');
          d.createObjectStore('profiles', { keyPath: 'id', autoIncrement: true });
          const shopS = d.createObjectStore('shopping_list', { keyPath: 'id', autoIncrement: true });
          shopS.createIndex('is_bought', 'is_bought');
          d.createObjectStore('settings', { keyPath: 'key' });
        }
        if (old < 2) {
          const stockS = d.createObjectStore('item_stocks', { keyPath: 'id', autoIncrement: true });
          stockS.createIndex('item_id', 'item_id');
          if (old >= 1) {
            t.objectStore('items').getAll().onsuccess = (ev) => {
              for (const item of (ev.target.result || [])) {
                const qty = parseFloat(item.qty) || 0;
                if (qty > 0 || item.expiry_date) {
                  stockS.add({ item_id: item.id, qty: qty > 0 ? qty : 1, expiry_date: item.expiry_date || '', note: '' });
                }
              }
            };
          }
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(); };
      req.onerror   = () => reject(req.error);
    });
  }

  function getStore(store, mode = 'readonly') { return db.transaction([store], mode).objectStore(store); }
  function req2p(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function getAll(store)      { return req2p(getStore(store).getAll()); }
  function get(store, key)    { return req2p(getStore(store).get(key)); }
  function add(store, obj)    { return req2p(getStore(store, 'readwrite').add(obj)); }
  function put(store, obj)    { return req2p(getStore(store, 'readwrite').put(obj)); }
  function del(store, key)    { return req2p(getStore(store, 'readwrite').delete(key)); }
  function getByIdx(store, idx, val) {
    return new Promise((res, rej) => {
      const r = getStore(store).index(idx).getAll(val);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }

  const ItemStocks = {
    getForItem: (id) => getByIdx('item_stocks', 'item_id', id),
    async getAllGrouped() {
      const all = await getAll('item_stocks');
      const map = new Map();
      for (const s of all) { if (!map.has(s.item_id)) map.set(s.item_id, []); map.get(s.item_id).push(s); }
      return map;
    },
    add:    (s) => add('item_stocks', s),
    update: (s) => put('item_stocks', s),
    delete: (id) => del('item_stocks', id),
    async replaceForItem(itemId, entries) {
      const old = await getByIdx('item_stocks', 'item_id', itemId);
      for (const s of old) await del('item_stocks', s.id);
      for (const e of entries) {
        if ((parseFloat(e.qty) || 0) > 0) {
          await add('item_stocks', { item_id: itemId, qty: parseFloat(e.qty) || 0, expiry_date: e.expiry_date || '', note: e.note || '' });
        }
      }
    },
    deleteForItem: async (id) => { const all = await getByIdx('item_stocks','item_id',id); for (const s of all) await del('item_stocks',s.id); },
  };

  function enrichItems(items, stockMap) {
    return items.map(item => {
      const stocks = (stockMap.get(item.id) || []).sort((a,b) => {
        if (!a.expiry_date) return 1; if (!b.expiry_date) return -1;
        return a.expiry_date.localeCompare(b.expiry_date);
      });
      const total_qty = stocks.reduce((s,e) => s + (parseFloat(e.qty)||0), 0);
      const future = stocks.filter(s => s.expiry_date && Utils.daysUntil(s.expiry_date) >= 0);
      const nearest_expiry = future.length ? future[0].expiry_date : (stocks.find(s=>s.expiry_date)?.expiry_date || '');
      return { ...item, stocks, total_qty, nearest_expiry };
    });
  }

  const Items = {
    async getAll() {
      const [items, stockMap] = await Promise.all([getAll('items'), ItemStocks.getAllGrouped()]);
      return enrichItems(items, stockMap);
    },
    async get(id) {
      const item = await get('items', id); if (!item) return null;
      const stocks = await ItemStocks.getForItem(id);
      const map = new Map([[id, stocks]]);
      return enrichItems([item], map)[0];
    },
    add(item) { item.created_at = item.updated_at = new Date().toISOString(); return add('items', item); },
    update(item) { item.updated_at = new Date().toISOString(); return put('items', item); },
    delete: (id) => del('items', id),
  };

  const ItemImages = {
    getForItem: (id) => getByIdx('item_images','item_id',id),
    add: (img) => add('item_images', img),
    delete: (id) => del('item_images', id),
    deleteForItem: async (id) => { const imgs = await getByIdx('item_images','item_id',id); for (const img of imgs) await del('item_images',img.id); },
  };

  const Profiles = {
    getAll: () => getAll('profiles'),
    get: (id) => get('profiles', id),
    add(p)   { p.created_at = p.updated_at = new Date().toISOString(); return add('profiles', p); },
    update(p){ p.updated_at = new Date().toISOString(); return put('profiles', p); },
    delete: (id) => del('profiles', id),
  };

  const Shopping = {
    getAll: () => getAll('shopping_list'),
    add(item) { item.created_at = new Date().toISOString(); item.is_bought = false; return add('shopping_list', item); },
    update: (item) => put('shopping_list', item),
    delete: (id) => del('shopping_list', id),
    clearBought: async () => { const all = await getAll('shopping_list'); for (const s of all) if (s.is_bought) await del('shopping_list',s.id); },
  };

  const Settings = {
    get: async (key, def=null) => { try { const r = await get('settings',key); return r?r.value:def; } catch { return def; } },
    set: (k,v) => put('settings', {key:k, value:v}),
    getAll: () => getAll('settings'),
  };

  async function exportAll() {
    return {
      version: DB_VER, exported_at: new Date().toISOString(),
      items:       await getAll('items'),
      item_stocks: await getAll('item_stocks'),
      profiles:    await getAll('profiles'),
      shopping:    await getAll('shopping_list'),
      settings:    await getAll('settings'),
    };
  }

  async function importAll(data) {
    if (!data || !data.items) throw new Error('Invalid backup');
    for (const store of ['items','item_stocks','item_images','profiles','shopping_list','settings']) {
      await new Promise((res,rej) => { const r = getStore(store,'readwrite').clear(); r.onsuccess=res; r.onerror=rej; });
    }
    for (const x of (data.items||[]))       await put('items', x);
    for (const x of (data.item_stocks||[]))  await put('item_stocks', x);
    for (const x of (data.profiles||[]))     await put('profiles', x);
    for (const x of (data.shopping||[]))     await put('shopping_list', x);
    for (const x of (data.settings||[]))     await put('settings', x);
  }

  return { init, Items, ItemStocks, ItemImages, Profiles, Shopping, Settings, exportAll, importAll };
})();
