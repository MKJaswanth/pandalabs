import { useState } from 'react'
import { newId } from '../utils/id'

function isValidGoogleDriveUrl(url) {
  const trimmed = (url || '').trim()
  if (!trimmed) return false

  let parsedUrl
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    // If it doesn't have a protocol, try adding https://
    if (!/^https?:\/\//i.test(trimmed)) {
      try {
        parsedUrl = new URL('https://' + trimmed)
      } catch {
        return false
      }
    } else {
      return false
    }
  }

  const host = parsedUrl.hostname.toLowerCase()
  return host === 'drive.google.com' || host === 'docs.google.com'
}

export function EvidenceLinksField({ evidenceLinks = [], onChange, currentUser, disabled = false }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    setError('')

    const trimmedUrl = url.trim()
    const trimmedLabel = label.trim()

    if (!trimmedUrl) {
      setError('Please enter a Google Drive URL.')
      return
    }

    if (!isValidGoogleDriveUrl(trimmedUrl)) {
      setError('Invalid URL. Please paste a valid Google Drive or Docs link (e.g., drive.google.com or docs.google.com).')
      return
    }

    // Standardize URL to have a protocol if it doesn't have one
    let finalUrl = trimmedUrl
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      finalUrl = 'https://' + trimmedUrl
    }

    const newLink = {
      id: newId(),
      url: finalUrl,
      label: trimmedLabel || 'Google Drive Link',
      addedAt: new Date().toISOString(),
      addedBy: currentUser || 'Unknown'
    }

    onChange([...evidenceLinks, newLink])
    setUrl('')
    setLabel('')
  }

  const handleRemove = (id) => {
    onChange(evidenceLinks.filter((link) => link.id !== id))
  }

  return (
    <div className="evidence-links-field">
      {evidenceLinks.length > 0 && (
        <div className="attachment-list" style={{ marginBottom: 12 }}>
          {evidenceLinks.map((link) => (
            <div key={link.id} className="attachment-item-wrap">
              <div className="attachment-item">
                <span className="attachment-icon">
                  {link.isLegacy ? '📎' : '🔗'}
                </span>
                <div className="attachment-info">
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="attachment-name"
                      style={{ textDecoration: 'underline', color: 'var(--primary-color, #1a73e8)' }}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="attachment-name" style={{ color: 'var(--text-muted, #5f6368)' }}>
                      {link.label}
                    </span>
                  )}
                  <span className="attachment-size">
                    {link.url ? new URL(link.url).hostname : 'No Link'}
                    {link.addedBy && ` • Added by ${link.addedBy}`}
                    {link.addedAt && ` on ${new Date(link.addedAt).toLocaleDateString()}`}
                  </span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => handleRemove(link.id)}
                    aria-label={`Remove ${link.label}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="evidence-add-form" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="evidence-inputs-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Paste Google Drive share link…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="attachment-drive-input"
              style={{ flex: '2 1 300px' }}
            />
            <input
              type="text"
              placeholder="Label (e.g. Screenshot before fix)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="attachment-drive-input"
              style={{ flex: '1 1 200px' }}
            />
            <button
              type="button"
              className="primary-button"
              onClick={handleAdd}
              style={{ height: '36px', display: 'flex', alignItems: 'center' }}
            >
              Add Link
            </button>
          </div>
          <span className="hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted, #5f6368)' }}>
            Paste Google Drive links for screenshots, videos, logs, or documents. Only drive.google.com or docs.google.com links are accepted.
          </span>
          {error && (
            <p className="attachment-error" style={{ color: 'var(--danger-color, #d93025)', margin: '4px 0 0 0' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
