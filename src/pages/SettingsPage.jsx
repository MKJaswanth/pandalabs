import { useState } from 'react'
import { XIcon, CheckIcon } from '../components/Icons'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useProjects } from '../hooks/useProjects'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useActivity } from '../hooks/useActivity'
import { useUserRole } from '../hooks/useUserRole'

export function SettingsPage() {
  const { projectId } = useParams()
  const { projects, updateProject, removeProject } = useProjects()
  const { members, addMember, updateMember } = useTeamMembers()
  const { getActivitiesByProject } = useActivity()
  const { isLead } = useUserRole()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const project = projects.find((p) => p.id === projectId)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [newMemberName, setNewMemberName] = useState('')
  const [saved, setSaved] = useState(false)

  const projectActivities = getActivitiesByProject(projectId).slice(0, 10)

  if (!project) {
    return (
      <section className="empty-state">
        <h2>Project not found</h2>
      </section>
    )
  }

  const memberIds = project.memberIds ?? []
  const projectMembers = members.filter((m) => memberIds.includes(m.id))
  const nonMembers = members.filter((m) => !memberIds.includes(m.id))

  const handleSave = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    updateProject({ ...project, name: name.trim(), description: description.trim() })
    setSaved(true)
    toast.success('Project settings saved')
    setTimeout(() => setSaved(false), 2000)
  }

  const addExistingMember = (memberId) =>
    updateProject({ ...project, memberIds: [...memberIds, memberId] })

  const removeMemberFromProject = (memberId) =>
    updateProject({ ...project, memberIds: memberIds.filter((id) => id !== memberId) })

  // Create a brand-new global member AND attach them to this project atomically
  const handleAddNew = (e) => {
    e.preventDefault()
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    const newMember = addMember(trimmed)
    updateProject({ ...project, memberIds: [...memberIds, newMember.id] })
    setNewMemberName('')
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete project?',
      message: `All test cases, bugs, and runs in "${project.name}" will be permanently deleted and cannot be recovered.`,
      confirmLabel: 'Delete project',
      danger: true,
      requireText: project.name,
    })
    if (ok) {
      removeProject(project.id)
      navigate('/projects')
    }
  }

  return (
    <>
      <PageHeader title="Settings" description={`Configure ${project.name}`} />

      <section className="panel settings-section">
        <div className="section-header"><h2>Project details</h2></div>
        <form className="settings-form" onSubmit={handleSave}>
          <label>
            Name <span className="required">*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isLead} />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              disabled={!isLead}
            />
          </label>
          <div className="settings-form-footer">
            <button type="submit" className="primary-button" disabled={!isLead}>
              {saved ? <><CheckIcon width={14} height={14} /> Saved</> : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel settings-section">
        <div className="section-header"><h2>Team members</h2></div>
        <div className="settings-body">
          <div className="member-management-panel">
            <div className="member-list-wrapper">
              <span className="section-subtitle">Assigned to this project</span>
              {projectMembers.length === 0 ? (
                <p className="settings-empty">No members assigned yet.</p>
              ) : (
                <ul className="settings-member-list">
                  {projectMembers.map((m) => (
                    <li key={m.id} className="settings-member-item">
                      <div className="member-info">
                        <span className="avatar">{m.name.slice(0, 2).toUpperCase()}</span>
                        <span className="member-name">{m.name}</span>
                        {m.uid && (
                          <span className="shared-badge" style={{ marginLeft: 8, background: '#eff6ff', color: '#1d4ed8' }}>
                            Workspace user
                          </span>
                        )}
                        <select
                          className="inline-select status-select status-select--neutral"
                          style={{ marginLeft: 8 }}
                          value={m.role || 'Viewer'}
                          disabled={!isLead}
                          onChange={(e) => updateMember({ ...m, role: e.target.value })}
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="Tester">Tester</option>
                          <option value="QA Lead">QA Lead</option>
                        </select>
                      </div>
                      {isLead && (
                        <button
                          type="button"
                          className="member-remove-btn"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => removeMemberFromProject(m.id)}
                        >
                          <XIcon width={12} height={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isLead && (
              <div className="member-actions-wrapper">
                <span className="section-subtitle">Assign team members</span>
                <div className="assign-controls">
                  {nonMembers.length > 0 && (
                    <div className="control-group">
                      <label htmlFor="existing-member-select">Choose from existing team</label>
                      <select
                        id="existing-member-select"
                        className="settings-select"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) { addExistingMember(e.target.value); e.target.value = '' }
                        }}
                      >
                        <option value="" disabled>Select member…</option>
                        {nonMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}

                  <form className="control-group" onSubmit={handleAddNew}>
                    <label htmlFor="new-member-input">Create & assign new member</label>
                    <div className="input-with-button">
                      <input
                        id="new-member-input"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Name (e.g. John Doe)"
                      />
                      <button type="submit" className="secondary-button" disabled={!newMemberName.trim()}>
                        Add
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Recent Activity</h2>
          <Link className="text-link" to={`/activity?projectId=${projectId}`}>
            View all activity →
          </Link>
        </div>
        <div className="settings-body" style={{ display: 'block' }}>
          {projectActivities.length === 0 ? (
            <p className="settings-empty">No recent activity for this project.</p>
          ) : (
            <div className="settings-activity-list">
            {projectActivities.map((act) => (
              <div key={act.id} className="settings-activity-item">
                <div className="settings-activity-header">
                  <strong className="settings-activity-title">{act.title}</strong>
                  <span className="settings-activity-time">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="settings-activity-meta">
                  By <strong>{act.actorName}</strong> {act.details ? `— ${act.details}` : ''}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </section>

      {isLead && (
        <section className="panel settings-section danger-zone-panel">
          <div className="section-header"><h2>Danger zone</h2></div>
          <div className="settings-body danger-body">
            <div className="danger-text">
              <strong>Delete this project</strong>
              <p>Permanently removes all test cases, bugs, and runs. This action cannot be undone.</p>
            </div>
            <button type="button" className="danger-button" onClick={handleDelete}>
              Delete project
            </button>
          </div>
        </section>
      )}
    </>
  )
}
