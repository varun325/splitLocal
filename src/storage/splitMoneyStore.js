const DB_NAME = 'split-money-db';
const DB_VERSION = 2;
const SHEETS_STORE = 'sheets';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Create new sheets store if not exists
      if (!db.objectStoreNames.contains(SHEETS_STORE)) {
        db.createObjectStore(SHEETS_STORE, { keyPath: 'name' });
      }
      // Remove old kv store if exists (migration)
      if (db.objectStoreNames.contains('kv')) {
        db.deleteObjectStore('kv');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all sheet names
export async function listSheets() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHEETS_STORE, 'readonly');
    const store = tx.objectStore(SHEETS_STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Check if sheet exists
export async function sheetExists(name) {
  const sheets = await listSheets();
  return sheets.some((s) => s.toLowerCase() === name.toLowerCase());
}

// Load a sheet by name
export async function loadSheet(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHEETS_STORE, 'readonly');
    const store = tx.objectStore(SHEETS_STORE);
    const req = store.get(name);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Save a sheet (create or update)
export async function saveSheet(sheetData) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHEETS_STORE, 'readwrite');
    const store = tx.objectStore(SHEETS_STORE);
    const data = { ...sheetData, updatedAt: Date.now() };
    const req = store.put(data);
    req.onsuccess = () => resolve(data);
    req.onerror = () => reject(req.error);
  });
}

// Delete a sheet by name
export async function deleteSheet(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHEETS_STORE, 'readwrite');
    const store = tx.objectStore(SHEETS_STORE);
    const req = store.delete(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Rename a sheet
export async function renameSheet(oldName, newName) {
  const existing = await loadSheet(oldName);
  if (!existing) throw new Error('Sheet not found');
  
  const conflict = await sheetExists(newName);
  if (conflict && oldName.toLowerCase() !== newName.toLowerCase()) {
    throw new Error('Sheet with this name already exists');
  }
  
  await deleteSheet(oldName);
  existing.name = newName;
  return saveSheet(existing);
}
