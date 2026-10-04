import type { DocMeta, Highlight, Thread } from "./types";

const DB_NAME = "segue-v1";
const DB_VER = 1;

type Stores = {
  docs: DocMeta;
  highlights: Highlight;
  threads: Thread;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("highlights")) {
        const s = db.createObjectStore("highlights", { keyPath: "id" });
        s.createIndex("docId", "docId", { unique: false });
      }
      if (!db.objectStoreNames.contains("threads")) db.createObjectStore("threads", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const value = await reqToPromise(fn(tx.objectStore(store)));
    await done;
    return value;
  } finally {
    db.close();
  }
}

export async function idbGetAll<K extends keyof Stores>(store: K): Promise<Stores[K][]> {
  return withStore(store, "readonly", (s) => s.getAll()) as Promise<Stores[K][]>;
}

export async function idbPut<K extends keyof Stores>(store: K, value: Stores[K]): Promise<void> {
  await withStore(store, "readwrite", (s) => s.put(value));
}

export async function idbDelete(store: string, key: string): Promise<void> {
  await withStore(store, "readwrite", (s) => s.delete(key));
}

export async function idbDeleteByIndex(store: "highlights", docId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    const idx = s.index("docId");
    const req = idx.openCursor(IDBKeyRange.only(docId));
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function idbPutFile(docId: string, bytes: ArrayBuffer): Promise<void> {
  await withStore("files", "readwrite", (s) => s.put(bytes, docId));
}

export async function idbGetFile(docId: string): Promise<ArrayBuffer | undefined> {
  return withStore("files", "readonly", (s) => s.get(docId));
}
