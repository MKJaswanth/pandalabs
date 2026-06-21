import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './landing-overrides.css'
import App from './App.jsx'
import { migrateLegacyCache } from './utils/storage'
import { cleanupLegacyDemoData } from './utils/legacyCleanup'

// Migrate old generic cache keys to workspace-namespaced keys first, then prune
// any leftover seeded demo data — both run once before the app mounts.
migrateLegacyCache()
cleanupLegacyDemoData()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
