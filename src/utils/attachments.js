// Attachment file storage backed by IndexedDB (large quota, free, local).
// Only the attachment *metadata* (id/name/type/size) is kept in the synced
// record; the bytes live here so they never bloat Firestore docs or the
// localStorage cache. Trade-off: blobs are per-browser — they don't sync to
// other devices/users (those see metadata only).

const DB_NAME = 'qa-lab-attachments'
const STORE = 'files'
const DB_VERSION = 1

// IndexedDB gives plenty of room; cap per file to keep memory/UX sane.
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// True when IndexedDB is usable in this environment.
export const canStoreFiles = () => typeof indexedDB !== 'undefined'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const request = fn(store)
    transaction.oncomplete = () => { db.close(); resolve(request?.result ?? null) }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

// Persist a File/Blob under the attachment id.
export async function putAttachmentBlob(id, blob) {
  const db = await openDb()
  return tx(db, 'readwrite', (store) => store.put(blob, id))
}

// Returns the stored Blob, or null if it isn't on this device.
export async function getAttachmentBlob(id) {
  try {
    const db = await openDb()
    return await tx(db, 'readonly', (store) => store.get(id))
  } catch {
    return null
  }
}

// Best-effort delete of the blob when an attachment is removed.
export async function deleteAttachmentBlob(id) {
  try {
    const db = await openDb()
    await tx(db, 'readwrite', (store) => store.delete(id))
  } catch {
    // non-fatal — the record is removed regardless
  }
}
