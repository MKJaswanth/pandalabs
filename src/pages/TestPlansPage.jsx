import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { Modal } from '../components/Modal'
import { useTestPlans } from '../hooks/useTestPlans'
import { useMilestones } from '../hooks/useMilestones'
import { useTestRuns } from '../hooks/useTestRuns'
import { useBugs } from '../hooks/useBugs'
import { useRequirements } from '../hooks/useRequirements'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { PencilIcon, XIcon } from '../components/Icons'
import { getPlanMetrics, getMilestoneMetrics } from '../utils/planMetrics'

const PLAN_STATUSES = ['Open', 'Completed']
const MILESTONE_STATUSES = ['Open', 'Completed']

const blankPlan = () => ({ name: '', description: '', requirementIds: [], milestoneId: '', status: 'Open' })
const blankMilestone = () => ({ name: '', description: '', dueDate: '', testPlanIds: [], status: 'Open' })

export function TestPlansPage() {
  const { projectId } = useParams()
  const { plans, addPlan, updatePlan, removePlan } = useTestPlans(projectId)
  const { milestones, addMilestone, updateMilestone, removeMilestone } = useMilestones(projectId)
  const { runs } = useTestRuns(projectId)
  const { bugs } = useBugs(projectId)
  const { requirements } = useRequirements(projectId)
  const confirm = useConfirm()
  const toast = useToast()

  const [tab, setTab] = useState('plans')
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [planForm, setPlanForm] = useState(blankPlan())
  const [milestoneForm, setMilestoneForm] = useState(blankMilestone())

  const planRows = useMemo(() =>
    [...plans]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((plan) => ({ plan, metrics: getPlanMetrics(plan, runs) })),
  [plans, runs])

  const milestoneRows = useMemo(() =>
    [...milestones]
      .sort((a, b) => {
        const aDue = a.dueDate || '9999'
        const bDue = b.dueDate || '9999'
        return aDue.localeCompare(bDue)
      })
      .map((milestone) => ({ milestone, metrics: getMilestoneMetrics(milestone, plans, runs) })),
  [milestones, plans, runs])

  const setPlan = (k) => (e) => setPlanForm((f) => ({ ...f, [k]: e.target.value }))
  const setMilestone = (k) => (e) => setMilestoneForm((f) => ({ ...f, [k]: e.target.value }))

  const togglePlanRequirement = (reqId) => setPlanForm((f) => ({
    ...f,
    requirementIds: f.requirementIds.includes(reqId)
      ? f.requirementIds.filter((id) => id !== reqId)
      : [...f.requirementIds, reqId],
  }))

  const toggleMilestonePlan = (planId) => setMilestoneForm((f) => ({
    ...f,
    testPlanIds: f.testPlanIds.includes(planId) ? f.testPlanIds.filter((id) => id !== planId) : [...f.testPlanIds, planId],
  }))

  const openAddPlan = () => { setEditingPlan(null); setPlanForm(blankPlan()); setShowPlanForm(true) }
  const openEditPlan = (plan) => {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      requirementIds: plan.requirementIds || [],
      milestoneId: plan.milestoneId || '',
      status: plan.status || 'Open',
    })
    setShowPlanForm(true)
  }

  const openAddMilestone = () => { setEditingMilestone(null); setMilestoneForm(blankMilestone()); setShowMilestoneForm(true) }
  const openEditMilestone = (milestone) => {
    setEditingMilestone(milestone)
    const linkedPlanIds = plans.filter((p) => p.milestoneId === milestone.id).map((p) => p.id)
    setMilestoneForm({
      name: milestone.name || '',
      description: milestone.description || '',
      dueDate: milestone.dueDate || '',
      testPlanIds: [...new Set([...(milestone.testPlanIds || []), ...linkedPlanIds])],
      status: milestone.status || 'Open',
    })
    setShowMilestoneForm(true)
  }

  const submitPlan = (e) => {
    e.preventDefault()
    if (!planForm.name.trim()) return
    const payload = { ...planForm, name: planForm.name.trim() }
    if (editingPlan) {
      updatePlan({ ...editingPlan, ...payload })
      toast.success('Test plan updated')
    } else {
      addPlan(payload)
      toast.success('Test plan created')
    }
    setShowPlanForm(false)
  }

  const submitMilestone = (e) => {
    e.preventDefault()
    if (!milestoneForm.name.trim()) return
    const payload = { ...milestoneForm, name: milestoneForm.name.trim() }
    if (editingMilestone) {
      updateMilestone({ ...editingMilestone, ...payload })
      toast.success('Milestone updated')
    } else {
      addMilestone(payload)
      toast.success('Milestone created')
    }
    setShowMilestoneForm(false)
  }

  const handleDeletePlan = async (plan) => {
    const ok = await confirm({
      title: 'Delete test plan?',
      message: `"${plan.name}" will be removed. Linked runs are not deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) { removePlan(plan.id); toast.success('Test plan deleted') }
  }

  const handleDeleteMilestone = async (milestone) => {
    const ok = await confirm({
      title: 'Delete milestone?',
      message: `"${milestone.name}" will be removed.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) { removeMilestone(milestone.id); toast.success('Milestone deleted') }
  }

  if (selectedPlanId) {
    const planObj = plans.find(p => p.id === selectedPlanId)
    if (!planObj) {
      setSelectedPlanId(null)
      return null
    }
    const metrics = getPlanMetrics(planObj, runs)
    const planBugs = bugs.filter(b => metrics.linkedRuns.some(r => r.linkedBugIds?.includes(b.id)))
    const planReqs = requirements.filter((r) => (planObj.requirementIds || []).includes(r.id))

    return (
      <>
        <PageHeader
          title={`Test Plan: ${planObj.name}`}
          description="Test plan execution progress, associated runs, and logged bugs."
          action={
            <div className="page-actions-row">
              <button className="secondary-button" type="button" onClick={() => setSelectedPlanId(null)}>Back to list</button>
              <button className="primary-button" type="button" onClick={() => openEditPlan(planObj)}>Edit plan</button>
            </div>
          }
        />

        <section className="panel req-detail-page">
          <div className="req-detail-header">
            <div>
              <span className="mono tc-id">TEST PLAN</span>
              <h2>{planObj.name}</h2>
              {planObj.description && <p className="req-detail-desc">{planObj.description}</p>}
            </div>
            <StatusPill tone={planObj.status === 'Completed' ? 'passed' : 'pending'}>{planObj.status || 'Open'}</StatusPill>
          </div>

          <div className="req-detail-meta">
            <div><span>Total runs</span><strong>{metrics.totalRuns}</strong></div>
            <div><span>Completed</span><strong>{metrics.completedRuns}</strong></div>
            <div><span>Total cases</span><strong>{metrics.totalCases}</strong></div>
            <div><span>Passed cases</span><strong>{metrics.passedCases}</strong></div>
            <div><span>Pass rate</span><strong>{metrics.passRate}%</strong></div>
          </div>

          <div className="req-progress-cell req-detail-progress">
            <div className="req-progress-track">
              <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
            </div>
            <span className="req-progress-pct">{metrics.progressPct}% Run Completion</span>
          </div>

          <div className="section-header req-detail-section-head">
            <h2>Scope: Linked requirements</h2>
            <StatusPill tone="neutral">{planReqs.length}</StatusPill>
          </div>

          {planReqs.length === 0 ? (
            <div className="req-detail-empty">
              <p>No requirements are linked to this plan yet. Edit the plan to define its scope.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Title</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {planReqs.map((req) => (
                    <tr key={req.id}>
                      <td className="mono tc-id">{req.key || '—'}</td>
                      <td>
                        <Link className="text-link" to={`/projects/${projectId}/requirements/${req.id}`}>
                          {req.title}
                        </Link>
                      </td>
                      <td>{req.priority || 'Medium'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="section-header req-detail-section-head" style={{ marginTop: 24 }}>
            <h2>Associated test runs</h2>
            <StatusPill tone="neutral">{metrics.totalRuns}</StatusPill>
          </div>

          {metrics.linkedRuns.length === 0 ? (
            <div className="req-detail-empty">
              <p>No test runs are linked to this plan yet. Edit the plan to associate runs.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Name</th>
                    <th>Build</th>
                    <th>Pass Rate</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.linkedRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="mono tc-id">{run.id.slice(0, 8).toUpperCase()}</td>
                      <td>
                        <Link className="text-link" to={`/projects/${projectId}/test-runs/${run.id}`}>
                          {run.name || 'Untitled run'}
                        </Link>
                      </td>
                      <td>{run.build || '—'}</td>
                      <td>{run.passRate ?? 0}%</td>
                      <td>
                        <StatusPill tone={run.completedAt ? 'passed' : 'pending'}>
                          {run.completedAt ? 'Completed' : 'In progress'}
                        </StatusPill>
                      </td>
                      <td>{new Date(run.completedAt || run.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="section-header req-detail-section-head" style={{ marginTop: 24 }}>
            <h2>Logged bugs</h2>
            <StatusPill tone="neutral">{planBugs.length}</StatusPill>
          </div>

          {planBugs.length === 0 ? (
            <div className="req-detail-empty">
              <p>No bugs have been logged in the runs associated with this plan.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Bug ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {planBugs.map((bug) => (
                    <tr key={bug.id}>
                      <td className="mono tc-id">{bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()}</td>
                      <td>
                        <Link className="text-link" to={`/projects/${projectId}/bugs`}>
                          {bug.title}
                        </Link>
                      </td>
                      <td>{bug.severity || '—'}</td>
                      <td>
                        <StatusPill tone={bug.status === 'Closed' ? 'passed' : 'failed'}>
                          {bug.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showPlanForm && (
          <Modal title={editingPlan ? 'Edit test plan' : 'New test plan'} onClose={() => setShowPlanForm(false)} style={{ maxWidth: 560 }}>
            <form className="modal-form" onSubmit={submitPlan}>
              <label>
                Name <span className="required">*</span>
                <input autoFocus value={planForm.name} onChange={setPlan('name')} placeholder="v1.2 Regression" />
              </label>
              <label>
                Description
                <textarea rows={2} value={planForm.description} onChange={setPlan('description')} placeholder="Full regression for release 1.2" />
              </label>
              <div className="form-row">
                <label>
                  Status
                  <select value={planForm.status} onChange={setPlan('status')}>
                    {PLAN_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Milestone
                  <select value={planForm.milestoneId} onChange={setPlan('milestoneId')}>
                    <option value="">None</option>
                    {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <label>Linked requirements <span className="hint">({(planForm.requirementIds || []).length} selected)</span></label>
                <div className="req-tc-picker" style={{ maxHeight: 200 }}>
                  {requirements.length === 0 ? (
                    <p className="panel-empty-text">No requirements yet. Create a requirement first.</p>
                  ) : (
                    requirements.map((req) => (
                      <label key={req.id} className="req-tc-option">
                        <input
                          className="row-checkbox"
                          type="checkbox"
                          checked={(planForm.requirementIds || []).includes(req.id)}
                          onChange={() => togglePlanRequirement(req.id)}
                        />
                        <span className="req-tc-title">{req.key ? `${req.key}: ` : ''}{req.title}</span>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {req.priority || 'Medium'}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setShowPlanForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={!planForm.name.trim()}>
                  {editingPlan ? 'Save' : 'Create plan'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </>
    )
  }

  if (selectedMilestoneId) {
    const milestoneObj = milestones.find(m => m.id === selectedMilestoneId)
    if (!milestoneObj) {
      setSelectedMilestoneId(null)
      return null
    }
    const metrics = getMilestoneMetrics(milestoneObj, plans, runs)

    return (
      <>
        <PageHeader
          title={`Milestone: ${milestoneObj.name}`}
          description="Milestone status, linked test plans, and release readiness tracker."
          action={
            <div className="page-actions-row">
              <button className="secondary-button" type="button" onClick={() => setSelectedMilestoneId(null)}>Back to list</button>
              <button className="primary-button" type="button" onClick={() => openEditMilestone(milestoneObj)}>Edit milestone</button>
            </div>
          }
        />

        <section className="panel req-detail-page">
          <div className="req-detail-header">
            <div>
              <span className="mono tc-id">MILESTONE</span>
              <h2>{milestoneObj.name}</h2>
              {milestoneObj.description && <p className="req-detail-desc">{milestoneObj.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <StatusPill tone={metrics.onTrack ? 'passed' : 'failed'}>{metrics.onTrack ? 'On track' : 'At risk'}</StatusPill>
              <StatusPill tone={milestoneObj.status === 'Completed' ? 'passed' : 'pending'}>{milestoneObj.status || 'Open'}</StatusPill>
            </div>
          </div>

          <div className="req-detail-meta">
            <div>
              <span>Due date</span>
              <strong>
                {milestoneObj.dueDate ? new Date(milestoneObj.dueDate).toLocaleDateString() : '—'}
                {metrics.overdue && <span className="text-danger" style={{ marginLeft: 6, fontSize: 12 }}>(Overdue)</span>}
              </strong>
            </div>
            <div><span>Linked plans</span><strong>{metrics.totalPlans}</strong></div>
            <div><span>Total runs</span><strong>{metrics.totalRuns}</strong></div>
            <div><span>Total cases</span><strong>{metrics.totalCases}</strong></div>
            <div><span>Pass rate</span><strong>{metrics.passRate}%</strong></div>
          </div>

          <div className="req-progress-cell req-detail-progress">
            <div className="req-progress-track">
              <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
            </div>
            <span className="req-progress-pct">{metrics.progressPct}% Run Completion</span>
          </div>

          <div className="section-header req-detail-section-head">
            <h2>Linked test plans</h2>
            <StatusPill tone="neutral">{metrics.totalPlans}</StatusPill>
          </div>

          {metrics.linkedPlans.length === 0 ? (
            <div className="req-detail-empty">
              <p>No test plans are linked to this milestone yet. Edit the milestone to associate plans.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Plan ID</th>
                    <th>Name</th>
                    <th>Runs</th>
                    <th>Pass Rate</th>
                    <th>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.linkedPlans.map((plan) => {
                    const planMetrics = getPlanMetrics(plan, runs)
                    return (
                      <tr key={plan.id}>
                        <td className="mono tc-id">{plan.id.slice(0, 8).toUpperCase()}</td>
                        <td>
                          <button className="link-btn" type="button" onClick={() => { setSelectedPlanId(plan.id); setSelectedMilestoneId(null); }}>
                            {plan.name}
                          </button>
                        </td>
                        <td>{planMetrics.totalRuns}</td>
                        <td>{planMetrics.passRate}%</td>
                        <td>
                          <div className="req-progress-cell">
                            <div className="req-progress-track">
                              <span className="req-progress-fill" style={{ width: `${planMetrics.progressPct}%` }} />
                            </div>
                            <span className="req-progress-pct">{planMetrics.progressPct}%</span>
                          </div>
                        </td>
                        <td>
                          <StatusPill tone={plan.status === 'Completed' ? 'passed' : 'pending'}>
                            {plan.status || 'Open'}
                          </StatusPill>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showMilestoneForm && (
          <Modal title={editingMilestone ? 'Edit milestone' : 'New milestone'} onClose={() => setShowMilestoneForm(false)} style={{ maxWidth: 560 }}>
            <form className="modal-form" onSubmit={submitMilestone}>
              <label>
                Name <span className="required">*</span>
                <input autoFocus value={milestoneForm.name} onChange={setMilestone('name')} placeholder="Release 1.2" />
              </label>
              <label>
                Description
                <textarea rows={2} value={milestoneForm.description} onChange={setMilestone('description')} />
              </label>
              <div className="form-row">
                <label>
                  Due date
                  <input type="date" value={milestoneForm.dueDate} onChange={setMilestone('dueDate')} />
                </label>
                <label>
                  Status
                  <select value={milestoneForm.status} onChange={setMilestone('status')}>
                    {MILESTONE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <label>Linked test plans <span className="hint">({milestoneForm.testPlanIds.length} selected)</span></label>
                <div className="req-tc-picker" style={{ maxHeight: 200 }}>
                  {plans.length === 0 ? (
                    <p className="panel-empty-text">No test plans yet.</p>
                  ) : (
                    plans.map((plan) => (
                      <label key={plan.id} className="req-tc-option">
                        <input
                          className="row-checkbox"
                          type="checkbox"
                          checked={milestoneForm.testPlanIds.includes(plan.id)}
                          onChange={() => toggleMilestonePlan(plan.id)}
                        />
                        <span className="req-tc-title">{plan.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setShowMilestoneForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={!milestoneForm.name.trim()}>
                  {editingMilestone ? 'Save' : 'Create milestone'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Test plans & milestones"
        description="Group test runs by release or sprint and track progress against deadlines."
        action={
          tab === 'plans'
            ? <button className="primary-button" type="button" onClick={openAddPlan}>+ Add test plan</button>
            : <button className="primary-button" type="button" onClick={openAddMilestone}>+ Add milestone</button>
        }
      />

      <div className="tab-navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'plans'}
          className={`tab-btn${tab === 'plans' ? ' tab-btn--active' : ''}`}
          onClick={() => setTab('plans')}
        >
          Test plans ({plans.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'milestones'}
          className={`tab-btn${tab === 'milestones' ? ' tab-btn--active' : ''}`}
          onClick={() => setTab('milestones')}
        >
          Milestones ({milestones.length})
        </button>
      </div>

      {tab === 'plans' && (
        <section className="panel">
          <div className="section-header">
            <h2>Test plans</h2>
            {plans.length > 0 && <StatusPill tone="neutral">{plans.length}</StatusPill>}
          </div>
          {plans.length === 0 ? (
            <div className="req-empty-state">
              <h3>No test plans yet</h3>
              <p>Create a plan to group related test runs (e.g. v1.2 regression, Sprint 14 smoke).</p>
              <button className="primary-button" type="button" onClick={openAddPlan}>+ Add test plan</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap tp-table-wrap">
                <table className="tp-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Runs</th>
                      <th>Progress</th>
                      <th>Pass rate</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.map(({ plan, metrics }) => (
                      <tr key={plan.id}>
                        <td>
                          <button className="link-btn" type="button" onClick={() => setSelectedPlanId(plan.id)}>
                            {plan.name}
                          </button>
                          {plan.description && <p className="req-desc">{plan.description}</p>}
                        </td>
                        <td>{metrics.totalRuns} run{metrics.totalRuns !== 1 ? 's' : ''}</td>
                        <td>
                          <div className="req-progress-cell">
                            <div className="req-progress-track">
                              <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
                            </div>
                            <span className="req-progress-pct">{metrics.progressPct}%</span>
                          </div>
                        </td>
                        <td>{metrics.passRate}%</td>
                        <td><StatusPill tone={plan.status === 'Completed' ? 'passed' : 'pending'}>{plan.status || 'Open'}</StatusPill></td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-row-actions">
                            <button className="icon-btn-action" type="button" title="Edit" aria-label="Edit" onClick={() => openEditPlan(plan)}>
                              <PencilIcon width={14} height={14} />
                            </button>
                            <button className="icon-btn-action text-danger" type="button" title="Delete" aria-label="Delete" onClick={() => handleDeletePlan(plan)}>
                              <XIcon width={14} height={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="tp-card-list">
                {planRows.map(({ plan, metrics }) => (
                  <div className="tp-card" key={plan.id}>
                    <div className="tp-card-header">
                      <div>
                        <button className="tp-card-name link-btn" type="button" style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => setSelectedPlanId(plan.id)}>{plan.name}</button>
                        {plan.description && <p className="tp-card-desc">{plan.description}</p>}
                      </div>
                      <StatusPill tone={plan.status === 'Completed' ? 'passed' : 'pending'}>{plan.status || 'Open'}</StatusPill>
                    </div>
                    <div className="tp-card-meta">
                      <div className="tp-card-meta-item">
                        <span className="tp-card-meta-label">Runs</span>
                        <span>{metrics.totalRuns}</span>
                      </div>
                      <div className="tp-card-meta-item">
                        <span className="tp-card-meta-label">Pass rate</span>
                        <span>{metrics.passRate}%</span>
                      </div>
                    </div>
                    <div className="tp-card-progress">
                      <div className="req-progress-cell">
                        <div className="req-progress-track">
                          <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
                        </div>
                        <span className="req-progress-pct">{metrics.progressPct}%</span>
                      </div>
                    </div>
                    <div className="tp-card-actions">
                      <button className="secondary-button" type="button" onClick={() => openEditPlan(plan)}>
                        <PencilIcon width={14} height={14} /> Edit
                      </button>
                      <button className="secondary-button text-danger" type="button" onClick={() => handleDeletePlan(plan)}>
                        <XIcon width={14} height={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'milestones' && (
        <section className="panel">
          <div className="section-header">
            <h2>Milestones</h2>
            {milestones.length > 0 && <StatusPill tone="neutral">{milestones.length}</StatusPill>}
          </div>
          {milestones.length === 0 ? (
            <div className="req-empty-state">
              <h3>No milestones yet</h3>
              <p>Set release deadlines and link test plans to track if you are on track.</p>
              <button className="primary-button" type="button" onClick={openAddMilestone}>+ Add milestone</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap ms-table-wrap">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th>Milestone</th>
                      <th>Due</th>
                      <th>Plans</th>
                      <th>Progress</th>
                      <th>On track</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestoneRows.map(({ milestone, metrics }) => (
                      <tr key={milestone.id}>
                        <td>
                          <button className="link-btn" type="button" onClick={() => setSelectedMilestoneId(milestone.id)}>
                            {milestone.name}
                          </button>
                          {milestone.description && <p className="req-desc">{milestone.description}</p>}
                        </td>
                        <td>
                          {milestone.dueDate
                            ? new Date(milestone.dueDate).toLocaleDateString()
                            : '—'}
                          {metrics.overdue && <StatusPill tone="failed" style={{ marginLeft: 6 }}>Overdue</StatusPill>}
                        </td>
                        <td>{metrics.totalPlans}</td>
                        <td>
                          <div className="req-progress-cell">
                            <div className="req-progress-track">
                              <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
                            </div>
                            <span className="req-progress-pct">{metrics.progressPct}%</span>
                          </div>
                        </td>
                        <td>
                          <StatusPill tone={metrics.onTrack ? 'passed' : 'failed'}>
                            {metrics.onTrack ? 'On track' : 'At risk'}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-row-actions">
                            <button className="icon-btn-action" type="button" title="Edit" aria-label="Edit" onClick={() => openEditMilestone(milestone)}>
                              <PencilIcon width={14} height={14} />
                            </button>
                            <button className="icon-btn-action text-danger" type="button" title="Delete" aria-label="Delete" onClick={() => handleDeleteMilestone(milestone)}>
                              <XIcon width={14} height={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="tp-card-list">
                {milestoneRows.map(({ milestone, metrics }) => (
                  <div className="tp-card" key={milestone.id}>
                    <div className="tp-card-header">
                      <div>
                        <button className="tp-card-name link-btn" type="button" style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => setSelectedMilestoneId(milestone.id)}>{milestone.name}</button>
                        {milestone.description && <p className="tp-card-desc">{milestone.description}</p>}
                      </div>
                      <StatusPill tone={metrics.onTrack ? 'passed' : 'failed'}>
                        {metrics.onTrack ? 'On track' : 'At risk'}
                      </StatusPill>
                    </div>
                    <div className="tp-card-meta">
                      <div className="tp-card-meta-item">
                        <span className="tp-card-meta-label">Due</span>
                        <span>{milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="tp-card-meta-item">
                        <span className="tp-card-meta-label">Plans</span>
                        <span>{metrics.totalPlans}</span>
                      </div>
                      {metrics.overdue && (
                        <StatusPill tone="failed" style={{ fontSize: 10, minHeight: 20 }}>Overdue</StatusPill>
                      )}
                    </div>
                    <div className="tp-card-progress">
                      <div className="req-progress-cell">
                        <div className="req-progress-track">
                          <span className="req-progress-fill" style={{ width: `${metrics.progressPct}%` }} />
                        </div>
                        <span className="req-progress-pct">{metrics.progressPct}%</span>
                      </div>
                    </div>
                    <div className="tp-card-actions">
                      <button className="secondary-button" type="button" onClick={() => openEditMilestone(milestone)}>
                        <PencilIcon width={14} height={14} /> Edit
                      </button>
                      <button className="secondary-button text-danger" type="button" onClick={() => handleDeleteMilestone(milestone)}>
                        <XIcon width={14} height={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {showPlanForm && (
        <Modal title={editingPlan ? 'Edit test plan' : 'New test plan'} onClose={() => setShowPlanForm(false)} style={{ maxWidth: 560 }}>
          <form className="modal-form" onSubmit={submitPlan}>
            <label>
              Name <span className="required">*</span>
              <input autoFocus value={planForm.name} onChange={setPlan('name')} placeholder="v1.2 Regression" />
            </label>
            <label>
              Description
              <textarea rows={2} value={planForm.description} onChange={setPlan('description')} placeholder="Full regression for release 1.2" />
            </label>
            <div className="form-row">
              <label>
                Status
                <select value={planForm.status} onChange={setPlan('status')}>
                  {PLAN_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Milestone
                <select value={planForm.milestoneId} onChange={setPlan('milestoneId')}>
                  <option value="">None</option>
                  {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label>Linked requirements <span className="hint">({(planForm.requirementIds || []).length} selected)</span></label>
              <div className="req-tc-picker" style={{ maxHeight: 200 }}>
                {requirements.length === 0 ? (
                  <p className="panel-empty-text">No requirements yet. Create a requirement first.</p>
                ) : (
                  requirements.map((req) => (
                    <label key={req.id} className="req-tc-option">
                      <input
                        className="row-checkbox"
                        type="checkbox"
                        checked={(planForm.requirementIds || []).includes(req.id)}
                        onChange={() => togglePlanRequirement(req.id)}
                      />
                      <span className="req-tc-title">{req.key ? `${req.key}: ` : ''}{req.title}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {req.priority || 'Medium'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setShowPlanForm(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={!planForm.name.trim()}>
                {editingPlan ? 'Save' : 'Create plan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showMilestoneForm && (
        <Modal title={editingMilestone ? 'Edit milestone' : 'New milestone'} onClose={() => setShowMilestoneForm(false)} style={{ maxWidth: 560 }}>
          <form className="modal-form" onSubmit={submitMilestone}>
            <label>
              Name <span className="required">*</span>
              <input autoFocus value={milestoneForm.name} onChange={setMilestone('name')} placeholder="Release 1.2" />
            </label>
            <label>
              Description
              <textarea rows={2} value={milestoneForm.description} onChange={setMilestone('description')} />
            </label>
            <div className="form-row">
              <label>
                Due date
                <input type="date" value={milestoneForm.dueDate} onChange={setMilestone('dueDate')} />
              </label>
              <label>
                Status
                <select value={milestoneForm.status} onChange={setMilestone('status')}>
                  {MILESTONE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label>Linked test plans <span className="hint">({milestoneForm.testPlanIds.length} selected)</span></label>
              <div className="req-tc-picker" style={{ maxHeight: 200 }}>
                {plans.length === 0 ? (
                  <p className="panel-empty-text">No test plans yet.</p>
                ) : (
                  plans.map((plan) => (
                    <label key={plan.id} className="req-tc-option">
                      <input
                        className="row-checkbox"
                        type="checkbox"
                        checked={milestoneForm.testPlanIds.includes(plan.id)}
                        onChange={() => toggleMilestonePlan(plan.id)}
                      />
                      <span className="req-tc-title">{plan.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setShowMilestoneForm(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={!milestoneForm.name.trim()}>
                {editingMilestone ? 'Save' : 'Create milestone'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
