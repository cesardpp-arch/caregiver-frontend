import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logo from './assets/logo.jpg'
import './App.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function readErrorMessage(data, fallback = 'Request failed') {
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => (typeof item?.msg === 'string' ? item.msg : JSON.stringify(item)))
      .join(', ')
  }
  return fallback
}

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '')
  const [me, setMe] = useState(null)
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [pendingShiftDelete, setPendingShiftDelete] = useState(null)
  const [pendingCaregiverRateDelete, setPendingCaregiverRateDelete] = useState(null)
  const [messageDialog, setMessageDialog] = useState({
    visible: false,
    message: '',
    tone: 'info'
  })
  const schedulerPrintRef = useRef(null)

  const [activeTab, setActiveTab] = useState('scheduler')
  const [caregivers, setCaregivers] = useState([])
  const [clients, setClients] = useState([])
  const [shifts, setShifts] = useState([])
  const [reportRows, setReportRows] = useState([])

  const [shiftFilters, setShiftFilters] = useState({
    status: '',
    caregiver_id: '',
    client_id: '',
    from_date: '',
    from_time: '00:00',
    to_date: '',
    to_time: '23:59'
  })

  const [createShift, setCreateShift] = useState({
    client_id: '',
    caregiver_id: '',
    start_date: todayStr(),
    start_time: '08:00',
    end_date: todayStr(),
    end_time: '16:00',
    notes: ''
  })

  const [reportFilters, setReportFilters] = useState({
    from_date: todayStr(),
    from_time: '00:00',
    to_date: todayStr(),
    to_time: '23:59',
    caregiver_id: '',
    client_id: ''
  })

  const [reportKind, setReportKind] = useState('summary')
  const [drilledDownCaregiver, setDrilledDownCaregiver] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [invoiceFilters, setInvoiceFilters] = useState({ client_id: '', from_date: '', to_date: '' })
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [invoiceBlueprints, setInvoiceBlueprints] = useState(() => {
    try {
      const raw = localStorage.getItem('invoiceBlueprints')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  const [csvPreview, setCsvPreview] = useState('')
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [invoicePreviewRows, setInvoicePreviewRows] = useState([])
  const [editingShiftId, setEditingShiftId] = useState(null)
  const [editShiftDraft, setEditShiftDraft] = useState({
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    notes: ''
  })
  const [selectedCaregiverId, setSelectedCaregiverId] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [selectedAdminUserId, setSelectedAdminUserId] = useState(null)
  const [adminUserForm, setAdminUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SUPERVISOR',
    active: '1',
    client_id: ''
  })
  const [caregiverForm, setCaregiverForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    active: '1'
  })
  const [caregiverRateForm, setCaregiverRateForm] = useState({
    rate_id: null,
    caregiver_id: '',
    client_id: '',
    pay_day: '',
    pay_night: ''
  })
  const [caregiverRates, setCaregiverRates] = useState([])
  const [holidays, setHolidays] = useState([])
  const [holidayForm, setHolidayForm] = useState({
    holiday_id: null,
    client_id: '',
    date: '',
    name: '',
    multiplier_bill: '',
    multiplier_pay: ''
  })
  const [pendingHolidayDelete, setPendingHolidayDelete] = useState(null)
  const [schedulerWeekKey, setSchedulerWeekKey] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    today.setDate(today.getDate() - today.getDay()) // back to Sunday
    return today.toISOString().slice(0, 10)
  })
  const [schedulerMonthKey, setSchedulerMonthKey] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    today.setDate(1)
    return today.toISOString().slice(0, 10)
  })
  const [schedulerShifts, setSchedulerShifts] = useState([])
  const [schedulerClientId, setSchedulerClientId] = useState('')
  const [schedulerSlots, setSchedulerSlots] = useState([])
  const [schedulerView, setSchedulerView] = useState('schedule') // 'schedule' | 'hours'
  const [schedulerAssignments, setSchedulerAssignments] = useState([])
  const [assignPickerMap, setAssignPickerMap] = useState({}) // "slotId-dateStr" -> caregiver_id
  const [copyPrevMonthConfirm, setCopyPrevMonthConfirm] = useState(false)

  // ── Caregiver profile shifts ─────────────────────────────────────────────
  const [cgProfileId, setCgProfileId] = useState('')
  const [cgProfileWeekKey, setCgProfileWeekKey] = useState(() => {
    const today = new Date(); today.setHours(0,0,0,0); today.setDate(today.getDate() - today.getDay())
    const yyyy = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0')
    return `${yyyy}-${mm}-${dd}`
  })
  const [cgProfileShifts, setCgProfileShifts] = useState([])
  const [cgProfileLoading, setCgProfileLoading] = useState(false)
  // ── end caregiver profile shifts ────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [clientShiftSlots, setClientShiftSlots] = useState([])
  const [shiftSlotForm, setShiftSlotForm] = useState({ slot_name: '', start_time: '', end_time: '', rate_type: 'DAY' })
  const [editingSlotId, setEditingSlotId] = useState(null)
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    active: '1',
    bill_day: '',
    bill_night: '',
    day_window_start: '07:00',
    day_window_end: '23:00',
    invoice_cycle: 'WEEKLY',
    invoice_anchor_dow: '6',
    invoice_anchor_time: '23:00',
    timezone: '',
    holiday_bill_multiplier: '',
    holiday_pay_multiplier: ''
  })

  const isLoggedIn = Boolean(token)
  const userRole = me?.role || ''
  const isAdmin = userRole === 'ADMIN'
  const isSupervisor = userRole === 'SUPERVISOR'
  const isCustomer = userRole === 'CUSTOMER'
  const linkedClientId = me?.client_id ? String(me.client_id) : ''
  const linkedClientName = me?.client_name || ''
  const canManageProfiles = isAdmin
  const canViewStaff = isAdmin || isSupervisor
  const canUseAdminOps = isAdmin || isSupervisor
  const canViewReports = canUseAdminOps || isCustomer
  const tokenPreview = useMemo(() => {
    if (!token) return ''
    if (token.length < 25) return token
    return `${token.slice(0, 18)}...${token.slice(-6)}`
  }, [token])

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (!savedToken) return

    async function restoreSession() {
      setLoading(true)
      setStatus('Restoring saved session...')
      try {
        setToken(savedToken)
        await bootstrapAdminData(savedToken)
        setStatus('Session restored. Welcome back.')
      } catch (err) {
        localStorage.removeItem('admin_token')
        setToken('')
        setMe(null)
        setStatus(`Saved session expired: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  useEffect(() => {
    if (token) {
      localStorage.setItem('admin_token', token)
    } else {
      localStorage.removeItem('admin_token')
    }
  }, [token])

  useEffect(() => {
    if (!me) return
    if (me.role === 'CUSTOMER' && activeTab !== 'reports') {
      setActiveTab('reports')
      return
    }
    if (me.role === 'SUPERVISOR' && activeTab === 'adminProfiles') {
      setActiveTab('scheduler')
    }
  }, [me, activeTab])

  useEffect(() => {
    if (!isCustomer || !linkedClientId) return
    setReportFilters((prev) => ({ ...prev, client_id: linkedClientId }))
  }, [isCustomer, linkedClientId])

  useEffect(() => {
    if (!canManageProfiles) return
    if (activeTab !== 'adminProfiles') return
    refreshAdminUsers()
  }, [activeTab, canManageProfiles])

  useEffect(() => {
    if (!canViewStaff) return
    if (activeTab !== 'caregivers') return
    refreshCaregiverRates()
  }, [activeTab, canViewStaff])

  useEffect(() => {
    if (!canViewStaff) return
    if (activeTab !== 'caregivers') return
    loadCgProfileShifts(cgProfileId, cgProfileWeekKey)
  }, [activeTab, cgProfileId, cgProfileWeekKey, canViewStaff])

  useEffect(() => {
    if (!canUseAdminOps) return
    if (activeTab !== 'holidays') return
    refreshHolidays()
  }, [activeTab, canUseAdminOps])

  useEffect(() => {
    if (!canUseAdminOps) return
    if (activeTab !== 'scheduler') return
    loadSchedulerShifts(schedulerWeekKey)
  }, [activeTab, schedulerWeekKey, canUseAdminOps])

  useEffect(() => {
    if (!canUseAdminOps) return
    if (activeTab !== 'invoices') return
    refreshInvoices()
  }, [activeTab, canUseAdminOps])

  useEffect(() => {
    try {
      localStorage.setItem('invoiceBlueprints', JSON.stringify(invoiceBlueprints))
    } catch {
      // ignore storage errors
    }
  }, [invoiceBlueprints])

  useEffect(() => {
    if (!canUseAdminOps) return
    if (activeTab !== 'scheduler') return
    if (!schedulerClientId) return
    const monthRange = schedulerMonthRange(schedulerMonthKey)
    loadSchedulerAssignments(schedulerClientId, schedulerMonthKey, monthRange)
  }, [activeTab, schedulerMonthKey, schedulerClientId, canUseAdminOps])

  useEffect(() => {
    if (isCustomer && !linkedClientId) {
      setStatus('Customer profile missing linked client. Contact admin.')
    }
  }, [isCustomer, linkedClientId])

  useEffect(() => {
    const msg = String(status || '').trim()
    if (!msg || msg === 'Ready') return

    // Keep transient "working" messages in the status bar only.
    if (msg.endsWith('...') || msg.toLowerCase().includes('loading')) return

    const lower = msg.toLowerCase()
    const shouldShowErrorDialog = [
      'failed',
      'error',
      'invalid',
      'required',
      'missing',
      'cannot',
      'forbidden',
      'denied',
      'not found',
      'load summary report first'
    ].some((token) => lower.includes(token))

    if (!shouldShowErrorDialog) return

    setMessageDialog({ visible: true, message: msg, tone: 'error' })
  }, [status])

  // Auto-logout after 5 minutes of inactivity
  useEffect(() => {
    if (!isLoggedIn) return
    const TIMEOUT_MS = 5 * 60 * 1000
    let timer = setTimeout(() => {
      logout()
      setStatus('Session expired due to inactivity.')
    }, TIMEOUT_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        logout()
        setStatus('Session expired due to inactivity.')
      }, TIMEOUT_MS)
    }
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [isLoggedIn])

  // ---- Scheduler helpers ----
  function _toDateStr(d) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  function schedulerDays(weekKey) {
    const start = new Date(`${weekKey}T00:00:00`)
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return {
        dateStr: _toDateStr(d),
        label: `${DAY_NAMES[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`,
        isToday: _toDateStr(d) === _toDateStr(new Date())
      }
    })
  }

  function schedulerMonthRange(weekKey) {
    const anchor = new Date(`${weekKey}T00:00:00`)
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return {
      from_date: _toDateStr(start),
      to_date: _toDateStr(end),
    }
  }

  function schedulerNavWeek(delta) {
    setSchedulerWeekKey(prev => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(d.getDate() + delta * 7)
      return _toDateStr(d)
    })
  }

  function schedulerNavMonth(delta) {
    setSchedulerMonthKey(prev => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(1)
      d.setMonth(d.getMonth() + delta)
      return _toDateStr(d)
    })
  }

  function schedulerThisMonth() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(1)
    setSchedulerMonthKey(_toDateStr(d))
  }

  function schedulerThisWeek() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    today.setDate(today.getDate() - today.getDay()) // back to Sunday
    setSchedulerWeekKey(_toDateStr(today))
  }

  async function loadSchedulerShifts(weekKey) {
    const days = schedulerDays(weekKey)
    const from = days[0].dateStr
    const to = days[6].dateStr
    setLoading(true)
    setStatus('Loading scheduler...')
    try {
      const params = new URLSearchParams({ from_date: from, from_time: '00:00', to_date: to, to_time: '23:59' })
      const data = await authedFetch(`/api/v1/admin/shifts?${params}`)
      setSchedulerShifts(Array.isArray(data) ? data : [])
      setStatus('Scheduler loaded')
    } catch (err) {
      setStatus(`Failed to load scheduler: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadSchedulerSlots(clientId) {
    if (!clientId) { setSchedulerSlots([]); return }
    try {
      const data = await authedFetch(`/api/v1/clients/${clientId}/shift-slots`)
      setSchedulerSlots(Array.isArray(data) ? data : [])
    } catch {
      setSchedulerSlots([])
    }
  }
  async function loadSchedulerAssignments(clientId, weekKey, rangeOverride = null) {
    if (!clientId || !weekKey) { setSchedulerAssignments([]); return }
    const range = rangeOverride || (() => {
      const days = schedulerDays(weekKey)
      return { from_date: days[0].dateStr, to_date: days[6].dateStr }
    })()
    const { from_date, to_date } = range
    try {
      const params = new URLSearchParams({ client_id: clientId, from_date, to_date })
      const data = await authedFetch(`/api/v1/scheduler/assignments?${params}`)
      setSchedulerAssignments(Array.isArray(data) ? data : [])
    } catch {
      setSchedulerAssignments([])
    }
  }

  async function copySchedulerFromPreviousMonth() {
    if (!schedulerClientId) return
    const monthRange = schedulerMonthRange(schedulerMonthKey)
    try {
      setLoading(true)
      await authedFetch('/api/v1/scheduler/assignments/copy-previous-month', {
        method: 'POST',
        body: JSON.stringify({ client_id: Number(schedulerClientId), target_month: monthRange.from_date }),
      })
      await loadSchedulerAssignments(schedulerClientId, schedulerMonthKey, monthRange)
      setStatus('Assignments copied from previous month')
    } catch (err) {
      setStatus(`Failed to copy assignments: ${err.message}`)
    } finally {
      setLoading(false)
      setCopyPrevMonthConfirm(false)
    }
  }
  // ---- end Scheduler helpers ----

  // ---- Caregiver profile shift helpers ----
  function cgProfileDays(weekKey) {
    const start = new Date(`${weekKey}T00:00:00`)
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const today = new Date(); today.setHours(0,0,0,0)
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
      return { dateStr, label: `${DAY_NAMES[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`, isToday: dateStr === todayStr }
    })
  }

  function cgProfileNavWeek(delta) {
    setCgProfileWeekKey(prev => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(d.getDate() + delta * 7)
      const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
      return `${yyyy}-${mm}-${dd}`
    })
  }

  function cgProfileThisWeek() {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay())
    const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
    setCgProfileWeekKey(`${yyyy}-${mm}-${dd}`)
  }

  async function loadCgProfileShifts(caregiverId, weekKey) {
    if (!caregiverId) { setCgProfileShifts([]); return }
    const days = cgProfileDays(weekKey)
    const from = days[0].dateStr
    const to = days[6].dateStr
    setCgProfileLoading(true)
    try {
      const params = new URLSearchParams({ caregiver_id: caregiverId, from_date: from, from_time: '00:00', to_date: to, to_time: '23:59' })
      const data = await authedFetch(`/api/v1/admin/shifts?${params}`)
      setCgProfileShifts(Array.isArray(data) ? data.filter(s => s.status !== 'VOID') : [])
    } catch {
      setCgProfileShifts([])
    } finally {
      setCgProfileLoading(false)
    }
  }
  // ---- end Caregiver profile shift helpers ----

  async function authedFetch(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(path, { ...options, headers })
    let data = null
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const txt = await res.text()
    if (isJson && txt.trim()) {
      try {
        data = JSON.parse(txt)
      } catch {
        data = { detail: txt }
      }
    } else {
      data = txt ? { detail: txt } : null
    }

    if (!res.ok) {
      throw new Error(readErrorMessage(data, `HTTP ${res.status}`))
    }

    return data
  }

  function clearInvoiceFilters() {
    setInvoiceFilters({ client_id: '', from_date: '', to_date: '' })
    setTimeout(() => {
      void refreshInvoices({ client_id: '', from_date: '', to_date: '' })
    }, 0)
  }

  async function refreshInvoices(nextFilters = invoiceFilters) {
    try {
      const params = new URLSearchParams()
      if (nextFilters.client_id) params.set('client_id', nextFilters.client_id)
      if (nextFilters.from_date) params.set('from_date', nextFilters.from_date)
      if (nextFilters.to_date) params.set('to_date', nextFilters.to_date)
      const data = await authedFetch(`/api/v1/invoices${params.toString() ? `?${params.toString()}` : ''}`)
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      setInvoices([])
      setStatus(`Could not load invoices: ${err.message}`)
    }
  }

  async function openInvoiceDetail(invoiceId) {
    try {
      setSelectedInvoiceId(invoiceId)
      const data = await authedFetch(`/api/v1/invoices/${invoiceId}`)
      setInvoiceDetail(data)
      setStatus(`Loaded invoice #${invoiceId}`)
    } catch (err) {
      setStatus(`Could not load invoice details: ${err.message}`)
    }
  }

  function buildInvoicePdfDocument({ clientName, clientAddress, invoiceNumber, periodFrom, periodTo, invoiceDate, dueDate, summaryRows = [], summaryTotals = null, previewRows = [] }) {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const blue = '#0a57b7'
    const teal = [10, 155, 170]
    const fmtHours = (n) => {
      const v = Number(n || 0)
      if (!Number.isFinite(v)) return '0'
      return Number(v.toFixed(2)).toString()
    }
    const fmtMoney = (n) => {
      const v = Number(n || 0)
      if (!Number.isFinite(v)) return '$0.00'
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    doc.setTextColor(10, 87, 183)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text('Bill to:', 54, 84)
    doc.text(clientName, 54, 104)
    if (clientAddress) {
      const addrLines = doc.splitTextToSize(clientAddress, 250)
      doc.text(addrLines, 54, 124)
    }

    doc.setFontSize(13)
    doc.text('Karla Perez', 560, 52, { align: 'right' })

    doc.setFontSize(12)
    doc.text('Invoice number:', 332, 166)
    doc.setFont('helvetica', 'bold')
    doc.text(invoiceNumber, 470, 166)
    doc.setFont('helvetica', 'normal')

    doc.text('Period:', 332, 188)
    doc.text(periodFrom, 414, 188)
    doc.text(periodTo, 498, 188)
    doc.text('Invoice date:', 332, 210)
    doc.text(invoiceDate, 414, 210)
    doc.text('Due Date', 332, 232)
    doc.text(dueDate, 414, 232)

    doc.setFont('helvetica', 'bold')
    doc.text('SUMMARY TO BILL', 54, 268)
    doc.setFont('helvetica', 'normal')

    const summaryTableBody = summaryRows.map((row) => ([
      row.caregiver_name || '',
      fmtHours(row.hours_total),
      fmtHours(row.hours_day),
      fmtHours(row.hours_night),
      fmtMoney(row.bill_total)
    ]))
    if (summaryTotals) {
      summaryTableBody.push([
        'TOTAL',
        fmtHours(summaryTotals.hours_total),
        fmtHours(summaryTotals.hours_day),
        fmtHours(summaryTotals.hours_night),
        fmtMoney(summaryTotals.bill_total)
      ])
    }

    autoTable(doc, {
      startY: 282,
      theme: 'grid',
      head: [['', 'Hours', 'Day', 'Night', 'TOTAL']],
      body: summaryTableBody,
      styles: { font: 'helvetica', fontSize: 10, lineColor: [0, 0, 0], lineWidth: 0.6, textColor: [10, 87, 183] },
      headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      didParseCell: (hook) => {
        if (hook.section === 'body' && hook.row.index === summaryTableBody.length - 1) {
          hook.cell.styles.fontStyle = 'bold'
        }
      }
    })

    const detailTableRows = previewRows.map((r) => {
      if (r.isHeader) {
        return {
          rowType: 'group',
          day: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          hours: '',
          notes: '',
          caregiver: r.caregiver
        }
      }
      if (r.isTotal) {
        return {
          rowType: 'total',
          day: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: 'TOTAL',
          hours: r.hours,
          notes: '',
          caregiver: r.caregiver
        }
      }
      return {
        rowType: 'row',
        day: r.day,
        startDate: r.startDate,
        startTime: r.startTime,
        endDate: r.endDate,
        endTime: r.endTime,
        hours: r.hours,
        notes: r.notes || '',
        caregiver: r.caregiver
      }
    })

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 260) + 24,
      theme: 'grid',
      columns: [
        { header: 'Day', dataKey: 'day' },
        { header: 'Start Date', dataKey: 'startDate' },
        { header: 'Start Time', dataKey: 'startTime' },
        { header: 'End Date', dataKey: 'endDate' },
        { header: 'End Time', dataKey: 'endTime' },
        { header: 'Tot Hours', dataKey: 'hours' },
        { header: 'Notes', dataKey: 'notes' },
        { header: 'Caregiver', dataKey: 'caregiver' }
      ],
      body: detailTableRows,
      styles: { font: 'helvetica', fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.4, textColor: [10, 87, 183] },
      headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        day: { halign: 'left' },
        startDate: { halign: 'right' },
        startTime: { halign: 'right' },
        endDate: { halign: 'right' },
        endTime: { halign: 'right' },
        hours: { halign: 'right' },
        notes: { halign: 'left', cellWidth: 60 },
        caregiver: { halign: 'left' }
      },
      didParseCell: (hook) => {
        const rowType = hook.row.raw?.rowType
        if (hook.section === 'body' && rowType === 'group') {
          hook.cell.styles.fillColor = [236, 248, 249]
          hook.cell.styles.fontStyle = 'bold'
          if (hook.column.dataKey !== 'caregiver') {
            hook.cell.text = ''
          }
        }
        if (hook.section === 'body' && rowType === 'total') {
          hook.cell.styles.fillColor = [244, 251, 252]
          hook.cell.styles.fontStyle = 'bold'
        }
      }
    })

    doc.setTextColor(10, 87, 183)
    doc.setFontSize(11)
    doc.text(`Grand Total: ${fmtMoney(summaryTotals?.bill_total || 0)}`, 420, (doc.lastAutoTable?.finalY || 700) + 26)
    doc.setTextColor(blue)
    return doc
  }

  async function viewInvoicePdf(invoiceId) {
    try {
      const data = await authedFetch(`/api/v1/invoices/${invoiceId}`)
      const client = clients.find((c) => String(c.client_id) === String(data.client_id))
      const clientName = client?.name || `Client #${data.client_id}`
      const clientAddress = client?.address || ''
      const makeDate = (value) => {
        if (!value) return ''
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return String(value)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
      const periodFrom = makeDate(data.from_utc)
      const periodTo = makeDate(data.to_utc)
      const invoiceDate = makeDate(data.created_at || data.from_utc)
      const dueDate = makeDate(data.to_utc)
      const invoiceNumber = `INV-${String(data.invoice_number ?? data.invoice_id).padStart(4, '0')}`
      const blueprint = invoiceBlueprints[invoiceId]

      const summaryRows = blueprint?.summaryRows || data.summary_rows || []
      const detailRows = blueprint?.previewRows || data.detail_rows || []
      const groupedPreviewRows = []
      const rowsByCaregiver = detailRows.reduce((acc, row) => {
        const caregiver = row.caregiver_name || 'Unknown'
        if (!acc[caregiver]) acc[caregiver] = []
        acc[caregiver].push(row)
        return acc
      }, {})
      Object.entries(rowsByCaregiver).forEach(([caregiver, rows]) => {
        groupedPreviewRows.push({ isHeader: true, caregiver })
        rows.forEach((row) => {
          groupedPreviewRows.push({
            isHeader: false,
            isTotal: false,
            day: row.start_date || '',
            startDate: row.start_date || '',
            startTime: row.start_time || '',
            endDate: row.end_date || '',
            endTime: row.end_time || '',
            hours: row.hours_total ?? ((Number(row.hours_day || 0) + Number(row.hours_night || 0)).toFixed(2)),
            notes: row.notes ?? '',
            caregiver
          })
        })
        const caregiverHours = rows.reduce((tot, row) => tot + Number(row.hours_total || 0 || ((Number(row.hours_day || 0) + Number(row.hours_night || 0)))), 0)
        groupedPreviewRows.push({ isTotal: true, hours: caregiverHours.toFixed(2), caregiver })
      })
      const previewRows = groupedPreviewRows
      const summaryTotals = blueprint?.summaryTotals || {
        hours_total: summaryRows.reduce((acc, row) => acc + Number(row.hours_total || 0), 0),
        hours_day: summaryRows.reduce((acc, row) => acc + Number(row.hours_day || 0), 0),
        hours_night: summaryRows.reduce((acc, row) => acc + Number(row.hours_night || 0), 0),
        bill_total: summaryRows.reduce((acc, row) => acc + Number(row.bill_total || 0), 0)
      }

      const doc = blueprint
        ? buildInvoicePdfDocument({
            clientName,
            clientAddress,
            invoiceNumber,
            periodFrom: blueprint.periodFrom || periodFrom,
            periodTo: blueprint.periodTo || periodTo,
            invoiceDate: blueprint.invoiceDate || invoiceDate,
            dueDate: blueprint.dueDate || dueDate,
            summaryRows,
            summaryTotals,
            previewRows
          })
        : buildInvoicePdfDocument({
            clientName,
            clientAddress,
            invoiceNumber,
            periodFrom,
            periodTo,
            invoiceDate,
            dueDate,
            summaryRows,
            summaryTotals,
            previewRows
          })

      window.open(doc.output('dataurlnewwindow'), '_blank', 'noopener,noreferrer')
      setInvoiceDetail(data)
      setSelectedInvoiceId(invoiceId)
      setStatus(`Opened invoice PDF #${invoiceId}`)
    } catch (err) {
      setStatus(`Could not open invoice PDF: ${err.message}`)
    }
  }

  async function bootstrapAdminData(jwt) {
    const headers = { Authorization: `Bearer ${jwt}` }
    const meRes = await fetch('/api/v1/auth/me', { headers })
    const meData = await meRes.json()
    if (!meRes.ok) {
      throw new Error(readErrorMessage(meData, 'Could not load user'))
    }
    setMe(meData)

    if (meData.role === 'CUSTOMER') {
      setCaregivers([])
      setClients(meData.client_id ? [{ client_id: meData.client_id, name: meData.client_name || `Client #${meData.client_id}` }] : [])
      return
    }

    const [cgRes, clientsRes, ratesRes] = await Promise.all([
      fetch('/api/v1/caregivers', { headers }),
      fetch('/api/v1/clients', { headers }),
      fetch('/api/v1/caregiver-rates', { headers })
    ])

    const cgData = await cgRes.json()
    const clientsData = await clientsRes.json()
    const ratesData = await ratesRes.json()

    if (!cgRes.ok) throw new Error(readErrorMessage(cgData, 'Could not load caregivers'))
    if (!clientsRes.ok) throw new Error(readErrorMessage(clientsData, 'Could not load clients'))
    if (!ratesRes.ok) throw new Error(readErrorMessage(ratesData, 'Could not load caregiver pay rates'))

    setCaregivers(Array.isArray(cgData) ? cgData : [])
    setClients(Array.isArray(clientsData) ? clientsData : [])
    setCaregiverRates(Array.isArray(ratesData) ? ratesData : [])
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
      const isJson = (res.headers.get('content-type') || '').includes('application/json')
      const data = isJson ? await res.json() : null
      if (!res.ok) throw new Error(readErrorMessage(data, `Login failed (${res.status})`))

      const jwt = data.access_token
      setToken(jwt)
      await bootstrapAdminData(jwt)
      setPassword('')
      setStatus('Login successful. Admin dashboard ready.')
      setActiveTab('scheduler')
    } catch (err) {
      setStatus(`Login failed: ${err.message}`)
      setToken('')
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setToken('')
    setMe(null)
    setShifts([])
    setReportRows([])
    setEditingShiftId(null)
    setStatus('Logged out')
    window.dispatchEvent(new Event('app-logout'))
  }

  function startEditShift(shiftRow) {
    setEditingShiftId(shiftRow.shift_id)
    setEditShiftDraft({
      start_date: shiftRow.start_date || '',
      start_time: shiftRow.start_time || '',
      end_date: shiftRow.end_date || '',
      end_time: shiftRow.end_time || '',
      notes: ''
    })
    setStatus(`Editing shift #${shiftRow.shift_id}`)
  }

  function cancelEditShift() {
    setEditingShiftId(null)
    setEditShiftDraft({
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      notes: ''
    })
  }

  async function saveShiftEdits(shiftId) {
    setLoading(true)
    setStatus(`Saving shift #${shiftId}...`)
    try {
      const payload = {}
      if (editShiftDraft.start_date) payload.start_date = editShiftDraft.start_date
      if (editShiftDraft.start_time) payload.start_time = editShiftDraft.start_time
      if (editShiftDraft.end_date) payload.end_date = editShiftDraft.end_date
      if (editShiftDraft.end_time) payload.end_time = editShiftDraft.end_time
      if (editShiftDraft.notes.trim()) payload.notes = editShiftDraft.notes.trim()

      await authedFetch(`/api/v1/admin/shifts/${shiftId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      setStatus(`Shift #${shiftId} updated`)
      setEditingShiftId(null)
      await loadShifts()
    } catch (err) {
      setStatus(`Failed to update shift #${shiftId}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function voidShift(shiftRow) {
    if (shiftRow.status === 'CLOSED' || shiftRow.status === 'VOID') {
      setStatus(`Shift #${shiftRow.shift_id} cannot be voided from status ${shiftRow.status}`)
      return
    }

    const ok = window.confirm(`Void shift #${shiftRow.shift_id}?`)
    if (!ok) return

    setLoading(true)
    setStatus(`Voiding shift #${shiftRow.shift_id}...`)
    try {
      await authedFetch(`/api/v1/admin/shifts/${shiftRow.shift_id}/void`, {
        method: 'POST'
      })
      setStatus(`Shift #${shiftRow.shift_id} voided`)
      await loadShifts()
    } catch (err) {
      setStatus(`Failed to void shift #${shiftRow.shift_id}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function requestDeleteShift(shiftRow) {
    setPendingShiftDelete(shiftRow)
  }

  async function confirmDeleteShift() {
    const shiftRow = pendingShiftDelete
    if (!shiftRow) return

    setPendingShiftDelete(null)
    setLoading(true)
    setStatus(`Deleting shift #${shiftRow.shift_id}...`)
    try {
      await authedFetch(`/api/v1/admin/shifts/${shiftRow.shift_id}`, {
        method: 'DELETE'
      })
      setStatus(`Shift #${shiftRow.shift_id} deleted`)
      await loadShifts()
    } catch (err) {
      setStatus(`Failed to delete shift #${shiftRow.shift_id}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadShifts() {
    setLoading(true)
    setStatus('Loading shifts...')
    try {
      const hasFromDate = String(shiftFilters.from_date || '').trim().length > 0
      const hasToDate = String(shiftFilters.to_date || '').trim().length > 0
      const params = new URLSearchParams()
      Object.entries(shiftFilters).forEach(([k, v]) => {
        if (!String(v || '').trim()) return
        if (k === 'from_time' && !hasFromDate) return
        if (k === 'to_time' && !hasToDate) return
        params.set(k, v)
      })
      const path = `/api/v1/admin/shifts${params.toString() ? `?${params.toString()}` : ''}`
      const data = await authedFetch(path)
      setShifts(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} shifts`)
      setActiveTab('shifts')
    } catch (err) {
      setStatus(`Failed to load shifts: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function caregiverLabel(caregiverId) {
    const cg = caregivers.find((row) => row.caregiver_id === caregiverId)
    return cg ? cg.name : caregiverId
  }

  function clientLabel(clientId) {
    const c = clients.find((row) => row.client_id === clientId)
    return c ? c.name : clientId
  }

  async function submitCreateClosedShift(e) {
    e.preventDefault()
    setLoading(true)
    setStatus('Creating closed shift...')
    try {
      const payload = {
        client_id: Number(createShift.client_id),
        caregiver_id: Number(createShift.caregiver_id),
        start_date: createShift.start_date,
        start_time: createShift.start_time,
        end_date: createShift.end_date,
        end_time: createShift.end_time,
        notes: createShift.notes
      }

      const data = await authedFetch('/api/v1/admin/shifts/create-closed', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setStatus(`Created shift #${data.shift_id}`)
      await loadShifts()
      setActiveTab('shifts')
    } catch (err) {
      setStatus(`Failed to create shift: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadReport(kind, caregiverId = null) {
    setLoading(true)
    setStatus(`Loading payroll ${kind} report...`)
    setReportKind(kind)
    setReportRows([])
    setDrilledDownCaregiver(null)
    try {
      const params = new URLSearchParams()
      Object.entries(reportFilters).forEach(([k, v]) => {
        if (String(v || '').trim()) params.set(k, v)
      })
      if (isCustomer && linkedClientId) {
        params.set('client_id', linkedClientId)
      }
      // Override caregiver_id if drilling down
      if (caregiverId) {
        params.set('caregiver_id', caregiverId)
        setDrilledDownCaregiver(caregiverId)
      }
      const endpoint = kind === 'summary'
        ? '/api/v1/admin/reports/payroll'
        : '/api/v1/admin/reports/payroll/detail'
      const path = `${endpoint}?${params.toString()}`
      const data = await authedFetch(path)
      setReportRows(Array.isArray(data) ? data : [])
      setActiveTab('reports')
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} rows`) 
    } catch (err) {
      setStatus(`Failed to load report: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const calculateSummaryTotals = () => {
    if (reportKind !== 'summary' || reportRows.length === 0) return null
    const totals = reportRows.reduce(
      (acc, row) => ({
        hours_day: acc.hours_day + (row.hours_day || 0),
        hours_night: acc.hours_night + (row.hours_night || 0),
        hours_total: acc.hours_total + (row.hours_total || 0),
        bill_day: acc.bill_day + (row.bill_day || 0),
        bill_night: acc.bill_night + (row.bill_night || 0),
        bill_total: acc.bill_total + (row.bill_total || 0),
        pay_day: acc.pay_day + (row.pay_day || 0),
        pay_night: acc.pay_night + (row.pay_night || 0),
        pay_total: acc.pay_total + (row.pay_total || 0)
      }),
      { hours_day: 0, hours_night: 0, hours_total: 0, bill_day: 0, bill_night: 0, bill_total: 0, pay_day: 0, pay_night: 0, pay_total: 0 }
    )
    return totals
  }

  function displaySummaryCsv() {
    setLoading(true)
    setStatus('Generating summary CSV preview...')
    try {
      if (reportKind !== 'summary' || reportRows.length === 0) {
        throw new Error('No summary data to export. Load a summary report first.')
      }

      const totals = calculateSummaryTotals()
      const csvContent = [
        ['Caregiver', 'Hours Day', 'Hours Night', 'Total Hours', 'Bill Day', 'Bill Night', 'Bill Total', 'Pay Day', 'Pay Night', 'Pay Total'],
        ...reportRows.map((row) => [
          row.caregiver_name || '',
          row.hours_day || 0,
          row.hours_night || 0,
          row.hours_total || 0,
          row.bill_day || 0,
          row.bill_night || 0,
          row.bill_total || 0,
          row.pay_day || 0,
          row.pay_night || 0,
          row.pay_total || 0
        ]),
        ['TOTAL', totals.hours_day, totals.hours_night, totals.hours_total, totals.bill_day, totals.bill_night, totals.bill_total, totals.pay_day, totals.pay_night, totals.pay_total]
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n')

      setCsvPreview(csvContent)
      setShowInvoicePreview(false)
      setStatus('Summary CSV ready to copy')
    } catch (err) {
      setStatus(`CSV generation failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function exportSummaryCsv() {
    setLoading(true)
    setStatus('Exporting payroll summary CSV...')
    try {
      if (reportKind !== 'summary' || reportRows.length === 0) {
        throw new Error('No summary data to export. Load a summary report first.')
      }

      const totals = calculateSummaryTotals()
      const csvContent = [
        ['Caregiver', 'Hours Day', 'Hours Night', 'Total Hours', 'Bill Day', 'Bill Night', 'Bill Total', 'Pay Day', 'Pay Night', 'Pay Total'],
        ...reportRows.map((row) => [
          row.caregiver_name || '',
          row.hours_day || 0,
          row.hours_night || 0,
          row.hours_total || 0,
          row.bill_day || 0,
          row.bill_night || 0,
          row.bill_total || 0,
          row.pay_day || 0,
          row.pay_night || 0,
          row.pay_total || 0
        ]),
        ['TOTAL', totals.hours_day, totals.hours_night, totals.hours_total, totals.bill_day, totals.bill_night, totals.bill_total, totals.pay_day, totals.pay_night, totals.pay_total]
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const from = reportFilters.from_date || 'from'
      const to = reportFilters.to_date || 'to'
      a.href = url
      a.download = `payroll-summary-${from}-to-${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      setStatus('Summary CSV downloaded')
    } catch (err) {
      setStatus(`CSV export failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function backToSummary() {
    setDrilledDownCaregiver(null)
    loadReport('summary')
  }

  async function copyToken() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setStatus('Token copied to clipboard')
    } catch {
      setStatus('Clipboard permission blocked. Copy token manually from the box.')
    }
  }

  async function exportDetailCsv() {
    setLoading(true)
    setStatus('Exporting payroll detail CSV...')
    try {
      const params = new URLSearchParams()
      Object.entries(reportFilters).forEach(([k, v]) => {
        if (String(v || '').trim()) params.set(k, v)
      })

      const res = await fetch(`/api/v1/admin/reports/payroll/detail.csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`
        const isJson = (res.headers.get('content-type') || '').includes('application/json')
        if (isJson) {
          const errData = await res.json()
          errMessage = readErrorMessage(errData, errMessage)
        } else {
          const txt = await res.text()
          if (txt) errMessage = txt
        }
        throw new Error(errMessage)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const from = reportFilters.from_date || 'from'
      const to = reportFilters.to_date || 'to'
      a.href = url
      a.download = `payroll-detail-${from}-to-${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      setStatus('CSV downloaded')
    } catch (err) {
      setStatus(`CSV export failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function resetCaregiverForm() {
    setSelectedCaregiverId(null)
    setCaregiverForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      active: '1'
    })
  }

  function resetAdminUserForm() {
    setSelectedAdminUserId(null)
    setAdminUserForm({
      name: '',
      email: '',
      password: '',
      role: 'SUPERVISOR',
      active: '1',
      client_id: ''
    })
  }

  async function refreshAdminUsers() {
    setLoading(true)
    setStatus('Refreshing admin profiles...')
    try {
      const data = await authedFetch('/api/v1/admin/users')
      setAdminUsers(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} admin profiles`)
    } catch (err) {
      setStatus(`Failed to refresh admin profiles: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function startEditAdminUser(user) {
    setSelectedAdminUserId(user.user_id)
    setAdminUserForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'SUPERVISOR',
      active: String(user.active ?? (user.status === 'ACTIVE' ? 1 : 0)),
      client_id: String(user.client_id || '')
    })
    setActiveTab('adminProfiles')
    setStatus(`Editing profile #${user.user_id}`)
  }

  async function handleSaveAdminUser() {
    if (!adminUserForm.email.trim()) {
      setStatus('Email is required')
      return
    }

    const role = (adminUserForm.role || '').trim().toUpperCase()
    if (!['ADMIN', 'SUPERVISOR', 'CUSTOMER'].includes(role)) {
      setStatus('Role must be ADMIN, SUPERVISOR, or CUSTOMER')
      return
    }

    if (role === 'CUSTOMER' && !adminUserForm.client_id) {
      setStatus('Customer profile requires linked client')
      return
    }

    if (!selectedAdminUserId && adminUserForm.password.trim().length < 8) {
      setStatus('Password must be at least 8 characters for new users')
      return
    }

    setLoading(true)
    setStatus(selectedAdminUserId ? 'Updating admin profile...' : 'Creating admin profile...')
    try {
      if (!selectedAdminUserId) {
        await authedFetch('/api/v1/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            name: adminUserForm.name.trim() || null,
            email: adminUserForm.email.trim(),
            password: adminUserForm.password.trim(),
            role,
            active: Number(adminUserForm.active),
            client_id: role === 'CUSTOMER' ? Number(adminUserForm.client_id) : null
          })
        })
        setStatus('Admin profile created')
      } else {
        const payload = {
          name: adminUserForm.name.trim() || null,
          email: adminUserForm.email.trim(),
          role,
          active: Number(adminUserForm.active),
          client_id: role === 'CUSTOMER' ? Number(adminUserForm.client_id) : null
        }
        if (adminUserForm.password.trim()) payload.password = adminUserForm.password.trim()

        await authedFetch(`/api/v1/admin/users/${selectedAdminUserId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })

        const isSelfUpdate = Number(selectedAdminUserId) === Number(me?.user_id)
        const emailChanged = String(adminUserForm.email || '').trim().toLowerCase() !== String(me?.email || '').trim().toLowerCase()
        const passwordChanged = Boolean(adminUserForm.password.trim())
        const deactivatedSelf = Number(adminUserForm.active) === 0
        const roleChangedAwayFromAdmin = role !== 'ADMIN'

        if (isSelfUpdate && (emailChanged || passwordChanged || deactivatedSelf || roleChangedAwayFromAdmin)) {
          resetAdminUserForm()
          logout()
          setStatus('Profile updated. Please log in again with your new credentials.')
          return
        }

        setStatus(`Admin profile #${selectedAdminUserId} updated`)
      }

      await refreshAdminUsers()
      resetAdminUserForm()
    } catch (err) {
      setStatus(`Admin profile save failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteAdminUser(userId) {
    const ok = window.confirm(`Delete admin profile #${userId}?`)
    if (!ok) return

    setLoading(true)
    setStatus(`Deleting admin profile #${userId}...`)
    try {
      await authedFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' })
      await refreshAdminUsers()
      if (selectedAdminUserId === userId) resetAdminUserForm()
      setStatus(`Admin profile #${userId} deleted`)
    } catch (err) {
      setStatus(`Delete failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function submitAdminUser(e) {
    e.preventDefault()
    handleSaveAdminUser()
  }

  function resetClientForm() {
    setSelectedClientId(null)
    setClientForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      active: '1',
      bill_day: '',
      bill_night: '',
      day_window_start: '07:00',
      day_window_end: '23:00',
      invoice_cycle: 'WEEKLY',
      invoice_anchor_dow: '6',
      invoice_anchor_time: '23:00',
      timezone: '',
      holiday_bill_multiplier: '',
      holiday_pay_multiplier: ''
    })
    setClientShiftSlots([])
    setShiftSlotForm({ slot_name: '', start_time: '', end_time: '', rate_type: 'DAY' })
    setEditingSlotId(null)
  }

  async function refreshCaregivers() {
    setLoading(true)
    setStatus('Refreshing caregivers...')
    try {
      const data = await authedFetch('/api/v1/caregivers')
      setCaregivers(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} caregivers`)
    } catch (err) {
      setStatus(`Failed to refresh caregivers: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function refreshCaregiverRates() {
    setLoading(true)
    setStatus('Refreshing caregiver pay rates...')
    try {
      const data = await authedFetch('/api/v1/caregiver-rates')
      setCaregiverRates(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} caregiver pay rates`)
    } catch (err) {
      setStatus(`Failed to refresh caregiver pay rates: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function resetCaregiverRateForm() {
    setCaregiverRateForm({
      rate_id: null,
      caregiver_id: '',
      client_id: '',
      pay_day: '',
      pay_night: ''
    })
  }

  // ---- Holiday helpers ----

  function resetHolidayForm() {
    setHolidayForm({ holiday_id: null, client_id: '', date: '', name: '', multiplier_bill: '', multiplier_pay: '' })
  }

  function startEditHoliday(row) {
    setHolidayForm({
      holiday_id: row.holiday_id,
      client_id: row.client_id != null ? String(row.client_id) : '',
      date: row.date || '',
      name: row.name || '',
      multiplier_bill: row.multiplier_bill != null ? row.multiplier_bill : '',
      multiplier_pay: row.multiplier_pay != null ? row.multiplier_pay : ''
    })
  }

  async function refreshHolidays() {
    setLoading(true)
    setStatus('Refreshing holidays...')
    try {
      const data = await authedFetch('/api/v1/holidays')
      setHolidays(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} holidays`)
    } catch (err) {
      setStatus(`Failed to refresh holidays: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitHoliday(e) {
    e.preventDefault()
    if (!holidayForm.date || !holidayForm.name) {
      setStatus('Date and name are required')
      return
    }
    if (holidayForm.multiplier_bill === '' || holidayForm.multiplier_pay === '') {
      setStatus('Bill % and Pay % are required')
      return
    }
    setLoading(true)
    setStatus('Saving holiday...')
    try {
      const payload = {
        client_id: holidayForm.client_id !== '' ? Number(holidayForm.client_id) : null,
        date: holidayForm.date,
        name: holidayForm.name.trim(),
        multiplier_bill: Number(holidayForm.multiplier_bill),
        multiplier_pay: Number(holidayForm.multiplier_pay)
      }
      if (holidayForm.holiday_id) {
        await authedFetch(`/api/v1/holidays/${holidayForm.holiday_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await authedFetch('/api/v1/holidays', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      await refreshHolidays()
      resetHolidayForm()
      setStatus('Holiday saved')
    } catch (err) {
      setStatus(`Failed to save holiday: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function requestDeleteHoliday(holidayId) {
    setPendingHolidayDelete(holidayId)
  }

  async function confirmDeleteHoliday() {
    const holidayId = pendingHolidayDelete
    if (!holidayId) return
    setPendingHolidayDelete(null)
    setLoading(true)
    setStatus(`Deleting holiday #${holidayId}...`)
    try {
      await authedFetch(`/api/v1/holidays/${holidayId}`, { method: 'DELETE' })
      await refreshHolidays()
      if (Number(holidayForm.holiday_id) === Number(holidayId)) resetHolidayForm()
      setStatus(`Holiday #${holidayId} deleted`)
    } catch (err) {
      setStatus(`Failed to delete holiday: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ---- end Holiday helpers ----

  function startEditCaregiverRate(row) {
    setCaregiverRateForm({
      rate_id: row.rate_id,
      caregiver_id: String(row.caregiver_id || ''),
      client_id: String(row.client_id || ''),
      pay_day: row.pay_day ?? '',
      pay_night: row.pay_night ?? ''
    })
  }

  async function submitCaregiverRate(e) {
    e.preventDefault()
    if (!caregiverRateForm.caregiver_id || !caregiverRateForm.client_id) {
      setStatus('Caregiver and client are required for pay rate')
      return
    }
    if (caregiverRateForm.pay_day === '' || caregiverRateForm.pay_night === '') {
      setStatus('Pay day and pay night are required')
      return
    }

    setLoading(true)
    setStatus('Saving caregiver pay rate...')
    try {
      await authedFetch('/api/v1/caregiver-rates', {
        method: 'PUT',
        body: JSON.stringify({
          caregiver_id: Number(caregiverRateForm.caregiver_id),
          client_id: Number(caregiverRateForm.client_id),
          pay_day: Number(caregiverRateForm.pay_day),
          pay_night: Number(caregiverRateForm.pay_night)
        })
      })
      await refreshCaregiverRates()
      resetCaregiverRateForm()
      setStatus('Caregiver pay rate saved')
    } catch (err) {
      setStatus(`Failed to save caregiver pay rate: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function requestDeleteCaregiverRate(rateId) {
    setPendingCaregiverRateDelete(rateId)
  }

  async function confirmDeleteCaregiverRate() {
    const rateId = pendingCaregiverRateDelete
    if (!rateId) return

    setPendingCaregiverRateDelete(null)

    setLoading(true)
    setStatus(`Deleting caregiver pay rate #${rateId}...`)
    try {
      await authedFetch(`/api/v1/caregiver-rates/${rateId}`, { method: 'DELETE' })
      await refreshCaregiverRates()
      if (Number(caregiverRateForm.rate_id) === Number(rateId)) resetCaregiverRateForm()
      setStatus(`Caregiver pay rate #${rateId} deleted`)
    } catch (err) {
      setStatus(`Failed to delete caregiver pay rate: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function startEditCaregiver(caregiver) {
    setSelectedCaregiverId(caregiver.caregiver_id)
    setCaregiverForm({
      name: caregiver.name || '',
      email: caregiver.email || '',
      password: '',
      phone: caregiver.phone || '',
      address: caregiver.address || '',
      active: String(caregiver.active ?? 1)
    })
    setActiveTab('caregivers')
    setStatus(`Editing caregiver #${caregiver.caregiver_id}`)
  }

  async function refreshClients() {
    setLoading(true)
    setStatus('Refreshing clients...')
    try {
      const data = await authedFetch('/api/v1/clients')
      setClients(Array.isArray(data) ? data : [])
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} clients`)
    } catch (err) {
      setStatus(`Failed to refresh clients: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function displayDetailCsv() {
    setLoading(true)
    setStatus('Generating detail CSV preview...')
    try {
      if (reportRows.length === 0) {
        throw new Error('No detail data loaded. Load a detail report first.')
      }
      const csvContent = [
        ['Shift ID', 'Caregiver', 'Client', 'Start', 'End', 'Total Hours', 'Pay Total'],
        ...reportRows.map((row) => [
          row.shift_id || '',
          row.caregiver_name || '',
          row.client_name || '',
          `${row.start_date || ''} ${row.start_time || ''}`,
          `${row.end_date || ''} ${row.end_time || ''}`,
          row.hours_total || 0,
          row.pay_total || 0
        ])
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n')
      setCsvPreview(csvContent)
      setStatus('Detail CSV ready to copy')
    } catch (err) {
      setStatus(`CSV generation failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function printDetailReport() {
    if (reportRows.length === 0) return

    // Sort all rows by start datetime only (to detect schedule coverage gaps)
    const sorted = [...reportRows].sort((a, b) => {
      const aStart = `${a.start_date || ''}T${a.start_time || ''}`
      const bStart = `${b.start_date || ''}T${b.start_time || ''}`
      return aStart.localeCompare(bStart)
    })

    // Compute gap between this row's end and the NEXT row's start (any caregiver)
    const gapFor = (idx) => {
      const cur = sorted[idx]
      const next = sorted[idx + 1]
      if (!next) return ''
      if (!cur.end_date || !cur.end_time || !next.start_date || !next.start_time) return ''
      const endMs = new Date(`${cur.end_date}T${cur.end_time}`).getTime()
      const nextMs = new Date(`${next.start_date}T${next.start_time}`).getTime()
      if (isNaN(endMs) || isNaN(nextMs)) return ''
      const diffMin = Math.round((nextMs - endMs) / 60000)
      if (diffMin === 0) return ''
      if (diffMin < 0) return `⚠ overlap ${Math.abs(diffMin)}m`
      const h = Math.floor(diffMin / 60)
      const m = diffMin % 60
      return h > 0 ? `${h}h ${m > 0 ? m + 'm ' : ''}gap` : `${m}m gap`
    }

    const rows = sorted.map((row, idx) => {
      const gap = gapFor(idx)
      const gapCell = gap
        ? `<td style="color:${gap.startsWith('⚠') ? '#c00' : '#b06000'}; font-weight:600;">${gap}</td>`
        : '<td></td>'
      return `<tr>
        <td>${row.caregiver_name || ''}</td>
        <td>${row.start_date || ''} ${row.start_time || ''}</td>
        <td>${row.end_date || ''} ${row.end_time || ''}</td>
        ${gapCell}
      </tr>`
    }).join('')

    const fmtPrintMoney = (n) => {
      const v = Number(n || 0)
      if (!Number.isFinite(v)) return '$0.00'
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    let payTotalsSection = ''
    if (!isCustomer) {
      const payTotals = {}
      reportRows.forEach((row) => {
        const name = row.caregiver_name || 'Unknown'
        payTotals[name] = (payTotals[name] || 0) + (parseFloat(row.pay_total) || 0)
      })
      const grandTotal = Object.values(payTotals).reduce((acc, n) => acc + Number(n || 0), 0)
      const payTotalRows = Object.entries(payTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, total]) => `<tr><td>${name}</td><td style="text-align:right; font-weight:600;">$${total.toFixed(2)}</td></tr>`)
        .join('')
      payTotalsSection = `
  <h3>Total to Pay per Caregiver</h3>
  <table class="pay-table">
    <thead><tr><th>Caregiver</th><th>Pay Total</th></tr></thead>
    <tbody>${payTotalRows}<tr><td style="font-weight:700;">GRAND TOTAL</td><td style="text-align:right; font-weight:700;">$${grandTotal.toFixed(2)}</td></tr></tbody>
  </table>`
    }

    let adminTotalsSection = ''
    if (isAdmin) {
      const billTotal = reportRows.reduce((acc, row) => {
        const hoursDay = Number(row.hours_day || 0)
        const hoursNight = Number(row.hours_night || 0)
        const client = clients.find((c) => String(c.client_id) === String(row.client_id))
        const billDayRate = Number(client?.bill_day || 0)
        const billNightRate = Number(client?.bill_night || 0)
        return acc + (hoursDay * billDayRate) + (hoursNight * billNightRate)
      }, 0)

      const payTotal = reportRows.reduce((acc, row) => acc + Number(row.pay_total || 0), 0)
      const fee = Math.ceil((billTotal / 100) * 1.5)
      const totalGains = billTotal - payTotal - fee

      adminTotalsSection = `
  <h3>Admin Totals</h3>
  <table class="pay-table admin-totals-table">
    <tbody>
      <tr><td style="font-weight:700;">Bill Total</td><td style="text-align:right; font-weight:700;">${fmtPrintMoney(billTotal)}</td></tr>
      <tr><td style="font-weight:700;">Pay Total</td><td style="text-align:right; font-weight:700;">${fmtPrintMoney(payTotal)}</td></tr>
      <tr><td style="font-weight:700;">Fee (1.5%)</td><td style="text-align:right; font-weight:700;">${fmtPrintMoney(fee)}</td></tr>
      <tr><td style="font-weight:700;">Total Gains</td><td style="text-align:right; font-weight:700;">${fmtPrintMoney(totalGains)}</td></tr>
    </tbody>
  </table>`
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payroll Detail Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; }
    h2 { margin-bottom: 12px; }
    h3 { margin: 24px 0 8px 0; color: #0a7a85; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
    th { background: #0a9baa; color: #fff; padding: 6px 10px; text-align: left; }
    td { border: 1px solid #ccc; padding: 5px 10px; }
    tr:nth-child(even) { background: #f5f5f5; }
    .pay-table { width: auto; min-width: 300px; }
  </style>
</head>
<body>
  <h2>Payroll Detail Report</h2>
  <table>
    <thead><tr><th>Caregiver</th><th>Start</th><th>End</th><th>Gap to Next</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${payTotalsSection}
  ${adminTotalsSection}
</body>
</html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  function printScheduler() {
    if (schedulerView !== 'schedule') {
      setStatus('Switch to Schedule view to print monthly assignments.')
      return
    }

    const node = schedulerPrintRef.current
    if (!node) {
      setStatus('Scheduler not ready to print.')
      return
    }

    const boardNode = node.querySelector('.month-board-wrap')
    if (!boardNode) {
      setStatus('Monthly board not ready to print.')
      return
    }

    const clientName = clients.find(c => String(c.client_id) === String(schedulerClientId))?.name || 'All Clients'

    const win = window.open('', '_blank')
    if (!win) {
      setStatus('Popup blocked. Please allow popups to print scheduler.')
      return
    }

    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => `<link rel="stylesheet" href="${l.href}">`)
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Scheduler Print</title>
  ${links}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 6px 10px; background: #fff; color: #1a2d38; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .print-head { margin-bottom: 4px; display: flex; align-items: baseline; gap: 12px; }
    .print-title { font-size: 16px; font-weight: 800; margin: 0; color: #0d596d; }
    .print-sub { margin: 0; font-size: 11px; color: #35525b; }
    .month-board-wrap { overflow: visible !important; border: none !important; background: #fff !important; border-radius: 0 !important; }
    .month-board-title { margin: 0 0 4px 0 !important; padding: 2px 0 !important; background: transparent !important; border: none !important; font-size: 13px !important; color: #1a2d38 !important; letter-spacing: 0.08em !important; text-align: center !important; text-transform: uppercase; font-weight: 800; }
    .month-board { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; min-width: 0 !important; }
    .month-board th { border: 1px solid #1a2d38 !important; background: #eef8fb !important; color: #1a2d38 !important; text-align: center !important; font-weight: 800 !important; padding: 3px 2px !important; font-size: 10px !important; }
    .month-board td { border: 1px solid #1a2d38 !important; background: #fff !important; width: 14.28% !important; height: 80px !important; vertical-align: top !important; padding: 3px 4px !important; }
    .month-cell-out { background: #f7fbfc !important; }
    .month-cell-today { background: #eef8fb !important; }
    .month-cell-date { font-size: 10px !important; font-weight: 800 !important; color: #1a2d38 !important; margin-bottom: 2px !important; }
    .month-cell-list { min-height: 0 !important; display: flex; flex-direction: column; gap: 1px; }
    .month-cg-line { font-size: 9px !important; font-weight: 700 !important; line-height: 1.2 !important; margin: 0 !important; padding: 1px 2px !important; border-radius: 2px; }
    .month-cg-name { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
    .month-add-row, .month-selection-preview, .month-cg-remove, .slot-empty-cell { display: none !important; }
    @page { size: landscape; margin: 6mm; }
    html, body { height: 100%; }
  </style>
</head>
<body>
  <div class="print-head">
    <h1 class="print-title">Scheduler</h1>
    <p class="print-sub">Client: ${clientName}</p>
  </div>
  <div class="print-board">
    ${boardNode.outerHTML}
  </div>
</body>
</html>`

    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 200)
  }

  async function generateInvoicePreview() {
    if (reportKind !== 'summary' || reportRows.length === 0) {
      setStatus('Load Summary report first, then click Generate Invoice.')
      return
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const toMMDDYYYY = (val) => {
      if (!val || typeof val !== 'string' || !val.includes('-')) return val || ''
      const [yyyy, mm, dd] = val.split('-')
      return `${mm}-${dd}-${yyyy}`
    }
    const toDayName = (dateStr) => {
      if (!dateStr) return ''
      const dt = new Date(`${dateStr}T00:00:00`)
      if (Number.isNaN(dt.getTime())) return ''
      return dayNames[dt.getDay()]
    }
    const fmtHours = (n) => {
      const v = Number(n || 0)
      if (!Number.isFinite(v)) return '0'
      return Number(v.toFixed(2)).toString()
    }
    const toMonDD = (val) => {
      if (!val || typeof val !== 'string' || !val.includes('-')) return val || ''
      const [yyyy, mm, dd] = val.split('-')
      const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
      if (Number.isNaN(d.getTime())) return `${mm}-${dd}`
      const mon = d.toLocaleString('en-US', { month: 'short' })
      return `${mon}-${Number(dd)}`
    }
    const fmtMoney = (n) => {
      const v = Number(n || 0)
      if (!Number.isFinite(v)) return '$0.00'
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    const addDays = (dateStr, days) => {
      if (!dateStr) return ''
      const dt = new Date(`${dateStr}T00:00:00`)
      if (Number.isNaN(dt.getTime())) return ''
      dt.setDate(dt.getDate() + days)
      const yyyy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    const col = (value, width, align = 'left') => {
      const text = String(value ?? '')
      if (text.length >= width) return text.slice(0, width)
      return align === 'right' ? text.padStart(width, ' ') : text.padEnd(width, ' ')
    }
    const rowLine = (day, startDate, startTime, endDate, endTime, hours, caregiver) => [
      col(day, 11),
      col(startDate, 12),
      col(startTime, 10),
      col(endDate, 12),
      col(endTime, 10),
      col(hours, 9, 'right'),
      col(caregiver, 18)
    ].join(' | ')

    setLoading(true)
    setStatus('Generating invoice preview...')
    try {
      const params = new URLSearchParams()
      Object.entries(reportFilters).forEach(([k, v]) => {
        if (String(v || '').trim()) params.set(k, v)
      })

      const detailPath = `/api/v1/admin/reports/payroll/detail?${params.toString()}`
      const detailRowsRaw = await authedFetch(detailPath)
      const detailRows = Array.isArray(detailRowsRaw) ? detailRowsRaw : []
      if (detailRows.length === 0) {
        throw new Error('No detail rows found for this period.')
      }

      const sorted = [...detailRows].sort((a, b) => {
        const ca = (a.caregiver_name || '').localeCompare(b.caregiver_name || '')
        if (ca !== 0) return ca
        const sa = `${a.start_date || ''} ${a.start_time || ''}`
        const sb = `${b.start_date || ''} ${b.start_time || ''}`
        return sa.localeCompare(sb)
      })

      const previewRows = []
      const lines = [
        'HOURS PER CAREGIVER',
        `FROM ${toMMDDYYYY(reportFilters.from_date)} ${reportFilters.from_time} TO ${toMMDDYYYY(reportFilters.to_date)} ${reportFilters.to_time}`,
        '',
        rowLine('Day', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Tot Hours', 'Caregiver'),
        '-'.repeat(97)
      ]

      let currentCaregiver = null
      let caregiverTotal = 0
      const flushTotal = () => {
        if (!currentCaregiver) return
        previewRows.push({
          isTotal: true,
          day: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: 'TOTAL',
          hours: fmtHours(caregiverTotal),
          caregiver: currentCaregiver
        })
        lines.push(
          rowLine('', '', '', '', 'TOTAL', fmtHours(caregiverTotal), currentCaregiver)
        )
        lines.push('')
      }

      for (const row of sorted) {
        const caregiver = row.caregiver_name || 'Unknown'
        if (currentCaregiver !== caregiver) {
          flushTotal()
          currentCaregiver = caregiver
          caregiverTotal = 0
          previewRows.push({ isHeader: true, caregiver })
        }
        const hrs = Number(row.hours_total || 0)
        caregiverTotal += Number.isFinite(hrs) ? hrs : 0

        const item = {
          isTotal: false,
          day: toDayName(row.start_date),
          startDate: toMMDDYYYY(row.start_date),
          startTime: row.start_time || '',
          endDate: toMMDDYYYY(row.end_date),
          endTime: row.end_time || '',
          hours: fmtHours(row.hours_total),
          notes: row.notes || '',
          caregiver
        }
        previewRows.push(item)
        lines.push(rowLine(item.day, item.startDate, item.startTime, item.endDate, item.endTime, item.hours, item.caregiver))
      }
      flushTotal()

      const summaryRows = Array.isArray(reportRows) ? reportRows : []
      const summaryTotals = calculateSummaryTotals()
      const selectedClient = clients.find((c) => String(c.client_id) === String(reportFilters.client_id))
      const detailClientNames = Array.from(new Set(detailRows.map((r) => (r.client_name || '').trim()).filter(Boolean)))
      const inferredClientName = detailClientNames.length === 1 ? detailClientNames[0] : ''
      const inferredClient = inferredClientName
        ? clients.find((c) => String(c.name || '').trim().toLowerCase() === inferredClientName.toLowerCase())
        : null
      const clientName = selectedClient?.name || inferredClientName || 'All Clients'
      const clientAddress = selectedClient?.address || inferredClient?.address || ''
      const periodFrom = toMonDD(reportFilters.from_date)
      const periodTo = toMonDD(reportFilters.to_date)
      const invoiceDate = toMonDD(reportFilters.to_date)
      const dueDate = toMonDD(addDays(reportFilters.to_date, 2))
      const invoiceNumber = `INV-${String((function () {
        const start = reportFilters.from_date
        if (!start) return 1
        const [year, month, day] = start.split('-').map(Number)
        const anchor = new Date(Date.UTC(2026, 0, 4))
        const current = new Date(Date.UTC(year, month - 1, day))
        let week = 1
        let cursor = new Date(anchor)
        while (current >= cursor) {
          if (current < new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            return week
          }
          cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
          week += 1
        }
        return week
      })()).padStart(4, '0')}`

      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const blue = '#0a57b7'
      const teal = [10, 155, 170]

      doc.setTextColor(10, 87, 183)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      doc.text('Bill to:', 54, 84)
      doc.text(clientName, 54, 104)
      if (clientAddress) {
        const addrLines = doc.splitTextToSize(clientAddress, 250)
        doc.text(addrLines, 54, 124)
      }

      doc.setFontSize(13)
      doc.text('Karla Perez', 560, 52, { align: 'right' })

      doc.setFontSize(12)
      doc.text('Invoice number:', 332, 166)
      doc.setFont('helvetica', 'bold')
      doc.text(invoiceNumber, 470, 166)
      doc.setFont('helvetica', 'normal')

      doc.text('Period:', 332, 188)
      doc.text(periodFrom, 414, 188)
      doc.text(periodTo, 498, 188)
      doc.text('Invoice date:', 332, 210)
      doc.text(invoiceDate, 414, 210)
      doc.text('Due Date', 332, 232)
      doc.text(dueDate, 414, 232)

      doc.setFont('helvetica', 'bold')
      doc.text('SUMMARY TO BILL', 54, 268)
      doc.setFont('helvetica', 'normal')

      const summaryTableBody = summaryRows.map((row) => ([
        row.caregiver_name || '',
        fmtHours(row.hours_total),
        fmtHours(row.hours_day),
        fmtHours(row.hours_night),
        fmtMoney(row.bill_total)
      ]))
      if (summaryTotals) {
        summaryTableBody.push([
          'TOTAL',
          fmtHours(summaryTotals.hours_total),
          fmtHours(summaryTotals.hours_day),
          fmtHours(summaryTotals.hours_night),
          fmtMoney(summaryTotals.bill_total)
        ])
      }

      autoTable(doc, {
        startY: 282,
        theme: 'grid',
        head: [['', 'Hours', 'Day', 'Night', 'TOTAL']],
        body: summaryTableBody,
        styles: { font: 'helvetica', fontSize: 10, lineColor: [0, 0, 0], lineWidth: 0.6, textColor: [10, 87, 183] },
        headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        },
        didParseCell: (hook) => {
          if (hook.section === 'body' && hook.row.index === summaryTableBody.length - 1) {
            hook.cell.styles.fontStyle = 'bold'
          }
        }
      })

      const detailTableRows = previewRows.map((r) => {
        if (r.isHeader) {
          return {
            rowType: 'group',
            day: '',
            startDate: '',
            startTime: '',
            endDate: '',
            endTime: '',
            hours: '',
            notes: '',
            caregiver: r.caregiver
          }
        }
        if (r.isTotal) {
          return {
            rowType: 'total',
            day: '',
            startDate: '',
            startTime: '',
            endDate: '',
            endTime: 'TOTAL',
            hours: r.hours,
            notes: '',
            caregiver: r.caregiver
          }
        }
        return {
          rowType: 'row',
          day: r.day,
          startDate: r.startDate,
          startTime: r.startTime,
          endDate: r.endDate,
          endTime: r.endTime,
          hours: r.hours,
          notes: r.notes || '',
          caregiver: r.caregiver
        }
      })

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 260) + 24,
        theme: 'grid',
        columns: [
          { header: 'Day', dataKey: 'day' },
          { header: 'Start Date', dataKey: 'startDate' },
          { header: 'Start Time', dataKey: 'startTime' },
          { header: 'End Date', dataKey: 'endDate' },
          { header: 'End Time', dataKey: 'endTime' },
          { header: 'Tot Hours', dataKey: 'hours' },
          { header: 'Notes', dataKey: 'notes' },
          { header: 'Caregiver', dataKey: 'caregiver' }
        ],
        body: detailTableRows,
        styles: { font: 'helvetica', fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.4, textColor: [10, 87, 183] },
        headStyles: { fillColor: teal, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          day: { halign: 'left' },
          startDate: { halign: 'right' },
          startTime: { halign: 'right' },
          endDate: { halign: 'right' },
          endTime: { halign: 'right' },
          hours: { halign: 'right' },
          notes: { halign: 'left', cellWidth: 60 },
          caregiver: { halign: 'left' }
        },
        didParseCell: (hook) => {
          const rowType = hook.row.raw?.rowType
          if (hook.section === 'body' && rowType === 'group') {
            hook.cell.styles.fillColor = [236, 248, 249]
            hook.cell.styles.fontStyle = 'bold'
            if (hook.column.dataKey !== 'caregiver') {
              hook.cell.text = ''
            }
          }
          if (hook.section === 'body' && rowType === 'total') {
            hook.cell.styles.fillColor = [244, 251, 252]
            hook.cell.styles.fontStyle = 'bold'
          }
        }
      })

      doc.setTextColor(10, 87, 183)
      doc.setFontSize(11)
      doc.text(`Grand Total: ${fmtMoney(summaryTotals?.bill_total || 0)}`, 420, (doc.lastAutoTable?.finalY || 700) + 26)
      doc.setTextColor(blue)
      doc.save(`invoice-${reportFilters.from_date || 'from'}-to-${reportFilters.to_date || 'to'}.pdf`)

      const createPayload = {
        client_id: selectedClient?.client_id || inferredClient?.client_id || reportFilters.client_id || null,
        from_date: reportFilters.from_date,
        from_time: reportFilters.from_time,
        to_date: reportFilters.to_date,
        to_time: reportFilters.to_time,
        notes: `Generated from report ${reportFilters.from_date} to ${reportFilters.to_date}`
      }
      if (!createPayload.client_id) {
        throw new Error('A client must be selected before saving an invoice.')
      }
      const createdInvoice = await authedFetch('/api/v1/invoices?' + new URLSearchParams(createPayload), { method: 'POST' })
      await refreshInvoices()

      setInvoiceBlueprints((prev) => ({
        ...prev,
        [createdInvoice.invoice_id]: {
          clientName,
          clientAddress,
          invoiceNumber,
          periodFrom,
          periodTo,
          invoiceDate,
          dueDate,
          summaryRows,
          summaryTotals,
          previewRows
        }
      }))
      setInvoicePreviewRows(previewRows)
      setCsvPreview(lines.join('\n'))
      setShowInvoicePreview(true)
      setStatus(`Invoice saved as #${createdInvoice.invoice_id}`)
    } catch (err) {
      setStatus(`Invoice generation failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function submitCaregiver(e) {
    e.preventDefault()
    handleSaveCaregiver()
  }

  async function handleSaveCaregiver() {
    if (!caregiverForm.name.trim()) {
      setStatus('Caregiver name is required')
      return
    }
    setLoading(true)
    setStatus('Saving caregiver...')
    try {
      if (!selectedCaregiverId) {
        const createPayload = {
          name: caregiverForm.name.trim(),
          email: caregiverForm.email.trim(),
          password: caregiverForm.password.trim(),
          phone: caregiverForm.phone.trim(),
          address: caregiverForm.address.trim(),
          active: Number(caregiverForm.active)
        }
        const created = await authedFetch('/api/v1/caregivers', {
          method: 'POST',
          body: JSON.stringify(createPayload)
        })

        const tempPassText = created.temp_password ? ` Temporary password: ${created.temp_password}` : ''
        setStatus(`Caregiver created.${tempPassText}`)
      } else {
        const updatePayload = {
          name: caregiverForm.name.trim(),
          active: Number(caregiverForm.active)
        }
        if (caregiverForm.email.trim()) updatePayload.email = caregiverForm.email.trim()
        if (caregiverForm.password.trim()) updatePayload.password = caregiverForm.password.trim()
        updatePayload.phone = caregiverForm.phone.trim()
        updatePayload.address = caregiverForm.address.trim()

        await authedFetch(`/api/v1/caregivers/${selectedCaregiverId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload)
        })
        setStatus(`Caregiver #${selectedCaregiverId} updated`)
      }

      await refreshCaregivers()
      await refreshCaregiverRates()
      resetCaregiverForm()
    } catch (err) {
      setStatus(`Caregiver save failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteCaregiver(caregiverId) {
    const ok = window.confirm(`Delete caregiver #${caregiverId}?`)
    if (!ok) return

    setLoading(true)
    setStatus(`Deleting caregiver #${caregiverId}...`)
    try {
      await authedFetch(`/api/v1/caregivers/${caregiverId}`, { method: 'DELETE' })
      await refreshCaregivers()
      await refreshCaregiverRates()
      if (selectedCaregiverId === caregiverId) resetCaregiverForm()
      setStatus(`Caregiver #${caregiverId} deleted`)
    } catch (err) {
      setStatus(`Delete failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function startEditClient(client) {
    setSelectedClientId(client.client_id)
    setClientForm({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      active: String(client.active ?? 1),
      bill_day: client.bill_day ?? '',
      bill_night: client.bill_night ?? '',
      day_window_start: client.day_window_start || '07:00',
      day_window_end: client.day_window_end || '23:00',
      invoice_cycle: client.invoice_cycle || 'WEEKLY',
      invoice_anchor_dow: String(client.invoice_anchor_dow ?? 6),
      invoice_anchor_time: client.invoice_anchor_time || '23:00',
      timezone: client.timezone || '',
      holiday_bill_multiplier: client.holiday_bill_multiplier ?? '',
      holiday_pay_multiplier: client.holiday_pay_multiplier ?? ''
    })
    loadClientSlots(client.client_id)
    setActiveTab('clients')
    setStatus(`Editing client #${client.client_id}`)
  }

  async function loadClientSlots(clientId) {
    try {
      const data = await authedFetch(`/api/v1/clients/${clientId}/shift-slots`)
      setClientShiftSlots(Array.isArray(data) ? data : [])
    } catch {
      setClientShiftSlots([])
    }
  }

  async function saveSlot(slotId) {
    if (!selectedClientId) return
    setLoading(true)
    try {
      if (slotId) {
        await authedFetch(`/api/v1/clients/${selectedClientId}/shift-slots/${slotId}`, {
          method: 'PUT',
          body: JSON.stringify(shiftSlotForm)
        })
      } else {
        await authedFetch(`/api/v1/clients/${selectedClientId}/shift-slots`, {
          method: 'POST',
          body: JSON.stringify({ ...shiftSlotForm, sort_order: clientShiftSlots.length })
        })
      }
      setShiftSlotForm({ slot_name: '', start_time: '', end_time: '', rate_type: 'DAY' })
      setEditingSlotId(null)
      await loadClientSlots(selectedClientId)
      setStatus('Shift slot saved')
    } catch (err) {
      setStatus(`Slot save failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteSlot(slotId) {
    if (!selectedClientId) return
    setLoading(true)
    try {
      await authedFetch(`/api/v1/clients/${selectedClientId}/shift-slots/${slotId}`, { method: 'DELETE' })
      await loadClientSlots(selectedClientId)
      setStatus('Shift slot deleted')
    } catch (err) {
      setStatus(`Slot delete failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function startEditSlot(slot) {
    setEditingSlotId(slot.slot_id)
    setShiftSlotForm({ slot_name: slot.slot_name, start_time: slot.start_time, end_time: slot.end_time, rate_type: slot.rate_type })
  }

  async function submitClient(e) {
    e.preventDefault()
    setLoading(true)
    setStatus(selectedClientId ? 'Updating client...' : 'Creating client...')
    try {
      if (!clientForm.name.trim()) {
        throw new Error('Client name is required')
      }

      const payload = {
        name: clientForm.name.trim(),
        active: Number(clientForm.active),
        invoice_cycle: clientForm.invoice_cycle || 'WEEKLY',
        invoice_anchor_dow: Number(clientForm.invoice_anchor_dow || 6),
        invoice_anchor_time: clientForm.invoice_anchor_time || '23:00'
      }

      if (clientForm.email.trim()) payload.email = clientForm.email.trim()
      if (clientForm.phone.trim()) payload.phone = clientForm.phone.trim()
      if (clientForm.address.trim()) payload.address = clientForm.address.trim()
      if (clientForm.timezone.trim()) payload.timezone = clientForm.timezone.trim()
      if (clientForm.bill_day !== '') payload.bill_day = Number(clientForm.bill_day)
      if (clientForm.bill_night !== '') payload.bill_night = Number(clientForm.bill_night)
      if (clientForm.day_window_start) payload.day_window_start = clientForm.day_window_start
      if (clientForm.day_window_end) payload.day_window_end = clientForm.day_window_end
      if (clientForm.holiday_bill_multiplier !== '') payload.holiday_bill_multiplier = Number(clientForm.holiday_bill_multiplier)
      if (clientForm.holiday_pay_multiplier !== '') payload.holiday_pay_multiplier = Number(clientForm.holiday_pay_multiplier)

      if (selectedClientId) {
        await authedFetch(`/api/v1/clients/${selectedClientId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        setStatus(`Client #${selectedClientId} updated`)
      } else {
        await authedFetch('/api/v1/clients', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        setStatus('Client created')
      }

      await refreshClients()
      if (canViewStaff) await refreshCaregiverRates()
      resetClientForm()
    } catch (err) {
      setStatus(`Client save failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteClient(clientId) {
    const ok = window.confirm(`Delete client #${clientId}?`)
    if (!ok) return

    setLoading(true)
    setStatus(`Deleting client #${clientId}...`)
    try {
      await authedFetch(`/api/v1/clients/${clientId}`, { method: 'DELETE' })
      await refreshClients()
      if (canViewStaff) await refreshCaregiverRates()
      if (selectedClientId === clientId) resetClientForm()
      setStatus(`Client #${clientId} deleted`)
    } catch (err) {
      setStatus(`Delete failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const sidebarNavItems = [
    { tab: 'scheduler', label: 'Scheduler', icon: '📅', show: canUseAdminOps },
    { tab: 'shifts',    label: 'Shift', icon: '🛠️', show: canUseAdminOps },
    { tab: 'create',    label: 'Create Shift', icon: '＋', show: canUseAdminOps },
    { tab: 'caregivers',    label: 'Staff',          icon: '👥', show: canViewStaff },
    { tab: 'adminProfiles', label: 'Admin Profiles', icon: '🔐', show: canManageProfiles },
    { tab: 'clients',  label: 'Clients',  icon: '🏠', show: canUseAdminOps },
    { tab: 'holidays', label: 'Holidays', icon: '🗓',  show: canUseAdminOps },
    { tab: 'reports',  label: 'Reports',  icon: '📊', show: canViewReports },
    { tab: 'invoices', label: 'Invoices', icon: '🧾', show: canUseAdminOps },
  ]

  return (
    <div className={isLoggedIn ? 'page-shell with-sidebar' : 'page-shell'}>

      {/* ---- LOGGED-OUT LOGIN PAGE ---- */}
      {!isLoggedIn && (
        <div className="login-center-wrap">
          <div className="login-center-stack">
          <header className="topbar">
            <div className="topbar-logo-wrap">
              <img src={logo} alt="Angels at Home" className="topbar-logo" />
            </div>
            <div className="topbar-copy">
              <h1>Angels at Home Operations Hub</h1>
              <p className="subtitle">Plan schedules, track shifts, and run payroll with confidence.</p>
            </div>
          </header>
          <section className="card login-card">
            <h2>Admin Login</h2>
            <form className="grid-form login-form" onSubmit={handleLogin}>
              <label>
                User
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button className="solid-btn" type="submit" disabled={loading}>
                {loading ? 'Please wait...' : 'Login'}
              </button>
            </form>
          </section>
          </div>
        </div>
      )}

      {/* ---- LOGGED-IN: SIDEBAR + MAIN ---- */}
      {isLoggedIn && (
        <>
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <img src={logo} alt="Angels at Home" />
            </div>

            <nav className="sidebar-nav">
              {sidebarNavItems.filter(n => n.show).map(n => (
                <button
                  key={n.tab}
                  type="button"
                  className={`sidebar-nav-item${activeTab === n.tab ? ' active' : ''}`}
                  onClick={() => setActiveTab(n.tab)}
                >
                  <span className="sidebar-nav-icon">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">
              <strong>{me?.name || me?.email || 'Unknown'}</strong>
              <span>{me?.role || ''}</span>
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

          {/* Main content */}
          <main className="main-content">



          {canUseAdminOps && activeTab === 'shifts' && (
            <section className="card">
              <h2>Shifts</h2>
              <div className="form-row">
                <label>
                  Status
                  <select value={shiftFilters.status} onChange={(e) => setShiftFilters({ ...shiftFilters, status: e.target.value })}>
                    <option value="">Any</option>
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="VOID">VOID</option>
                  </select>
                </label>
                <label>
                  Caregiver
                  <select value={shiftFilters.caregiver_id} onChange={(e) => setShiftFilters({ ...shiftFilters, caregiver_id: e.target.value })}>
                    <option value="">Any</option>
                    {caregivers.map((cg) => (
                      <option key={cg.caregiver_id} value={cg.caregiver_id}>{cg.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Client
                  <select value={shiftFilters.client_id} onChange={(e) => setShiftFilters({ ...shiftFilters, client_id: e.target.value })}>
                    <option value="">Any</option>
                    {clients.map((c) => (
                      <option key={c.client_id} value={c.client_id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  From Date
                  <input type="date" value={shiftFilters.from_date} onChange={(e) => setShiftFilters({ ...shiftFilters, from_date: e.target.value })} />
                </label>
                <label>
                  From Time
                  <input type="time" value={shiftFilters.from_time} onChange={(e) => setShiftFilters({ ...shiftFilters, from_time: e.target.value })} />
                </label>
                <label>
                  To Date
                  <input type="date" value={shiftFilters.to_date} onChange={(e) => setShiftFilters({ ...shiftFilters, to_date: e.target.value })} />
                </label>
                <label>
                  To Time
                  <input type="time" value={shiftFilters.to_time} onChange={(e) => setShiftFilters({ ...shiftFilters, to_time: e.target.value })} />
                </label>
              </div>
              <div className="quick-actions">
                <button className="solid-btn" type="button" onClick={loadShifts}>Refresh Shifts</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Caregiver</th>
                      <th>Client</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Pay Day</th>
                      <th>Pay Night</th>
                      <th>Pay Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.length === 0 && (
                      <tr><td colSpan="10">No shifts loaded yet.</td></tr>
                    )}
                    {shifts.map((s) => (
                      <tr key={s.shift_id}>
                        <td>{s.shift_id}</td>
                        <td>{s.status}</td>
                        <td>{caregiverLabel(s.caregiver_id)}</td>
                        <td>{clientLabel(s.client_id)}</td>
                        <td>
                          {editingShiftId === s.shift_id ? (
                            <div className="table-inputs">
                              <input
                                className="table-inline-input"
                                type="date"
                                value={editShiftDraft.start_date}
                                onChange={(e) => setEditShiftDraft({ ...editShiftDraft, start_date: e.target.value })}
                              />
                              <input
                                className="table-inline-input"
                                type="time"
                                value={editShiftDraft.start_time}
                                onChange={(e) => setEditShiftDraft({ ...editShiftDraft, start_time: e.target.value })}
                              />
                            </div>
                          ) : (
                            <>{s.start_date} {s.start_time}</>
                          )}
                        </td>
                        <td>
                          {editingShiftId === s.shift_id ? (
                            <div className="table-inputs">
                              <input
                                className="table-inline-input"
                                type="date"
                                value={editShiftDraft.end_date}
                                onChange={(e) => setEditShiftDraft({ ...editShiftDraft, end_date: e.target.value })}
                              />
                              <input
                                className="table-inline-input"
                                type="time"
                                value={editShiftDraft.end_time}
                                onChange={(e) => setEditShiftDraft({ ...editShiftDraft, end_time: e.target.value })}
                              />
                            </div>
                          ) : (
                            <>{s.end_date || '-'} {s.end_time || ''}</>
                          )}
                        </td>
                        <td>{s.pay_day ?? '-'}</td>
                        <td>{s.pay_night ?? '-'}</td>
                        <td>{s.pay_total ?? '-'}</td>
                        <td>
                          {editingShiftId === s.shift_id ? (
                            <div className="action-buttons">
                              <input
                                className="table-inline-input"
                                type="text"
                                placeholder="Notes (optional)"
                                value={editShiftDraft.notes}
                                onChange={(e) => setEditShiftDraft({ ...editShiftDraft, notes: e.target.value })}
                              />
                              <button className="ghost-btn" type="button" onClick={() => saveShiftEdits(s.shift_id)}>Save</button>
                              <button className="ghost-btn" type="button" onClick={cancelEditShift}>Cancel</button>
                            </div>
                          ) : (
                            <div className="action-buttons">
                              <button className="ghost-btn" type="button" onClick={() => startEditShift(s)}>Edit</button>
                              <button className="danger-btn" type="button" onClick={() => requestDeleteShift(s)}>Delete</button>
                              <button className="danger-btn" type="button" onClick={() => voidShift(s)} disabled={s.status === 'CLOSED' || s.status === 'VOID'}>
                                Void
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </section>
          )}

          {canUseAdminOps && activeTab === 'create' && (
            <section className="card">
              <h2>Create Closed Shift</h2>
              <form className="form-row" onSubmit={submitCreateClosedShift}>
                <label>
                  Client
                  <select value={createShift.client_id} onChange={(e) => setCreateShift({ ...createShift, client_id: e.target.value })} required>
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c.client_id} value={c.client_id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Caregiver
                  <select value={createShift.caregiver_id} onChange={(e) => setCreateShift({ ...createShift, caregiver_id: e.target.value })} required>
                    <option value="">Select caregiver</option>
                    {caregivers.map((cg) => (
                      <option key={cg.caregiver_id} value={cg.caregiver_id}>{cg.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Start Date
                  <input type="date" value={createShift.start_date} onChange={(e) => setCreateShift({ ...createShift, start_date: e.target.value })} required />
                </label>
                <label>
                  Start Time
                  <input type="time" value={createShift.start_time} onChange={(e) => setCreateShift({ ...createShift, start_time: e.target.value })} required />
                </label>
                <label>
                  End Date
                  <input type="date" value={createShift.end_date} onChange={(e) => setCreateShift({ ...createShift, end_date: e.target.value })} required />
                </label>
                <label>
                  End Time
                  <input type="time" value={createShift.end_time} onChange={(e) => setCreateShift({ ...createShift, end_time: e.target.value })} required />
                </label>
                <label className="wide-field">
                  Notes
                  <input type="text" value={createShift.notes} onChange={(e) => setCreateShift({ ...createShift, notes: e.target.value })} placeholder="Optional" />
                </label>
                <button className="solid-btn" type="submit" disabled={loading}>Create Shift</button>
              </form>
            </section>
          )}

          {canViewStaff && activeTab === 'caregivers' && (
            <section className="card">
              <h2>Caregiver Maintenance</h2>

              <h3 style={{ margin: '8px 0 8px 0' }}>Set Pay Rate by Caregiver + Client</h3>
              <form className="form-row" onSubmit={submitCaregiverRate}>
                <label>
                  Caregiver
                  <select
                    value={caregiverRateForm.caregiver_id}
                    onChange={(e) => setCaregiverRateForm({ ...caregiverRateForm, caregiver_id: e.target.value })}
                    required
                  >
                    <option value="">Select caregiver</option>
                    {caregivers.map((cg) => (
                      <option key={`rate-cg-${cg.caregiver_id}`} value={cg.caregiver_id}>{cg.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Client
                  <select
                    value={caregiverRateForm.client_id}
                    onChange={(e) => setCaregiverRateForm({ ...caregiverRateForm, client_id: e.target.value })}
                    required
                  >
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={`rate-cl-${c.client_id}`} value={c.client_id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Pay Day
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={caregiverRateForm.pay_day}
                    onChange={(e) => setCaregiverRateForm({ ...caregiverRateForm, pay_day: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Pay Night
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={caregiverRateForm.pay_night}
                    onChange={(e) => setCaregiverRateForm({ ...caregiverRateForm, pay_night: e.target.value })}
                    required
                  />
                </label>
                <div className="quick-actions">
                  <button className="solid-btn" type="submit" disabled={loading}>Save Pay Rate</button>
                  <button className="ghost-btn" type="button" onClick={resetCaregiverRateForm}>Clear</button>
                  <button className="ghost-btn" type="button" onClick={refreshCaregiverRates}>Refresh</button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Caregiver</th>
                      <th>Client</th>
                      <th>Pay Day</th>
                      <th>Pay Night</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caregiverRates.length === 0 && (
                      <tr><td colSpan="6">No caregiver pay rates found.</td></tr>
                    )}
                    {caregiverRates.map((r) => (
                      <tr key={`cg-rate-${r.rate_id}`}>
                        <td>{r.rate_id}</td>
                        <td>{r.caregiver_name}</td>
                        <td>{r.client_name}</td>
                        <td>{Number(r.pay_day || 0).toFixed(2)}</td>
                        <td>{Number(r.pay_night || 0).toFixed(2)}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="ghost-btn" type="button" onClick={() => startEditCaregiverRate(r)}>Edit</button>
                            <button className="danger-btn" type="button" onClick={() => requestDeleteCaregiverRate(r.rate_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form className="form-row" onSubmit={submitCaregiver}>
                <label>
                  Name
                  <input
                    type="text"
                    value={caregiverForm.name}
                    onChange={(e) => setCaregiverForm({ ...caregiverForm, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={caregiverForm.email}
                    onChange={(e) => setCaregiverForm({ ...caregiverForm, email: e.target.value })}
                    required={!selectedCaregiverId}
                  />
                </label>
                <label>
                  Password {selectedCaregiverId ? '(optional reset)' : '(optional)'}
                  <input
                    type="text"
                    value={caregiverForm.password}
                    onChange={(e) => setCaregiverForm({ ...caregiverForm, password: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="text"
                    value={caregiverForm.phone}
                    onChange={(e) => setCaregiverForm({ ...caregiverForm, phone: e.target.value })}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text"
                    value={caregiverForm.address}
                    onChange={(e) => setCaregiverForm({ ...caregiverForm, address: e.target.value })}
                  />
                </label>
                <label>
                  Active
                  <select value={caregiverForm.active} onChange={(e) => setCaregiverForm({ ...caregiverForm, active: e.target.value })}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <div className="quick-actions">
                  <button className="solid-btn" type="submit" disabled={loading}>
                    {selectedCaregiverId ? 'Update Caregiver' : 'Create Caregiver'}
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetCaregiverForm}>Clear</button>
                  <button className="ghost-btn" type="button" onClick={refreshCaregivers}>Refresh</button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caregivers.length === 0 && (
                      <tr><td colSpan="7">No caregivers found.</td></tr>
                    )}
                    {caregivers.map((cg) => (
                      <tr key={cg.caregiver_id}>
                        <td>{cg.caregiver_id}</td>
                        <td>{cg.name}</td>
                        <td>{cg.email || '-'}</td>
                        <td>{cg.phone || '-'}</td>
                        <td>{cg.address || '-'}</td>
                        <td>{String(cg.active) === '1' ? 'Yes' : 'No'}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="ghost-btn" type="button" onClick={() => startEditCaregiver(cg)}>Edit</button>
                            <button className="danger-btn" type="button" onClick={() => deleteCaregiver(cg.caregiver_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Caregiver Shift History ─────────────────────────────────── */}
              <h3 style={{ margin: '24px 0 8px 0' }}>Shift History by Caregiver</h3>
              {(() => {
                const days = cgProfileDays(cgProfileWeekKey)
                const weekStart = new Date(`${cgProfileWeekKey}T00:00:00`)
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
                const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`

                const fmtHours = h => {
                  if (h == null) return '—'
                  const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
                  return mm ? `${hh}h ${mm}m` : `${hh}h`
                }
                const shiftHours = s => {
                  const explicit = Number(s.total_hours ?? s.hours_total)
                  if (Number.isFinite(explicit)) return explicit
                  return (Number.isFinite(Number(s.hours_day)) ? Number(s.hours_day) : 0)
                       + (Number.isFinite(Number(s.hours_night)) ? Number(s.hours_night) : 0)
                }

                const shiftsByDay = Object.fromEntries(
                  days.map(d => [
                    d.dateStr,
                    cgProfileShifts
                      .filter(s => s.start_date === d.dateStr)
                      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                  ])
                )
                const maxRows = Math.max(0, ...days.map(d => shiftsByDay[d.dateStr]?.length || 0))
                const dayTotals = Object.fromEntries(
                  days.map(d => [d.dateStr, (shiftsByDay[d.dateStr] || []).reduce((s, sh) => s + shiftHours(sh), 0)])
                )
                const weekTotal = Object.values(dayTotals).reduce((a, b) => a + b, 0)

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Caregiver
                        <select
                          value={cgProfileId}
                          onChange={e => setCgProfileId(e.target.value)}
                          style={{ marginLeft: '6px' }}
                        >
                          <option value="">— Select —</option>
                          {caregivers.map(cg => (
                            <option key={cg.caregiver_id} value={String(cg.caregiver_id)}>{cg.name}</option>
                          ))}
                        </select>
                      </label>
                      <button className="ghost-btn" type="button" onClick={() => cgProfileNavWeek(-1)}>‹ Prev</button>
                      <button className="solid-btn" type="button" onClick={cgProfileThisWeek}>This Week</button>
                      <button className="ghost-btn" type="button" onClick={() => cgProfileNavWeek(1)}>Next ›</button>
                      <span style={{ fontSize: '0.82rem', color: '#35525b', marginLeft: '4px' }}>{weekLabel}</span>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => loadCgProfileShifts(cgProfileId, cgProfileWeekKey)}
                        disabled={cgProfileLoading}
                        style={{ marginLeft: '4px' }}
                      >↻</button>
                      {weekTotal > 0 && (
                        <span style={{ marginLeft: '8px', fontWeight: 700, fontSize: '0.82rem', color: '#0d596d' }}>
                          Week Total: {fmtHours(weekTotal)}
                        </span>
                      )}
                    </div>

                    {!cgProfileId ? (
                      <p style={{ color: '#7a9aaa', fontSize: '0.85rem' }}>Select a caregiver to view their shifts.</p>
                    ) : cgProfileLoading ? (
                      <p style={{ color: '#7a9aaa', fontSize: '0.85rem' }}>Loading…</p>
                    ) : maxRows === 0 ? (
                      <p style={{ color: '#7a9aaa', fontSize: '0.85rem' }}>No shifts logged this week.</p>
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
                            {Array.from({ length: maxRows }, (_, rowIdx) => (
                              <tr key={`cgp-row-${rowIdx}`}>
                                {days.map(d => {
                                  const s = shiftsByDay[d.dateStr]?.[rowIdx]
                                  if (!s) return <td key={d.dateStr} className={d.isToday ? 'today-day-cell' : ''}><span className="slot-empty-cell">—</span></td>
                                  const clientName = clients.find(c => c.client_id === s.client_id)?.name || `#${s.client_id}`
                                  const statusClass = s.status === 'OPEN' ? 'shift-open' : ''
                                  const timeLabel = s.start_time && s.end_time
                                    ? `${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`
                                    : s.start_time ? `${s.start_time.slice(0,5)}+` : '—'
                                  return (
                                    <td key={d.dateStr} className={d.isToday ? 'today-day-cell' : ''} style={{ verticalAlign: 'top' }}>
                                      <div className={`shift-block ${statusClass}`} title={`#${s.shift_id} • ${clientName} • ${fmtHours(shiftHours(s))}`}>
                                        <div className="shift-block-time">{timeLabel}</div>
                                        <div className="shift-block-cgname" style={{ color: '#35525b', fontSize: '0.7rem' }}>{clientName}</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#0a3d4a', marginTop: '2px' }}>{fmtHours(shiftHours(s))}</div>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                            <tr>
                              {days.map(d => {
                                const total = dayTotals[d.dateStr] || 0
                                return (
                                  <td key={`cgp-tot-${d.dateStr}`} className={d.isToday ? 'today-day-cell' : ''}
                                    style={{ textAlign: 'center', background: total > 0 ? '#e8f6f0' : '#f7fbfc', borderTop: '2px solid #c5dde3' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#35525b' }}>Total</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1a2d38' }}>{total > 0 ? fmtHours(total) : '—'}</div>
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )
              })()}
              {/* ── end Caregiver Shift History ──────────────────────────────── */}

            </section>
          )}

          {canManageProfiles && activeTab === 'adminProfiles' && (
            <section className="card">
              <h2>Admin Profiles</h2>
              <form className="form-row" onSubmit={submitAdminUser}>
                <label>
                  Name
                  <input
                    type="text"
                    value={adminUserForm.name}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, name: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={adminUserForm.email}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, email: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Password {selectedAdminUserId ? '(optional reset)' : '(required)'}
                  <input
                    type="text"
                    value={adminUserForm.password}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, password: e.target.value })}
                  />
                </label>
                <label>
                  Role
                  <select value={adminUserForm.role} onChange={(e) => setAdminUserForm({ ...adminUserForm, role: e.target.value })}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                </label>
                {adminUserForm.role === 'CUSTOMER' && (
                  <label>
                    Linked Client
                    <select value={adminUserForm.client_id} onChange={(e) => setAdminUserForm({ ...adminUserForm, client_id: e.target.value })} required>
                      <option value="">Select client</option>
                      {clients.map((c) => (
                        <option key={c.client_id} value={c.client_id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Active
                  <select value={adminUserForm.active} onChange={(e) => setAdminUserForm({ ...adminUserForm, active: e.target.value })}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <div className="quick-actions">
                  <button className="solid-btn" type="submit" disabled={loading}>
                    {selectedAdminUserId ? 'Update Profile' : 'Create Profile'}
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetAdminUserForm}>Clear</button>
                  <button className="ghost-btn" type="button" onClick={refreshAdminUsers}>Refresh</button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Linked Client</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length === 0 && (
                      <tr><td colSpan="7">No admin profiles found.</td></tr>
                    )}
                    {adminUsers.map((u) => (
                      <tr key={u.user_id}>
                        <td>{u.user_id}</td>
                        <td>{u.name || '-'}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.role === 'CUSTOMER' ? (clients.find((c) => String(c.client_id) === String(u.client_id))?.name || u.client_id || '-') : '-'}</td>
                        <td>{u.status || (String(u.active) === '1' ? 'ACTIVE' : 'INACTIVE')}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="ghost-btn" type="button" onClick={() => startEditAdminUser(u)}>Edit</button>
                            <button className="danger-btn" type="button" onClick={() => deleteAdminUser(u.user_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canUseAdminOps && activeTab === 'clients' && (
            <section className="card">
              <h2>Client Maintenance</h2>
              <form className="form-row" onSubmit={submitClient}>
                <label>
                  Name
                  <input
                    type="text"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="text"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text"
                    value={clientForm.address}
                    onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  />
                </label>
                <label>
                  Active
                  <select value={clientForm.active} onChange={(e) => setClientForm({ ...clientForm, active: e.target.value })}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <label>
                  Bill Day
                  <input
                    type="number"
                    step="0.01"
                    value={clientForm.bill_day}
                    onChange={(e) => setClientForm({ ...clientForm, bill_day: e.target.value })}
                  />
                </label>
                <label>
                  Bill Night
                  <input
                    type="number"
                    step="0.01"
                    value={clientForm.bill_night}
                    onChange={(e) => setClientForm({ ...clientForm, bill_night: e.target.value })}
                  />
                </label>
                <label>
                  Day Shift Starts (fallback)
                  <input
                    type="time"
                    value={clientForm.day_window_start}
                    onChange={(e) => setClientForm({ ...clientForm, day_window_start: e.target.value })}
                  />
                </label>
                <label>
                  Day Shift Ends (fallback)
                  <input
                    type="time"
                    value={clientForm.day_window_end}
                    onChange={(e) => setClientForm({ ...clientForm, day_window_end: e.target.value })}
                  />
                </label>
                <label>
                  Invoice Cycle
                  <select value={clientForm.invoice_cycle} onChange={(e) => setClientForm({ ...clientForm, invoice_cycle: e.target.value })}>
                    <option value="WEEKLY">WEEKLY</option>
                  </select>
                </label>
                <label>
                  Invoice Anchor DOW (0-6)
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={clientForm.invoice_anchor_dow}
                    onChange={(e) => setClientForm({ ...clientForm, invoice_anchor_dow: e.target.value })}
                  />
                </label>
                <label>
                  Invoice Anchor Time
                  <input
                    type="time"
                    value={clientForm.invoice_anchor_time}
                    onChange={(e) => setClientForm({ ...clientForm, invoice_anchor_time: e.target.value })}
                  />
                </label>
                <label>
                  Timezone
                  <input
                    type="text"
                    placeholder="America/Toronto"
                    value={clientForm.timezone}
                    onChange={(e) => setClientForm({ ...clientForm, timezone: e.target.value })}
                  />
                </label>
                <label>
                  Holiday Bill Multiplier
                  <input
                    type="number"
                    step="0.01"
                    value={clientForm.holiday_bill_multiplier}
                    onChange={(e) => setClientForm({ ...clientForm, holiday_bill_multiplier: e.target.value })}
                  />
                </label>
                <label>
                  Holiday Pay Multiplier
                  <input
                    type="number"
                    step="0.01"
                    value={clientForm.holiday_pay_multiplier}
                    onChange={(e) => setClientForm({ ...clientForm, holiday_pay_multiplier: e.target.value })}
                  />
                </label>

                <div className="quick-actions">
                  <button className="solid-btn" type="submit" disabled={loading}>
                    {selectedClientId ? 'Update Client' : 'Create Client'}
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetClientForm}>Clear</button>
                  <button className="ghost-btn" type="button" onClick={refreshClients}>Refresh</button>
                </div>
              </form>

              {/* ── Shift Slots ── */}
              {selectedClientId && (
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: '#1a2d38' }}>
                    Shift Slots for {clients.find(c => c.client_id === selectedClientId)?.name}
                  </h3>

                  {/* Slot rows */}
                  <div className="table-wrap" style={{ marginBottom: '10px' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Slot Name</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Rate Type</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientShiftSlots.length === 0 && (
                          <tr><td colSpan="5">No shift slots defined.</td></tr>
                        )}
                        {clientShiftSlots.map(sl => (
                          editingSlotId === sl.slot_id ? (
                            <tr key={sl.slot_id}>
                              <td><input type="text" value={shiftSlotForm.slot_name} onChange={e => setShiftSlotForm({...shiftSlotForm, slot_name: e.target.value})} style={{ width: '100px' }} /></td>
                              <td><input type="time" value={shiftSlotForm.start_time} onChange={e => setShiftSlotForm({...shiftSlotForm, start_time: e.target.value})} /></td>
                              <td><input type="time" value={shiftSlotForm.end_time} onChange={e => setShiftSlotForm({...shiftSlotForm, end_time: e.target.value})} /></td>
                              <td>
                                <select value={shiftSlotForm.rate_type} onChange={e => setShiftSlotForm({...shiftSlotForm, rate_type: e.target.value})}>
                                  <option value="DAY">DAY</option>
                                  <option value="NIGHT">NIGHT</option>
                                </select>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button className="solid-btn" type="button" onClick={() => saveSlot(sl.slot_id)} disabled={loading}>Save</button>
                                  <button className="ghost-btn" type="button" onClick={() => { setEditingSlotId(null); setShiftSlotForm({ slot_name: '', start_time: '', end_time: '', rate_type: 'DAY' }) }}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={sl.slot_id}>
                              <td>{sl.slot_name}</td>
                              <td>{sl.start_time}</td>
                              <td>{sl.end_time}</td>
                              <td><span className={`rate-badge rate-${sl.rate_type.toLowerCase()}`}>{sl.rate_type}</span></td>
                              <td>
                                <div className="action-buttons">
                                  <button className="ghost-btn" type="button" onClick={() => startEditSlot(sl)}>Edit</button>
                                  <button className="danger-btn" type="button" onClick={() => deleteSlot(sl.slot_id)} disabled={loading}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add new slot row */}
                  {editingSlotId === null && (
                    <div className="form-row" style={{ alignItems: 'flex-end', gap: '8px' }}>
                      <label style={{ flex: '1', minWidth: '120px' }}>
                        Slot Name
                        <input type="text" placeholder="e.g. Morning" value={shiftSlotForm.slot_name}
                          onChange={e => setShiftSlotForm({...shiftSlotForm, slot_name: e.target.value})} />
                      </label>
                      <label>
                        Start
                        <input type="time" value={shiftSlotForm.start_time}
                          onChange={e => setShiftSlotForm({...shiftSlotForm, start_time: e.target.value})} />
                      </label>
                      <label>
                        End
                        <input type="time" value={shiftSlotForm.end_time}
                          onChange={e => setShiftSlotForm({...shiftSlotForm, end_time: e.target.value})} />
                      </label>
                      <label>
                        Rate Type
                        <select value={shiftSlotForm.rate_type} onChange={e => setShiftSlotForm({...shiftSlotForm, rate_type: e.target.value})}>
                          <option value="DAY">DAY</option>
                          <option value="NIGHT">NIGHT</option>
                        </select>
                      </label>
                      <button className="solid-btn" type="button" onClick={() => saveSlot(null)}
                        disabled={loading || !shiftSlotForm.slot_name || !shiftSlotForm.start_time || !shiftSlotForm.end_time}>
                        + Add Slot
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Active</th>
                      <th>Bill Day</th>
                      <th>Bill Night</th>
                      <th>Shift Slots</th>
                      <th>Timezone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 && (
                      <tr><td colSpan="10">No clients found.</td></tr>
                    )}
                    {clients.map((c) => (
                      <tr key={c.client_id}>
                        <td>{c.client_id}</td>
                        <td>{c.name}</td>
                        <td>{c.email || '-'}</td>
                        <td>{c.phone || '-'}</td>
                        <td>{String(c.active) === '1' ? 'Yes' : 'No'}</td>
                        <td>{c.bill_day ?? '-'}</td>
                        <td>{c.bill_night ?? '-'}</td>
                        <td>
                          <button className="ghost-btn" type="button" style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                            onClick={() => { startEditClient(c) }}>
                            View / Edit Slots
                          </button>
                        </td>
                        <td>{c.timezone || '-'}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="ghost-btn" type="button" onClick={() => startEditClient(c)}>Edit</button>
                            <button className="danger-btn" type="button" onClick={() => deleteClient(c.client_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canUseAdminOps && activeTab === 'holidays' && (
            <section className="card">
              <h2>Holiday Rates</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.9rem' }}>
                Define dates considered holidays and the billing / pay multipliers applied when a caregiver works those days.
                Leave <strong>Client</strong> blank to apply globally to all clients.
              </p>

              {/* Form */}
              <form onSubmit={submitHoliday}>
                <div className="form-row">
                  <label>
                    Date *
                    <input
                      type="date"
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Holiday Name *
                    <input
                      type="text"
                      placeholder="e.g. Christmas Day"
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Client (optional)
                    <select
                      value={holidayForm.client_id}
                      onChange={(e) => setHolidayForm({ ...holidayForm, client_id: e.target.value })}
                    >
                      <option value="">Global (all clients)</option>
                      {clients.map((c) => (
                        <option key={c.client_id} value={c.client_id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Bill % *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1.5 = 150%"
                      value={holidayForm.multiplier_bill}
                      onChange={(e) => setHolidayForm({ ...holidayForm, multiplier_bill: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Pay % *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1.5 = 150%"
                      value={holidayForm.multiplier_pay}
                      onChange={(e) => setHolidayForm({ ...holidayForm, multiplier_pay: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="solid-btn" type="submit" disabled={loading}>
                    {holidayForm.holiday_id ? 'Update Holiday' : 'Add Holiday'}
                  </button>
                  {holidayForm.holiday_id && (
                    <button className="ghost-btn" type="button" onClick={resetHolidayForm}>Cancel</button>
                  )}
                  <button className="ghost-btn" type="button" onClick={refreshHolidays} disabled={loading}>Refresh</button>
                </div>
              </form>

              {/* Table */}
              <div className="table-wrapper" style={{ marginTop: '16px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Bill Multiplier</th>
                      <th>Pay Multiplier</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No holidays defined</td></tr>
                    ) : holidays.map((h) => (
                      <tr key={`holiday-${h.holiday_id}`}>
                        <td>{h.holiday_id}</td>
                        <td>{h.date}</td>
                        <td>{h.name}</td>
                        <td>{h.client_id != null ? (clients.find((c) => c.client_id === h.client_id)?.name || `#${h.client_id}`) : <em>Global</em>}</td>
                        <td>{h.multiplier_bill != null ? `×${h.multiplier_bill}` : '-'}</td>
                        <td>{h.multiplier_pay != null ? `×${h.multiplier_pay}` : '-'}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="ghost-btn" type="button" onClick={() => startEditHoliday(h)}>Edit</button>
                            <button className="danger-btn" type="button" onClick={() => requestDeleteHoliday(h.holiday_id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canUseAdminOps && activeTab === 'invoices' && (
            <section className="card">
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <h2>Invoices</h2>
                <button className="solid-btn" type="button" onClick={refreshInvoices}>Refresh</button>
              </div>
              {invoiceDetail && (
                <div className="card" style={{ marginTop: '16px' }}>
                  <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Invoice #{invoiceDetail.invoice_id}</h3>
                    <button className="ghost-btn" type="button" onClick={() => setInvoiceDetail(null)}>Close</button>
                  </div>
                  <p><strong>Client:</strong> {clients.find((c) => String(c.client_id) === String(invoiceDetail.client_id))?.name || `Client #${invoiceDetail.client_id}`}</p>
                  <p><strong>Invoice #:</strong> {invoiceDetail.invoice_number ?? invoiceDetail.invoice_id}</p>
                  <p><strong>Period:</strong> {invoiceDetail.from_date || invoiceDetail.from_utc ? `${(invoiceDetail.from_date || invoiceDetail.from_utc || '').slice(0, 10)} → ${(invoiceDetail.to_date || invoiceDetail.to_utc || '').slice(0, 10)}` : '—'}</p>
                  <p><strong>Total:</strong> ${Number(invoiceDetail.total_amount || 0).toFixed(2)}</p>
                  {(invoiceDetail.items || []).length === 0 ? (
                    <p>No line items recorded.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Hours Day</th>
                            <th>Hours Night</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetail.items.map((item) => (
                            <tr key={item.item_id}>
                              <td>{item.desc}</td>
                              <td>{Number(item.hours_day || 0).toFixed(2)}</td>
                              <td>{Number(item.hours_night || 0).toFixed(2)}</td>
                              <td>${Number(item.amount || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              <div className="form-row" style={{ marginBottom: '12px' }}>
                <label>
                  Client
                  <select value={invoiceFilters.client_id} onChange={(e) => setInvoiceFilters({ ...invoiceFilters, client_id: e.target.value })}>
                    <option value="">All clients</option>
                    {clients.map((c) => (
                      <option key={c.client_id} value={c.client_id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  From Date
                  <input type="date" value={invoiceFilters.from_date} onChange={(e) => setInvoiceFilters({ ...invoiceFilters, from_date: e.target.value })} />
                </label>
                <label>
                  To Date
                  <input type="date" value={invoiceFilters.to_date} onChange={(e) => setInvoiceFilters({ ...invoiceFilters, to_date: e.target.value })} />
                </label>
                <button className="ghost-btn" type="button" onClick={() => void refreshInvoices()}>Apply</button>
                <button className="ghost-btn" type="button" onClick={clearInvoiceFilters}>Clear</button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Client</th>
                      <th>Period</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr><td colSpan="4">No invoices saved yet.</td></tr>
                    ) : invoices.map((inv) => {
                      const clientName = clients.find((c) => String(c.client_id) === String(inv.client_id))?.name || `Client #${inv.client_id}`
                      return (
                        <tr key={inv.invoice_id}>
                          <td>{inv.invoice_number ?? inv.invoice_id}</td>
                          <td>{clientName}</td>
                          <td>{inv.from_date || inv.from_utc ? `${(inv.from_date || inv.from_utc || '').slice(0, 10)} → ${(inv.to_date || inv.to_utc || '').slice(0, 10)}` : '—'}</td>
                          <td>${Number(inv.total_amount || 0).toFixed(2)}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="ghost-btn" type="button" onClick={() => openInvoiceDetail(inv.invoice_id)}>View</button>
                              <button className="ghost-btn" type="button" onClick={() => viewInvoicePdf(inv.invoice_id)}>PDF</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canUseAdminOps && activeTab === 'scheduler' && (() => {
            const days = schedulerDays(schedulerWeekKey)
            const weekStart = new Date(`${schedulerWeekKey}T00:00:00`)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            const monthAnchor = new Date(`${schedulerMonthKey}T00:00:00`)
            const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1)
            const monthTitle = monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
            const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`

            const calendarStart = new Date(monthStart)
            calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay())
            const monthLastDay = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0)
            const calendarEnd = new Date(monthLastDay)
            calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()))
            const totalDays = Math.floor((calendarEnd - calendarStart) / 86400000) + 1
            const calendarRowCount = Math.ceil(totalDays / 7)
            const calendarCells = Array.from({ length: totalDays }, (_, i) => {
              const d = new Date(calendarStart)
              d.setDate(d.getDate() + i)
              return {
                date: d,
                dateStr: _toDateStr(d),
                day: d.getDate(),
                inMonth: d.getMonth() === monthAnchor.getMonth(),
                isToday: _toDateStr(d) === _toDateStr(new Date()),
              }
            })

            const activeSlots = schedulerSlots.filter(s => typeof s.slot_id === 'number')
            const slotOrder = Object.fromEntries(activeSlots.map((s, i) => [s.slot_id, i]))
            const slotToneClass = (slotName = '') => {
              const n = String(slotName).toLowerCase()
              if (n.includes('morning') || n.includes('day')) return 'cg-tone-green'
              if (n.includes('afternoon') || n.includes('pm')) return 'cg-tone-blue'
              if (n.includes('night') || n.includes('overnight')) return 'cg-tone-orange'
              return 'cg-tone-cyan'
            }

            const fmtHours = (h) => {
              if (h == null) return '—'
              const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
              return mm ? `${hh}h ${mm}m` : `${hh}h`
            }

            const shiftHours = (s) => {
              const explicit = Number(s.total_hours ?? s.hours_total)
              if (Number.isFinite(explicit)) return explicit
              const day = Number(s.hours_day ?? 0)
              const night = Number(s.hours_night ?? 0)
              return (Number.isFinite(day) ? day : 0) + (Number.isFinite(night) ? night : 0)
            }

            const activeCaregivers = caregivers
              .filter(cg =>
                cg.active !== 0 &&
                schedulerShifts.some(s =>
                  s.caregiver_id === cg.caregiver_id &&
                  s.status !== 'VOID' &&
                  shiftHours(s) > 0
                )
              )
              .sort((a, b) => {
                const firstA = schedulerShifts
                  .filter(s => s.caregiver_id === a.caregiver_id && s.status !== 'VOID' && shiftHours(s) > 0)
                  .map(s => `${s.start_date || ''}T${s.start_time || '00:00'}`)
                  .sort()[0] || ''
                const firstB = schedulerShifts
                  .filter(s => s.caregiver_id === b.caregiver_id && s.status !== 'VOID' && shiftHours(s) > 0)
                  .map(s => `${s.start_date || ''}T${s.start_time || '00:00'}`)
                  .sort()[0] || ''
                return firstA.localeCompare(firstB)
              })

            const monthRange = schedulerMonthRange(schedulerMonthKey)
            const loggedShiftsByDay = Object.fromEntries(
              days.map(d => {
                const items = schedulerShifts
                  .filter(s => s.status !== 'VOID' && shiftHours(s) > 0 && s.start_date === d.dateStr)
                  .sort((a, b) => {
                    const t = (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
                    if (t !== 0) return t
                    return (a.caregiver_id || 0) - (b.caregiver_id || 0)
                  })
                return [d.dateStr, items]
              })
            )
            const loggedCount = days.reduce((sum, d) => sum + (loggedShiftsByDay[d.dateStr]?.length || 0), 0)
            const maxLoggedRows = Math.max(0, ...days.map(d => loggedShiftsByDay[d.dateStr]?.length || 0))
            const dayHoursTotals = Object.fromEntries(
              days.map(d => [
                d.dateStr,
                (loggedShiftsByDay[d.dateStr] || []).reduce((sum, s) => sum + shiftHours(s), 0)
              ])
            )

            return (
              <section ref={schedulerPrintRef} className="card" style={{ padding: '16px' }}>
                <div className="scheduler-header">
                  <div>
                    <div className="scheduler-title">Scheduler</div>
                    <div className="scheduler-week-label">{schedulerView === 'schedule' ? 'Monthly Schedule' : weekLabel}</div>
                  </div>
                  <div className="scheduler-week-nav">
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => schedulerView === 'schedule' ? schedulerNavMonth(-1) : schedulerNavWeek(-1)}
                    >
                      ‹ Prev
                    </button>
                    <button
                      className="solid-btn"
                      type="button"
                      onClick={schedulerView === 'schedule' ? schedulerThisMonth : schedulerThisWeek}
                    >
                      {schedulerView === 'schedule' ? 'This Month' : 'This Week'}
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => schedulerView === 'schedule' ? schedulerNavMonth(1) : schedulerNavWeek(1)}
                    >
                      Next ›
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={printScheduler}
                    >
                      Print
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        if (schedulerView === 'schedule') {
                          if (schedulerClientId) loadSchedulerAssignments(schedulerClientId, schedulerMonthKey, monthRange)
                        } else {
                          loadSchedulerShifts(schedulerWeekKey)
                        }
                      }}
                      disabled={loading}
                      style={{ marginLeft: '6px' }}
                    >
                      ↻ Refresh
                    </button>
                    {schedulerView === 'schedule' && schedulerClientId && (
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => setCopyPrevMonthConfirm(true)}
                        disabled={loading}
                        style={{ marginLeft: '6px', borderColor: '#c0892a', color: '#7a5010' }}
                        title="Copy all assignments from the previous month into the current month"
                      >
                        ⎘ Copy from Previous Month
                      </button>
                    )}
                  </div>
                </div>

                <div className="scheduler-view-tabs">
                  <button
                    type="button"
                    className={`scheduler-view-tab${schedulerView === 'schedule' ? ' active' : ''}`}
                    onClick={() => setSchedulerView('schedule')}
                  >
                    📅 Schedule
                  </button>
                  <button
                    type="button"
                    className={`scheduler-view-tab${schedulerView === 'hours' ? ' active' : ''}`}
                    onClick={() => setSchedulerView('hours')}
                  >
                    ⏱ Logged Hours
                  </button>
                </div>

                {schedulerView === 'schedule' && (
                  <>
                    <div className="scheduler-client-bar">
                      <span className="scheduler-client-label">Client</span>
                      <select
                        className="scheduler-client-select"
                        value={schedulerClientId}
                        onChange={e => {
                          setSchedulerClientId(e.target.value)
                          loadSchedulerSlots(e.target.value)
                          loadSchedulerAssignments(e.target.value, schedulerMonthKey, monthRange)
                        }}
                      >
                        <option value="">— Select a client —</option>
                        {clients.filter(c => c.active !== 0).map(c => (
                          <option key={c.client_id} value={String(c.client_id)}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {!schedulerClientId ? (
                      <div className="scheduler-empty">Select a client above to view the monthly schedule.</div>
                    ) : (
                      <div className="month-board-wrap">
                        <div className="month-board-title">{monthTitle}</div>
                        <table className="month-board">
                          <thead>
                            <tr>
                              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                <th key={d}>{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: calendarRowCount }, (_, row) => (
                              <tr key={`month-row-${row}`}>
                                {calendarCells.slice(row * 7, row * 7 + 7).map(cell => {
                                  const dayAssignments = schedulerAssignments
                                    .filter(a => a.assign_date === cell.dateStr)
                                    .sort((a, b) => (slotOrder[a.slot_id] ?? 999) - (slotOrder[b.slot_id] ?? 999))

                                  const pickedSlot = assignPickerMap[`${cell.dateStr}:slot`] || (activeSlots[0]?.slot_id ? String(activeSlots[0].slot_id) : '')
                                  const pickedCaregiver = assignPickerMap[`${cell.dateStr}:cg`] || ''

                                  return (
                                    <td key={cell.dateStr} className={`month-cell${cell.inMonth ? '' : ' month-cell-out'}${cell.isToday ? ' month-cell-today' : ''}`}>
                                      <div className="month-cell-date">{cell.day}</div>
                                      <div className="month-cell-list">
                                        {dayAssignments.map(a => {
                                          const slotName = activeSlots.find(s => s.slot_id === a.slot_id)?.slot_name || 'Slot'
                                          const toneClass = slotToneClass(slotName)
                                          const caregiverLabel =
                                            a.caregiver_name ||
                                            caregivers.find(c => c.caregiver_id === a.caregiver_id)?.name ||
                                            `#${a.caregiver_id}`
                                          return (
                                            <div key={`asg-${a.assignment_id}`} className={`month-cg-line ${toneClass}`} title={`${slotName}: ${caregiverLabel}`}>
                                              <span className="month-cg-name">{slotName}: {caregiverLabel}</span>
                                              <button
                                                type="button"
                                                className="month-cg-remove"
                                                onClick={async () => {
                                                  try {
                                                    await authedFetch(`/api/v1/scheduler/assignments/${a.assignment_id}`, { method: 'DELETE' })
                                                    await loadSchedulerAssignments(schedulerClientId, schedulerMonthKey, monthRange)
                                                  } catch (err) {
                                                    setStatus(`Failed to remove assignment: ${err.message}`)
                                                  }
                                                }}
                                                title="Remove"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          )
                                        })}
                                      </div>

                                      <div className="month-add-row">
                                        <select
                                          className="month-slot-select"
                                          value={pickedSlot}
                                          onChange={e => setAssignPickerMap(prev => ({ ...prev, [`${cell.dateStr}:slot`]: e.target.value }))}
                                          disabled={activeSlots.length === 0}
                                        >
                                          {activeSlots.length === 0 ? (
                                            <option value="">No slots</option>
                                          ) : activeSlots.map(s => (
                                            <option key={`pick-slot-${cell.dateStr}-${s.slot_id}`} value={String(s.slot_id)}>{s.slot_name}</option>
                                          ))}
                                        </select>
                                        <select
                                          className="month-cg-select"
                                          value={pickedCaregiver}
                                          onChange={e => setAssignPickerMap(prev => ({ ...prev, [`${cell.dateStr}:cg`]: e.target.value }))}
                                        >
                                          <option value="">Caregiver</option>
                                          {caregivers.filter(cg => cg.active !== 0).map(cg => (
                                            <option key={`pick-cg-${cell.dateStr}-${cg.caregiver_id}`} value={String(cg.caregiver_id)}>{cg.name}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          className="month-add-btn"
                                          disabled={!pickedSlot || !pickedCaregiver}
                                          onClick={async () => {
                                            try {
                                              await authedFetch('/api/v1/scheduler/assignments', {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                  client_id: Number(schedulerClientId),
                                                  slot_id: Number(pickedSlot),
                                                  caregiver_id: Number(pickedCaregiver),
                                                  assign_date: cell.dateStr,
                                                }),
                                              })
                                              setAssignPickerMap(prev => ({ ...prev, [`${cell.dateStr}:cg`]: '' }))
                                              await loadSchedulerAssignments(schedulerClientId, schedulerMonthKey, monthRange)
                                              setStatus('Assignment saved')
                                            } catch (err) {
                                              setStatus(`Failed to save assignment: ${err.message}`)
                                            }
                                          }}
                                        >
                                          Add
                                        </button>
                                      </div>
                                      <div className="month-selection-preview">
                                        {activeSlots.find(s => String(s.slot_id) === pickedSlot)?.slot_name || 'Slot'}
                                        {' • '}
                                        {caregivers.find(cg => String(cg.caregiver_id) === pickedCaregiver)?.name || 'Caregiver'}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {schedulerView === 'hours' && (
                  <>
                    {loggedCount === 0 ? (
                      <div className="scheduler-empty">No logged hours for this week.</div>
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
                            {Array.from({ length: maxLoggedRows }, (_, rowIdx) => {
                              return (
                                <tr key={`hrs-row-${rowIdx}`}>
                                  {days.map(d => {
                                    const s = loggedShiftsByDay[d.dateStr]?.[rowIdx]
                                    if (!s) {
                                      return <td key={d.dateStr} className={d.isToday ? 'today-day-cell' : ''}><span className="slot-empty-cell">—</span></td>
                                    }
                                    const caregiverName = caregivers.find(c => c.caregiver_id === s.caregiver_id)?.name || `#${s.caregiver_id}`
                                    const clientName = clients.find(c => c.client_id === s.client_id)?.name || `#${s.client_id}`
                                    const statusClass = s.status === 'OPEN' ? 'shift-open' : ''
                                    const timeLabel = s.start_time && s.end_time
                                      ? `${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`
                                      : s.start_time ? `${s.start_time.slice(0,5)}+` : '—'
                                    return (
                                      <td key={d.dateStr} className={d.isToday ? 'today-day-cell' : ''} style={{ verticalAlign: 'top' }}>
                                        <div className={`shift-block ${statusClass}`}
                                          title={`#${s.shift_id} • ${clientName} • ${fmtHours(shiftHours(s))}`}>
                                          <div className="shift-block-time">{timeLabel}</div>
                                          <div className="shift-block-cgname" style={{ color: '#1a5e6a', fontSize: '0.7rem' }}>{caregiverName}</div>
                                          <div className="shift-block-cgname" style={{ color: '#35525b', fontSize: '0.7rem' }}>{clientName}</div>
                                          <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#0a3d4a', marginTop: '2px' }}>
                                            {fmtHours(shiftHours(s))}
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                            <tr>
                              {days.map(d => {
                                const total = dayHoursTotals[d.dateStr] || 0
                                const ok24 = Math.abs(total - 24) < 0.01
                                return (
                                  <td
                                    key={`tot-${d.dateStr}`}
                                    className={d.isToday ? 'today-day-cell' : ''}
                                    style={{
                                      textAlign: 'center',
                                      background: ok24 ? '#e8f6f0' : '#fff5e8',
                                      borderTop: '2px solid #c5dde3'
                                    }}
                                  >
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#35525b' }}>Daily Total</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1a2d38' }}>{fmtHours(total)}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: ok24 ? '#0a7a4d' : '#9b5f00' }}>
                                      {ok24 ? 'OK 24h' : 'Target 24h'}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

              </section>
            )
          })()}

          {canViewReports && activeTab === 'reports' && (
            <section className="card">
              <h2>Payroll Reports</h2>
              <div className="form-row">
                <label>
                  From Date
                  <input type="date" value={reportFilters.from_date} onChange={(e) => setReportFilters({ ...reportFilters, from_date: e.target.value })} />
                </label>
                <label>
                  From Time
                  <input type="time" value={reportFilters.from_time} onChange={(e) => setReportFilters({ ...reportFilters, from_time: e.target.value })} />
                </label>
                <label>
                  To Date
                  <input type="date" value={reportFilters.to_date} onChange={(e) => setReportFilters({ ...reportFilters, to_date: e.target.value })} />
                </label>
                <label>
                  To Time
                  <input type="time" value={reportFilters.to_time} onChange={(e) => setReportFilters({ ...reportFilters, to_time: e.target.value })} />
                </label>
                <label>
                  Caregiver
                  <select value={reportFilters.caregiver_id} onChange={(e) => setReportFilters({ ...reportFilters, caregiver_id: e.target.value })}>
                    <option value="">All</option>
                    {caregivers.map((cg) => (
                      <option key={cg.caregiver_id} value={cg.caregiver_id}>{cg.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Client
                  {isCustomer ? (
                    <input type="text" value={linkedClientName || linkedClientId || 'Linked client required'} readOnly />
                  ) : (
                    <select value={reportFilters.client_id} onChange={(e) => setReportFilters({ ...reportFilters, client_id: e.target.value })}>
                      <option value="">All</option>
                      {clients.map((c) => (
                        <option key={c.client_id} value={c.client_id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
              <div className="quick-actions">
                <button className="solid-btn" type="button" onClick={() => loadReport('summary')}>Load Summary</button>
                <button className="solid-btn" type="button" onClick={() => loadReport('detail')}>Load Detail</button>

                {canUseAdminOps && <button className="ghost-btn" type="button" onClick={generateInvoicePreview}>Generate Invoice</button>}
                {reportKind === 'detail' && reportRows.length > 0 && <button className="ghost-btn" type="button" onClick={printDetailReport}>Print Report</button>}
                {drilledDownCaregiver && <button className="ghost-btn" type="button" onClick={backToSummary}>← Back to Summary</button>}
              </div>

              {reportKind === 'summary' ? (
                <>
                  <h3 style={{ margin: '18px 0 8px 0' }}>Summary to Bill</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Caregiver</th>
                          <th>Hours Day</th>
                          <th>Hours Night</th>
                          <th>Total Hours</th>
                          <th>Bill Day</th>
                          <th>Bill Night</th>
                          <th>Bill Total</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.length === 0 && (
                          <tr><td colSpan="8">No report rows loaded yet.</td></tr>
                        )}
                        {reportRows.map((row, idx) => (
                          <tr key={`${row.caregiver_id || idx}-sum-bill`}>
                            <td>{row.caregiver_name}</td>
                            <td>{row.hours_day}</td>
                            <td>{row.hours_night}</td>
                            <td>{row.hours_total}</td>
                            <td>${Number(row.bill_day || 0).toFixed(2)}</td>
                            <td>${Number(row.bill_night || 0).toFixed(2)}</td>
                            <td>${Number(row.bill_total || 0).toFixed(2)}</td>
                            <td><button className="ghost-btn" type="button" onClick={() => loadReport('detail', row.caregiver_id)}>Detail →</button></td>
                          </tr>
                        ))}
                        {reportRows.length > 0 && (() => {
                          const totals = calculateSummaryTotals()
                          return (
                            <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                              <td>TOTAL</td>
                              <td>{totals.hours_day.toFixed(2)}</td>
                              <td>{totals.hours_night.toFixed(2)}</td>
                              <td>{totals.hours_total.toFixed(2)}</td>
                              <td>${totals.bill_day.toFixed(2)}</td>
                              <td>${totals.bill_night.toFixed(2)}</td>
                              <td>${totals.bill_total.toFixed(2)}</td>
                              <td></td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {!isCustomer && (
                    <>
                      <h3 style={{ margin: '18px 0 8px 0' }}>Summary to Pay Caregivers</h3>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Caregiver</th>
                              <th>Hours Day</th>
                              <th>Hours Night</th>
                              <th>Total Hours</th>
                              <th>Pay Day</th>
                              <th>Pay Night</th>
                              <th>Pay Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportRows.length === 0 && (
                              <tr><td colSpan="7">No report rows loaded yet.</td></tr>
                            )}
                            {reportRows.map((row, idx) => (
                              <tr key={`${row.caregiver_id || idx}-sum-pay`}>
                                <td>{row.caregiver_name}</td>
                                <td>{row.hours_day}</td>
                                <td>{row.hours_night}</td>
                                <td>{row.hours_total}</td>
                                <td>${Number(row.pay_day || 0).toFixed(2)}</td>
                                <td>${Number(row.pay_night || 0).toFixed(2)}</td>
                                <td>${Number(row.pay_total || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                            {reportRows.length > 0 && (() => {
                              const totals = calculateSummaryTotals()
                              return (
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                                  <td>TOTAL</td>
                                  <td>{totals.hours_day.toFixed(2)}</td>
                                  <td>{totals.hours_night.toFixed(2)}</td>
                                  <td>{totals.hours_total.toFixed(2)}</td>
                                  <td>${totals.pay_day.toFixed(2)}</td>
                                  <td>${totals.pay_night.toFixed(2)}</td>
                                  <td>${totals.pay_total.toFixed(2)}</td>
                                </tr>
                              )
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Shift ID</th>
                          <th>Caregiver</th>
                          <th>Client</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Total Hours</th>
                          {!isCustomer && <th>Pay Total</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.length === 0 && (
                          <tr><td colSpan={isCustomer ? 6 : 7}>No report rows loaded yet.</td></tr>
                        )}
                        {reportRows.map((row, idx) => (
                          <tr key={`${row.shift_id || idx}-det`}>
                            <td>{row.shift_id}</td>
                            <td>{row.caregiver_name}</td>
                            <td>{row.client_name}</td>
                            <td>{row.start_date} {row.start_time}</td>
                            <td>{row.end_date} {row.end_time}</td>
                            <td>{row.hours_total}</td>
                            {!isCustomer && <td>{row.pay_total}</td>}
                          </tr>
                        ))}
                        {reportRows.length > 0 && !isCustomer && (() => {
                          const totals = reportRows.reduce(
                            (acc, row) => ({
                              hours_total: acc.hours_total + Number(row.hours_total || 0),
                              pay_total: acc.pay_total + Number(row.pay_total || 0)
                            }),
                            { hours_total: 0, pay_total: 0 }
                          )
                          return (
                            <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                              <td colSpan={5}>TOTAL</td>
                              <td>{totals.hours_total.toFixed(2)}</td>
                              <td>${totals.pay_total.toFixed(2)}</td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {!isCustomer && reportRows.length > 0 && (
                    <>
                      <h3 style={{ margin: '18px 0 8px 0' }}>Amount to Pay per Caregiver</h3>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Caregiver</th>
                              <th>Pay Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(
                              reportRows.reduce((acc, row) => {
                                const name = row.caregiver_name || 'Unknown'
                                acc[name] = (acc[name] || 0) + Number(row.pay_total || 0)
                                return acc
                              }, {})
                            )
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([name, total]) => (
                                <tr key={`det-pay-${name}`}>
                                  <td>{name}</td>
                                  <td>${Number(total).toFixed(2)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

      {csvPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{showInvoicePreview ? 'Invoice Preview' : 'CSV Data (Copy to clipboard)'}</h3>
              <button type="button" onClick={() => { setCsvPreview(''); setShowInvoicePreview(false); setInvoicePreviewRows([]); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            {showInvoicePreview ? (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', textAlign: 'center', color: '#0a7a85', fontWeight: 700, letterSpacing: '1px', fontSize: '15px', textTransform: 'uppercase' }}>Hours Per Caregiver</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: '820px', width: '100%', fontSize: '13px', fontFamily: 'Arial, sans-serif' }}>
                    <thead>
                      <tr style={{ background: '#0a9baa' }}>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Day</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Start Date</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Start Time</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>End Date</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>End Time</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Tot Hours</th>
                        <th style={{ border: '1px solid #087a85', padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Caregiver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePreviewRows.map((r, idx) => {
                        if (r.isHeader) {
                          return (
                            <tr key={`header-${r.caregiver}-${idx}`} style={{ background: '#d6f4f6' }}>
                              <td colSpan={7} style={{ border: '1px solid #087a85', padding: '5px 10px', fontWeight: 700, color: '#0a7a85', fontSize: '13px' }}>{r.caregiver}</td>
                            </tr>
                          )
                        }
                        if (r.isTotal) {
                          return (
                            <tr key={`total-${r.caregiver}-${idx}`} style={{ background: '#e8f8f9' }}>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px' }}></td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px' }}></td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px' }}></td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px' }}></td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px', fontWeight: 700, color: '#0a7a85', textAlign: 'right' }}>TOTAL</td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px', fontWeight: 700, color: '#0a7a85', textAlign: 'right' }}>{r.hours}</td>
                              <td style={{ border: '1px solid #b0dde2', padding: '5px 10px', fontWeight: 700, color: '#0a7a85' }}>{r.caregiver}</td>
                            </tr>
                          )
                        }
                        return (
                          <tr key={`row-${r.caregiver}-${idx}`} style={{ background: '#fff' }}>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333' }}>{r.day}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333', textAlign: 'right' }}>{r.startDate}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333', textAlign: 'right' }}>{r.startTime}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333', textAlign: 'right' }}>{r.endDate}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333', textAlign: 'right' }}>{r.endTime}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333', textAlign: 'right' }}>{r.hours}</td>
                            <td style={{ border: '1px solid #cde8eb', padding: '4px 10px', color: '#333' }}>{r.caregiver}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <textarea
                value={csvPreview}
                readOnly
                style={{
                  width: '100%',
                  height: '400px',
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}
              />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="solid-btn" type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(csvPreview)
                  setStatus('Copied to clipboard!')
                } catch (e) {
                  setStatus('Failed to copy: ' + e.message)
                }
              }}>Copy to Clipboard</button>
              <button className="ghost-btn" type="button" onClick={() => { setCsvPreview(''); setShowInvoicePreview(false); setInvoicePreviewRows([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {messageDialog.visible && (
        <div className="msg-modal-overlay" role="dialog" aria-modal="true" aria-live="polite">
          <div className={`msg-modal msg-modal-${messageDialog.tone}`}>
            <h3 className="msg-modal-title">
              {messageDialog.tone === 'error' ? 'Action Required' : 'Message'}
            </h3>
            <p className="msg-modal-text">{messageDialog.message}</p>
            <div className="msg-modal-actions">
              <button
                className="solid-btn"
                type="button"
                onClick={() => setMessageDialog((prev) => ({ ...prev, visible: false }))}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {copyPrevMonthConfirm && (() => {
        const anchor = new Date(`${schedulerMonthKey}T00:00:00`)
        const monthLabel = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const prevAnchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)
        const prevLabel = prevAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        return (
          <div className="msg-modal-overlay" role="dialog" aria-modal="true">
            <div className="msg-modal msg-modal-error">
              <h3 className="msg-modal-title">⚠ Copy from Previous Month</h3>
              <p className="msg-modal-text">
                This will <strong>permanently overwrite</strong> all current assignments for{' '}
                <strong>{monthLabel}</strong> with the assignments from{' '}
                <strong>{prevLabel}</strong>. This action cannot be undone.
              </p>
              <p className="msg-modal-text" style={{ marginTop: '6px', fontSize: '0.85rem', color: '#7a3a00' }}>
                Are you sure you want to continue?
              </p>
              <div className="msg-modal-actions" style={{ gap: '8px' }}>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => setCopyPrevMonthConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={copySchedulerFromPreviousMonth}
                  disabled={loading}
                >
                  Yes, Overwrite
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {pendingShiftDelete && (
        <div className="msg-modal-overlay" role="dialog" aria-modal="true">
          <div className="msg-modal msg-modal-error">
            <h3 className="msg-modal-title">Confirm Delete</h3>
            <p className="msg-modal-text">Delete shift #{pendingShiftDelete.shift_id}? This cannot be undone.</p>
            <div className="msg-modal-actions" style={{ gap: '8px' }}>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setPendingShiftDelete(null)}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={confirmDeleteShift}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCaregiverRateDelete && (
        <div className="msg-modal-overlay" role="dialog" aria-modal="true">
          <div className="msg-modal msg-modal-error">
            <h3 className="msg-modal-title">Confirm Delete</h3>
            <p className="msg-modal-text">Delete caregiver pay rate #{pendingCaregiverRateDelete}? This cannot be undone.</p>
            <div className="msg-modal-actions" style={{ gap: '8px' }}>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setPendingCaregiverRateDelete(null)}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={confirmDeleteCaregiverRate}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingHolidayDelete && (
        <div className="msg-modal-overlay" role="dialog" aria-modal="true">
          <div className="msg-modal msg-modal-error">
            <h3 className="msg-modal-title">Confirm Delete</h3>
            <p className="msg-modal-text">Delete holiday #{pendingHolidayDelete}? This cannot be undone.</p>
            <div className="msg-modal-actions" style={{ gap: '8px' }}>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setPendingHolidayDelete(null)}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                type="button"
                onClick={confirmDeleteHoliday}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="status-bar">{status}</footer>
          </main>
        </>
      )}
    </div>
  )
}

export default App
