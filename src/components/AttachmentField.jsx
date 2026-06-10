import { useRef, useState } from 'react'
import { newId } from '../utils/id'

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB in bytes

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getIconForType(type) {
  if (type === 'drive-link') return '🔗'
  if (type.startsWith('image/')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return '📊'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('zip') || type.includes('archive')) return '📦'
  return '📎'
}

function extractDriveId(url) {
  // Handles: /file/d/ID/view, /file/d/ID/edit, ?id=ID, /open?id=ID
  const byPath = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
  const byParam = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  return (byPath?.[1] ?? byParam?.[1]) ?? null
}

export function AttachmentField({ attachments = [], onChange, disabled = false }) {
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [showDriveInput, setShowDriveInput] = useState(false)

  const handleFiles = async (files) => {
    setError('')
    const newAttachments = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 1MB limit (${formatSize(file.size)}).`)
        continue
      }

      try {
        const data = await fileToBase64(file)
        newAttachments.push({
          id: newId(),
          name: file.name,
          type: file.type,
          size: file.size,
          data,
        })
      } catch {
        setError(`Failed to read "${file.name}".`)
      }
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments])
    }
  }

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => setDragActive(false)

  const removeAttachment = (id) => {
    onChange(attachments.filter((a) => a.id !== id))
    if (previewId === id) setPreviewId(null)
  }

  const addDriveLink = () => {
    setError('')
    const driveId = extractDriveId(driveUrl.trim())
    if (!driveId) {
      setError('Could not find a file ID in that link. Make sure it\'s a Google Drive share URL.')
      return
    }
    const embedUrl = `https://drive.google.com/file/d/${driveId}/preview`
    onChange([...attachments, {
      id: newId(),
      name: driveUrl.trim(),
      type: 'drive-link',
      driveId,
      embedUrl,
    }])
    setDriveUrl('')
    setShowDriveInput(false)
  }

  return (
    <div className="attachment-field">
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((att) => (
            <div key={att.id} className="attachment-item-wrap">
              <div className="attachment-item">
                <span className="attachment-icon">{getIconForType(att.type)}</span>
                <div className="attachment-info">
                  <span className="attachment-name" title={att.name}>
                    {att.type === 'drive-link' ? 'Google Drive file' : att.name}
                  </span>
                  {att.size && <span className="attachment-size">{formatSize(att.size)}</span>}
                  {att.type === 'drive-link' && (
                    <span className="attachment-size">Must be shared publicly to preview</span>
                  )}
                </div>
                {(att.type === 'drive-link' || (att.type.startsWith('image/') && att.data)) && (
                  <button
                    type="button"
                    className="attachment-preview-link"
                    onClick={() => setPreviewId(previewId === att.id ? null : att.id)}
                  >
                    {previewId === att.id ? 'Hide' : 'Preview'}
                  </button>
                )}
                {att.type === 'drive-link' && (
                  <a
                    href={att.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attachment-preview-link"
                  >
                    Open
                  </a>
                )}
                {!disabled && (
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
              {previewId === att.id && att.type === 'drive-link' && (
                <iframe
                  src={att.embedUrl}
                  className="attachment-drive-preview"
                  title="Google Drive preview"
                  allow="autoplay"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              )}
              {previewId === att.id && att.type !== 'drive-link' && att.data && (
                <img
                  src={att.data}
                  alt={att.name}
                  className="attachment-preview-img"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div
            className={`attachment-dropzone ${dragActive ? 'attachment-dropzone--active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="attachment-dropzone-icon">📎</span>
            <span className="attachment-dropzone-text">Drop files here or click to upload</span>
            <span className="attachment-dropzone-hint">Max 1MB per file — images, docs, spreadsheets</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleInputChange}
              className="attachment-file-input"
              aria-label="Upload attachment"
            />
          </div>

          {showDriveInput ? (
            <div className="attachment-drive-row">
              <input
                autoFocus
                type="url"
                className="attachment-drive-input"
                placeholder="Paste Google Drive share link…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addDriveLink() }
                  if (e.key === 'Escape') { setShowDriveInput(false); setDriveUrl('') }
                }}
              />
              <button type="button" className="primary-button" onClick={addDriveLink} disabled={!driveUrl.trim()}>
                Add
              </button>
              <button type="button" className="secondary-button" onClick={() => { setShowDriveInput(false); setDriveUrl('') }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="attachment-drive-btn"
              onClick={() => setShowDriveInput(true)}
            >
              <span>🔗</span> Add Google Drive link
            </button>
          )}
        </>
      )}

      {error && <p className="attachment-error">{error}</p>}
    </div>
  )
}
