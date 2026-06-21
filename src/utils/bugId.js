// Canonical bug-ID format: BUG-<2-letter module code>-<zero-padded sequence>
// e.g. BUG-GE-002. Numbering is per module code, so each module has its own
// running sequence. The internal record `id` (uuid) remains the real key used
// for all links/relations — this is only the human-facing display label.

const BUG_ID_RE = /^BUG-[A-Z]{2}-\d+$/

// Two-letter uppercase code derived from a module name. Falls back to "GE"
// (general) when there's no usable module name.
export function moduleCode(moduleName) {
  const alphabetic = (moduleName || '').replace(/[^a-zA-Z]/g, '')
  if (alphabetic.length >= 2) return alphabetic.slice(0, 2).toUpperCase()
  if (alphabetic.length === 1) return (alphabetic + 'X').toUpperCase()
  return 'GE'
}

export function isValidBugId(id) {
  return typeof id === 'string' && BUG_ID_RE.test(id)
}

// Next sequential ID for a module, computed from the highest existing valid ID
// that shares the same module code.
export function nextBugId(moduleName, existingBugs = []) {
  const code = moduleCode(moduleName)
  const re = new RegExp(`^BUG-${code}-(\\d+)$`)
  const max = existingBugs.reduce((highest, bug) => {
    const match = re.exec(bug?.sourceBugId || '')
    return match ? Math.max(highest, parseInt(match[1], 10)) : highest
  }, 0)
  return `BUG-${code}-${String(max + 1).padStart(3, '0')}`
}
