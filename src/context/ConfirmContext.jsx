import { useCallback, useState } from 'react'
import { Modal } from '../components/Modal'
import { ConfirmContext } from './ConfirmContextCore'

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state.resolve(false)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} onClose={handleCancel} style={{ maxWidth: 420 }}>
          <p className="confirm-message">{state.message}</p>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={handleCancel}>
              Cancel
            </button>
            <button
              autoFocus
              type="button"
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
