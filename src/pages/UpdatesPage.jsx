import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { getSlackSettings, loadSlackUpdates, saveSlackSettings } from '../utils/slackUpdates'

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function initials(name) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function SlackIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8.3 14.1a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Z" fill="#36C5F0" />
      <path d="M9.4 14.1a2.1 2.1 0 0 1 4.2 0v5.2a2.1 2.1 0 0 1-4.2 0v-5.2Z" fill="#36C5F0" />
      <path d="M9.4 8.3a2.1 2.1 0 1 1 2.1-2.1v2.1H9.4Z" fill="#2EB67D" />
      <path d="M9.4 9.4h5.2a2.1 2.1 0 0 1 0 4.2H9.4a2.1 2.1 0 0 1 0-4.2Z" fill="#2EB67D" />
      <path d="M15.7 9.9a2.1 2.1 0 1 1 2.1 2.1h-2.1V9.9Z" fill="#ECB22E" />
      <path d="M14.6 9.9a2.1 2.1 0 0 1-4.2 0V4.7a2.1 2.1 0 0 1 4.2 0v5.2Z" fill="#ECB22E" />
      <path d="M14.6 15.7a2.1 2.1 0 1 1-2.1 2.1v-2.1h2.1Z" fill="#E01E5A" />
      <path d="M14.6 14.6H9.4a2.1 2.1 0 0 1 0-4.2h5.2a2.1 2.1 0 0 1 0 4.2Z" fill="#E01E5A" />
    </svg>
  )
}

function groupByProject(updates) {
  return updates.reduce((groups, update) => {
    const key = update.project || 'General updates'
    groups[key] = groups[key] || []
    groups[key].push(update)
    return groups
  }, {})
}

export function UpdatesPage() {
  const initialSettings = getSlackSettings()
  const [endpoint, setEndpoint] = useState(initialSettings.endpoint)
  const [channel, setChannel] = useState(initialSettings.channel)
  const [updates, setUpdates] = useState([])
  const [source, setSource] = useState('demo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await loadSlackUpdates()
      setUpdates(result.updates)
      setSource(result.source)
    } catch (err) {
      setError(err.message || 'Could not load Slack updates')
      setUpdates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    loadSlackUpdates()
      .then((result) => {
        if (cancelled) return
        setUpdates(result.updates)
        setSource(result.source)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Could not load Slack updates')
        setUpdates([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const grouped = useMemo(() => groupByProject(updates), [updates])
  const activePeople = new Set(updates.map((update) => update.user)).size
  const projectCount = Object.keys(grouped).length
  const latestUpdate = updates[0]?.time

  const handleSave = (event) => {
    event.preventDefault()
    saveSlackSettings({ endpoint, channel })
    setSaved(true)
    refresh()
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <>
      <PageHeader
        title="Slack updates"
        description={`Showing what people are working on from #${channel || 'updates'}.`}
        action={
          <button className="secondary-button" type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        }
      />

      <section className="slack-connect-band">
        <div className="slack-connect-main">
          <span className="slack-connect-icon"><SlackIcon width={22} height={22} /></span>
          <div>
            <h2>{source === 'live' ? 'Slack connected' : 'Connect Slack updates'}</h2>
            <p>
              Add a safe backend endpoint that reads the Slack updates channel and returns JSON.
              The app will summarize recent messages by project and teammate.
            </p>
          </div>
        </div>
        <div className="slack-connect-actions">
          {initialSettings.connectUrl && (
            <a className="primary-button" href={initialSettings.connectUrl} target="_blank" rel="noreferrer">
              Connect Slack
            </a>
          )}
          <StatusPill tone={source === 'live' ? 'passed' : 'pending'}>
            {source === 'live' ? 'Live data' : 'Demo data'}
          </StatusPill>
        </div>
      </section>

      <section className="panel slack-settings-panel">
        <form className="slack-settings-form" onSubmit={handleSave}>
          <label>
            Updates channel
            <input
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              placeholder="updates"
            />
          </label>
          <label>
            Slack updates endpoint
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://your-api.example.com/slack/updates"
            />
          </label>
          <button className="primary-button" type="submit">
            {saved ? 'Saved' : 'Save'}
          </button>
        </form>
      </section>

      <section className="metric-grid" aria-label="Slack update metrics">
        <article className="metric-card metric-card--neutral">
          <span>People active</span>
          <strong>{activePeople}</strong>
        </article>
        <article className="metric-card metric-card--neutral">
          <span>Projects mentioned</span>
          <strong>{projectCount}</strong>
        </article>
        <article className="metric-card metric-card--neutral">
          <span>Updates loaded</span>
          <strong>{updates.length}</strong>
        </article>
        <article className="metric-card metric-card--neutral">
          <span>Latest update</span>
          <strong>{latestUpdate ? formatTime(latestUpdate) : 'None'}</strong>
        </article>
      </section>

      {error && (
        <section className="slack-error" role="alert">
          {error}
        </section>
      )}

      <div className="slack-updates-layout">
        <section className="panel slack-feed-panel">
          <div className="section-header">
            <h2>Recent teammate updates</h2>
            <span className="slack-source-label">#{channel || 'updates'}</span>
          </div>
          {loading ? (
            <p className="panel-empty-text">Loading Slack updates...</p>
          ) : updates.length === 0 ? (
            <p className="panel-empty-text">No updates found yet.</p>
          ) : (
            <div className="slack-update-list">
              {updates.map((update) => (
                <article className="slack-update-item" key={update.id}>
                  <span className="slack-avatar" aria-hidden="true">{initials(update.user)}</span>
                  <div className="slack-update-body">
                    <div className="slack-update-topline">
                      <strong>{update.user}</strong>
                      <span>{formatTime(update.time)}</span>
                    </div>
                    <div className="slack-update-meta">
                      <span className={`slack-tone slack-tone--${update.tone}`}>{update.tone}</span>
                      <span>{update.project}</span>
                    </div>
                    <p>{update.text}</p>
                    {update.link && (
                      <a href={update.link} target="_blank" rel="noreferrer">Open in Slack</a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel slack-project-panel">
          <div className="section-header">
            <h2>Projects being worked on</h2>
          </div>
          {Object.entries(grouped).length === 0 ? (
            <p className="panel-empty-text">Project mentions will appear here.</p>
          ) : (
            <div className="slack-project-list">
              {Object.entries(grouped).map(([project, items]) => (
                <article className="slack-project-item" key={project}>
                  <div>
                    <h3>{project}</h3>
                    <p>{items.length} update{items.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="avatar-row">
                    {[...new Set(items.map((item) => item.user))].slice(0, 5).map((name) => (
                      <span className="avatar" title={name} aria-label={name} key={name}>
                        {initials(name)}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
