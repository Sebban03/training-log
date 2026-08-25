/**
 * DB — cienka warstwa nad IndexedDB.
 * Działa zarówno w przeglądarce (window.DB), jak i w Node (module.exports) — do testów.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'workoutTrackerDB';
  const DB_VERSION = 1;

  const STORES = {
    exercises: { keyPath: 'id', autoIncrement: true, indexes: [] },
    equipment: { keyPath: 'id', autoIncrement: true, indexes: [] },
    templates: { keyPath: 'id', autoIncrement: true, indexes: [] },
    scheduled_sessions: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'data', keyPath: 'data', unique: false }] },
    history_entries: { keyPath: 'id', autoIncrement: true, indexes: [{ name: 'data', keyPath: 'data', unique: false }] },
    settings: { keyPath: 'id', autoIncrement: false, indexes: [] },
  };

  let _dbPromise = null;
  let _dbInstance = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = root.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.keys(STORES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const cfg = STORES[storeName];
            const store = db.createObjectStore(storeName, {
              keyPath: cfg.keyPath,
              autoIncrement: cfg.autoIncrement,
            });
            cfg.indexes.forEach((idx) => {
              store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
            });
          }
        });
      };

      req.onsuccess = (event) => {
        _dbInstance = event.target.result;
        resolve(_dbInstance);
      };
      req.onerror = (event) => reject(event.target.error);
    });
    return _dbPromise;
  }

  function withStore(storeName, mode, fn) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
          let result;
          try {
            result = fn(store);
          } catch (err) {
            reject(err);
            return;
          }
          tx.oncomplete = () => resolve(result);
          tx.onerror = (event) => reject(event.target.error);
          tx.onabort = (event) => reject(event.target.error);
        })
    );
  }

  function requestToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = (event) => reject(event.target.error);
    });
  }

  function add(storeName, obj) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.add(obj);
          req.onsuccess = () => resolve(req.result);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function put(storeName, obj) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.put(obj);
          req.onsuccess = () => resolve(req.result);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function get(storeName, id) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function getAll(storeName) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function remove(storeName, id) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const req = tx.objectStore(storeName).delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function getByIndexRange(storeName, indexName, lowerDate, upperDate) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const idx = tx.objectStore(storeName).index(indexName);
          const range =
            lowerDate && upperDate
              ? root.IDBKeyRange.bound(lowerDate, upperDate)
              : lowerDate
              ? root.IDBKeyRange.lowerBound(lowerDate)
              : upperDate
              ? root.IDBKeyRange.upperBound(upperDate)
              : undefined;
          const req = range ? idx.getAll(range) : idx.getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = (event) => reject(event.target.error);
        })
    );
  }

  // --- Backup / restore całej bazy ---

  function exportAll() {
    const names = Object.keys(STORES);
    return Promise.all(names.map((name) => getAll(name))).then((results) => {
      const dump = {};
      names.forEach((name, i) => {
        dump[name] = results[i];
      });
      dump._meta = { exportedAt: new Date().toISOString(), version: DB_VERSION };
      return dump;
    });
  }

  function importAll(dump) {
    const names = Object.keys(STORES).filter((n) => Array.isArray(dump[n]));
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(names, 'readwrite');
          names.forEach((name) => {
            const store = tx.objectStore(name);
            store.clear();
            dump[name].forEach((obj) => store.put(obj));
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function clearAll() {
    const names = Object.keys(STORES);
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(names, 'readwrite');
          names.forEach((name) => tx.objectStore(name).clear());
          tx.oncomplete = () => resolve(true);
          tx.onerror = (event) => reject(event.target.error);
        })
    );
  }

  function resetForTests() {
    // pomocnicze tylko dla testów: realnie zamyka połączenie (inaczej deleteDatabase się blokuje)
    if (_dbInstance) {
      try {
        _dbInstance.close();
      } catch (err) {
        // ignoruj — połączenie mogło już być zamknięte
      }
    }
    _dbPromise = null;
    _dbInstance = null;
  }

  const api = {
    STORES,
    openDB,
    add,
    put,
    get,
    getAll,
    remove,
    getByIndexRange,
    exportAll,
    importAll,
    clearAll,
    resetForTests,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DB = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
