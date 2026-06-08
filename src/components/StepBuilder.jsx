import { XIcon } from './Icons'

export function StepBuilder({ steps, onChange }) {
  const updateStep = (index, value) =>
    onChange(steps.map((step, stepIndex) => (stepIndex === index ? value : step)))

  const addStep = () => onChange([...steps, ''])

  const removeStep = (index) => {
    if (steps.length === 1) return
    onChange(steps.filter((_, stepIndex) => stepIndex !== index))
  }

  return (
    <div className="step-builder">
      {steps.map((step, index) => (
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
      ))}
      <button type="button" className="step-add" onClick={addStep}>
        + Add step
      </button>
    </div>
  )
}
