import { useState, useEffect } from 'react'
import App from './App.jsx'
import CaregiverApp from './CaregiverApp.jsx'
import logo from './assets/logo.jpg'
import './App.css'

function Root() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState(() => localStorage.getItem('app_role') || '')

  // Listen for logout events dispatched by sub-apps
  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('app_role')
      setRole('')
    }
    window.addEventListener('app-logout', handleLogout)
    return () => window.removeEventListener('app-logout', handleLogout)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const isJson = (res.headers.get('content-type') || '').includes('application/json')
      const data = isJson ? await res.json() : null
      if (!res.ok) throw new Error(data?.detail || `Login failed (${res.status})`)

      const jwt = data.access_token

      const meRes = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${jwt}` }
      })
      const meIsJson = (meRes.headers.get('content-type') || '').includes('application/json')
      const meData = meIsJson ? await meRes.json() : null
      if (!meRes.ok) throw new Error(meData?.detail || 'Could not verify user')

      const userRole = meData.role // ADMIN / SUPERVISOR / CUSTOMER / CAREGIVER

      // Clear any stale role tokens before switching apps so the correct portal mounts.
      localStorage.removeItem('admin_token')
      localStorage.removeItem('cg_token')
      localStorage.removeItem('app_role')

      if (userRole === 'CAREGIVER') {
        localStorage.setItem('cg_token', jwt)
      } else {
        localStorage.setItem('admin_token', jwt)
      }
      localStorage.setItem('app_role', userRole)
      setPassword('')
      setRole(userRole)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (role === 'ADMIN' || role === 'SUPERVISOR' || role === 'CUSTOMER') return <App />
  if (role === 'CAREGIVER') return <CaregiverApp />

  // Single shared login page
  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <img src={logo} alt="Angels at Home" style={{ height: '56px', objectFit: 'contain' }} />
          <p className="subtitle">Caregiver Management System</p>
        </div>
      </header>
      <section className="card login-card">
        <h2>Sign In</h2>
        <form className="grid-form login-form root-login-form" onSubmit={handleLogin} autoComplete="off">
          <label>
            User
            <input
              type="email"
              name="login-email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="login-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p style={{ color: '#c00', margin: '0' }}>{error}</p>}
          <button className="solid-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default Root
