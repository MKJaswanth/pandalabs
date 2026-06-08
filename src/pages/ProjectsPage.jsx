import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../context/useConfirm'
import { useProjects } from '../hooks/useProjects'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { getTestCases } from '../utils/storage'

function getPassRate(projectId) {
  const tcs = getTestCases(projectId)
  if (!tcs.length) return 0
  return Math.round((tcs.filter((t) => t.status === 'Pass').length / tcs.length) * 100)
}

function Avatar({ name }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="avatar" title={name} aria-label={name}>
      {initials}
    </span>
  )
}

const blank = { name: '', description: '', memberIds: [] }

export function ProjectsPage() {
  const { projects, addProject, removeProject } = useProjects()
  const { members } = useTeamMembers()
  const confirm = useConfirm()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blank)

  const toggleMember = (id) =>
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(id)
        ? f.memberIds.filter((m) => m !== id)
        : [...f.memberIds, id],
    }))

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    addProject({ name: form.name.trim(), description: form.description.trim(), memberIds: form.memberIds })
    setForm(blank)
    setShowAdd(false)
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Create and manage QA workspaces for each product."
        action={
          <button className="primary-button" type="button" onClick={() => setShowAdd(true)}>
            + New project
          </button>
        }
      />

      {projects.length === 0 ? (
        <section className="empty-state">
          <h2>No projects yet</h2>
          <p>Click "New project" to create your first QA workspace.</p>
        </section>
      ) : (
        <section className="project-grid">
          {projects.map((project) => {
            const passRate = getPassRate(project.id)
            const projectMembers = members.filter((m) => project.memberIds?.includes(m.id))
            return (
              <article className="project-card" key={project.id}>
                <div>
                  <h2>{project.name}</h2>
                  {project.description && <p>{project.description}</p>}
                </div>

                {projectMembers.length > 0 && (
                  <div className="avatar-row" aria-label="Team members">
                    {projectMembers.map((m) => <Avatar key={m.id} name={m.name} />)}
                  </div>
                )}

                <div className="progress-cell">
                  <span>{passRate}% pass rate</span>
                  <div className="progress-track">
                    <span style={{ width: `${passRate}%` }} />
                  </div>
                </div>

                <div className="card-actions">
                  <Link className="text-link" to={`/projects/${project.id}/test-cases`}>
                    Open project →
                  </Link>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete project?',
                        message: `"${project.name}" and all its test cases, bugs, and runs will be permanently removed.`,
                        confirmLabel: 'Delete project',
                        danger: true,
                      })
                      if (ok) removeProject(project.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {showAdd && (
        <Modal title="New project" onClose={() => { setShowAdd(false); setForm(blank) }}>
          <form className="modal-form" onSubmit={handleAdd}>
            <label>
              Name <span className="required">*</span>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="E.g. Mobile app"
              />
            </label>
            <label>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description"
              />
            </label>

            {members.length > 0 && (
              <fieldset className="member-picker">
                <legend>Team members</legend>
                <div className="member-picker-list">
                  {members.map((m) => (
                    <label key={m.id} className="member-check">
                      <input
                        type="checkbox"
                        checked={form.memberIds.includes(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <Avatar name={m.name} />
                      <span>{m.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => { setShowAdd(false); setForm(blank) }}>
                Cancel
              </button>
              <button type="submit" className="primary-button">Create project</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
