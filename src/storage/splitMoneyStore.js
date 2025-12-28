const DB_NAME = 'split-money-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const APP_KEY = 'appData';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadAppData() {
  const db = await openDb();
  const req = await withStore(db, 'readonly', (store) => store.get(APP_KEY));

  const value = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return value || null;
}

export async function saveAppData(data) {
  const db = await openDb();
  const req = await withStore(db, 'readwrite', (store) => store.put(data, APP_KEY));

  await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function patchAppData(partial) {
  const existing = (await loadAppData()) || {};
  const merged = {
    ...existing,
    ...partial,
    updatedAt: Date.now(),
  };
  await saveAppData(merged);
  return merged;
}
