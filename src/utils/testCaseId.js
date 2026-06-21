import { moduleCode } from './bugId'

// Canonical test-case display ID: TC-<2-letter module code>-<zero-padded seq>
// e.g. TC-GE-001. Numbered per module, mirroring the bug ID scheme. The
// internal record `id` (uuid) stays the real key used for all links/relations.

const TC_ID_RE = /^TC-[A-Z]{2}-\d+$/

export function isValidTcId(id) {
  return typeof id === 'string' && TC_ID_RE.test(id)
}

export function nextTcId(moduleName, existing = []) {
  const code = moduleCode(moduleName)
  const re = new RegExp(`^TC-${code}-(\\d+)$`)
  const max = existing.reduce((highest, tc) => {
    const match = re.exec(tc?.sourceTcId || '')
    return match ? Math.max(highest, parseInt(match[1], 10)) : highest
  }, 0)
  return `TC-${code}-${String(max + 1).padStart(3, '0')}`
}

export { moduleCode }
