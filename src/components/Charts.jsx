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
    <div className="pass-ring-wrap" style={{ width: size, height: size }} role="img" aria-label={`Pass rate ${rate}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="pass-ring-svg" style={{ width: size, height: size }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className="ring-fill"
          stroke={strokeColor}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ / 4}
        />
      </svg>
      <div className="pass-ring-label" aria-hidden="true">
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
    <div className="chart-bar-row" role="img" aria-label={`${label}: ${value} of ${total || 0}, ${pct}%`}>
      <span className="chart-bar-label">{label}</span>
      <div className="chart-bar-track" aria-hidden="true">
        <div className={`chart-bar-fill chart-bar--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="chart-bar-value">{value} <em>{pct}%</em></span>
    </div>
  )
}

// SVG polyline sparkline for run pass-rate trend
export function RunTrend({ runs }) {
  if (!runs || runs.length < 2) return null
  const rates = runs.map((r) => (r.total ? Math.round((r.passed / r.total) * 100) : 0))
  const W = 180, H = 52, pad = 6
  const xStep = runs.length > 1 ? (W - pad * 2) / (runs.length - 1) : 0
  const yScale = (v) => pad + (H - pad * 2) * (1 - v / 100)
  const pts = rates.map((v, i) => [pad + i * xStep, yScale(v)])
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const latest = rates[rates.length - 1]
  const prev = rates[rates.length - 2]
  const delta = latest - prev
  const color = latest >= 70 ? 'var(--success)' : latest >= 50 ? 'var(--warning)' : 'var(--danger)'
  const deltaColor = delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)'

  return (
    <div className="run-trend-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="run-trend-svg" aria-hidden>
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill={color} />
        ))}
      </svg>
      <div className="run-trend-meta">
        <span className="run-trend-latest" style={{ color }}>{latest}%</span>
        {delta !== 0 && (
          <span className="run-trend-delta" style={{ color: deltaColor }}>
            {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
          </span>
        )}
        <span className="run-trend-label">{runs.length} runs</span>
      </div>
    </div>
  )
}
