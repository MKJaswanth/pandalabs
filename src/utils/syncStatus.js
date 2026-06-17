// Lightweight pub/sub that bridges the non-React Firestore subscription
// callbacks (in remoteStorage.js) to React components (the sync-status badge).
// States: 'syncing' | 'synced' | 'offline' | 'error'.
//   syncing — initial workspace load in progress
//   synced  — a Firestore snapshot was received successfully
//   offline — no Firebase / guest / browser offline (local-only)
//   error   — a subscription failed (permission/network)

let status = 'offline'
const listeners = new Set()

export function getSyncStatus() {
  return status
}

export function setSyncStatus(next) {
  if (next === status) return
  status = next
  listeners.forEach((cb) => cb(status))
}

export function subscribeSyncStatus(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
