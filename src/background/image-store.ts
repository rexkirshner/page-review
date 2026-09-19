const DATABASE = "feedback-packet-images";
const STORE = "screenshots";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => database.close();
    tx.onerror = () => reject(tx.error);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Screenshot is not a base64 data URL.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
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
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${draftId}:`)) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { database.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
