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
  if (type.startsWith('image/')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) return '📊'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('zip') || type.includes('archive')) return '📦'
  return '📎'
}

export function AttachmentField({ attachments = [], onChange, disabled = false }) {
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')

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
  }

  return (
    <div className="attachment-field">
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((att) => (
            <div key={att.id} className="attachment-item">
              <span className="attachment-icon">{getIconForType(att.type)}</span>
              <div className="attachment-info">
                <span className="attachment-name" title={att.name}>{att.name}</span>
                <span className="attachment-size">{formatSize(att.size)}</span>
              </div>
              {att.type.startsWith('image/') && att.data && (
                <a
                  href={att.data}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-preview-link"
                >
                  Preview
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
          ))}
        </div>
      )}

      {!disabled && (
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
      )}

      {error && <p className="attachment-error">{error}</p>}
    </div>
  )
}
