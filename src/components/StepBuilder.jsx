import { XIcon } from './Icons'
import { useState } from 'react'

function LayersIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

export function StepBuilder({ steps, onChange, sharedSteps = [] }) {
  const [showSelector, setShowSelector] = useState(false)

  const updateStep = (index, value) =>
    onChange(steps.map((step, stepIndex) => (stepIndex === index ? value : step)))

  const addStep = () => {
    onChange([...steps, ''])
    setShowSelector(false)
  }

  const addSharedBlock = (groupId) => {
    onChange([...steps, `shared_step_group:${groupId}`])
    setShowSelector(false)
  }

  const removeStep = (index) => {
    if (steps.length === 1) return
    onChange(steps.filter((_, stepIndex) => stepIndex !== index))
  }

  return (
    <div className="step-builder">
      {steps.map((step, index) => {
        const isSharedRef = typeof step === 'string' && step.startsWith('shared_step_group:')
        
        if (isSharedRef) {
          const groupId = step.split(':')[1]
          const group = sharedSteps.find((g) => g.id === groupId)
          return (
            <div key={index} className="step-row shared-step-row">
              <span className="step-num">{index + 1}</span>
              <div className="shared-step-block">
                <div className="shared-step-block-header">
                  <LayersIcon className="icon-shared" />
                  <strong>{group ? group.name : 'Deleted Shared Step Group'}</strong>
                  <span className="shared-badge">Shared block</span>
                </div>
                {group?.steps && group.steps.length > 0 ? (
                  <ol className="shared-step-nested-list">
                    {group.steps.map((nested, nIdx) => (
                      <li key={nIdx}>{nested}</li>
                    ))}
                  </ol>
                ) : (
                  <div className="shared-step-empty">No steps in this group</div>
                )}
              </div>
              <button
                type="button"
                className="step-remove"
                onClick={() => removeStep(index)}
                aria-label={`Remove step ${index + 1}`}
              >
                <XIcon width={12} height={12} />
              </button>
            </div>
          )
        }

        return (
          <div key={index} className="step-row">
            <span className="step-num">{index + 1}</span>
            <input
              value={step}
              onChange={(event) => updateStep(index, event.target.value)}
              placeholder={`Step ${index + 1}`}
            />
            <button
              type="button"
              className="step-remove"
              onClick={() => removeStep(index)}
              aria-label={`Remove step ${index + 1}`}
            >
              <XIcon width={12} height={12} />
            </button>
          </div>
        )
      })}

      <div className="step-builder-actions">
        <button type="button" className="step-add" onClick={addStep}>
          + Add manual step
        </button>

        {sharedSteps.length > 0 && (
          <div className="shared-step-selector-wrap">
            <button
              type="button"
              className="step-add secondary"
              onClick={() => setShowSelector(!showSelector)}
            >
              + Shared steps
            </button>
            
            {showSelector && (
              <div className="shared-step-select-dropdown">
                <div className="dropdown-title">Select shared steps:</div>
                {sharedSteps.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="dropdown-item"
                    onClick={() => addSharedBlock(g.id)}
                  >
                    <LayersIcon width={10} height={10} style={{ marginRight: 6, opacity: 0.7 }} />
                    {g.name} ({g.steps?.length || 0} steps)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
