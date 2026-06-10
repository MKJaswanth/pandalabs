const LOCAL_ENDPOINT_KEY = 'qaLabSlackUpdatesEndpoint'
const LOCAL_CHANNEL_KEY = 'qaLabSlackUpdatesChannel'

const sampleMessages = [
  {
    id: 'sample-1',
    user: 'Priya S',
    project: 'Mobile checkout',
    text: 'Wrapping up payment regression and checking Razorpay retry states.',
    time: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'sample-2',
    user: 'Arjun M',
    project: 'Admin LMS',
    text: 'Working on role access QA for course publishing and user imports.',
    time: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
  },
  {
    id: 'sample-3',
    user: 'Neha K',
    project: 'Reports dashboard',
    text: 'Investigating chart export failures and validating PDF output.',
    time: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
  },
  {
    id: 'sample-4',
    user: 'Rahul P',
    project: 'Customer portal',
    text: 'Testing signup edge cases and confirming password reset emails.',
    time: new Date(Date.now() - 1000 * 60 * 185).toISOString(),
  },
]

function cleanSlackText(text = '') {
  return text
    .replace(/<@([A-Z0-9]+)>/g, '@$1')
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2')
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function inferProject(text) {
  const patterns = [
    /\[([^\]]+)\]/,
    /project\s*:\s*([^|,\n-]+)/i,
    /working\s+on\s+([^|,\n.]+)/i,
    /#([a-z0-9][a-z0-9_-]+)/i,
  ]
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean)
  return match ? match[1].trim().replace(/[-_]/g, ' ') : 'General updates'
}

function inferTone(text) {
  const value = text.toLowerCase()
  if (/(blocked|blocker|stuck|waiting|issue)/.test(value)) return 'blocked'
  if (/(done|completed|shipped|merged|fixed)/.test(value)) return 'done'
  if (/(review|qa|testing|validating|checking)/.test(value)) return 'review'
  return 'active'
}

function normalizeUser(message) {
  return (
    message.userName ||
    message.user_name ||
    message.username ||
    message.profile?.real_name ||
    message.profile?.display_name ||
    message.user ||
    'Slack teammate'
  )
}

function normalizeMessage(message, index) {
  const text = cleanSlackText(message.text || message.message || message.update || '')
  const time = message.time || message.datetime || message.createdAt || (
    message.ts ? new Date(Number(message.ts) * 1000).toISOString() : new Date().toISOString()
  )

  return {
    id: message.id || message.client_msg_id || message.ts || `message-${index}`,
    user: normalizeUser(message),
    project: message.project || inferProject(text),
    text,
    time,
    tone: message.tone || inferTone(text),
    link: message.permalink || message.url || message.link || '',
  }
}

function normalizeResponse(payload) {
  const messages = Array.isArray(payload) ? payload : (payload.messages || payload.updates || [])
  return messages
    .map(normalizeMessage)
    .filter((message) => message.text)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
}

export function getSlackSettings() {
  return {
    endpoint: localStorage.getItem(LOCAL_ENDPOINT_KEY) || import.meta.env.VITE_SLACK_UPDATES_ENDPOINT || '',
    channel: localStorage.getItem(LOCAL_CHANNEL_KEY) || import.meta.env.VITE_SLACK_UPDATES_CHANNEL || 'updates',
    connectUrl: import.meta.env.VITE_SLACK_CONNECT_URL || '',
  }
}

export function saveSlackSettings({ endpoint, channel }) {
  localStorage.setItem(LOCAL_ENDPOINT_KEY, endpoint.trim())
  localStorage.setItem(LOCAL_CHANNEL_KEY, channel.trim() || 'updates')
}

export async function loadSlackUpdates() {
  const { endpoint } = getSlackSettings()
  if (!endpoint) {
    return { source: 'demo', updates: sampleMessages.map(normalizeMessage) }
  }

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Slack updates endpoint returned ${response.status}`)
  }

  const payload = await response.json()
  return { source: 'live', updates: normalizeResponse(payload) }
}
