import { PipelineResult } from '../types';

export interface StoredReceiptItem {
  id: string;
  filename: string;
  fileSize: number;
  blob: Blob;
  previewUrl?: string;
  bookNumber?: string;
  uploadedAt: number;
  rotation: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  result?: PipelineResult;
  error?: string;
  reviewed?: boolean;
  savedReceiptId?: number;
}

const DB_NAME = 'trikuta_receipt_db';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('bookNumber', 'bookNumber', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addStoredReceipts(receipts: StoredReceiptItem[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    receipts.forEach((r) => {
      // Create clean record without in-memory object URLs
      const record = {
        ...r,
        previewUrl: undefined,
      };
      store.put(record);
    });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAllStoredReceipts(): Promise<StoredReceiptItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      const records: StoredReceiptItem[] = request.result || [];
      // Generate object URLs for immediate preview
      const withUrls = records.map((rec) => ({
        ...rec,
        previewUrl: URL.createObjectURL(rec.blob),
      }));
      // Sort oldest to newest by default so book sequence is preserved
      withUrls.sort((a, b) => a.uploadedAt - b.uploadedAt);
      resolve(withUrls);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function updateStoredReceipt(
  id: string,
  updates: Partial<Omit<StoredReceiptItem, 'id' | 'blob'>> & { blob?: Blob }
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        db.close();
        resolve();
        return;
      }
      const updated = {
        ...existing,
        ...updates,
        previewUrl: undefined,
      };
      store.put(updated);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteStoredReceipt(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteStoredReceipts(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearAllStoredReceipts(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
