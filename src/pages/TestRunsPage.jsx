import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { EvidenceLinksField } from '../components/EvidenceLinksField'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { CheckIcon, BugIcon, ChevronLeftIcon, ChevronRightIcon, UploadIcon } from '../components/Icons'
import { useUser } from '../context/UserContext'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useAuth } from '../context/useAuth'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useTestCases } from '../hooks/useTestCases'
import { useTestRuns } from '../hooks/useTestRuns'
import { useTestPlans } from '../hooks/useTestPlans'
import { useSharedSteps } from '../hooks/useSharedSteps'
import { historyEntry, withHistory } from '../utils/history'
import { newId } from '../utils/id'
import { clearRunDraft, getRunDraft, saveRunDraft } from '../utils/runDrafts'
import { STATUS_TONE, TEST_STATUSES, summarizeStatuses } from '../utils/status'
import { isFirebaseEnabled, auth } from '../utils/firebase'
import { saveRunDraftRemote, deleteRunDraftRemote, logActivityRemote } from '../utils/remoteStorage'
import { JUnitUploadModal } from '../components/JUnitUploadModal'
import { testRunMatchesSearch } from '../utils/entitySearch'

const BUG_STATUSES = ['Open', 'In review', 'Closed']
const SEVERITIES = ['Critical', 'Major', 'Minor']

function failingModules(cases = []) {
  const counts = cases.reduce((acc, tc) => {
    if (tc.status !== 'Fail' && tc.status !== 'Blocker') return acc
    const module = tc.module || 'Unassigned'
    acc[module] = (acc[module] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
}

function RunSummary({ summary }) {
  const rate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0
  const pending = summary.pending ?? 0
  const executed = summary.total - pending

  const allStats = [
    { label: 'Pass',               count: summary.passed,                 tone: 'passed' },
    { label: 'Fail',               count: summary.failed,                 tone: 'failed' },
    { label: 'Blocker',            count: summary.blocker,                tone: 'blocker' },
    { label: 'Reported',           count: summary.reported ?? 0,          tone: 'reported' },
    { label: 'In Progress',        count: summary.testingInProgress ?? 0, tone: 'inprogress' },
    { label: 'Need Clarification', count: summary.needClarification ?? 0, tone: 'clarification' },
    { label: 'Hold',               count: summary.hold ?? 0,              tone: 'hold' },
    { label: 'Skipped',            count: summary.skipped,                tone: 'skipped' },
    { label: 'Not Executed',       count: pending,                        tone: 'pending' },
  ]

  const alwaysShow = new Set(['passed', 'failed', 'blocker', 'pending'])
  const visibleStats = allStats.filter((s) => s.count > 0 || alwaysShow.has(s.tone))

  return (
    <div className="run-summary">
      <div className="run-summary-hero">
        <span className="run-summary-rate-num">{rate}<span className="run-summary-rate-pct">%</span></span>
        <div className="run-summary-meta">
          <strong>pass rate</strong>
          <span>{executed} / {summary.total} executed</span>
        </div>
      </div>

      <div className="run-stacked-bar">
        {summary.total === 0
          ? <span className="run-stacked-seg run-stacked-seg--pending" style={{ flex: 1 }} />
          : allStats.filter((s) => s.count > 0).map((s) => (
            <span
              key={s.tone}
              className={`run-stacked-seg run-stacked-seg--${s.tone}`}
              style={{ flex: s.count }}
              title={`${s.label}: ${s.count}`}
            />
          ))
        }
      </div>

      <div className="run-stat-rows">
        {visibleStats.map(({ label, count, tone }) => (
          <div key={label} className="run-stat-row">
            <span className={`run-stat-dot run-stat-dot--${tone}`} />
            <span className="run-stat-label">{label}</span>
            <span className={`run-stat-count${count > 0 ? ` status-text--${tone}` : ''}`}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TestRunsPage() {
  const { projectId } = useParams()
  const { user } = useUser()
  const confirm = useConfirm()
  const toast = useToast()
  const { projects } = useProjects()
  const { testCases, updateTestCase } = useTestCases(projectId)
  const { bugs, addBug } = useBugs(projectId)
  const { runs, addRun, refresh } = useTestRuns(projectId)
  const { plans, linkRunToPlan } = useTestPlans(projectId)
  const { sharedSteps } = useSharedSteps(projectId)
  const project = projects.find((p) => p.id === projectId)

  const { firebaseUser } = useAuth()
  const [remoteDrafts, setRemoteDrafts] = useState([])
  const [currentDraftId, setCurrentDraftId] = useState(null)
  const [draftDismissed, setDraftDismissed] = useState(false)

  useEffect(() => {
    if (!isFirebaseEnabled || !firebaseUser || !projectId) return undefined
    let unsubscribe
    import('../utils/remoteStorage').then(({ subscribeRunDrafts }) => {
      unsubscribe = subscribeRunDrafts(projectId, (draftsList) => {
        const active = draftsList.filter(d => !d.deleted && d.status === 'draft')
        setRemoteDrafts(active)
      })
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [projectId, firebaseUser])

  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId)
    setDraftDismissed(false)
  }

  const activeDraft = useMemo(() => {
    if (draftDismissed) return null
    const localDraft = getRunDraft(projectId)
    const remoteDraft = firebaseUser
      ? remoteDrafts.find((d) => d.createdBy === firebaseUser.uid)
      : null
    if (localDraft && remoteDraft) {
      const localTime = new Date(localDraft.updatedAt || 0).getTime()
      const remoteTime = new Date(remoteDraft.updatedAt || 0).getTime()
      return localTime > remoteTime ? localDraft : remoteDraft
    }
    return localDraft || remoteDraft || null
  }, [projectId, firebaseUser, remoteDrafts, draftDismissed])

  const [mode, setMode] = useState('setup')
  const [runName, setRunName] = useState('')
  const [build, setBuild] = useState('')
  const [selectedTestPlanId, setSelectedTestPlanId] = useState('')
  const [linkedRequirementId, setLinkedRequirementId] = useState('')
  const [selectedFilterPlanId, setSelectedFilterPlanId] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => testCases.map((tc) => tc.id))
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeCaseRef = useRef(null)
  const [showJunitModal, setShowJunitModal] = useState(false)

  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const runCasesParam = searchParams.get('runCases')
    const reqKeyParam = searchParams.get('reqKey')
    const reqTitleParam = searchParams.get('reqTitle')
    const reqIdParam = searchParams.get('reqId')

    if (runCasesParam) {
      const caseIds = runCasesParam.split(',').filter(Boolean)
      
      setTimeout(() => {
        setSelectedIds(caseIds)
        if (reqIdParam) setLinkedRequirementId(reqIdParam)
        if (reqKeyParam && reqTitleParam) {
          setRunName(`Run for ${decodeURIComponent(reqKeyParam)}: ${decodeURIComponent(reqTitleParam)}`)
        } else if (reqKeyParam) {
          setRunName(`Run for ${decodeURIComponent(reqKeyParam)}`)
        } else if (reqTitleParam) {
          setRunName(`Run for ${decodeURIComponent(reqTitleParam)}`)
        } else {
          setRunName('Run for Requirement Cases')
        }
        setDraftDismissed(true)
        setMode('setup')
      }, 0)
    }
  }, [location.search])

  useEffect(() => {
    if (activeCaseRef.current) {
      activeCaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentIndex])
  const [results, setResults] = useState({})
  const [savedRun, setSavedRun] = useState(null)
  const [bugForm, setBugForm] = useState(null)
  const [bugsLogged, setBugsLogged] = useState(0)
  // track which case IDs already have a bug logged (to avoid duplicates at finish)
  const [loggedBugCaseIds, setLoggedBugCaseIds] = useState([])
  // track IDs of bugs logged manually during execution
  const [loggedBugIds, setLoggedBugIds] = useState([])
  const [startedAt, setStartedAt] = useState(null)

  // Pagination (recent runs + the case picker) to keep the page from becoming
  // one long scroll when a project has lots of runs or cases.
  const RUN_PAGE_SIZES = [10, 25, 100]
  const [runsPageSize, setRunsPageSize] = useState(10)
  const [runsPage, setRunsPage] = useState(1)
  const [runSearch, setRunSearch] = useState('')
  const [casePageSize, setCasePageSize] = useState(25)
  const [casePage, setCasePage] = useState(1)

  const sortedTestCases = useMemo(
    () => [...testCases].sort((a, b) => {
      const aKey = a.sourceTcId || ''
      const bKey = b.sourceTcId || ''
      if (aKey && bKey) return aKey.localeCompare(bKey, undefined, { numeric: true })
      if (aKey) return -1
      if (bKey) return 1
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    }),
    [testCases],
  )

  const selectedCases = useMemo(
    () => sortedTestCases.filter((tc) => selectedIds.includes(tc.id)),
    [selectedIds, sortedTestCases],
  )
  const currentCase = selectedCases[currentIndex]
  const currentResult = currentCase
    ? results[currentCase.id] ?? { status: currentCase.status ?? 'Not Executed', actual: currentCase.actual ?? '' }
    : null

  const linkedBug = currentResult?.bugId
    ? bugs.find((b) => b.id === currentResult.bugId)
    : null

  const resultItems = selectedCases.map((tc) => ({
    ...tc,
    status: results[tc.id]?.status ?? tc.status ?? 'Not Executed',
  }))
  const liveSummary = summarizeStatuses(resultItems)
  // Recent runs, newest first, searchable and paginated. currentPage is clamped
  const orderedRuns = [...runs].reverse()
  const filteredRuns = orderedRuns.filter((run) => {
    if (selectedFilterPlanId && run.testPlanId !== selectedFilterPlanId) {
      return false
    }
    return testRunMatchesSearch(run, runSearch)
  })
  const totalRuns = filteredRuns.length
  const runsTotalPages = Math.max(1, Math.ceil(totalRuns / runsPageSize))
  const runsCurrentPage = Math.min(runsPage, runsTotalPages)
  const runsStartIndex = (runsCurrentPage - 1) * runsPageSize
  const paginatedRuns = filteredRuns.slice(runsStartIndex, runsStartIndex + runsPageSize)
  const runsStartItem = totalRuns === 0 ? 0 : runsStartIndex + 1
  const runsEndItem = Math.min(runsStartIndex + runsPageSize, totalRuns)

  // Case-picker pagination (run setup). Selection (Select all / Clear / checked
  // ids) still operates on the full list, not just the visible page.
  const caseTotal = sortedTestCases.length
  const caseTotalPages = Math.max(1, Math.ceil(caseTotal / casePageSize))
  const caseCurrentPage = Math.min(casePage, caseTotalPages)
  const caseStartIndex = (caseCurrentPage - 1) * casePageSize
  const paginatedCases = sortedTestCases.slice(caseStartIndex, caseStartIndex + casePageSize)
  const caseStartItem = caseTotal === 0 ? 0 : caseStartIndex + 1
  const caseEndItem = Math.min(caseStartIndex + casePageSize, caseTotal)
  const completedCount = selectedCases.filter((tc) => {
    const status = results[tc.id]?.status ?? tc.status ?? 'Not Executed'
    return status !== 'Not Executed'
  }).length
  const progressPercent = selectedCases.length ? Math.round((completedCount / selectedCases.length) * 100) : 0
  const moduleRisks = failingModules(resultItems)

  // Elapsed time ticker — updates every 30 s while executing
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (mode !== 'execute' || !startedAt) return
    const fmt = () => {
      const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
      if (mins < 1) setElapsed('just started')
      else if (mins < 60) setElapsed(`${mins}m`)
      else { const h = Math.floor(mins / 60); const m = mins % 60; setElapsed(m ? `${h}h ${m}m` : `${h}h`) }
    }
    fmt()
    const id = setInterval(fmt, 30000)
    return () => clearInterval(id)
  }, [mode, startedAt])

  const jumpToNextPending = () => {
    // Search forward from current position first, then wrap around
    const after = selectedCases.findIndex((tc, idx) => {
      if (idx <= currentIndex) return false
      return (results[tc.id]?.status ?? tc.status ?? 'Not Executed') === 'Not Executed'
    })
    if (after !== -1) { setCurrentIndex(after); return }
    const from0 = selectedCases.findIndex((tc) =>
      (results[tc.id]?.status ?? tc.status ?? 'Not Executed') === 'Not Executed',
    )
    if (from0 !== -1) setCurrentIndex(from0)
  }

  const toggleCase = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }

  const startRun = () => {
    const initial = Object.fromEntries(selectedCases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ]))
    const now = new Date().toISOString()
    const newDraftId = newId()
    setCurrentDraftId(newDraftId)
    setResults(initial)
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setLoggedBugCaseIds([])
    setLoggedBugIds([])
    setStartedAt(now)
    setDraftDismissed(true)
    setMode('execute')
    const draftData = {
      id: newDraftId,
      projectId,
      runName,
      build,
      testPlanId: selectedTestPlanId || '',
      linkedRequirementId: linkedRequirementId || '',
      selectedIds,
      currentIndex: 0,
      results: initial,
      bugsLogged: 0,
      loggedBugCaseIds: [],
      loggedBugIds: [],
      startedAt: now,
      status: 'draft',
      createdBy: firebaseUser?.uid || '',
      createdByName: user || '',
      updatedAt: now,
    }
    saveRunDraft(projectId, draftData)
    if (isFirebaseEnabled && firebaseUser) {
      saveRunDraftRemote(projectId, draftData)
      logActivityRemote({
        id: newId(),
        type: 'test_run_started',
        entityType: 'test_run',
        entityId: newDraftId,
        projectId,
        message: `Test run "${runName || 'Unnamed run'}" started`,
      })
    }
  }

  const startRunWithIds = (ids) => {
    setSelectedIds(ids)
    const cases = testCases.filter((tc) => ids.includes(tc.id))
    const initial = Object.fromEntries(cases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ]))
    const now = new Date().toISOString()
    const newDraftId = newId()
    setCurrentDraftId(newDraftId)
    setResults(initial)
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setLoggedBugCaseIds([])
    setLoggedBugIds([])
    setStartedAt(now)
    setDraftDismissed(true)
    setMode('execute')
    const draftData = {
      id: newDraftId,
      projectId,
      runName,
      build,
      testPlanId: selectedTestPlanId || '',
      linkedRequirementId: linkedRequirementId || '',
      selectedIds: ids,
      currentIndex: 0,
      results: initial,
      bugsLogged: 0,
      loggedBugCaseIds: [],
      loggedBugIds: [],
      startedAt: now,
      status: 'draft',
      createdBy: firebaseUser?.uid || '',
      createdByName: user || '',
      updatedAt: now,
    }
    saveRunDraft(projectId, draftData)
    if (isFirebaseEnabled && firebaseUser) {
      saveRunDraftRemote(projectId, draftData)
      logActivityRemote({
        id: newId(),
        type: 'test_run_started',
        entityType: 'test_run',
        entityId: newDraftId,
        projectId,
        message: `Test run "${runName || 'Unnamed run'}" started`,
      })
    }
  }

  const updateCurrent = (patch) => {
    if (!currentCase) return
    const newResult = { ...currentResult, ...patch }
    setResults((prev) => ({ ...prev, [currentCase.id]: newResult }))
    if ('status' in patch && patch.status !== currentCase.status) {
      updateTestCase({
        ...currentCase,
        status: newResult.status,
        updatedAt: new Date().toISOString(),
        updatedBy: user,
      })
    }
  }

  const finishRun = () => {
    const executed = selectedCases.map((tc) => {
      const result = results[tc.id] ?? { status: tc.status ?? 'Not Executed', actual: tc.actual ?? '' }
      updateTestCase(withHistory(
        { ...tc, status: result.status, actual: result.actual, updatedAt: new Date().toISOString(), updatedBy: user },
        historyEntry('execution', user, `Executed in run as ${result.status}`, tc.status, result.status),
      ))
      return {
        testCaseId: tc.id,
        title: tc.title,
        module: tc.module ?? '',
        priority: tc.priority ?? '',
        assignee: tc.assignee ?? '',
        expected: tc.expected ?? '',
        status: result.status,
        actual: result.actual ?? '',
        bugId: result.bugId ?? '',
      }
    })

    const summary = summarizeStatuses(executed)
    const passRate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0
    const runId = newId()

    const autoBugIds = []
    const failedUnlogged = executed.filter(
      (tc) => (tc.status === 'Fail' || tc.status === 'Blocker') && !loggedBugCaseIds.includes(tc.testCaseId),
    )
    for (const tc of failedUnlogged) {
      const bug = addBug({
        title: `${tc.title} failed during test run`,
        description: tc.actual ? `Actual result: ${tc.actual}` : '',
        severity: tc.status === 'Blocker' ? 'Critical' : 'Major',
        status: 'Open',
        linkedTestCase: tc.testCaseId,
        linkedRequirementId: linkedRequirementId || '',
        module: tc.module || '',
        priority: tc.priority || '',
        reportedBy: auth?.currentUser?.uid || '',
        reportedByName: user || '',
        linkedRunId: runId,
        history: [historyEntry('created', user, 'Auto-created from failed test run execution')],
      })
      autoBugIds.push(bug.id)
      const idx = executed.findIndex(item => item.testCaseId === tc.testCaseId)
      if (idx >= 0) {
        executed[idx].bugId = bug.id
      }
    }

    const totalBugsLogged = bugsLogged + autoBugIds.length
    const allLinkedBugIds = [...loggedBugIds, ...autoBugIds]

    const runNameText = runName.trim() || `${project?.name ?? 'Project'} run`
    const run = addRun({
      id: runId,
      name: runNameText,
      build: build.trim() || '',
      executedBy: user ?? '',
      startedAt: startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      testPlanId: selectedTestPlanId || '',
      linkedRequirementId: linkedRequirementId || '',
      cases: executed,
      bugsLogged: totalBugsLogged,
      linkedBugIds: allLinkedBugIds,
      failureModules: failingModules(executed),
      passRate,
      ...summary,
    })

    if (selectedTestPlanId) {
      linkRunToPlan(selectedTestPlanId, run.id)
    }

    clearRunDraft(projectId)
    if (isFirebaseEnabled && firebaseUser && currentDraftId) {
      deleteRunDraftRemote(projectId, currentDraftId)
    }
    setDraftDismissed(true)

    setSavedRun(run)
    setMode('complete')

    if (isFirebaseEnabled && firebaseUser) {
      logActivityRemote({
        id: newId(),
        type: 'test_run_completed',
        entityType: 'test_run',
        entityId: runId,
        projectId,
        message: `Test run "${runNameText}" completed`,
        after: {
          id: runId,
          name: runNameText,
          passRate,
          total: summary.total,
          passed: summary.passed,
          failed: summary.failed,
          blocker: summary.blocker,
        }
      })
    }

    if (autoBugIds.length > 0) {
      toast.info(`Run saved. ${autoBugIds.length} bug${autoBugIds.length !== 1 ? 's' : ''} auto-logged for failed cases.`)
    } else {
      toast.success('Run saved successfully.')
    }
  }

  const openRunBug = () => {
    if (!currentCase) return
    setBugForm({
      title: `${currentCase.title} failed during test run`,
      module: currentCase.module || '',
      linkedTestCase: currentCase.id,
      draftRunId: currentDraftId,
      severity: currentResult?.status === 'Blocker' ? 'Critical' : 'Major',
      status: 'Open',
      description: currentResult?.actual || '',
      expected: currentCase.expected || '',
      evidenceLinks: [],
    })
  }

  const setBug = (key) => (event) => setBugForm((current) => ({ ...current, [key]: event.target.value }))

  const handleRunBug = (event) => {
    event.preventDefault()
    if (!bugForm?.title.trim()) return
    const bug = addBug({
      ...bugForm,
      linkedRequirementId: linkedRequirementId || bugForm.linkedRequirementId || '',
      reportedBy: auth?.currentUser?.uid || '',
      reportedByName: user || '',
      history: [historyEntry('created', user, 'Bug created during test run execution')],
    })
    setBugsLogged((count) => count + 1)
    setLoggedBugCaseIds((ids) => [...ids, currentCase.id])
    setLoggedBugIds((ids) => [...ids, bug.id])
    setResults((prev) => ({
      ...prev,
      [currentCase.id]: {
        ...(prev[currentCase.id] ?? { status: 'Not Executed', actual: '' }),
        bugId: bug.id,
      }
    }))
    setBugForm(null)
    toast.success('Bug logged.')
  }

  // ── Draft: resume ──────────────────────────────────────────────────────────
  const resumeDraft = () => {
    if (!activeDraft) return
    const validIds = (activeDraft.selectedIds ?? []).filter((id) => testCases.some((tc) => tc.id === id))
    if (validIds.length === 0) {
      clearRunDraft(projectId)
      if (isFirebaseEnabled && firebaseUser) {
        deleteRunDraftRemote(projectId, activeDraft.id)
      }
      setDraftDismissed(true)
      toast.warning('All test cases from the saved draft no longer exist. Draft discarded.')
      return
    }
    const safeIndex = Math.min(activeDraft.currentIndex ?? 0, validIds.length - 1)
    setRunName(activeDraft.runName ?? '')
    setBuild(activeDraft.build ?? '')
    setSelectedTestPlanId(activeDraft.testPlanId ?? '')
    setLinkedRequirementId(activeDraft.linkedRequirementId ?? '')
    setSelectedIds(validIds)
    setCurrentIndex(safeIndex)
    setResults(activeDraft.results ?? {})
    setBugsLogged(activeDraft.bugsLogged ?? 0)
    setLoggedBugCaseIds(activeDraft.loggedBugCaseIds ?? [])
    setLoggedBugIds(activeDraft.loggedBugIds ?? [])
    setStartedAt(activeDraft.startedAt ?? new Date().toISOString())
    setCurrentDraftId(activeDraft.id)
    setSavedRun(null)
    setDraftDismissed(true)
    setMode('execute')
    if (isFirebaseEnabled && firebaseUser) {
      logActivityRemote({
        id: newId(),
        type: 'test_run_resumed',
        entityType: 'test_run',
        entityId: activeDraft.id,
        projectId,
        message: `Test run "${activeDraft.runName || 'Unnamed run'}" resumed`,
      })
    }
  }

  // ── Draft: discard ─────────────────────────────────────────────────────────
  const discardDraft = async () => {
    if (!activeDraft) return
    const ok = await confirm({
      title: 'Discard draft?',
      message: 'The saved progress for this test run will be permanently deleted.',
      confirmLabel: 'Discard',
      danger: true,
    })
    if (!ok) return
    clearRunDraft(projectId)
    if (isFirebaseEnabled && firebaseUser) {
      deleteRunDraftRemote(projectId, activeDraft.id)
    }
    setDraftDismissed(true)
    toast.success('Draft discarded.')
  }

  // ── Draft: autosave during execution ───────────────────────────────────────
  useEffect(() => {
    if (mode !== 'execute' || !currentDraftId) return
    const draftData = {
      id: currentDraftId,
      projectId,
      runName,
      build,
      testPlanId: selectedTestPlanId || '',
      linkedRequirementId: linkedRequirementId || '',
      selectedIds,
      currentIndex,
      results,
      bugsLogged,
      loggedBugCaseIds,
      loggedBugIds,
      startedAt,
      status: 'draft',
      createdBy: firebaseUser?.uid || '',
      createdByName: user || '',
      updatedAt: new Date().toISOString(),
    }
    saveRunDraft(projectId, draftData)
    if (isFirebaseEnabled && firebaseUser) {
      saveRunDraftRemote(projectId, draftData)
    }
  }, [mode, projectId, currentDraftId, runName, build, selectedTestPlanId, linkedRequirementId, selectedIds, currentIndex, results, bugsLogged, loggedBugCaseIds, loggedBugIds, startedAt, firebaseUser, user])

  // ── Keyboard shortcuts during execution ────────────────────────────────────
  useEffect(() => {
    if (mode !== 'execute' || bugForm) return
    const handler = (event) => {
      const target = event.target
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      const setShortcutStatus = (status) => {
        if (!currentCase) return
        setResults((prev) => ({
          ...prev,
          [currentCase.id]: {
            ...(prev[currentCase.id] ?? { status: currentCase.status ?? 'Not Executed', actual: currentCase.actual ?? '' }),
            status,
          },
        }))
        if (status !== currentCase.status) {
          updateTestCase({
            ...currentCase,
            status,
            updatedAt: new Date().toISOString(),
            updatedBy: user,
          })
        }
      }
      if (event.key === 'p' || event.key === 'P') setShortcutStatus('Pass')
      if (event.key === 'f' || event.key === 'F') setShortcutStatus('Fail')
      if (event.key === 'b' || event.key === 'B') setShortcutStatus('Blocker')
      if (event.key === 's' || event.key === 'S') setShortcutStatus('Skipped')
      if (event.key === 'r' || event.key === 'R') setShortcutStatus('Reported')
      if (event.key === 'h' || event.key === 'H') setShortcutStatus('Hold')
      if (event.key === 'i' || event.key === 'I') setShortcutStatus('Testing in Progress')
      if (event.key === 'n' || event.key === 'N') setShortcutStatus('Need Clarification')
      if (event.key === 'ArrowRight') setCurrentIndex((index) => Math.min(selectedCases.length - 1, index + 1))
      if (event.key === 'ArrowLeft') setCurrentIndex((index) => Math.max(0, index - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bugForm, currentCase, mode, selectedCases.length, updateTestCase, user])

  // Derive a human-readable draft age string for the banner
  const draftAge = activeDraft?.startedAt
    ? new Date(activeDraft.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  const draftExecutedCount = Object.values(activeDraft?.results ?? {}).filter((r) => r.status !== 'Not Executed').length

  return (
    <>
      <PageHeader
        title="Test runs"
        description="Select test cases, execute them, and save run history for release reporting."
        action={
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowJunitModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <UploadIcon width={14} height={14} />
            Import JUnit XML
          </button>
        }
      />

      {mode === 'setup' && activeDraft && (
        <div className="run-draft-banner">
          <div className="run-draft-banner-text">
            <strong>Unfinished run</strong>
            <span>
              {activeDraft.runName || 'Unnamed run'}
              {draftAge ? ` • started ${draftAge}` : ''}
              {' • '}
              {activeDraft.selectedIds?.length ?? 0} case{(activeDraft.selectedIds?.length ?? 0) !== 1 ? 's' : ''},
              {' '}{draftExecutedCount} executed
            </span>
          </div>
          <button className="secondary-button" type="button" onClick={resumeDraft}>Resume run</button>
          <button className="secondary-button" type="button" onClick={discardDraft}>Discard</button>
        </div>
      )}

      {mode === 'setup' && (
        <section className="panel run-setup">
          <div className="run-config">
            <label>
              Run name
              <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Regression cycle, build smoke..." />
            </label>
            <label>
              Build / version
              <input value={build} onChange={(e) => setBuild(e.target.value)} placeholder="v1.8.0, staging-42..." />
            </label>
            {plans.length > 0 && (
              <label>
                Test plan <span className="hint">(optional)</span>
                <select value={selectedTestPlanId} onChange={(e) => setSelectedTestPlanId(e.target.value)}>
                  <option value="">None</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="section-header">
            <h2>Select cases</h2>
            <div className="run-selection-actions">
              <button className="secondary-button" type="button" onClick={() => setSelectedIds(testCases.map((tc) => tc.id))}>Select all</button>
              <button className="secondary-button" type="button" onClick={() => setSelectedIds([])}>Clear</button>
              <button className="primary-button" type="button" disabled={selectedIds.length === 0} onClick={startRun}>
                Start run ({selectedIds.length})
              </button>
            </div>
          </div>

          {testCases.length === 0 ? (
            <div className="empty-table-row">No test cases available for this project.</div>
          ) : (
            <div className="table-wrap">
              <table className="run-case-picker-table">
                <colgroup>
                  <col className="rcp-col-check" />
                  <col className="rcp-col-id" />
                  <col className="rcp-col-title" />
                  <col className="rcp-col-module" />
                  <col className="rcp-col-priority" />
                  <col className="rcp-col-status" />
                </colgroup>
                <thead>
                  <tr>
                    <th></th>
                    <th>TC ID</th>
                    <th>Title</th>
                    <th>Module</th>
                    <th>Priority</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCases.map((tc) => (
                    <tr key={tc.id}>
                      <td>
                        <input
                          className="row-checkbox"
                          type="checkbox"
                          aria-label={`Select ${tc.title}`}
                          checked={selectedIds.includes(tc.id)}
                          onChange={() => toggleCase(tc.id)}
                        />
                      </td>
                      <td className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</td>
                      <td>{tc.title}</td>
                      <td>{tc.module || '-'}</td>
                      <td>{tc.priority}</td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'pending'}`}
                          value={tc.status}
                          aria-label={`Status for ${tc.title}`}
                          onChange={(e) => updateTestCase(withHistory(
                            { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                            historyEntry('status', user, `Status changed to ${e.target.value}`, tc.status, e.target.value),
                          ))}
                        >
                          {TEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {caseTotal > 0 && (
            <div className="table-pagination" aria-label="Case pagination">
              <div className="rows-per-page">
                <span>Rows</span>
                <select
                  aria-label="Rows per page"
                  value={casePageSize}
                  onChange={(e) => {
                    setCasePageSize(Number(e.target.value))
                    setCasePage(1)
                  }}
                >
                  {RUN_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
              <span className="pagination-summary">
                {caseStartItem}-{caseEndItem} of {caseTotal}
              </span>
              <div className="pagination-actions">
                <button
                  className="secondary-button icon-button"
                  type="button"
                  aria-label="Previous page"
                  disabled={caseCurrentPage === 1}
                  onClick={() => setCasePage(Math.max(1, caseCurrentPage - 1))}
                >
                  <ChevronLeftIcon width={14} height={14} />
                </button>
                <span className="page-indicator">{caseCurrentPage} / {caseTotalPages}</span>
                <button
                  className="secondary-button icon-button"
                  type="button"
                  aria-label="Next page"
                  disabled={caseCurrentPage === caseTotalPages}
                  onClick={() => setCasePage(Math.min(caseTotalPages, caseCurrentPage + 1))}
                >
                  <ChevronRightIcon width={14} height={14} />
                </button>
              </div>
            </div>
          )}
          <div className="mobile-card-list">
            {paginatedCases.map((tc) => (
              <div className="mobile-card" key={tc.id}>
                <div className="mobile-card-header">
                  <label className="mobile-card-select-label">
                    <input
                      className="row-checkbox"
                      type="checkbox"
                      aria-label={`Select ${tc.title}`}
                      checked={selectedIds.includes(tc.id)}
                      onChange={() => toggleCase(tc.id)}
                    />
                    <span className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</span>
                  </label>
                  <div className="mobile-card-header-badges">
                    <span className={`priority-badge priority-${tc.priority?.toLowerCase()}`}>{tc.priority}</span>
                    <select
                      className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'neutral'}`}
                      value={tc.status}
                      aria-label={`Status for ${tc.title}`}
                      onChange={(e) => updateTestCase(withHistory(
                        { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                        historyEntry('status', user, `Status changed to ${e.target.value}`, tc.status, e.target.value),
                      ))}
                    >
                      {TEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <h3 className="mobile-card-title">{tc.title}</h3>
                <div className="mobile-card-details">
                  <div>
                    <span>Module:</span>
                    <strong>{tc.module || '—'}</strong>
                  </div>
                  <div>
                    <span>Assignee:</span>
                    <strong>{tc.assignee || '—'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {mode === 'execute' && selectedCases.length === 0 && (
        <section className="panel" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <p className="muted-text">No test cases available for this run. They may have been deleted.</p>
          <button className="secondary-button" type="button" style={{ marginTop: 12 }} onClick={() => { clearRunDraft(projectId); setMode('setup') }}>
            Back to setup
          </button>
        </section>
      )}

      {mode === 'execute' && currentCase && (
        <div className="run-execution-layout">
          <section className="panel run-case-panel">
            <div className="run-progress-row">
              <span>Case {currentIndex + 1} of {selectedCases.length}</span>
              <strong>{progressPercent}% executed</strong>
              <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            </div>
            <div className="run-current-id">
              <span className="mono">{currentCase.sourceTcId || currentCase.id.slice(0, 8).toUpperCase()}</span>
              <span className={`status-pill status-pill--${STATUS_TONE[currentResult.status] ?? 'pending'}`}>{currentResult.status}</span>
            </div>
            <h2>{currentCase.title}</h2>
            <dl className="run-case-meta">
              <div><dt>Module</dt><dd>{currentCase.module || '-'}</dd></div>
              <div><dt>Priority</dt><dd>{currentCase.priority}</dd></div>
              <div><dt>Assignee</dt><dd>{currentCase.assignee || '-'}</dd></div>
            </dl>

            <div className="run-case-block">
              <h3>Steps</h3>
              {currentCase.steps?.length ? (
                <ol className="step-list">
                  {currentCase.steps.map((step, index) => {
                    const isSharedRef = typeof step === 'string' && step.startsWith('shared_step_group:')
                    if (isSharedRef) {
                      const groupId = step.split(':')[1]
                      const group = sharedSteps.find((g) => g.id === groupId)
                      return (
                        <li key={`${step}-${index}`} className="shared-step-display-item">
                          <div className="shared-step-display-header">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--primary-color, #1a73e8)' }}>
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <strong>{group ? group.name : 'Deleted Shared Step Group'}</strong>
                            <span className="shared-badge">Shared block</span>
                          </div>
                          {group?.steps && (
                            <ol className="shared-step-display-list">
                              {group.steps.map((nested, nIdx) => (
                                <li key={nIdx}>{nested}</li>
                              ))}
                            </ol>
                          )}
                        </li>
                      )
                    }
                    return <li key={`${step}-${index}`}>{step}</li>
                  })}
                </ol>
              ) : <p className="muted-text">No steps recorded.</p>}
            </div>

            <div className="run-case-block">
              <h3>Expected result</h3>
              <p>{currentCase.expected || '-'}</p>
            </div>

            <label className="run-actual-field">
              Actual result
              <textarea
                rows={4}
                value={currentResult.actual}
                onChange={(e) => updateCurrent({ actual: e.target.value })}
                placeholder="What happened during execution?"
              />
            </label>

            {linkedBug && (
              <div className="linked-bug-banner" style={{ marginTop: 12, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fee2e2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: '13px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BugIcon width={14} height={14} />
                  Linked Bug: <strong>{linkedBug.sourceBugId || linkedBug.id.slice(0, 8).toUpperCase()} - {linkedBug.title}</strong>
                </span>
                <Link to={`/projects/${projectId}/bugs`} className="text-link" style={{ fontSize: '13px' }}>
                  View tracker →
                </Link>
              </div>
            )}

            <div className="run-status-actions" aria-label="Execution status">
              {TEST_STATUSES.filter((s) => s !== 'Not Executed').map((status) => (
                <button
                  key={status}
                  className={`status-choice status-choice--${STATUS_TONE[status]}${currentResult.status === status ? ' active' : ''}`}
                  type="button"
                  onClick={() => updateCurrent({ status })}
                >
                  {status}
                </button>
              ))}
              {currentResult?.bugId ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <span className="status-pill status-pill--failed" style={{ fontSize: '12px', minHeight: 28, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>Bug linked</span>
                  <button className="secondary-button" type="button" onClick={() => {
                    setResults((prev) => ({
                      ...prev,
                      [currentCase.id]: {
                        ...prev[currentCase.id],
                        bugId: undefined,
                      }
                    }))
                    setTimeout(() => {
                      openRunBug()
                    }, 0)
                  }}>
                    Create another
                  </button>
                </div>
              ) : (
                <button className="secondary-button" type="button" onClick={openRunBug}>
                  + Log bug
                </button>
              )}
            </div>
            <div className="shortcut-hints" aria-label="Keyboard shortcuts">
              <span>P Pass</span>
              <span>F Fail</span>
              <span>B Blocker</span>
              <span>S Skip</span>
              <span>R Reported</span>
              <span>H Hold</span>
              <span>I In Progress</span>
              <span>N Need Clarification</span>
              <span>← → navigate</span>
            </div>

            <div className="run-nav-actions">
              <button className="secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                Previous
              </button>
              {currentIndex < selectedCases.length - 1 ? (
                <button className="primary-button" type="button" onClick={() => setCurrentIndex((i) => i + 1)}>
                  Next case
                </button>
              ) : (
                <button className="primary-button" type="button" onClick={finishRun}>
                  Finish run
                </button>
              )}
            </div>
          </section>

          <aside className="panel run-side-panel">
            <div className="run-side-header">
              <h2>Live summary</h2>
              <button className="run-jump-btn" type="button" onClick={jumpToNextPending} title="Jump to next unexecuted case">
                Next pending ↓
              </button>
            </div>
            {elapsed && (
              <div className="run-elapsed">
                <span>Elapsed</span>
                <strong>{elapsed}</strong>
              </div>
            )}
            <RunSummary summary={liveSummary} />
            <div className="run-side-section">
              <h3>At-risk modules</h3>
              {moduleRisks.length ? (
                moduleRisks.slice(0, 4).map((item) => (
                  <div className="run-module-risk" key={item.module}>
                    <span>{item.module}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-text">No failures yet.</p>
              )}
            </div>
            <div className="run-side-section">
              <h3>Cases</h3>
              <div className="run-case-list">
                {selectedCases.map((tc, index) => {
                  const status = results[tc.id]?.status ?? tc.status ?? 'Not Executed'
                  return (
                    <button
                      key={tc.id}
                      ref={index === currentIndex ? activeCaseRef : null}
                      type="button"
                      className={index === currentIndex ? 'active' : ''}
                      onClick={() => setCurrentIndex(index)}
                    >
                      <span>{index + 1}. {tc.title}</span>
                      <strong className={`status-text--${STATUS_TONE[status] ?? 'pending'}`}>{status}</strong>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {bugForm && currentCase && (
        <Modal title="Log bug during run" onClose={() => setBugForm(null)}>
          <form className="modal-form" onSubmit={handleRunBug}>
            <label>
              Title <span className="required">*</span>
              <input autoFocus value={bugForm.title} onChange={setBug('title')} placeholder="Describe the defect" />
            </label>
            <label>
              Description
              <textarea rows={3} value={bugForm.description} onChange={setBug('description')} placeholder="Steps to reproduce, environment, notes..." />
            </label>
            <div className="form-row">
              <label>
                Severity
                <select value={bugForm.severity} onChange={setBug('severity')}>
                  {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={bugForm.status} onChange={setBug('status')}>
                  {BUG_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <label>
              Linked test case
              <input value={currentCase.title} disabled className="input-disabled" />
            </label>
            <div>
              <label>Evidence links</label>
              <EvidenceLinksField
                evidenceLinks={bugForm.evidenceLinks || []}
                onChange={(evidenceLinks) => setBugForm((prev) => ({ ...prev, evidenceLinks }))}
                currentUser={user}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setBugForm(null)}>Cancel</button>
              <button type="submit" className="primary-button">Log bug</button>
            </div>
          </form>
        </Modal>
      )}

      {mode === 'complete' && savedRun && (
        <section className="panel run-complete-panel">
          <span className="run-complete-mark"><CheckIcon width={24} height={24} /></span>
          <h2>Run saved</h2>
          <p>{savedRun.name} was saved to test run history and the latest test case statuses were updated.</p>
          <RunSummary summary={savedRun} />
          {savedRun.failureModules?.length > 0 && (
            <div className="run-complete-insights">
              <h3>Needs attention</h3>
              <div className="run-complete-insight-list">
                {savedRun.failureModules.slice(0, 4).map((item) => (
                  <span key={item.module} className="run-insight-chip">
                    <strong>{item.module}</strong>: {item.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="run-nav-actions">
            <button className="secondary-button" type="button" onClick={() => setMode('setup')}>Start another run</button>
            <button
              className="secondary-button"
              type="button"
              disabled={!savedRun.cases?.some((tc) => tc.status === 'Fail' || tc.status === 'Blocker')}
              onClick={() => startRunWithIds(savedRun.cases.filter((tc) => tc.status === 'Fail' || tc.status === 'Blocker').map((tc) => tc.testCaseId))}
            >
              Rerun failed only
            </button>
            <Link to={`/projects/${projectId}/test-runs/${savedRun.id}`} className="primary-button" style={{ textDecoration: 'none' }}>
              View run details
            </Link>
          </div>
        </section>
      )}

      {mode === 'setup' && orderedRuns.length > 0 && (
        <section className="panel">
          <div className="section-header">
            <h2>Recent runs</h2>
            <span className="section-count">{totalRuns} of {orderedRuns.length}</span>
          </div>
          <div className="toolbar run-history-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={runSearch}
              onChange={(e) => {
                setRunSearch(e.target.value)
                setRunsPage(1)
              }}
              placeholder="Search runs..."
              aria-label="Search test runs"
              style={{ flex: '1 1 200px' }}
            />
            {plans.length > 0 && (
              <select
                value={selectedFilterPlanId}
                onChange={(e) => {
                  setSelectedFilterPlanId(e.target.value)
                  setRunsPage(1)
                }}
                aria-label="Filter runs by test plan"
                className={selectedFilterPlanId ? 'filter-active' : ''}
              >
                <option value="">All test plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <span className="toolbar-info" style={{ flex: '1 1 100%' }}>
              Search by run name, build, owner, date, or result count.
            </span>
          </div>
          <div className="table-wrap">
            <table className="run-list-table">
              <colgroup>
                <col className="rl-col-date" />
                <col className="rl-col-name" />
                <col className="rl-col-num" />
                <col className="rl-col-num" />
                <col className="rl-col-num" />
                <col className="rl-col-num" />
                <col className="rl-col-by" />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th className="rl-num">Total</th>
                  <th className="rl-num">Pass</th>
                  <th className="rl-num">Fail</th>
                  <th className="rl-num">Blocker</th>
                  <th>Executed by</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRuns.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <span className="empty-table-message">No runs match your search.</span>
                    </td>
                  </tr>
                ) : paginatedRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.completedAt || run.date).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Link to={`/projects/${projectId}/test-runs/${run.id}`} className="text-link">
                          {run.name || 'Test run'}
                        </Link>
                        {run.testPlanId && (
                          <span className="text-muted" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-color, #2563eb)' }}></span>
                            Plan: {plans.find(p => p.id === run.testPlanId)?.name || 'Unknown'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="rl-num">{run.total}</td>
                    <td className="rl-num metric-passed">{run.passed}</td>
                    <td className="rl-num metric-failed">{run.failed}</td>
                    <td className="rl-num">{run.blocker ?? 0}</td>
                    <td>{run.executedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {paginatedRuns.length === 0 ? (
              <article className="mobile-card">
                <h3 className="mobile-card-title">No runs found</h3>
                <p className="muted-text">Try a different run name, build, owner, or date.</p>
              </article>
            ) : paginatedRuns.map((run) => {
              const rate = run.total ? Math.round((run.passed / run.total) * 100) : 0
              const tone = rate >= 70 ? 'passed' : rate >= 50 ? 'pending' : 'failed'
              return (
                <article className="mobile-card" key={run.id}>
                  <div className="mobile-card-header">
                    <span className="mono tc-id">{new Date(run.completedAt || run.date).toLocaleString()}</span>
                    <div className="mobile-card-header-badges">
                      <span className={`status-pill status-pill--${tone}`}>{rate}% pass</span>
                    </div>
                  </div>
                  <h3 className="mobile-card-title">
                    <Link to={`/projects/${projectId}/test-runs/${run.id}`}>{run.name || 'Test run'}</Link>
                    {run.testPlanId && (
                      <span className="text-muted" style={{ fontSize: '11px', display: 'block', marginTop: '4px', fontWeight: 'normal' }}>
                        Plan: {plans.find(p => p.id === run.testPlanId)?.name || 'Unknown'}
                      </span>
                    )}
                  </h3>
                  <div className="mobile-card-details">
                    <div>
                      <span>Total:</span>
                      <strong>{run.total}</strong>
                    </div>
                    <div>
                      <span>Passed:</span>
                      <strong className="metric-passed">{run.passed}</strong>
                    </div>
                    <div>
                      <span>Failed:</span>
                      <strong className="metric-failed">{run.failed}</strong>
                    </div>
                    <div>
                      <span>Blocked:</span>
                      <strong>{run.blocker ?? 0}</strong>
                    </div>
                    <div>
                      <span>Executed by:</span>
                      <strong>{run.executedBy || '—'}</strong>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="table-pagination" aria-label="Run pagination">
            <div className="rows-per-page">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={runsPageSize}
                onChange={(e) => {
                  setRunsPageSize(Number(e.target.value))
                  setRunsPage(1)
                }}
              >
                {RUN_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <span className="pagination-summary">
              {runsStartItem}-{runsEndItem} of {totalRuns}
            </span>
            <div className="pagination-actions">
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Previous page"
                disabled={runsCurrentPage === 1}
                onClick={() => setRunsPage(Math.max(1, runsCurrentPage - 1))}
              >
                <ChevronLeftIcon width={14} height={14} />
              </button>
              <span className="page-indicator">{runsCurrentPage} / {runsTotalPages}</span>
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Next page"
                disabled={runsCurrentPage === runsTotalPages}
                onClick={() => setRunsPage(Math.min(runsTotalPages, runsCurrentPage + 1))}
              >
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          </div>
        </section>
      )}
      {showJunitModal && (
        <JUnitUploadModal
          isOpen={showJunitModal}
          onClose={() => {
            setShowJunitModal(false)
            refresh()
          }}
          projectId={projectId}
          testCases={testCases}
          addRun={addRun}
          updateTestCase={updateTestCase}
          addBug={addBug}
          plans={plans}
          user={user}
        />
      )}
    </>
  )
}
