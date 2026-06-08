const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 // 5 MB typical limit

export function getQaStorageBytes() {
  let total = 0
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('qa_')) {
      total += (localStorage.getItem(key) ?? '').length * 2 // UTF-16 ≈ 2 bytes/char
    }
  }
  return total
}

export function getStoragePercent() {
  return Math.min(100, Math.round((getQaStorageBytes() / STORAGE_LIMIT_BYTES) * 100))
}

// Returns 'ok' | 'warning' (≥80%) | 'critical' (≥95%)
export function getStorageStatus() {
  const pct = getStoragePercent()
  if (pct >= 95) return 'critical'
  if (pct >= 80) return 'warning'
  return 'ok'
}
