import { useEffect, useMemo, useState } from 'react'
import logo from './assets/logo.jpg'
import './CaregiverApp.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function nowTimeHourZero() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

function addHoursToLocalDateTime(dateStr, timeStr, hoursToAdd) {
  const dt = parseLocalDateTime(dateStr, timeStr)
  if (!dt) return null
  dt.setHours(dt.getHours() + hoursToAdd, 0, 0, 0)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  return { end_date: `${y}-${m}-${d}`, end_time: `${hh}:00` }
}

function readError(data, fallback = 'Request failed') {
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail))
    return data.detail.map((i) => i?.msg ?? JSON.stringify(i)).join(', ')
  return fallback
}

function parseLocalDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function getAnchoredPeriodLabel(dt, anchorDow, anchorTime) {
  // NOTE: anchorDow from backend uses Python convention: 0=Monday...6=Sunday
  // JavaScript getDay() uses: 0=Sunday...6=Saturday
  // Convert backend convention to JavaScript convention
  const jsAnchorDow = (anchorDow + 1) % 7

  if (!anchorTime || !anchorTime.includes(':')) {
    // Fallback to calendar week
    return periodLabelForDate(dt, 'week')
  }

  const [anchorHour, anchorMin] = anchorTime.split(':').map(Number)

  // Find the most recent anchor point (on or before dt)
  const testDate = new Date(dt)
  const currentDow = testDate.getDay()
  const currentHour = testDate.getHours()
  const currentMin = testDate.getMinutes()

  // Calculate days back to reach the anchor day
  let daysBack = (currentDow - jsAnchorDow + 7) % 7

  // If we're on the anchor day
  if (daysBack === 0) {
    // Check if current time is before anchor time
    const isBeforeAnchor = currentHour < anchorHour || (currentHour === anchorHour && currentMin < anchorMin)
    if (isBeforeAnchor) {
      // Go back 7 days to the previous anchor
      daysBack = 7
    }
  }

  // Compute the period start (most recent anchor)
  const periodStart = new Date(testDate)
  periodStart.setDate(periodStart.getDate() - daysBack)
  periodStart.setHours(anchorHour, anchorMin, 0, 0)

  // Compute the period end (next anchor, 7 days later)
  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + 7)

  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  }

  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][periodStart.getDay()]
  return `${dayName} ${fmt(periodStart)} to ${fmt(periodEnd)}`
}

function periodLabelForDate(dt, periodType, client = null) {
  // If client has anchor settings, use anchored period
  if (client && client.invoice_anchor_dow != null && client.invoice_anchor_time) {
    return getAnchoredPeriodLabel(dt, client.invoice_anchor_dow, client.invoice_anchor_time)
  }

  if (periodType === 'month') {
    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  const weekStart = new Date(dt)
  const weekday = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - weekday)
  const year = weekStart.getFullYear()
  const month = String(weekStart.getMonth() + 1).padStart(2, '0')
  const day = String(weekStart.getDate()).padStart(2, '0')
  return `Week of ${year}-${month}-${day}`
}

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A'
  return `$${Number(value).toFixed(2)}`
}

export default function CaregiverApp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const INACTIVITY_MS = 5 * 60 * 1000
  const [token, setToken] = useState(() => localStorage.getItem('cg_token') || '')
  const [me, setMe] = useState(null)
  const [clients, setClients] = useState([])
  const [openShift, setOpenShift] = useState(null)
  const [myShifts, setMyShifts] = useState([])
  const [plannedAssignments, setPlannedAssignments] = useState([])
  const [periodType, setPeriodType] = useState('week')
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [passwordChange, setPasswordChange] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  // ── Sidebar navigation ──────────────────────────────────────────────────
  const [cgActiveTab, setCgActiveTab] = useState('shifts') // 'shifts' | 'hours' | 'reports'

  // ── My Reports filters ───────────────────────────────────────────────────
  const [rptClientFilter, setRptClientFilter] = useState('')
  const [rptFrom, setRptFrom] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
  })
  const [rptFromTime, setRptFromTime] = useState('00:00')
  const [rptTo, setRptTo] = useState(() => {
    const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0)
    return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`
  })
  const [rptToTime, setRptToTime] = useState('23:00')

  // ── Logged Hours week navigation ────────────────────────────────────────
  const [cgWeekKey, setCgWeekKey] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay())
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })

  // Check-in form
  const [checkIn, setCheckIn] = useState({
    client_id: '',
    start_date: todayStr(),
    start_time: nowTimeHourZero(),
    notes: ''
  })
  const [checkInPopupMessage, setCheckInPopupMessage] = useState('')

  // Check-out form
  const [checkOut, setCheckOut] = useState({
    start_date: todayStr(),
    start_time: nowTimeHourZero(),
    end_date: todayStr(),
    end_time: nowTimeHourZero(),
    notes: ''
  })
  const [lastCheckoutSummary, setLastCheckoutSummary] = useState(null)

  const isLoggedIn = Boolean(token)

  useEffect(() => {
    if (token) {
      localStorage.setItem('cg_token', token)
      loadAll(token)
    } else {
      localStorage.removeItem('cg_token')
    }
  }, [token])

  // Auto-logout after 5 minutes of inactivity
  useEffect(() => {
    if (!isLoggedIn) return
    let timer = setTimeout(() => {
      logout()
      setStatus('Session expired due to inactivity.')
    }, INACTIVITY_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        logout()
        setStatus('Session expired due to inactivity.')
      }, INACTIVITY_MS)
    }
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [isLoggedIn])

  async function authedFetch(path, options = {}, jwt = token) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${jwt}`
    }
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(path, { ...options, headers })
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json() : null
    if (!res.ok) throw new Error(readError(data, `HTTP ${res.status}`))
    return data
  }

  async function loadAll(jwt) {
    setLoading(true)
    try {
      const meData = await authedFetch('/api/v1/auth/me/caregiver', {}, jwt)
      setMe(meData)
      setMustChangePassword(Boolean(meData.must_change_password))

      if (meData.must_change_password) {
        setStatus('Please change your password to continue.')
        setClients([])
        setOpenShift(null)
        setMyShifts([])
        return
      }

      const clientsData = await authedFetch('/api/v1/shifts/clients', {}, jwt)
      setClients(Array.isArray(clientsData) ? clientsData : [])

      await loadShiftStatus(jwt)
      await loadMyShifts(jwt)
      await loadPlannedAssignments(jwt, cgWeekKey, Array.isArray(clientsData) ? clientsData : [], meData?.caregiver_id)
      setStatus('Ready')
    } catch (err) {
      setStatus(`Error loading data: ${err.message}`)
      if (err.message.includes('admin')) {
        // do not clear token, just warn
      } else {
        setToken('')
        setMe(null)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadShiftStatus(jwt) {
    try {
      const data = await authedFetch('/api/v1/shifts/open', {}, jwt)
      setOpenShift(data)
      const defaultCheckout = addHoursToLocalDateTime(data?.start_date, data?.start_time, 8)
      setCheckOut({
        start_date: data?.start_date || todayStr(),
        start_time: data?.start_time || nowTimeHourZero(),
        end_date: defaultCheckout?.end_date || todayStr(),
        end_time: defaultCheckout?.end_time || nowTimeHourZero()
      })
    } catch {
      setOpenShift(null)
    }
  }

  async function loadMyShifts(jwt) {
    try {
      const data = await authedFetch('/api/v1/shifts/mine', {}, jwt)
      setMyShifts(Array.isArray(data) ? data : [])
    } catch {
      setMyShifts([])
    }
  }

  async function loadPlannedAssignments(jwt, weekKey = cgWeekKey, clientsList = clients, caregiverId = me?.caregiver_id) {
    if (!jwt || !caregiverId || !Array.isArray(clientsList) || clientsList.length === 0) {
      setPlannedAssignments([])
      return
    }

    const start = new Date(`${weekKey}T00:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fromDate = fmt(start)
    const toDate = fmt(end)

    try {
      const allResults = await Promise.all(
        clientsList.map((c) => {
          const params = new URLSearchParams({
            client_id: String(c.client_id),
            from_date: fromDate,
            to_date: toDate,
          })
          return authedFetch(`/api/v1/scheduler/assignments?${params.toString()}`, {}, jwt).catch(() => [])
        })
      )

      const mine = allResults
        .flat()
        .filter((a) => Number(a.caregiver_id) === Number(caregiverId) && a.assign_date)

      setPlannedAssignments(mine)
    } catch {
      setPlannedAssignments([])
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setStatus('Logging in...')
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(readError(data, 'Login failed'))
      setToken(data.access_token)
      setPassword('')
      setStatus('Logged in')
    } catch (err) {
      setStatus(`Login failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setToken('')
    setMe(null)
    setMustChangePassword(false)
    setPasswordChange({
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
    setClients([])
    setOpenShift(null)
    setMyShifts([])
    setPlannedAssignments([])
    setStatus('Logged out')
    window.dispatchEvent(new Event('app-logout'))
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!passwordChange.current_password || !passwordChange.new_password) {
      setStatus('Current and new password are required')
      return
    }
    if (passwordChange.new_password.length < 8) {
      setStatus('New password must be at least 8 characters')
      return
    }
    if (passwordChange.new_password !== passwordChange.confirm_password) {
      setStatus('New password and confirmation do not match')
      return
    }

    setLoading(true)
    setStatus('Updating password...')
    try {
      await authedFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordChange.current_password,
          new_password: passwordChange.new_password
        })
      })

      setPasswordChange({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      setMustChangePassword(false)
      await loadAll(token)
      setStatus('Password changed successfully')
    } catch (err) {
      setStatus(`Password change failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckIn(e) {
    e.preventDefault()
    setLoading(true)
    setStatus('Checking in...')
    setCheckInPopupMessage('')
    try {
      const payload = {
        client_id: Number(checkIn.client_id),
        start_date: checkIn.start_date,
        start_time: checkIn.start_time,
        notes: checkIn.notes || undefined
      }
      await authedFetch('/api/v1/shifts/check-in', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setStatus('Checked in successfully')
      setCheckInPopupMessage('')
      await loadShiftStatus(token)
      await loadMyShifts(token)
    } catch (err) {
      const message = String(err?.message || '')
      if (message.toLowerCase().includes('no pay rate configured')) {
        setStatus('Check-in failed')
        setCheckInPopupMessage('No pay rate configured for you and client selected')
      } else {
        setStatus(`Check-in failed: ${message || 'Unable to check in. Please review the entered data.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckOut(e) {
    e.preventDefault()
    const openStart = parseLocalDateTime(checkOut.start_date, checkOut.start_time)
    const requestedEnd = parseLocalDateTime(checkOut.end_date, checkOut.end_time)
    if (openStart && requestedEnd && requestedEnd <= openStart) {
      window.alert(`Check-out failed: End time must be after check-in (${checkOut.start_date} ${checkOut.start_time}).`)
      return
    }

    setLoading(true)
    try {
      setStatus('Checking overlap warnings...')
      let warningData
      try {
        warningData = await authedFetch('/api/v1/shifts/check-out/warnings', {
          method: 'POST',
          body: JSON.stringify({
            start_date: checkOut.start_date,
            start_time: checkOut.start_time,
            end_date: checkOut.end_date,
            end_time: checkOut.end_time,
            notes: checkOut.notes || undefined
          })
        })
      } catch (warnErr) {
        const msg = String(warnErr?.message || '')
        if (msg.toLowerCase().includes('no open shift')) {
          setStatus('No open shift found. Refreshing...')
          setOpenShift(null)
          await loadShiftStatus(token)
          await loadMyShifts(token)
          return
        }
        throw warnErr
      }

      if (warningData?.has_overlap) {
        const sample = (warningData.overlaps || []).slice(0, 5)
        const details = sample
          .map((r) => `- ${r.caregiver_name}: ${r.start_date} ${r.start_time} to ${r.end_date || 'OPEN'} ${r.end_time || ''}`)
          .join('\n')
        const more = warningData.overlap_count > sample.length
          ? `\n(and ${warningData.overlap_count - sample.length} more)`
          : ''
        const proceed = window.confirm(
          `Warning: another caregiver already has logged time in this timeframe for this client.\n\n${details}${more}\n\nSelect OK to continue checkout, or Cancel to modify end date/time.`
        )
        if (!proceed) {
          setStatus('Check-out paused. Modify end date/time and try again.')
          return
        }
      }

      setStatus('Checking out...')
      const closedShift = await authedFetch('/api/v1/shifts/check-out', {
        method: 'POST',
        body: JSON.stringify({
          start_date: checkOut.start_date,
          start_time: checkOut.start_time,
          end_date: checkOut.end_date,
          end_time: checkOut.end_time,
          notes: checkOut.notes || undefined
        })
      })

      const startDt = parseLocalDateTime(closedShift.start_date, closedShift.start_time)
      const endDt = parseLocalDateTime(closedShift.end_date, closedShift.end_time)
      const hoursWorked = startDt && endDt ? Math.max(0, (endDt.getTime() - startDt.getTime()) / 3600000) : null
      setLastCheckoutSummary({
        ...closedShift,
        client_name: clientName(closedShift.client_id),
        hours_worked: hoursWorked
      })

      setStatus('Checked out successfully')
      setOpenShift(null)
      await loadMyShifts(token)
    } catch (err) {
      setStatus(`Check-out failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const clientName = (id) => clients.find((c) => c.client_id === id)?.name ?? `Client #${id}`
  const selectedClient = clients.find((c) => c.client_id === Number(checkIn.client_id)) || null
  const openShiftClient = clients.find((c) => c.client_id === openShift?.client_id) || null

  const periodRows = useMemo(() => {
    const totals = new Map()

    for (const s of myShifts) {
      if (!s.start_date || !s.start_time || !s.end_date || !s.end_time) continue

      const start = parseLocalDateTime(s.start_date, s.start_time)
      const end = parseLocalDateTime(s.end_date, s.end_time)
      if (!start || !end) continue

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (!Number.isFinite(hours) || hours <= 0) continue

      // Find the client for this shift to get anchor settings
      const client = clients.find((c) => c.client_id === s.client_id) || null
      const key = periodLabelForDate(start, periodType, client)
      const pay = Number(s.pay_total)
      const existing = totals.get(key) || { period: key, hours: 0, shifts: 0, pay: 0 }
      existing.hours += hours
      existing.shifts += 1
      if (Number.isFinite(pay) && pay >= 0) {
        existing.pay += pay
      }
      totals.set(key, existing)
    }

    return Array.from(totals.values())
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((row) => ({
        ...row,
        hours: Number(row.hours.toFixed(2)),
        pay: Number(row.pay.toFixed(2))
      }))
  }, [myShifts, periodType, clients])

  const totalPeriodHours = useMemo(
    () => periodRows.reduce((sum, row) => sum + row.hours, 0).toFixed(2),
    [periodRows]
  )

  const totalPeriodPay = useMemo(
    () => periodRows.reduce((sum, row) => sum + row.pay, 0).toFixed(2),
    [periodRows]
  )

  // ── Week helpers for Logged Hours tab ────────────────────────────────────
  function cgWeekDays(wk) {
    const start = new Date(`${wk}T00:00:00`)
    const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const today = new Date(); today.setHours(0,0,0,0)
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
      return { dateStr, label: `${DAY[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`, isToday: dateStr === todayStr }
    })
  }

  function cgNavWeek(delta) {
    setCgWeekKey(prev => {
      const d = new Date(`${prev}T00:00:00`); d.setDate(d.getDate() + delta * 7)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })
  }

  function cgThisWeek() {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay())
    setCgWeekKey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }

  const cgWeekShifts = useMemo(() => {
    const days = cgWeekDays(cgWeekKey)
    const dateSet = new Set(days.map(d => d.dateStr))
    return myShifts.filter(s => s.status !== 'VOID' && dateSet.has(s.start_date))
  }, [myShifts, cgWeekKey])

  useEffect(() => {
    if (!isLoggedIn || mustChangePassword) return
    if (!token || !me?.caregiver_id || clients.length === 0) {
      setPlannedAssignments([])
      return
    }
    loadPlannedAssignments(token, cgWeekKey, clients, me.caregiver_id)
  }, [token, isLoggedIn, mustChangePassword, me, clients, cgWeekKey])
  // ── end week helpers ──────────────────────────────────────────────────────

  return (
    <div className={isLoggedIn && !mustChangePassword ? 'page-shell with-sidebar' : 'cg-login-shell'}>

      {/* ── Login / Change-password: centered page ── */}
      {(!isLoggedIn || mustChangePassword) && (
        <div className="cg-login-page">
          <div className="cg-login-logo">
            <img src={logo} alt="Angels at Home" />
            <h1>Caregiver Portal</h1>
          </div>

          {!isLoggedIn && (
            <section className="cg-card" style={{ width: '340px' }}>
              <h2>Login</h2>
              <form className="cg-form cg-login-form" onSubmit={handleLogin} autoComplete="off">
                <label>
                  User
                  <input type="email" name="login-email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>
                <label>
                  Password
                  <input type="password" name="login-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                <button className="cg-solid" type="submit" disabled={loading}>
                  {loading ? 'Please wait...' : 'Login'}
                </button>
              </form>
              {status && status !== 'Ready' && status !== 'Logged in' && (
                <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '8px' }}>{status}</p>
              )}
            </section>
          )}

          {isLoggedIn && mustChangePassword && (
            <section className="cg-card" style={{ width: '360px' }}>
              <h2>Change Password</h2>
              <p>For security, you must change your password before using the portal.</p>
              <form className="cg-form" onSubmit={handleChangePassword}>
                <label>
                  Current Password
                  <input type="password" value={passwordChange.current_password}
                    onChange={(e) => setPasswordChange({ ...passwordChange, current_password: e.target.value })}
                    required autoFocus />
                </label>
                <label>
                  New Password
                  <input type="password" value={passwordChange.new_password}
                    onChange={(e) => setPasswordChange({ ...passwordChange, new_password: e.target.value })}
                    required minLength={8} />
                </label>
                <label>
                  Confirm New Password
                  <input type="password" value={passwordChange.confirm_password}
                    onChange={(e) => setPasswordChange({ ...passwordChange, confirm_password: e.target.value })}
                    required minLength={8} />
                </label>
                <button className="cg-solid" type="submit" disabled={loading}>
                  {loading ? 'Please wait...' : 'Save New Password'}
                </button>
              </form>
              {status && status !== 'Ready' && status !== 'Logged in' && (
                <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '8px' }}>{status}</p>
              )}
            </section>
          )}
        </div>
      )}

      {isLoggedIn && !mustChangePassword && (
        <>
          {/* ── Sidebar ── */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <img src={logo} alt="Angels at Home" />
            </div>
            <nav className="sidebar-nav">
              {[
                { id: 'shifts',  icon: '🏠', label: 'Log Hours'     },
                { id: 'hours',   icon: '📅', label: 'Work Schedule' },
                { id: 'reports', icon: '📊', label: 'My Reports'    },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`sidebar-nav-item${cgActiveTab === tab.id ? ' active' : ''}`}
                  onClick={() => setCgActiveTab(tab.id)}
                >
                  <span className="sidebar-nav-icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-footer">
              <strong>{me?.name || me?.email || 'Caregiver'}</strong>
              <span>Caregiver</span>
              <button
                className="ghost-btn"
                type="button"
                onClick={logout}
                style={{ marginTop: '10px', width: '100%', fontSize: '0.82rem', padding: '7px 10px' }}
              >
                Log Out
              </button>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="main-content">
            {status && status !== 'Ready' && status !== 'Logged in' && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')
                    ? '#fdecea'
                    : '#e9f6ef',
                  color: status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')
                    ? '#8a1f17'
                    : '#0f5132',
                  border: status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')
                    ? '1px solid #f5c2c7'
                    : '1px solid #badbcc',
                  fontSize: '0.9rem',
                }}
              >
                {status}
              </div>
            )}

            {/* ── MY SHIFTS tab ── */}
            {cgActiveTab === 'shifts' && (
              <>
                {openShift && (
                  <section className="cg-card cg-open-banner">
                    <h2>You have an open shift</h2>
                    <p>
                      <strong>Client:</strong> {clientName(openShift.client_id)}&nbsp;&nbsp;
                      <strong>Started:</strong> {openShift.start_date} {openShift.start_time}
                    </p>
                    {openShiftClient && (
                      <div className="cg-client-summary">
                        <h3>Client Rate Summary</h3>
                        <p><strong>Day Window:</strong> {openShiftClient.day_window_start || '07:00'} - {openShiftClient.day_window_end || '23:00'}</p>
                        <p><strong>Caregiver Pay:</strong> Day {formatMoney(openShiftClient.pay_day)}, Night {formatMoney(openShiftClient.pay_night)}</p>
                        <p><strong>Timezone:</strong> {openShiftClient.timezone || 'Default org timezone'}</p>
                      </div>
                    )}
                    <h3>Check Out</h3>
                    <form className="cg-form cg-inline-form" onSubmit={handleCheckOut}>
                      <label>
                        Check-In Date
                        <input
                          type="date"
                          value={checkOut.start_date}
                          onChange={(e) => setCheckOut({ ...checkOut, start_date: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Check-In Time
                        <input
                          type="time"
                          value={checkOut.start_time}
                          onChange={(e) => setCheckOut({ ...checkOut, start_time: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        End Date
                        <input
                          type="date"
                          value={checkOut.end_date}
                          onChange={(e) => setCheckOut({ ...checkOut, end_date: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        End Time
                        <input
                          type="time"
                          value={checkOut.end_time}
                          onChange={(e) => setCheckOut({ ...checkOut, end_time: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        Notes (optional - unusual situations during this shift)
                        <textarea
                          value={checkOut.notes}
                          onChange={(e) => setCheckOut({ ...checkOut, notes: e.target.value })}
                          placeholder="Add any notes about this shift..."
                          style={{ minHeight: '60px', fontFamily: 'inherit' }}
                        />
                      </label>
                      <button className="cg-solid" type="submit" disabled={loading}>Check Out</button>
                    </form>
                  </section>
                )}

                {!openShift && (
                  <section className="cg-card">
                    <h2>Log Hours</h2>
                    <form className="cg-form" onSubmit={handleCheckIn}>
                      <label>
                        Client
                        <select
                          value={checkIn.client_id}
                          onChange={(e) => {
                            setCheckIn({ ...checkIn, client_id: e.target.value })
                            setCheckInPopupMessage('')
                          }}
                          required
                        >
                          <option value="">Select a client...</option>
                          {clients.map((c) => (
                            <option key={c.client_id} value={c.client_id}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Start Date
                        <input
                          type="date"
                          value={checkIn.start_date}
                          onChange={(e) => {
                            setCheckIn({ ...checkIn, start_date: e.target.value })
                            setCheckInPopupMessage('')
                          }}
                          required
                        />
                      </label>
                      <label>
                        Start Time
                        <input
                          type="time"
                          value={checkIn.start_time}
                          onChange={(e) => {
                            setCheckIn({ ...checkIn, start_time: e.target.value })
                            setCheckInPopupMessage('')
                          }}
                          required
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={checkIn.notes}
                          onChange={(e) => {
                            setCheckIn({ ...checkIn, notes: e.target.value })
                            setCheckInPopupMessage('')
                          }}
                          placeholder="Optional"
                        />
                      </label>
                      <button className="cg-solid" type="submit" disabled={loading || !checkIn.client_id}>
                        Check In
                      </button>
                    </form>
                    {selectedClient && (
                      <div className="cg-client-summary">
                        <h3>Selected Client Summary</h3>
                        <p><strong>Day Window:</strong> {selectedClient.day_window_start || '07:00'} - {selectedClient.day_window_end || '23:00'}</p>
                        <p><strong>Caregiver Pay:</strong> Day {formatMoney(selectedClient.pay_day)}, Night {formatMoney(selectedClient.pay_night)}</p>
                        <p><strong>Timezone:</strong> {selectedClient.timezone || 'Default org timezone'}</p>
                      </div>
                    )}

                    {lastCheckoutSummary && (
                      <div className="cg-client-summary" style={{ marginTop: '14px' }}>
                        <h3>Last Check-Out Summary</h3>
                        <p><strong>Client:</strong> {lastCheckoutSummary.client_name}</p>
                        <p><strong>Start:</strong> {lastCheckoutSummary.start_date || 'N/A'} {lastCheckoutSummary.start_time || ''}</p>
                        <p><strong>End:</strong> {lastCheckoutSummary.end_date || 'N/A'} {lastCheckoutSummary.end_time || ''}</p>
                        <p>
                          <strong>Hours Worked:</strong>{' '}
                          {Number.isFinite(Number(lastCheckoutSummary.hours_worked))
                            ? Number(lastCheckoutSummary.hours_worked).toFixed(2)
                            : 'N/A'}
                        </p>
                        <p><strong>Pay Total:</strong> {formatMoney(lastCheckoutSummary.pay_total)}</p>
                        <p><strong>Status:</strong> {lastCheckoutSummary.status || 'CLOSED'}</p>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {checkInPopupMessage && (
              <div className="cg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Action Required">
                <div className="cg-modal cg-modal-warn">
                  <h3>Action Required</h3>
                  <p>{checkInPopupMessage}</p>
                  <button
                    className="cg-solid"
                    type="button"
                    onClick={() => setCheckInPopupMessage('')}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* ── LOGGED HOURS tab ── */}
            {cgActiveTab === 'hours' && (() => {
              const days = cgWeekDays(cgWeekKey)
              const weekStart = new Date(`${cgWeekKey}T00:00:00`)
              const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
              const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`

              const fmtHours = h => {
                if (h == null || !Number.isFinite(Number(h))) return '—'
                const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
                return mm ? `${hh}h ${mm}m` : `${hh}h`
              }
              const shiftHrs = s => {
                if (s.start_date && s.start_time && s.end_date && s.end_time) {
                  const start = parseLocalDateTime(s.start_date, s.start_time)
                  const end = parseLocalDateTime(s.end_date, s.end_time)
                  if (start && end) {
                    const h = (end - start) / 3600000
                    return h > 0 ? h : 0
                  }
                }
                return 0
              }

              const shiftsByDay = Object.fromEntries(
                days.map(d => [
                  d.dateStr,
                  cgWeekShifts
                    .filter(s => s.start_date === d.dateStr)
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                ])
              )
              const plannedByDay = Object.fromEntries(
                days.map(d => [
                  d.dateStr,
                  plannedAssignments
                    .filter(a => a.assign_date === d.dateStr)
                    .sort((a, b) => (a.slot_start_time || '').localeCompare(b.slot_start_time || ''))
                ])
              )
              const hasAnyEntries = days.some(d => (shiftsByDay[d.dateStr]?.length || 0) > 0 || (plannedByDay[d.dateStr]?.length || 0) > 0)
              const dayTotals = Object.fromEntries(
                days.map(d => [d.dateStr, (shiftsByDay[d.dateStr] || []).reduce((s, sh) => s + shiftHrs(sh), 0)])
              )
              const weekTotal = Object.values(dayTotals).reduce((a, b) => a + b, 0)

              return (
                <section className="cg-card">
                  <div className="cg-section-header">
                    <h2>Work Schedule</h2>
                    <div className="cg-actions">
                      <button className="cg-ghost" type="button" onClick={() => cgNavWeek(-1)}>‹ Prev</button>
                      <button className="cg-solid" type="button" onClick={cgThisWeek}>This Week</button>
                      <button className="cg-ghost" type="button" onClick={() => cgNavWeek(1)}>Next ›</button>
                      <button
                        className="cg-ghost"
                        type="button"
                        onClick={() => Promise.all([
                          loadMyShifts(token),
                          loadPlannedAssignments(token, cgWeekKey, clients, me?.caregiver_id),
                        ])}
                        disabled={loading}
                      >↻</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px', fontSize: '0.88rem', color: '#35525b' }}>
                    {weekLabel}
                    {weekTotal > 0 && (
                      <strong style={{ marginLeft: '12px', color: '#0d596d' }}>Worked Total: {fmtHours(weekTotal)}</strong>
                    )}
                  </div>

                  <div className="cg-schedule-legend" aria-label="Work schedule legend">
                    <span className="cg-legend-item"><span className="cg-legend-dot planned" />Planned (Assigned)</span>
                    <span className="cg-legend-item"><span className="cg-legend-dot worked" />Worked (Logged)</span>
                  </div>

                  {!hasAnyEntries ? (
                    <p style={{ color: '#7a9aaa' }}>No planned or worked shifts this week.</p>
                  ) : (
                    <div className="scheduler-grid-wrap">
                      <table className="scheduler-grid">
                        <thead>
                          <tr>
                            {days.map(d => (
                              <th key={d.dateStr} className={d.isToday ? 'today-col' : ''}>{d.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {days.map(d => {
                              const planned = plannedByDay[d.dateStr] || []
                              const worked = shiftsByDay[d.dateStr] || []
                              return (
                                <td key={`cgh-day-${d.dateStr}`} className={d.isToday ? 'today-day-cell' : ''} style={{ verticalAlign: 'top' }}>
                                  <div className="cg-day-schedule-stack">
                                    <div className="cg-day-label planned">Planned</div>
                                    {planned.length === 0 ? (
                                      <div className="cg-pill-empty">No assignment</div>
                                    ) : planned.map(a => {
                                      const slotTime = (a.slot_start_time && a.slot_end_time)
                                        ? `${a.slot_start_time.slice(0,5)} - ${a.slot_end_time.slice(0,5)}`
                                        : (a.slot_name || `Slot ${a.slot_id}`)
                                      return (
                                        <div key={`plan-${a.assignment_id}`} className="cg-pill-planned">
                                          <div className="cg-pill-time">{slotTime}</div>
                                          <div className="cg-pill-client">{clientName(a.client_id)}</div>
                                        </div>
                                      )
                                    })}

                                    <div className="cg-day-label worked">Worked</div>
                                    {worked.length === 0 ? (
                                      <div className="cg-pill-empty">No logged shift</div>
                                    ) : worked.map(s => {
                                      const cName = clientName(s.client_id)
                                      const timeLabel = s.start_time && s.end_time
                                        ? `${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)}`
                                        : s.start_time ? `${s.start_time.slice(0,5)}+` : '—'
                                      const hrs = shiftHrs(s)
                                      return (
                                        <div key={`work-${s.shift_id}`} className={`cg-pill-worked${s.status === 'OPEN' ? ' cg-pill-worked-open' : ''}`}>
                                          <div className="cg-pill-time">{timeLabel}</div>
                                          <div className="cg-pill-client">{cName}</div>
                                          <div className="cg-pill-meta">{fmtHours(hrs)}</div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                          <tr>
                            {days.map(d => {
                              const total = dayTotals[d.dateStr] || 0
                              return (
                                <td key={`cgh-tot-${d.dateStr}`} className={d.isToday ? 'today-day-cell' : ''}
                                  style={{ textAlign: 'center', background: total > 0 ? '#e8f6f0' : '#fff5e8', borderTop: '2px solid #c5dde3' }}>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#35525b' }}>Daily Total</div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1a2d38' }}>{total > 0 ? fmtHours(total) : '—'}</div>
                                </td>
                              )
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )
            })()}

            {/* ── MY REPORTS tab ── */}
            {cgActiveTab === 'reports' && (() => {
              const [rptClient, setRptClient] = [rptClientFilter, setRptClientFilter]
              const filtered = myShifts.filter(s => {
                if (s.status === 'VOID') return false
                if (rptClient && String(s.client_id) !== rptClient) return false
                if (rptFrom) {
                  const fromDT = `${rptFrom}T${rptFromTime || '00:00'}`
                  const shiftDT = `${s.start_date}T${s.start_time || '00:00'}`
                  if (shiftDT < fromDT) return false
                }
                if (rptTo) {
                  const toDT = `${rptTo}T${rptToTime || '23:59'}`
                  const shiftDT = `${s.start_date}T${s.start_time || '00:00'}`
                  if (shiftDT > toDT) return false
                }
                return true
              })
              const shiftHrsR = s => {
                if (s.start_date && s.start_time && s.end_date && s.end_time) {
                  const st = parseLocalDateTime(s.start_date, s.start_time)
                  const en = parseLocalDateTime(s.end_date, s.end_time)
                  if (st && en) { const h = (en - st) / 3600000; return h > 0 ? h : 0 }
                }
                return 0
              }
              // per-client totals
              const clientTotals = clients.map(c => {
                const rows = filtered.filter(s => s.client_id === c.client_id)
                if (rows.length === 0) return null
                const hours = rows.reduce((a, s) => a + shiftHrsR(s), 0)
                const pay = rows.reduce((a, s) => a + (Number.isFinite(Number(s.pay_total)) ? Number(s.pay_total) : 0), 0)
                return { client_id: c.client_id, name: c.name, shifts: rows.length, hours, pay }
              }).filter(Boolean)
              const grandHours = clientTotals.reduce((a, r) => a + r.hours, 0)
              const grandPay = clientTotals.reduce((a, r) => a + r.pay, 0)
              const fmtH = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm ? `${hh}h ${mm}m` : `${hh}h` }

              return (
                <section className="cg-card">
                  <div className="cg-section-header">
                    <h2>My Reports</h2>
                    <button className="cg-ghost" type="button" onClick={() => loadMyShifts(token)} disabled={loading}>↻ Refresh</button>
                  </div>

                  {/* Filters */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <label className="cg-period-label">
                      Client
                      <select className="cg-period-select" value={rptClient} onChange={e => setRptClient(e.target.value)}>
                        <option value="">All Clients</option>
                        {clients.map(c => <option key={c.client_id} value={String(c.client_id)}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="cg-period-label">
                      From Date
                      <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)}
                        style={{ border: '1px solid #a8d4bb', borderRadius: '10px', padding: '7px 10px', background: '#f8fffb', font: 'inherit' }} />
                    </label>
                    <label className="cg-period-label">
                      From Time
                      <input type="time" value={rptFromTime} onChange={e => setRptFromTime(e.target.value)}
                        style={{ border: '1px solid #a8d4bb', borderRadius: '10px', padding: '7px 10px', background: '#f8fffb', font: 'inherit' }} />
                    </label>
                    <label className="cg-period-label">
                      To Date
                      <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)}
                        style={{ border: '1px solid #a8d4bb', borderRadius: '10px', padding: '7px 10px', background: '#f8fffb', font: 'inherit' }} />
                    </label>
                    <label className="cg-period-label">
                      To Time
                      <input type="time" value={rptToTime} onChange={e => setRptToTime(e.target.value)}
                        style={{ border: '1px solid #a8d4bb', borderRadius: '10px', padding: '7px 10px', background: '#f8fffb', font: 'inherit' }} />
                    </label>
                    <button className="cg-ghost" type="button" onClick={() => {
                      const now = new Date()
                      const y = now.getFullYear(), m = now.getMonth()
                      const first = `${y}-${String(m+1).padStart(2,'0')}-01`
                      const lastD = new Date(y, m+1, 0)
                      const last = `${lastD.getFullYear()}-${String(lastD.getMonth()+1).padStart(2,'0')}-${String(lastD.getDate()).padStart(2,'0')}`
                      setRptClientFilter(''); setRptFrom(first); setRptFromTime('00:00'); setRptTo(last); setRptToTime('23:00')
                    }}>Reset to This Month</button>
                  </div>

                  {/* Per-client summary */}
                  {clientTotals.length === 0 ? (
                    <p style={{ color: '#7a9aaa' }}>No shifts match the selected filters.</p>
                  ) : (
                    <>
                      <h3 style={{ margin: '0 0 8px' }}>Hours by Client</h3>
                      <div className="cg-table-wrap" style={{ marginBottom: '16px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th>Shifts</th>
                              <th>Hours Worked</th>
                              <th>Total Pay</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientTotals.map(r => (
                              <tr key={r.client_id}>
                                <td>{r.name}</td>
                                <td>{r.shifts}</td>
                                <td>{fmtH(r.hours)}</td>
                                <td>${r.pay.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr style={{ fontWeight: 800, background: '#eef8f2' }}>
                              <td>Total</td>
                              <td>{clientTotals.reduce((a, r) => a + r.shifts, 0)}</td>
                              <td>{fmtH(grandHours)}</td>
                              <td>${grandPay.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h3 style={{ margin: '0 0 8px' }}>Shift Detail</h3>
                      <div className="cg-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Client</th>
                              <th>Start</th>
                              <th>End</th>
                              <th>Hours</th>
                              <th>Pay Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(s => (
                              <tr key={s.shift_id} className={s.status === 'OPEN' ? 'cg-open-row' : ''}>
                                <td>{s.shift_id}</td>
                                <td>{clientName(s.client_id)}</td>
                                <td>{s.start_date} {s.start_time}</td>
                                <td>{s.end_date ? `${s.end_date} ${s.end_time}` : '—'}</td>
                                <td>{fmtH(shiftHrsR(s))}</td>
                                <td>{s.pay_total != null ? `$${Number(s.pay_total).toFixed(2)}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              )
            })()}

          </main>
        </>
      )}

    </div>
  )
}
