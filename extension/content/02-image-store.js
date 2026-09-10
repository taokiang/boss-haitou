/**
 * 02-image-store.js
 * IndexedDB 封装：存储图片简历 Blob（localStorage 只存元数据）
 */
(function () {
  "use strict";

  const DB_NAME = "BossHaitouImages";
  const STORE_NAME = "imageResumes";

  BH.imageStore = {
    _db: null,
    // 发送时的内存 Blob 缓存，避免重复读库
    _blobCache: new Map(),

    _getDB() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = (e) => {
          this._db = e.target.result;
          resolve(this._db);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async save(id, blob) {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ id, file: blob });
        tx.oncomplete = () => {
          this._blobCache.set(id, blob);
          resolve();
        };
        tx.onerror = (e) => reject(e.target.error);
      });
    },

    async get(id) {
      if (this._blobCache.has(id)) return this._blobCache.get(id);
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
        request.onsuccess = () => {
          const blob = request.result ? request.result.file : null;
          if (blob) this._blobCache.set(id, blob);
          resolve(blob);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async remove(id) {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => {
          this._blobCache.delete(id);
          resolve();
        };
        tx.onerror = (e) => reject(e.target.error);
      });
    },
  };
})();
