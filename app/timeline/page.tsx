'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Report, ReportStatus, Priority, STATUS_CFG, PRIORITY_CFG, ALL_STATUSES } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function TimelinePage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*').order('report_time', { ascending: false })
    if (data) setReports(data as Report[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('tl').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const quickUpdate = async (id: string, fields: Partial<Report>) => {
    await supabase.from('reports').update(fields).eq('id', id)
    load()
  }

  const filtered = reports.filter(r => {
    const ok = (!search || `${r.city} ${r.street} ${r.report_content ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      && (!filterStatus || r.status === filterStatus)
      && (!filterPriority || r.priority === filterPriority)
      && (!filterDate || r.report_time.startsWith(filterDate))
    return ok
  })

  const grouped: Record<string, Report[]> = {}
  filtered.forEach(r => {
    const date = new Date(r.report_time).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(r)
  })

  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 13, direction: 'rtl', outline: 'none', background: '#fff' }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>→ טבלה</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📊 דשבורד</button>
          <button onClick={() => router.push('/log')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📖 יומן</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Image src="/logo.png" alt="ISR-1" width={44} height={44} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>ציר זמן אירועים</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#60a5fa' }}>{filtered.length} אירועים</div>
        </div>
      </div>

      <div style={{ background: '#1e293b', padding: '8px 22px', display: 'flex', gap: 20 }}>
        {ALL_STATUSES.slice(0,4).map(s => {
          const count = reports.filter(r => r.status === s).length
          const cfg = STATUS_CFG[s]
          return <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: cfg.dot }}>{count}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s}</span>
          </div>
        })}
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', border: '1px solid #e5e7eb' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש חופשי..." style={{ ...inp, width: 180 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
            <option value="">כל הסטטוסים</option>
            {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={inp}>
            <option value="">כל העדיפויות</option>
            <option>דחוף</option><option>גבוה</option><option>בינוני</option><option>רגיל</option>
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={inp} />
          {filterDate && <button onClick={() => setFilterDate('')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>✕</button>}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>טוען...</div>
          : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>לא נמצאו אירועים</div>
          : Object.entries(grouped).map(([date, dayReports]) => (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#0f172a', color: '#fff', borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 700 }}>{date}</div>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{dayReports.length} אירועים</div>
              </div>
              <div style={{ position: 'relative', paddingRight: 28 }}>
                <div style={{ position: 'absolute', right: 10, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
                {dayReports.map(r => {
                  const sc = STATUS_CFG[r.status || 'חדש']
                  const pc = PRIORITY_CFG[r.priority || 'רגיל']
                  const isExpanded = expanded === r.id
                  const time = new Date(r.report_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={r.id} style={{ position: 'relative', marginBottom: 10 }}>
                      <div style={{ position: 'absolute', right: -18, top: 14, width: 16, height: 16, borderRadius: '50%', background: sc.dot, border: '3px solid #f3f4f6', zIndex: 1 }} />
                      <div onClick={() => setExpanded(isExpanded ? null : r.id)} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${isExpanded ? sc.border : '#e5e7eb'}`, padding: '12px 14px', cursor: 'pointer', borderRight: `4px solid ${sc.dot}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{time}</span>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.street}, {r.city}</span>
                            <span style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{r.priority || 'רגיל'}</span>
                            {(r.casualties ?? 0) > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{r.casualties} נפגעים</span>}
                          </div>
                          <div onClick={e => e.stopPropagation()}>
                            <select value={r.status || 'חדש'} onChange={e => quickUpdate(r.id, { status: e.target.value as ReportStatus })}
                              style={{ border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, cursor: 'pointer', outline: 'none', direction: 'rtl' }}>
                              {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <span style={{ fontSize: 14, color: '#9ca3af', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                        </div>
                        {!isExpanded && r.report_content && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.report_content}</div>}
                        {isExpanded && (
                          <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                              {r.report_content && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>תוכן</div><div>{r.report_content}</div></div>}
                              {r.assigned_unit && <div><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>כוח מוקצה</div><div style={{ fontWeight: 600, color: '#1d4ed8' }}>{r.assigned_unit}</div></div>}
                              {r.forces_dispatched && <div><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>כוחות</div><div>{r.forces_dispatched}</div></div>}
                              {r.geo_summary && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>קשר גיאוגרפי</div><div style={{ color: '#dc2626', fontWeight: 600 }}>{r.geo_summary}</div></div>}
                            </div>
                            {r.maps_url && <a href={r.maps_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#1d4ed8', textDecoration: 'none', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px' }}>📍 פתח במפה</a>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}
