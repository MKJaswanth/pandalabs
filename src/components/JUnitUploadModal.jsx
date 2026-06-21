import { useState, useRef } from 'react'
import { Modal } from './Modal'
import { UploadIcon, AlertTriangleIcon } from './Icons'
import { newId } from '../utils/id'
import { historyEntry, withHistory } from '../utils/history'
import { addActivity } from '../utils/activity'
import { summarizeStatuses } from '../utils/status'

// Simple regex to look for TC IDs (e.g. TC-GE-001) in test names or classnames
const TC_ID_REGEX = /TC-[A-Z]{2}-\d+/i

export function JUnitUploadModal({
  isOpen,
  onClose,
  projectId,
  testCases = [],
  addRun,
  updateTestCase,
  addBug,
  plans = [],
  user = 'User',
}) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null) // { suiteName, time, cases: [...] }
  const [runName, setRunName] = useState('')
  const [build, setBuild] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [autoLogBugs, setAutoLogBugs] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  
  // Custom manual mappings: { [xmlCaseIndex]: selectedTestCaseId }
  const [mappings, setMappings] = useState({})
  
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.xml')) {
      processFile(droppedFile)
    } else {
      setErrorMsg('Please upload a valid .xml file.')
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      processFile(selected)
    }
  }

  const processFile = (selectedFile) => {
    setErrorMsg('')
    setFile(selectedFile)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const data = parseJUnitXML(text)
        if (data.cases.length === 0) {
          throw new Error('No testcases found in the JUnit XML file.')
        }
        
        setParsedData(data)
        
        // Auto-fill run name based on suite name & current date
        const dateStr = new Date().toLocaleDateString()
        setRunName(data.suiteName ? `Automated Suite: ${data.suiteName} (${dateStr})` : `Automated Run (${dateStr})`)
        
        // Compute initial mappings
        const initialMappings = {}
        data.cases.forEach((tc, idx) => {
          const match = findTestCaseMatch(tc, testCases)
          if (match) {
            initialMappings[idx] = match.id
          } else {
            initialMappings[idx] = '' // unmapped by default
          }
        })
        setMappings(initialMappings)
      } catch (err) {
        console.error(err)
        setErrorMsg(err.message || 'Failed to parse XML file.')
        setFile(null)
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = () => {
    if (!runName.trim()) {
      setErrorMsg('Please specify a run name.')
      return
    }

    try {
      const runId = newId()
      const executedCases = []
      const autoBugIds = []
      
      // We will perform updates
      for (let idx = 0; idx < parsedData.cases.length; idx++) {
        const xmlCase = parsedData.cases[idx]
        const targetCaseId = mappings[idx]
        const targetCase = testCases.find((c) => c.id === targetCaseId)
        
        if (targetCase) {
          // Update base test case status and execution history
          const actualText = xmlCase.failureMsg 
            ? `${xmlCase.failureMsg}\n(Class: ${xmlCase.className || 'Unknown'}, Duration: ${xmlCase.duration}s)`
            : `Execution completed successfully. (Duration: ${xmlCase.duration}s)`
            
          updateTestCase(withHistory(
            { 
              ...targetCase, 
              status: xmlCase.status, 
              actual: actualText, 
              updatedAt: new Date().toISOString(), 
              updatedBy: user 
            },
            historyEntry('execution', user, `Executed via JUnit import as ${xmlCase.status}`, targetCase.status, xmlCase.status)
          ))
          
          let bugId = ''
          // Auto-log bug if case failed
          if (autoLogBugs && (xmlCase.status === 'Fail' || xmlCase.status === 'Blocker')) {
            const bug = addBug({
              id: newId(),
              title: `${targetCase.title} failed during automated run`,
              description: `Automated test "${xmlCase.name}" failed.\n\nError Message:\n${xmlCase.failureMsg || 'No failure details available.'}`,
              severity: xmlCase.status === 'Blocker' ? 'Critical' : 'Major',
              status: 'Open',
              linkedTestCase: targetCase.id,
              module: targetCase.module || '',
              priority: targetCase.priority || '',
              reportedBy: user,
              reportedByName: user,
              linkedRunId: runId,
              history: [historyEntry('created', user, 'Auto-created from failed automated run import')],
            })
            bugId = bug.id
            autoBugIds.push(bug.id)
          }

          executedCases.push({
            testCaseId: targetCase.id,
            title: targetCase.title,
            module: targetCase.module || '',
            priority: targetCase.priority || '',
            assignee: targetCase.assignee || '',
            status: xmlCase.status,
            actual: actualText,
            bugId,
          })
        }
      }

      if (executedCases.length === 0) {
        throw new Error('No mapped test cases executed.')
      }

      const summary = summarizeStatuses(executedCases)
      const passRate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0

      // Calculate started time safely without Date.now() call
      const completedTime = new Date()
      const startedTime = new Date(completedTime.getTime() - (parsedData.time * 1000))

      // Write test run history
      addRun({
        id: runId,
        name: runName.trim(),
        build: build.trim(),
        executedBy: user,
        startedAt: startedTime.toISOString(),
        completedAt: completedTime.toISOString(),
        testPlanId: selectedPlanId || '',
        cases: executedCases,
        bugsLogged: autoBugIds.length,
        linkedBugIds: autoBugIds,
        failureModules: failingModulesList(executedCases),
        passRate,
        ...summary,
      })

      addActivity({
        id: newId(),
        projectId,
        type: 'test_run_completed',
        entityType: 'test_run',
        entityId: runId,
        actorName: user,
        action: 'created',
        title: `JUnit Import: Test run "${runName.trim()}" completed`,
        details: `Pass rate: ${passRate}% (${summary.passed}/${summary.total} cases). ${autoBugIds.length} bugs automatically created.`,
      })

      onClose()
      resetState()
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'An error occurred during import.')
    }
  }

  const resetState = () => {
    setFile(null)
    setParsedData(null)
    setRunName('')
    setBuild('')
    setSelectedPlanId('')
    setMappings({})
    setErrorMsg('')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose()
        resetState()
      }}
      title="Import automated JUnit results"
    >
      <div className="junit-modal-content" style={{ display: 'grid', gap: '16px', fontSize: '13px' }}>
        {errorMsg && (
          <div className="error-banner" style={{ background: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <AlertTriangleIcon width={16} height={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {!parsedData ? (
          /* Upload Step */
          <div
            className="drop-zone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-strong)',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--soft-bg)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml"
              style={{ display: 'none' }}
            />
            <UploadIcon width={32} height={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-strong)' }}>Drag & drop JUnit XML file here</h4>
            <p className="text-muted" style={{ margin: 0, fontSize: '12px' }}>Or click to browse your computer (.xml files only)</p>
          </div>
        ) : (
          /* Configuration & Mapping Step */
          <div style={{ display: 'grid', gap: '16px' }}>
            {file && (
              <div style={{ fontSize: '12px', color: 'var(--text-soft)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                Importing: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}

            <div className="form-row">
              <label>
                Run Name
                <input
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="e.g. Automated Integration Run"
                  required
                />
              </label>
              <label>
                Build / Version
                <input
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                  placeholder="e.g. build-84a"
                />
              </label>
            </div>

            <div className="form-row">
              {plans.length > 0 && (
                <label>
                  Link to Test Plan
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                  >
                    <option value="">No Plan (Standalone Run)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'var(--page-bg)', padding: '12px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={autoLogBugs}
                  onChange={(e) => setAutoLogBugs(e.target.checked)}
                />
                Auto-log bugs for test failures
              </label>
            </div>

            <div style={{ marginTop: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-strong)' }}>
                Test Case Mapping Preview ({parsedData.cases.length} tests found)
              </h4>
              <div
                className="mapping-list-container"
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Automated Test</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '220px' }}>Maps to QA Lab Case</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.cases.map((xmlCase, idx) => {
                      const isMapped = mappings[idx]
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{xmlCase.name}</div>
                            {xmlCase.className && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                                Class: {xmlCase.className}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background:
                                  xmlCase.status === 'Pass' ? '#e9f7ee' :
                                  xmlCase.status === 'Fail' ? '#fef0f0' :
                                  xmlCase.status === 'Blocker' ? '#fff1f0' : '#f5f5f5',
                                color:
                                  xmlCase.status === 'Pass' ? '#1a6b37' :
                                  xmlCase.status === 'Fail' ? '#a93030' :
                                  xmlCase.status === 'Blocker' ? '#7f1d1d' : '#555',
                              }}
                            >
                              {xmlCase.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={mappings[idx] || ''}
                              onChange={(e) => setMappings(prev => ({ ...prev, [idx]: e.target.value }))}
                              style={{
                                height: '28px',
                                fontSize: '11.5px',
                                padding: '0 4px',
                                borderColor: isMapped ? '#b6e4c8' : 'var(--border-strong)',
                                background: isMapped ? '#f4fbf7' : 'var(--surface)',
                              }}
                            >
                              <option value="">-- Do Not Map --</option>
                              {testCases.map((tc) => (
                                <option key={tc.id} value={tc.id}>
                                  {tc.sourceTcId || 'TC'} : {tc.title}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="secondary-button" type="button" onClick={resetState}>
                Reset
              </button>
              <button className="primary-button" type="button" onClick={handleImport}>
                Import results
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Private Helpers ─────────────────────────────────────────────────────────

function parseJUnitXML(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid XML format')
  }

  const suiteEl = doc.querySelector('testsuite')
  const suiteName = suiteEl ? (suiteEl.getAttribute('name') || 'Automated Suite') : 'Automated Suite'
  const time = suiteEl ? parseFloat(suiteEl.getAttribute('time') || '0') : 0

  const cases = []
  const testcaseEls = doc.querySelectorAll('testcase')
  
  testcaseEls.forEach((el) => {
    const name = el.getAttribute('name') || ''
    const className = el.getAttribute('classname') || ''
    const duration = parseFloat(el.getAttribute('time') || '0')
    
    let status = 'Pass'
    let failureMsg = ''
    
    const failureEl = el.querySelector('failure')
    const errorEl = el.querySelector('error')
    const skippedEl = el.querySelector('skipped')
    
    if (failureEl) {
      status = 'Fail'
      failureMsg = failureEl.textContent || failureEl.getAttribute('message') || 'Failure'
    } else if (errorEl) {
      status = 'Blocker'
      failureMsg = errorEl.textContent || errorEl.getAttribute('message') || 'Error'
    } else if (skippedEl) {
      status = 'Skip'
    }
    
    cases.push({
      name,
      className,
      duration,
      status,
      failureMsg,
    })
  })

  return {
    suiteName,
    time,
    cases,
  }
}

function findTestCaseMatch(xmlCase, existingTestCases) {
  // Extract TC-XX-NNN formatted display IDs
  const match = xmlCase.name.match(TC_ID_REGEX) || (xmlCase.className && xmlCase.className.match(TC_ID_REGEX))
  if (match) {
    const targetId = match[0].toUpperCase()
    const found = existingTestCases.find((tc) => (tc.sourceTcId || '').toUpperCase() === targetId)
    if (found) return found
  }

  // Fallback to title matching
  const normXmlTitle = normalizeTitle(xmlCase.name)
  return existingTestCases.find((tc) => normalizeTitle(tc.title) === normXmlTitle)
}

function normalizeTitle(title) {
  return title
    .replace(/TC-[A-Z]{2}-\d+/gi, '')
    .replace(/^[:-\s]+/, '')
    .trim()
    .toLowerCase()
}

function failingModulesList(cases = []) {
  const counts = cases.reduce((acc, tc) => {
    if (tc.status !== 'Fail' && tc.status !== 'Blocker') return acc
    const module = tc.module || 'Unassigned'
    acc[module] = (acc[module] || 0) + 1
    return acc
  }, {})
  return Object.entries(counts).map(([module, count]) => ({ module, count }))
}
