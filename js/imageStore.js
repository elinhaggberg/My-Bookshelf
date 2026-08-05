// Local cover-photo uploads are stored here instead of in localStorage — a
// phone photo easily runs a few hundred KB, and localStorage's ~5MB-per-site
// cap (tighter still on Safari) fills up after only a handful of them.
// IndexedDB has no such practical ceiling, so book *metadata* (title,
// author, genres, etc.) stays in localStorage as before, while a cover photo
// that came from the camera/library lives here as a Blob, referenced from
// the book by an "idb:<id>" string instead of the raw bytes.
export const IDB_PREFIX = "idb:";

const DB_NAME = "my-bookshelf-images";
const STORE_NAME = "images";
const DB_VERSION = 1;

let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function putImage(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((r) => r.blob());
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Lets an optional add-on (js/cloudImageSync.js's download side) teach
// resolveImageSrc how to handle its own reference prefix, without this
// generic, ported-verbatim-across-apps module needing to import or know
// anything about Cloud Backup/Supabase itself. Registered once at startup
// (see app.js) -- every existing resolveImageSrc call site (book covers,
// search results...) picks up the new prefix automatically, no call-site
// changes needed.
const remoteResolvers = new Map();

export function registerRemoteResolver(prefix, resolve) {
  remoteResolvers.set(prefix, resolve);
}

// Turns whatever a book's `coverImage` field holds into something an <img>
// can actually load: a Blob (a fresh, not-yet-saved upload) becomes an
// object URL directly; an "idb:<id>" reference is looked up and turned into
// an object URL; a prefix registered via registerRemoteResolver is handed
// off to its resolver; anything else (a remote http(s) URL, or a legacy
// inline data: URI from before this store existed) is already usable as-is.
export async function resolveImageSrc(ref) {
  if (!ref) return "";
  if (ref instanceof Blob) return URL.createObjectURL(ref);
  if (typeof ref === "string" && ref.startsWith(IDB_PREFIX)) {
    const blob = await getImage(ref.slice(IDB_PREFIX.length));
    return blob ? URL.createObjectURL(blob) : "";
  }
  if (typeof ref === "string") {
    for (const [prefix, resolve] of remoteResolvers) {
      if (ref.startsWith(prefix)) return (await resolve(ref)) || "";
    }
  }
  return ref;
}
