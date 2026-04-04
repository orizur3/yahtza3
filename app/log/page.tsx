'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { EventLogEntry, Report, COMPANY_CFG, ALL_COMPANIES, Company } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '../../components/BottomNav'

function getUserRole(): string {
  if (typeof document === 'undefined') return 'אגם'
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = decodeURIComponent(v || '')
    return acc
  }, {} as Record<string, string>)
  return cookies['user_role'] || 'אגם'
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDiaryDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function LogPage() {
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate())
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('מפעיל')
  const [relatedId, setRelatedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)
  const [filterCompany, setFilterCompany] = useState('')
  const [viewAllCompanies, setViewAllCompanies] = useState(false)
  const [userRole, setUserRole] = useState('אגם')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => { setUserRole(getUserRole()) }, [])

  // Auto-create today's diary entry at 6am (check on load)
  const ensureTodayDiary = useCallback(async () => {
    const today = getTodayDate()
    const { data } = await supabase.from('daily_diary').select('id').eq('diary_date', today).single()
    if (!data) {
      await supabase.from('daily_diary').insert({ diary_date: today })
      await supabase.from('event_log').insert({
        entry_type: 'auto',
        content: `📅 יומן חדש נפתח — ${formatDiaryDate(today)}`,
        created_by: 'מערכת',
        reported_by_role: 'מערכת',
        diary_date: today,
      })
    }
  }, [])

  const loadDates = useCallback(async () => {
    // Get all distinct dates from event_log
    const { data } = await supabase.from('event_log').select('diary_date').not('diary_date', 'is', null).order('diary_date', { ascending: false })
    if (data) {
      const dates = Array.from(new Set(data.map((d: any) => d.diary_date).filter(Boolean))) as string[]
      // Also add today if not present
      const today = getTodayDate()
      if (!dates.includes(today)) dates.unshift(today)
      setAvailableDates(dates)
    }
  }, [])

  const load = useCallback(async () => {
    const [{ data: logs }, { data: reps }] = await Promise.all([
      supabase.from('event_log').select('*')
        .eq('diary_date', selectedDate)
        .order('created_at', { ascending: true }),
      supabase.from('reports').select('id,city,street,assigned_company').order('report_time', { ascending: false }),
    ])
    if (logs) setEntries(logs as EventLogEntry[])
    if (reps) setReports(reps as Report[])
    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    ensureTodayDiary().then(() => {
      loadDates()
      load()
    })
    const ch = supabase.channel('log-v12')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_log' }, () => { load(); loadDates() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, loadDates, ensureTodayDiary])

  const addEntry = async () => {
    if (!content.trim()) return
    setSaving(true)
    await supabase.from('event_log').insert({
      entry_type: 'manual',
      content: content.trim(),
      created_by: author || 'מפעיל',
      related_report_id: relatedId || null,
      reported_by_role: userRole,
      diary_date: selectedDate,
    })
    setContent(''); setRelatedId('')
    setSaving(false)
    inputRef.current?.focus()
    load()
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('למחוק רשומה זו?')) return
    await supabase.from('event_log').delete().eq('id', id)
    load()
  }

  const saveEdit = async (id: string) => {
    if (!editingText.trim()) return
    setEditingSaving(true)
    await supabase.from('event_log').update({ content: editingText.trim() }).eq('id', id)
    setEditingId(null)
    setEditingSaving(false)
    load()
  }

  const exportLog = () => {
    const text = filtered.map(e =>
      `[${new Date(e.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}] ${e.reported_by_role ? `[${e.reported_by_role}] ` : ''}${e.created_by}: ${e.content}`
    ).join('\n')
    const blob = new Blob([`יומן ${formatDiaryDate(selectedDate)}\n${'='.repeat(40)}\n${text}`], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `יומן_${selectedDate}.txt`
    a.click()
  }

  const isHQ = userRole === 'אגם'
  const isToday = selectedDate === getTodayDate()

  const roleFilteredEntries = (isHQ && viewAllCompanies) ? entries : isHQ ? entries : entries.filter(e => {
    // Show auto entries linked to this company's reports
    if (e.reported_by_role === userRole) return true
    if (e.related_report_id) {
      const rep = reports.find(r => r.id === e.related_report_id)
      return rep?.assigned_company === userRole
    }
    // Show system auto entries only if they mention this company
    if (e.entry_type === 'auto' && !e.related_report_id) return false
    return false
  })

  const filtered = roleFilteredEntries.filter(e =>
    !filterCompany || e.reported_by_role === filterCompany ||
    reports.find(r => r.id === e.related_report_id)?.assigned_company === filterCompany
  )

  const getRoleBadge = (role?: string) => {
    if (!role || role === 'מערכת') return null
    if (role === 'אגם') return <span style={{ background: '#1c0f00', color: '#fbbf24', border: '1px solid #92400e', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>אג"ם</span>
    const company = role as Company
    if (COMPANY_CFG[company]) {
      const cfg = COMPANY_CFG[company]
      return <span style={{ background: cfg.bg + '33', color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{cfg.label}</span>
    }
    return null
  }

  const inp: React.CSSProperties = { border: '1px solid #334155', borderRadius: 7, padding: '7px 10px', fontSize: 13, direction: 'rtl', outline: 'none', background: '#1e293b', color: '#e2e8f0' }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#0a0f1a', fontFamily: 'Arial, sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>→ טבלה</button>
          {isHQ && <button onClick={() => router.push('/dashboard')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📊 דשבורד</button>}
          <button onClick={exportLog} style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📥 ייצוא</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Image src="/logo.png" alt="ISR-1" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>יומן אירועים</div>
          {isHQ ? (
            <button onClick={() => setViewAllCompanies(!viewAllCompanies)} style={{ background: viewAllCompanies ? '#1e3a5f' : '#1e293b', color: viewAllCompanies ? '#93c5fd' : '#64748b', border: '1px solid #334155', borderRadius: 20, padding: '2px 10px', fontSize: 10, cursor: 'pointer' }}>
              {viewAllCompanies ? 'כל הפלוגות' : 'אג"ם בלבד'}
            </button>
          ) : (
            <div style={{ color: '#475569', fontSize: 10 }}>{COMPANY_CFG[userRole as Company]?.label || userRole}</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#60a5fa' }}>{filtered.length} רשומות</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 70px)' }}>

        {/* Date sidebar */}
        <div style={{ background: '#0f172a', borderLeft: '1px solid #1e293b', overflowY: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>יומנים לפי יום</div>
          {availableDates.map(date => {
            const isSelected = date === selectedDate
            const isDateToday = date === getTodayDate()
            return (
              <div key={date} onClick={() => setSelectedDate(date)} style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #1e293b',
                background: isSelected ? '#1e3a5f' : 'transparent',
                borderRight: isSelected ? '3px solid #378add' : '3px solid transparent',
              }}>
                <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#93c5fd' : '#94a3b8' }}>
                  {isDateToday ? '📅 היום' : new Date(date + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{date}</div>
              </div>
            )
          })}
        </div>

        {/* Main content */}
        <div style={{ padding: 18, overflowY: 'auto' }}>

          {/* Day header */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{formatDiaryDate(selectedDate)}</div>
              {!isToday && <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>יומן ארכיון — לא ניתן להוסיף רשומות</div>}
            </div>
            <div style={{ fontSize: 12, color: '#60a5fa' }}>{filtered.length} רשומות</div>
          </div>

          {/* Add entry — only for today */}
          {isToday && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>+ הוסף רשומה ליומן היום</div>
              <textarea ref={inputRef} value={content} onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addEntry() }}
                placeholder="תיאור האירוע... (Ctrl+Enter לשמירה)"
                style={{ ...inp, width: '100%', minHeight: 80, resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' as any }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="שם המדווח" style={{ ...inp, width: 160 }} />
                <select value={relatedId} onChange={e => setRelatedId(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }}>
                  <option value="">קשר לאירוע (אופציונלי)</option>
                  {reports.map(r => <option key={r.id} value={r.id}>{r.street}, {r.city}{r.assigned_company ? ` — ${COMPANY_CFG[r.assigned_company as Company]?.label || r.assigned_company}` : ''}</option>)}
                </select>
                <button onClick={addEntry} disabled={saving || !content.trim()}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving || !content.trim() ? '#334155' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving || !content.trim() ? 'default' : 'pointer' }}>
                  {saving ? 'שומר...' : 'הוסף'}
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          {isHQ && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={inp}>
                <option value="">כל הפלוגות</option>
                {ALL_COMPANIES.map(c => <option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
                <option value="אגם">אג"ם</option>
              </select>
              {filterCompany && <button onClick={() => setFilterCompany('')} style={{ ...inp, cursor: 'pointer', color: '#f87171' }}>✕</button>}
            </div>
          )}

          {/* Entries */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>טוען...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              {isToday ? 'אין רשומות עדיין — הוסף את הרשומה הראשונה' : 'אין רשומות ליום זה'}
            </div>
          ) : (
            <div>
              {filtered.map((e, idx) => {
                const rel = reports.find(r => r.id === e.related_report_id)
                const isAuto = e.entry_type === 'auto'
                const isDayOpen = e.content.includes('יומן חדש נפתח')
                return (
                  <div key={e.id} style={{ display: 'flex', gap: 12, marginBottom: 10, paddingRight: 18, position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 6, width: 10, height: 10, borderRadius: '50%', background: isDayOpen ? '#fbbf24' : isAuto ? '#334155' : '#378add', border: '2px solid #0a0f1a', zIndex: 1 }} />
                    {idx < filtered.length - 1 && <div style={{ position: 'absolute', right: 4, top: 16, bottom: -10, width: 2, background: '#1e293b' }} />}
                    <div style={{ flex: 1, background: isDayOpen ? '#1c0f00' : '#0f172a', border: `1px solid ${isDayOpen ? '#92400e' : isAuto ? '#1e293b' : '#1e3a5f'}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {!isAuto && <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{e.created_by}</span>}
                          {isAuto && !isDayOpen && <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>AUTO</span>}
                          {isDayOpen && <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>📅 פתיחת יומן</span>}
                          {getRoleBadge(e.reported_by_role ?? undefined)}
                          {rel && <span style={{ background: '#1e3a5f', color: '#93c5fd', borderRadius: 20, padding: '1px 8px', fontSize: 10 }}>↗ {rel.street}, {rel.city}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#475569' }}>{new Date(e.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                          {!isAuto && isToday && editingId !== e.id && (
                            <>
                              <button onClick={() => { setEditingId(e.id); setEditingText(e.content) }} style={{ background: 'none', border: 'none', color: '#378add', cursor: 'pointer', fontSize: 13, padding: 0 }}>✏️</button>
                              <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingId === e.id ? (
                        <div style={{ marginTop: 6 }}>
                          <textarea value={editingText} onChange={ev => setEditingText(ev.target.value)}
                            onKeyDown={ev => { if (ev.key === 'Enter' && ev.ctrlKey) saveEdit(e.id); if (ev.key === 'Escape') setEditingId(null) }}
                            style={{ width: '100%', minHeight: 70, padding: '7px 10px', border: '1px solid #378add', borderRadius: 7, fontSize: 13, direction: 'rtl', outline: 'none', background: '#0a0f1a', color: '#e2e8f0', resize: 'vertical', boxSizing: 'border-box' as any, fontFamily: 'Arial' }}
                            autoFocus />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={() => saveEdit(e.id)} disabled={editingSaving} style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {editingSaving ? 'שומר...' : 'שמור'}
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>ביטול</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: isAuto ? '#475569' : '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.content}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav onNewReport={() => router.push("/?newReport=1")} onSummary={() => router.push("/?summary=1")} />
    </div>
  )
}
