import { useCallback, useState } from 'react'
import { Modal } from '../components/Modal'
import { ConfirmContext } from './ConfirmContextCore'

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const [typedText, setTypedText] = useState('')

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false, requireText = null }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, requireText, resolve })
      setTypedText('')
    })
  }, [])

  const handleConfirm = () => {
    state.resolve(true)
    setState(null)
    setTypedText('')
  }

  const handleCancel = () => {
    state.resolve(false)
    setState(null)
    setTypedText('')
  }

  const canConfirm = !state?.requireText || typedText === state.requireText

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} onClose={handleCancel} style={{ maxWidth: 420 }}>
          <p className="confirm-message">{state.message}</p>
          {state.requireText && (
            <label className="confirm-type-label">
              Type <strong>{state.requireText}</strong> to confirm
              <input
                autoFocus
                className="confirm-type-input"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm() }}
                placeholder={state.requireText}
              />
            </label>
          )}
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={handleCancel}>
              Cancel
            </button>
            <button
              autoFocus={!state.requireText}
              type="button"
              disabled={!canConfirm}
              className={state.danger ? 'danger-button' : 'primary-button'}
              onClick={handleConfirm}
            >
              {state.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
