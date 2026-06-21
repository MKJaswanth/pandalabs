export const compactText = (value) => {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(compactText).filter(Boolean).join(' ')
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export const buildSearchText = (values) =>
  values.map(compactText).filter(Boolean).join(' ').toLowerCase()

export const matchesSearchText = (values, query) => {
  const normalizedQuery = compactText(query).toLowerCase()
  if (!normalizedQuery) return true
  return buildSearchText(values).includes(normalizedQuery)
}

export function sharedStepMatchesSearch(group, query) {
  return matchesSearchText([
    group?.name,
    group?.description,
    group?.steps,
  ], query)
}

export function bugMatchesSearch(bug, query) {
  return matchesSearchText([
    bug?.sourceBugId,
    bug?.id,
    bug?.title,
    bug?.description,
    bug?.module,
    bug?.stepsToReproduce,
    bug?.expected,
    bug?.actual,
    bug?.severity,
    bug?.priority,
    bug?.status,
    bug?.retestStatus,
    bug?.environment,
    bug?.build,
    bug?.fixedInBuild,
    bug?.assignedTo,
    bug?.reportedBy,
    bug?.reportedByName,
    bug?.reportedDate,
    bug?.devRemarks,
    bug?.qaRemarks,
    bug?.tags,
    bug?.evidenceLinks,
  ], query)
}

export function requirementMatchesSearch(requirement, query) {
  return matchesSearchText([
    requirement?.key,
    requirement?.id,
    requirement?.title,
    requirement?.description,
    requirement?.priority,
    requirement?.testCaseIds,
  ], query)
}

export function testRunMatchesSearch(run, query) {
  return matchesSearchText([
    run?.name,
    run?.id,
    run?.build,
    run?.environment,
    run?.executedBy,
    run?.date,
    run?.completedAt,
    run?.notes,
    run?.total,
    run?.passed,
    run?.failed,
    run?.blocker,
    run?.skipped,
    run?.reported,
    run?.needClarification,
    run?.testingInProgress,
    run?.hold,
    run?.pending,
    run?.testPlanId,
    run?.cases,
  ], query)
}

export function activityMatchesSearch(activity, query) {
  return matchesSearchText([
    activity?.title,
    activity?.actorName,
    activity?.userName,
    activity?.details,
    activity?.entityType,
    activity?.entityId,
    activity?.action,
    activity?.projectId,
    activity?.projectName,
    activity?.createdAt,
    activity?.metadata,
  ], query)
}

export function memberMatchesSearch(member, query) {
  return matchesSearchText([
    member?.name,
    member?.email,
    member?.role,
    member?.status,
    member?.id,
  ], query)
}
