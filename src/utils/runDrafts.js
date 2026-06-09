const draftKey = (projectId) => `qa_run_draft_${projectId}`

/**
 * Returns the persisted draft for the given project, or null if none exists.
 * Shape: { runName, build, selectedIds, currentIndex, results,
 *           bugsLogged, loggedBugCaseIds, loggedBugIds, startedAt,
 *           projectId, updatedAt }
 */
export function getRunDraft(projectId) {
  if (!projectId) return null
  try {
    return JSON.parse(localStorage.getItem(draftKey(projectId)) ?? 'null')
  } catch {
    return null
  }
}

/** Persists the in-progress run state so it survives a refresh. */
export function saveRunDraft(projectId, draft) {
  if (!projectId) return
  try {
    localStorage.setItem(
      draftKey(projectId),
      JSON.stringify({ ...draft, projectId, updatedAt: new Date().toISOString() }),
    )
  } catch {
    // localStorage quota exceeded or private-browsing restrictions — silently skip
  }
}

/** Removes the draft after a run is finished or explicitly discarded. */
export function clearRunDraft(projectId) {
  if (!projectId) return
  localStorage.removeItem(draftKey(projectId))
}
