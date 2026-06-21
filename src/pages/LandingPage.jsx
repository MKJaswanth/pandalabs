import { useState, useEffect, useRef } from 'react'

/* ── Brand mark ──────────────────────────────────────────────────────────── */
const BrandMark = () => (
  <span className="brand-mark" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  </span>
)

/* ── Icons ───────────────────────────────────────────────────────────────── */
const icons = {
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 11 2 2 4-4" /></>,
  bolt: <><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></>,
  cases: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="m3 6 .8.8L5.5 5" /><path d="m3 12 .8.8 1.7-1.8" /><path d="m3 18 .8.8 1.7-1.8" /></>,
  run: <><path d="M5 4v16" /><path d="m5 12 6-4v8Z" /><path d="M15 8h4" /><path d="M15 16h4" /></>,
  bug: <><path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0Z" /><path d="M3 13h5" /><path d="M16 13h5" /><path d="M4 20l4-3" /><path d="m16 17 4 3" /><path d="M9 4 7 2" /><path d="m15 4 2-2" /></>,
  report: <><path d="M4 19V5" /><path d="M20 19H4" /><path d="M8 15v-4" /><path d="M13 15V8" /><path d="M18 15v-6" /></>,
}

const Glyph = ({ name }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icons[name]}
  </svg>
)

/* ── Data ────────────────────────────────────────────────────────────────── */
const pillars = [
  { icon: 'shield', title: 'You own your data', text: 'Your own instance and domain, not a shared multi-tenant cloud. Your test data stays yours.' },
  { icon: 'bolt', title: 'Fast and calm', text: 'Keyboard-first, instant, no clutter and no AI noise. A tool that gets out of the way.' },
  { icon: 'layers', title: 'The whole QA loop', text: 'Test cases, requirements, runs, bugs, and release readiness, all in one place.' },
  { icon: 'save', title: 'Never lose a result', text: 'Realtime cloud sync with an offline-safe local cache and one-click backups.' },
]

const features = [
  { icon: 'cases', title: 'Test cases & requirements', text: 'Write and organize test cases, link them to requirements, and see exactly what is covered and passing.' },
  { icon: 'run', title: 'Execution runs', text: 'A focused run cockpit: mark Pass, Fail, or Blocker fast and log a bug inline the moment something breaks.' },
  { icon: 'bug', title: 'Bug tracker', text: 'Severity, priority, linked test cases, attachments, and a full activity history, built in with no extra tool.' },
  { icon: 'report', title: 'Release-readiness reports', text: 'One clear view of what can ship, what is blocked, and the next QA action, exportable as a shareable PDF.' },
]

const steps = [
  { n: '1', title: 'Write test cases', text: 'Add cases and requirements, or import them, and organize by module.' },
  { n: '2', title: 'Run and log bugs', text: 'Execute a run, mark results, and capture defects as they happen.' },
  { n: '3', title: 'Share readiness', text: 'Send stakeholders a clean readiness report. Is it safe to ship?' },
]

/* ── Demo tabs data ──────────────────────────────────────────────────────── */
const demoTabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'runs', label: 'Test Runs' },
  { key: 'bugs', label: 'Bug Tracker' },
  { key: 'reports', label: 'Reports' },
]

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */

/** Intersection Observer hook for scroll-reveal */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return [ref, visible]
}

/* ── Demo panel content ──────────────────────────────────────────────────── */
function DemoDashboard() {
  return (
    <div className="ld-panel">
      <div className="ld-panel-head">
        <span className="ld-dot ld-dot--ok" />
        <strong>Release readiness</strong>
        <span className="ld-verdict ld-verdict--ok">Ready</span>
      </div>
      <div className="ld-stats">
        <div className="ld-stat"><span>Pass rate</span><strong>94%</strong></div>
        <div className="ld-stat"><span>Executed</span><strong>128/136</strong></div>
        <div className="ld-stat"><span>Open bugs</span><strong>2</strong></div>
        <div className="ld-stat"><span>Blockers</span><strong>0</strong></div>
      </div>
      <div className="ld-bar">
        <span className="ld-bar-seg ld-bar-seg--pass" style={{ flex: 94 }} />
        <span className="ld-bar-seg ld-bar-seg--warn" style={{ flex: 4 }} />
        <span className="ld-bar-seg ld-bar-seg--fail" style={{ flex: 2 }} />
      </div>
      <div className="ld-rows">
        <div><span>Checkout flow</span><em className="ld-pass">Verified</em></div>
        <div><span>Password reset</span><em className="ld-pass">Verified</em></div>
        <div><span>Payments retry</span><em className="ld-review">In progress</em></div>
      </div>
    </div>
  )
}

function DemoRuns() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2200); return () => clearInterval(id) }, [])
  const statuses = ['Pass', 'Pass', 'Fail', 'Pass', 'Pass', 'Pass', 'Blocker', 'Pass']
  return (
    <div className="ld-panel">
      <div className="ld-panel-head">
        <strong>Test Run: v2.1 Regression</strong>
        <span className="ld-badge ld-badge--running">Executing</span>
      </div>
      <div className="ld-run-progress">
        <span>Case {Math.min(tick % 9 + 1, 8)} of 8</span>
        <strong>{Math.min(Math.round(((tick % 9 + 1) / 8) * 100), 100)}%</strong>
      </div>
      <div className="ld-run-bar">
        <div className="ld-run-fill" style={{ width: `${Math.min(((tick % 9 + 1) / 8) * 100, 100)}%` }} />
      </div>
      <div className="ld-run-cases">
        {statuses.map((s, i) => {
          const done = i < (tick % 9 + 1)
          return (
            <div key={i} className={`ld-run-case ${done ? 'ld-run-case--done' : ''}`}>
              <span className="ld-run-case-n">{i + 1}</span>
              <span className={`ld-run-case-status ld-rs--${s.toLowerCase()}`}>
                {done ? s : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="ld-run-shortcuts">
        <span>P Pass</span><span>F Fail</span><span>B Block</span><span>← → navigate</span>
      </div>
    </div>
  )
}

function DemoBugs() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2800); return () => clearInterval(id) }, [])
  const bugs = [
    { id: 'BUG-AU-001', title: 'Login fails on Safari 17', sev: 'Critical', status: 'Open' },
    { id: 'BUG-PA-002', title: 'Payment timeout after 30s', sev: 'Major', status: 'In review' },
    { id: 'BUG-CH-003', title: 'Cart total rounds wrong', sev: 'Minor', status: 'Closed' },
  ]
  return (
    <div className="ld-panel">
      <div className="ld-panel-head">
        <strong>Bug Tracker</strong>
        <span className="ld-badge ld-badge--open">3 open</span>
      </div>
      <div className="ld-bug-list">
        {bugs.map((b, i) => (
          <div key={i} className={`ld-bug-row ${tick % 4 === i ? 'ld-bug-row--highlight' : ''}`}>
            <span className="ld-bug-id">{b.id}</span>
            <span className="ld-bug-title">{b.title}</span>
            <span className={`ld-severity ld-sev--${b.sev.toLowerCase()}`}>{b.sev}</span>
            <span className={`ld-bug-status ld-bs--${b.status.toLowerCase().replace(' ', '')}`}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DemoReports() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2500); return () => clearInterval(id) }, [])
  const modules = [
    { name: 'Auth', pass: 12, fail: 0, tone: 'ok' },
    { name: 'Checkout', pass: 8, fail: 1, tone: 'warn' },
    { name: 'Payments', pass: 5, fail: 3, tone: 'fail' },
  ]
  return (
    <div className="ld-panel">
      <div className="ld-panel-head">
        <strong>Project Report</strong>
        <span className="ld-verdict ld-verdict--warn">At risk</span>
      </div>
      <div className="ld-report-mods">
        {modules.map((m, i) => (
          <div key={i} className={`ld-report-row ${tick % 3 === i ? 'ld-report-row--highlight' : ''}`}>
            <span className="ld-report-name">{m.name}</span>
            <div className="ld-report-bar">
              <span className={`ld-report-fill ld-report-fill--${m.tone}`} style={{ flex: m.pass }} />
              {m.fail > 0 && <span className="ld-report-fill ld-report-fill--fail" style={{ flex: m.fail }} />}
            </div>
            <span className="ld-report-counts">
              <span className="ld-pass">{m.pass}</span>
              {m.fail > 0 && <span className="ld-fail">{m.fail}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="ld-report-summary">
        <div><span>Total</span><strong>28</strong></div>
        <div><span>Passed</span><strong className="ld-pass">25</strong></div>
        <div><span>Failed</span><strong className="ld-fail">4</strong></div>
        <div><span>Pass rate</span><strong>89%</strong></div>
      </div>
    </div>
  )
}

const demoPanels = { dashboard: DemoDashboard, runs: DemoRuns, bugs: DemoBugs, reports: DemoReports }

/* ── Main component ──────────────────────────────────────────────────────── */
export function LandingPage({ onGetStarted }) {
  const [activeDemo, setActiveDemo] = useState('dashboard')
  const [userInteracted, setUserInteracted] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)

  // Track scroll progress for the progress bar (throttled via rAF)
  useEffect(() => {
    let raf = 0
    const updateScroll = () => {
      const docHeight = document.documentElement.scrollHeight
      const viewHeight = window.innerHeight
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop
      const scrollable = docHeight - viewHeight
      setScrollPct(scrollable > 0 ? Math.min((scrollTop / scrollable) * 100, 100) : 0)
    }

    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        updateScroll()
      })
    }

    // Run initial update on mount to align with current scroll position
    updateScroll()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('load', updateScroll, { passive: true })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('load', updateScroll)
    }
  }, [])
  const [heroRef, heroVisible] = useScrollReveal(0.1)
  const [pillarsRef, pillarsVisible] = useScrollReveal(0.1)
  const [featuresRef, featuresVisible] = useScrollReveal(0.1)
  const [howRef, howVisible] = useScrollReveal(0.1)
  const [wedgeRef, wedgeVisible] = useScrollReveal(0.1)
  const [finalRef, finalVisible] = useScrollReveal(0.1)

  // Auto-cycle demo tabs — pauses when user manually clicks a tab
  useEffect(() => {
    if (userInteracted) return
    const keys = demoTabs.map((t) => t.key)
    const id = setInterval(() => {
      setActiveDemo((prev) => {
        const idx = keys.indexOf(prev)
        return keys[(idx + 1) % keys.length]
      })
    }, 3500)
    return () => clearInterval(id)
  }, [userInteracted])

  const selectDemoTab = (key) => {
    setActiveDemo(key)
    setUserInteracted(true)
  }

  const DemoPanel = demoPanels[activeDemo]

  return (
    <div className="lp">
      {/* ── Scroll progress bar ─────────────────────────────────── */}
      <div className="lp-progress-track" aria-hidden="true">
        <div className="lp-progress-fill" style={{ width: `${scrollPct}%` }} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="lp-nav">
        <a className="lp-brand" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><BrandMark /><span>QA Lab</span></a>
        <nav className="lp-nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollToId('features') }}>Features</a>
          <a href="#how" onClick={(e) => { e.preventDefault(); scrollToId('how') }}>How it works</a>
          <button type="button" className="lp-nav-signin" onClick={onGetStarted}>Sign in</button>
          <button type="button" className="primary-button lp-nav-cta" onClick={onGetStarted}>Get started</button>
        </nav>
      </header>

      <main className="lp-main" id="top">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className={`lp-hero ${heroVisible ? 'lp-reveal' : ''}`} ref={heroRef}>
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">Self-hosted QA test management</span>
            <h1 className="lp-h1">The QA platform your team fully owns.</h1>
            <p className="lp-sub">
              Test cases, runs, bugs, and release readiness in one fast, calm workspace.
              Your own instance, your data.
            </p>
            <div className="lp-cta-row">
              <button type="button" className="primary-button lp-cta-primary lp-cta-pulse" onClick={onGetStarted}>Get started free</button>
              <button type="button" className="secondary-button lp-cta-secondary" onClick={onGetStarted}>Sign in</button>
            </div>
            <p className="lp-trust">No credit card · Works offline · Your data stays yours</p>
          </div>

          {/* Interactive mini-demo */}
          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-glow" />
            <div className="lp-demo-card">
              <div className="lp-demo-tabs">
                {demoTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`lp-demo-tab ${activeDemo === t.key ? 'lp-demo-tab--active' : ''}`}
                    onClick={() => selectDemoTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <DemoPanel />
            </div>
          </div>
        </section>

        {/* ── Pillars ───────────────────────────────────────────── */}
        <section className={`lp-pillars ${pillarsVisible ? 'lp-reveal' : ''}`} ref={pillarsRef}>
          {pillars.map((p, i) => (
            <article key={p.title} className="lp-pillar" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="lp-pillar-icon"><Glyph name={p.icon} /></span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className={`lp-section ${featuresVisible ? 'lp-reveal' : ''}`} id="features" ref={featuresRef}>
          <div className="lp-section-head">
            <h2>Everything a QA team needs, nothing it doesn't</h2>
            <p>The full testing loop in one tool, no add-ons and no AI gimmicks.</p>
          </div>
          <div className="lp-feature-grid">
            {features.map((f, i) => (
              <article key={f.title} className="lp-feature" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="lp-feature-icon"><Glyph name={f.icon} /></span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className={`lp-section lp-how ${howVisible ? 'lp-reveal' : ''}`} id="how" ref={howRef}>
          <div className="lp-section-head">
            <h2>From test case to "ready to ship" in three steps</h2>
          </div>
          <div className="lp-steps">
            {steps.map((s, i) => (
              <article key={s.n} className="lp-step" style={{ transitionDelay: `${i * 100}ms` }}>
                <span className="lp-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Wedge ─────────────────────────────────────────────── */}
        <section className={`lp-wedge ${wedgeVisible ? 'lp-reveal' : ''}`} ref={wedgeRef}>
          <h2>Your QA data shouldn&apos;t live in someone else&apos;s cloud.</h2>
          <p>
            Every team gets its own instance and its own domain, fully isolated and fully yours.
            No shared database, no lock-in. Own your quality, end to end.
          </p>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section className={`lp-final ${finalVisible ? 'lp-reveal' : ''}`} ref={finalRef}>
          <h2>Ready to own your QA?</h2>
          <button type="button" className="primary-button lp-cta-primary lp-cta-pulse" onClick={onGetStarted}>Get started free</button>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-brand"><BrandMark /><span>QA Lab</span></div>
        <span className="lp-footer-note">QA test management you own.</span>
      </footer>
    </div>
  )
}
