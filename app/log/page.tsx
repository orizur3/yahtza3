'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { EventLogEntry, Report, COMPANY_CFG, ALL_COMPANIES, Company } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function getUserRole(): string {
  if (typeof document === 'undefined') return 'אגם'
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = decodeURIComponent(v || '')
    return acc
  }, {} as Record<string, string>)
  return cookies['user_role'] || 'אגם'
}

export default function LogPage() {
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('מפעיל')
  const [relatedId, setRelatedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [userRole, setUserRole] = useState('אגם')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => { setUserRole(getUserRole()) }, [])

  const load = useCallback(async () => {
    const [{ data: logs }, { data: reps }] = await Promise.all([
      supabase.from('event_log').select('*').order('created_at', { ascending: false }),
      supabase.from('reports').select('id,city,street,assigned_company').order('report_time', { ascending: false }),
    ])
    if (logs) setEntries(logs as EventLogEntry[])
    if (reps) setReports(reps as Report[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('log-v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_log' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const addEntry = async () => {
    if (!content.trim()) return
    setSaving(true)
    await supabase.from('event_log').insert({
      entry_type: 'manual',
      content: content.trim(),
      created_by: author || 'מפעיל',
      related_report_id: relatedId || null,
      reported_by_role: userRole,
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

  const exportLog = () => {
    const text = filtered.map(e =>
      `[${new Date(e.created_at).toLocaleString('he-IL')}] ${e.reported_by_role ? `[${e.reported_by_role}] ` : ''}${e.created_by}: ${e.content}`
    ).join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `יומן_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.txt`
    a.click()
  }

  const isHQ = userRole === 'אגם'

  // Filter entries by role — company sees only their own
  const roleFilteredEntries = isHQ ? entries : entries.filter(e => {
    if (e.reported_by_role === userRole) return true
    if (!e.related_report_id) return false
    const rep = reports.find(r => r.id === e.related_report_id)
    return rep?.assigned_company === userRole
  })

  const filtered = roleFilteredEntries.filter(e => {
    const matchDate = !filterDate || e.created_at.startsWith(filterDate)
    const matchCompany = !filterCompany || e.reported_by_role === filterCompany ||
      reports.find(r => r.id === e.related_report_id)?.assigned_company === filterCompany
    return matchDate && matchCompany
  })

  const grouped: Record<string, EventLogEntry[]> = {}
  filtered.forEach(e => {
    const date = new Date(e.created_at).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(e)
  })

  const inp: React.CSSProperties = { border: '1px solid #334155', borderRadius: 7, padding: '7px 10px', fontSize: 13, direction: 'rtl', outline: 'none', background: '#1e293b', color: '#e2e8f0' }

  const getRoleBadge = (role?: string) => {
    if (!role) return null
    if (role === 'אגם') return <span style={{ background: '#1c0f00', color: '#fbbf24', border: '1px solid #92400e', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>אג"ם</span>
    const company = role as Company
    if (COMPANY_CFG[company]) {
      const cfg = COMPANY_CFG[company]
      return <span style={{ background: cfg.bg + '33', color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{cfg.label}</span>
    }
    return null
  }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#0a0f1a', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>→ טבלה</button>
          {isHQ && <button onClick={() => router.push('/dashboard')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📊 דשבורד</button>}
          <button onClick={exportLog} style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📥 ייצוא</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Image src="/logo.png" alt="ISR-1" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>יומן אירועים</div>
          <div style={{ color: '#475569', fontSize: 10 }}>{isHQ ? 'תצוגה יחידתית — כל הפלוגות' : COMPANY_CFG[userRole as Company]?.label}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#60a5fa' }}>{filtered.length} רשומות</div>
        </div>
      </div>

      <div style={{ padding: 18, maxWidth: 860, margin: '0 auto' }}>
        {/* Add entry */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>+ הוסף רשומה ליומן</div>
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

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={inp} />
          {isHQ && (
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={inp}>
              <option value="">כל הפלוגות</option>
              {ALL_COMPANIES.map(c => <option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
              <option value="אגם">אג"ם</option>
            </select>
          )}
          {filterDate && <button onClick={() => setFilterDate('')} style={{ ...inp, cursor: 'pointer', color: '#f87171' }}>✕</button>}
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>טוען...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>אין רשומות</div>
        ) : (
          Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#1e293b', color: '#94a3b8', borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>{date}</div>
                <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
                <div style={{ fontSize: 11, color: '#475569' }}>{dayEntries.length} רשומות</div>
              </div>
              {dayEntries.map(e => {
                const rel = reports.find(r => r.id === e.related_report_id)
                const isAuto = e.entry_type === 'auto'
                return (
                  <div key={e.id} style={{ display: 'flex', gap: 12, marginBottom: 10, paddingRight: 14, position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 6, width: 8, height: 8, borderRadius: '50%', background: isAuto ? '#334155' : '#378add', border: '2px solid #0a0f1a' }} />
                    <div style={{ flex: 1, background: '#0f172a', border: `1px solid ${isAuto ? '#1e293b' : '#1e3a5f'}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {!isAuto && <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{e.created_by}</span>}
                          {isAuto && <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>AUTO</span>}
                          {getRoleBadge(e.reported_by_role)}
                          {rel && <span style={{ background: '#1e3a5f', color: '#93c5fd', borderRadius: 20, padding: '1px 8px', fontSize: 10 }}>↗ {rel.street}, {rel.city}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#475569' }}>{new Date(e.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                          {!isAuto && <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: isAuto ? '#475569' : '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.content}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
