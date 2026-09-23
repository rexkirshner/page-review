// Keep the original persistent identifier so an upgrade does not orphan locally stored screenshots.
const DATABASE = "feedback-packet-images";
const STORE = "screenshots";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Screenshot storage is blocked by another extension context."));
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onerror = () => { database.close(); reject(tx.error ?? request.error); };
    tx.onabort = () => { database.close(); reject(tx.error ?? new Error("Screenshot storage transaction was aborted.")); };
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Screenshot is not a base64 data URL.");
  const mimeType = match[1];
  const encoded = match[2];
  if (!mimeType || encoded === undefined) throw new Error("Screenshot data is incomplete.");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

export async function putImage(key: string, dataUrl: string): Promise<void> {
  await transaction("readwrite", (store) => store.put(dataUrlToBlob(dataUrl), key));
}

export async function getImage(key: string): Promise<string | undefined> {
  const blob = await transaction<Blob | undefined>("readonly", (store) => store.get(key));
  return blob ? blobToDataUrl(blob) : undefined;
}

export async function deleteImage(key: string): Promise<void> {
  await transaction("readwrite", (store) => store.delete(key));
}

export async function deleteDraftImages(draftId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const prefix = `${draftId}:`;
    const request = store.openCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => { database.close(); reject(tx.error ?? request.error); };
    tx.onabort = () => { database.close(); reject(tx.error ?? new Error("Screenshot cleanup transaction was aborted.")); };
  });
}
