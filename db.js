/* db.js — LifeStock IndexedDB wrapper */
const DB = (() => {
  const DB_NAME = 'lifestockDB';
  const DB_VER  = 1;
  let db = null;

  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e) => {
        const d = e.target.result;

        // items store
        if (!d.objectStoreNames.contains('items')) {
          const s = d.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
          s.createIndex('category', 'category');
          s.createIndex('expiry_date', 'expiry_date');
          s.createIndex('location', 'location');
        }

        // item_images store
        if (!d.objectStoreNames.contains('item_images')) {
          const s = d.createObjectStore('item_images', { keyPath: 'id', autoIncrement: true });
          s.createIndex('item_id', 'item_id');
        }

        // profiles store
        if (!d.objectStoreNames.contains('profiles')) {
          d.createObjectStore('profiles', { keyPath: 'id', autoIncrement: true });
        }

        // shopping_list store
        if (!d.objectStoreNames.contains('shopping_list')) {
          const s = d.createObjectStore('shopping_list', { keyPath: 'id', autoIncrement: true });
          s.createIndex('is_bought', 'is_bought');
        }

        // settings store
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => { db = e.target.result; resolve(); };
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Generic helpers ──
  function tx(stores, mode = 'readonly') {
    return db.transaction(stores, mode);
  }
  function getStore(store, mode = 'readonly') {
    return tx([store], mode).objectStore(store);
  }
  function reqToPromise(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }
  function getAll(store) {
    return reqToPromise(getStore(store).getAll());
  }
  function get(store, key) {
    return reqToPromise(getStore(store).get(key));
  }
  function add(store, obj) {
    return reqToPromise(getStore(store, 'readwrite').add(obj));
  }
  function put(store, obj) {
    return reqToPromise(getStore(store, 'readwrite').put(obj));
  }
  function del(store, key) {
    return reqToPromise(getStore(store, 'readwrite').delete(key));
  }
  function getByIndex(store, indexName, value) {
    return new Promise((res, rej) => {
      const req = getStore(store).index(indexName).getAll(value);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }

  // ── Items ──
  const Items = {
    getAll: () => getAll('items'),
    get: (id) => get('items', id),
    add: (item) => {
      item.created_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      return add('items', item);
    },
    update: (item) => {
      item.updated_at = new Date().toISOString();
      return put('items', item);
    },
    delete: (id) => del('items', id),
    getByCategory: (cat) => getByIndex('items', 'category', cat),
  };

  // ── Item Images ──
  const ItemImages = {
    getForItem: (itemId) => getByIndex('item_images', 'item_id', itemId),
    add: (img) => add('item_images', img),
    delete: (id) => del('item_images', id),
    deleteForItem: async (itemId) => {
      const imgs = await getByIndex('item_images', 'item_id', itemId);
      for (const img of imgs) await del('item_images', img.id);
    },
  };

  // ── Profiles ──
  const Profiles = {
    getAll: () => getAll('profiles'),
    get: (id) => get('profiles', id),
    add: (profile) => {
      profile.created_at = new Date().toISOString();
      profile.updated_at = new Date().toISOString();
      return add('profiles', profile);
    },
    update: (profile) => {
      profile.updated_at = new Date().toISOString();
      return put('profiles', profile);
    },
    delete: (id) => del('profiles', id),
  };

  // ── Shopping List ──
  const Shopping = {
    getAll: () => getAll('shopping_list'),
    add: (item) => {
      item.created_at = new Date().toISOString();
      item.is_bought = false;
      return add('shopping_list', item);
    },
    update: (item) => put('shopping_list', item),
    delete: (id) => del('shopping_list', id),
    clearBought: async () => {
      const all = await getAll('shopping_list');
      for (const item of all) {
        if (item.is_bought) await del('shopping_list', item.id);
      }
    },
  };

  // ── Settings ──
  const Settings = {
    get: async (key, defaultVal = null) => {
      try {
        const rec = await get('settings', key);
        return rec ? rec.value : defaultVal;
      } catch { return defaultVal; }
    },
    set: (key, value) => put('settings', { key, value }),
    getAll: () => getAll('settings'),
  };

  // ── Export / Import ──
  async function exportAll() {
    return {
      version: DB_VER,
      exported_at: new Date().toISOString(),
      items:    await getAll('items'),
      profiles: await getAll('profiles'),
      shopping: await getAll('shopping_list'),
      settings: await getAll('settings'),
    };
  }

  async function importAll(data) {
    if (!data || !data.items) throw new Error('Invalid backup data');
    // Clear and re-import each store
    for (const store of ['items', 'profiles', 'shopping_list', 'settings']) {
      await new Promise((res, rej) => {
        const req = getStore(store, 'readwrite').clear();
        req.onsuccess = res; req.onerror = rej;
      });
    }
    for (const item of (data.items || []))    await put('items', item);
    for (const p of (data.profiles || []))    await put('profiles', p);
    for (const s of (data.shopping || []))    await put('shopping_list', s);
    for (const s of (data.settings || []))    await put('settings', s);
  }

  return { init, Items, ItemImages, Profiles, Shopping, Settings, exportAll, importAll };
})();
