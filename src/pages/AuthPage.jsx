import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { EyeIcon, EyeOffIcon } from '../components/Icons'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function AuthPage({ onBack }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest, redirectError } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const clearError = () => setError('')

  // Combine local form errors with any redirect sign-in error
  const displayError = error || (redirectError ? friendlyError(redirectError) : '')

  const handleGoogle = async () => {
    setLoading(true)
    clearError()
    try {
      await signInWithGoogle()
      // Page will redirect away; code below only runs if signInWithRedirect throws
    } catch (err) {
      setError(friendlyError(err.code))
      setLoading(false)
    }
  }

  const handleGuest = async () => {
    setLoading(true)
    clearError()
    try {
      await signInAsGuest()
    } catch (err) {
      setError(friendlyError(err.code))
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearError()
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, displayName)
      }
    } catch (err) {
      setError(friendlyError(err.code))
      setLoading(false)
    }
  }

  return (
    <div className="auth-backdrop">
      <div className="auth-card">
        {onBack && (
          <button type="button" className="auth-back" onClick={onBack}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
        )}
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </span>
          <span>QA Lab</span>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </h1>

        {/* Google */}
        <button
          className="google-btn"
          type="button"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        <div className="auth-divider"><span>or</span></div>

        {/* Email / password */}
        <form className="auth-form" onSubmit={handleEmailSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete={mode === 'login' ? 'username' : 'email'}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
              </button>
            </div>
          </label>

          {displayError && <p className="auth-error" role="alert">{displayError}</p>}

          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>No account? <button type="button" className="link-btn" onClick={() => { setMode('register'); clearError() }}>Create one</button></>
          ) : (
            <>Already have an account? <button type="button" className="link-btn" onClick={() => { setMode('login'); clearError() }}>Sign in</button></>
          )}
        </p>

        <div className="auth-divider"><span>or</span></div>

        {/* Guest access */}
        <button
          type="button"
          className="guest-btn"
          onClick={handleGuest}
          disabled={loading}
        >
          Continue as guest
        </button>
        <p className="auth-guest-note">
          No account needed. Data is saved in this browser only.
        </p>
      </div>
    </div>
  )
}

function friendlyError(code) {
  const map = {
    'auth/invalid-credential':        'Incorrect email or password.',
    'auth/user-not-found':            'No account found with that email.',
    'auth/wrong-password':            'Incorrect password.',
    'auth/email-already-in-use':      'An account with this email already exists.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/invalid-email':             'Please enter a valid email address.',
    'auth/too-many-requests':         'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user':      'Sign-in cancelled.',
    'auth/cancelled-popup-request':   'Sign-in cancelled.',
    'auth/popup-blocked':             'Pop-up blocked by your browser. Please allow pop-ups for this site and try again.',
    'auth/network-request-failed':    'Network error. Check your connection and try again.',
    'auth/unauthorized-domain':       'This domain is not authorised for sign-in. Open Firebase Console → Authentication → Settings → Authorized Domains and add this site\'s URL.',
    'auth/operation-not-allowed':     'Google sign-in is not enabled. In Firebase Console go to Authentication → Sign-in methods and enable Google.',
    'auth/internal-error':            'Firebase returned an internal error. Check the browser console for more details.',
    'auth/admin-restricted-operation': 'Guest sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in methods → Anonymous and enable it.',
    'auth/unknown':                   'An unknown error occurred. Check the browser console for details.',
  }
  return map[code] ?? `Sign-in failed (${code ?? 'unknown'}). Please try again.`
}
