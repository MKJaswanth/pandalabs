const STORAGE_LIMIT_CHARS = 5 * 1024 * 1024 // 5 million characters typical limit

export function getQaStorageChars() {
  let total = 0
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('qa_')) {
      total += (localStorage.getItem(key) ?? '').length
    }
  }
  return total
}

export function getStoragePercent() {
  return Math.min(100, Math.round((getQaStorageChars() / STORAGE_LIMIT_CHARS) * 100))
}

// Returns 'ok' | 'warning' (≥80%) | 'critical' (≥95%)
export function getStorageStatus() {
  const pct = getStoragePercent()
  if (pct >= 95) return 'critical'
  if (pct >= 80) return 'warning'
  return 'ok'
}
