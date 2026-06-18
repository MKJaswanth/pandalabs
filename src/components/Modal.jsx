import { useEffect, useState, useRef, useId } from 'react'
import { XIcon } from './Icons'

export function Modal({ title, onClose, children, style, closeOnBackdrop = true }) {
  const [highlight, setHighlight] = useState(false)
  const titleId = useId()
  const timerRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose])

  const handleBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return
    if (closeOnBackdrop) {
      onClose()
    } else {
      setHighlight(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setHighlight(false)
        timerRef.current = null
      }, 1000)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={handleBackdropClick}>
      <div className="modal" style={style} role="document">
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className={`modal-close ${highlight ? 'modal-close--highlight' : ''}`} onClick={onClose} aria-label="Close">
            <XIcon width={14} height={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
