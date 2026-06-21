import { useState } from 'react'
import { XIcon } from './Icons'

// Reusable free-form tag editor. Type and press Enter (or comma) to add a tag,
// click ✕ to remove, Backspace on an empty field removes the last tag.
// `suggestions` powers a native datalist autocomplete from tags already in use.
export function TagInput({ value = [], onChange, suggestions = [], placeholder = 'Add a tag…', id }) {
  const [draft, setDraft] = useState('')

  const addTag = (raw) => {
    const tag = raw.trim()
    setDraft('')
    if (!tag) return
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase())
    if (!exists) onChange([...value, tag])
  }

  const removeTag = (tag) => onChange(value.filter((t) => t !== tag))

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  const listId = id ? `${id}-suggestions` : undefined
  const remaining = suggestions.filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()))

  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span className="tag-chip" key={tag}>
          {tag}
          <button
            type="button"
            className="tag-chip-remove"
            aria-label={`Remove tag ${tag}`}
            onClick={() => removeTag(tag)}
          >
            <XIcon width={11} height={11} />
          </button>
        </span>
      ))}
      <input
        className="tag-input-field"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={value.length ? '' : placeholder}
        list={listId}
        aria-label="Add tag"
      />
      {listId && remaining.length > 0 && (
        <datalist id={listId}>
          {remaining.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  )
}

// Read-only chip list for tables/detail views. When `onTagClick` is provided,
// each chip becomes a button that filters by that tag.
export function TagList({ tags = [], onTagClick, activeTag, className = '' }) {
  if (!tags.length) return null
  return (
    <span className={`tag-chip-list ${className}`.trim()}>
      {tags.map((tag) =>
        onTagClick ? (
          <button
            type="button"
            key={tag}
            className={`tag-chip tag-chip--button${activeTag === tag ? ' tag-chip--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onTagClick(tag) }}
            title={`Filter by ${tag}`}
          >
            {tag}
          </button>
        ) : (
          <span className="tag-chip tag-chip--static" key={tag}>{tag}</span>
        )
      )}
    </span>
  )
}
