/**
 * Shared chart components for Reports and Run Detail pages.
 */

// SVG donut ring for pass rate
export function PassRing({ rate, size = 140 }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const dash = (rate / 100) * circ
  const strokeColor = rate >= 70 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="pass-ring-wrap" style={{ width: size, height: size }} aria-label={`Pass rate ${rate}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="pass-ring-svg" style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className="ring-fill"
          stroke={strokeColor}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ / 4}
        />
      </svg>
      <div className="pass-ring-label">
        <strong>{rate}%</strong>
        <span>pass rate</span>
      </div>
    </div>
  )
}

// Horizontal bar with % label
export function Bar({ label, value, total, tone }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="chart-bar-row">
      <span className="chart-bar-label">{label}</span>
      <div className="chart-bar-track">
        <div className={`chart-bar-fill chart-bar--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="chart-bar-value">{value} <em>{pct}%</em></span>
    </div>
  )
}
