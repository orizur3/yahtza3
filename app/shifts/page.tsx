'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Report, Shift, COMPANY_CFG, ALL_COMPANIES, Company, PRIORITY_CFG, STATUS_CFG, CLOSED_STATUSES, ALL_STATUSES } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '../../components/BottomNav'
import SideNav from '../../components/SideNav'

function duration(start: string, end: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}ש' ${m}ד'` : `${m} דקות`
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [editingShiftName, setEditingShiftName] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const router = useRouter()

  const load = useCallback(async () => {
    const [{ data: sh }, { data: reps }] = await Promise.all([
      supabase.from('shifts').select('*').order('started_at', { ascending: false }),
      supabase.from('reports').select('*').order('report_time', { ascending: false }),
    ])
    if (sh) {
      setShifts(sh as Shift[])
      const active = (sh as Shift[]).find(s => s.is_active)
      if (!selectedShift) setSelectedShift(active || (sh as Shift[])[0] || null)
    }
    if (reps) setReports(reps as Report[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const renameShift = async (id: string, name: string) => {
    if (!name.trim()) return
    await supabase.from('shifts').update({ name: name.trim() }).eq('id', id)
    setEditingShiftId(null)
    load()
  }

  const shiftReports = selectedShift
    ? reports.filter(r => r.shift_id === selectedShift.id && !r.is_merged)
    : []

  const filtered = shiftReports.filter(r => {
    const s = `${r.city} ${r.street} ${r.report_content ?? ''}`.toLowerCase()
    return (!search || s.includes(search.toLowerCase())) &&
      (!filterStatus || r.status === filterStatus) &&
      (!filterCompany || r.assigned_company === filterCompany)
  })

  const stats = {
    total: shiftReports.length,
    open: shiftReports.filter(r => !CLOSED_STATUSES.includes(r.status)).length,
    closed: shiftReports.filter(r => CLOSED_STATUSES.includes(r.status)).length,
    casualties: shiftReports.reduce((a, r) => a + (r.casualties || 0), 0),
    critical: shiftReports.filter(r => r.priority === 'דחוף').length,
  }

  const cell: React.CSSProperties = { padding: '9px 10px', fontSize: 12, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }
  const thStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f9fafb', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }
  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 13, direction: 'rtl', outline: 'none' }

  const exportAllShiftsExcel = () => {
    const today = new Date().toLocaleDateString('he-IL').replace(/\//g, '-')
    const cell = (v: any, hdr = false) =>
      '<td style="border:1px solid #ccc;padding:4px 8px;direction:rtl;font-family:Arial;' +
      (hdr ? 'background:#0f172a;color:white;font-weight:bold;' : '') + '">' + String(v || '') + '</td>'
    const COLS = ['עיר', 'רחוב', 'פלוגה', 'עדיפות', 'סטטוס', 'כוח מוקצה', 'נפגעים', 'תוכן']
    let html = '<html><head><meta charset="utf-8"><style>body{direction:rtl;font-family:Arial}h2,h3{margin-top:16px}</style></head><body dir="rtl"><h1>ארכיון מטחים ISR-1</h1>'
    let sumRows = '<tr>' + ['מטח','פתיחה','סגירה','סהכ','פתוחים','סגורים','דחופים','נפגעים'].map(h => cell(h,true)).join('') + '</tr>'
    shifts.forEach((s: any) => {
      const sr = reports.filter((r: any) => r.shift_id === s.id && !r.is_merged)
      const op = sr.filter((r: any) => r.status !== 'הושלם' && r.status !== 'נסגר כדיווח שווא')
      const cl = sr.filter((r: any) => r.status === 'הושלם' || r.status === 'נסגר כדיווח שווא')
      const urg = sr.filter((r: any) => r.priority === 'דחוף')
      const cas = sr.reduce((a: number, r: any) => a + (r.casualties || 0), 0)
      sumRows += '<tr>' + [s.name, new Date(s.started_at).toLocaleDateString('he-IL'), s.ended_at ? new Date(s.ended_at).toLocaleDateString('he-IL') : 'פעיל', sr.length, op.length, cl.length, urg.length, cas].map((v: any) => cell(v)).join('') + '</tr>'
    })
    html += '<h2>סיכום מטחים</h2><table border="1">' + sumRows + '</table>'
    shifts.forEach((s: any) => {
      const sr = reports.filter((r: any) => r.shift_id === s.id && !r.is_merged)
      let rows = '<tr><td colspan="8" style="background:#0f172a;color:white;font-weight:bold;padding:6px;font-family:Arial">' + s.name + '</td></tr>'
      rows += '<tr>' + COLS.map(h => cell(h,true)).join('') + '</tr>'
      sr.forEach((r: any) => {
        rows += '<tr>' + [r.city,r.street,r.assigned_company||'-',r.priority||'רגיל',r.status,r.assigned_unit||'-',r.casualties||0,r.report_content||''].map((v: any) => cell(v)).join('') + '</tr>'
      })
      html += '<br><h3>' + s.name + '</h3><table border="1">' + rows + '</table>'
    })
    html += '</body></html>'
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ISR1_' + today + '.xls'
    a.click()
  }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', paddingRight: 200, paddingBottom: 80, background: '#f3f4f6', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>→ טבלה</button>
          <button onClick={exportAllShiftsExcel} title="ייצוא כל המטחים לאקסל" style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📊 ייצוא כל המטחים</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>📊 דשבורד</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Image src="/logo.png" alt="ISR-1" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>ארכיון מטחים</div>
          <div style={{ color: '#475569', fontSize: 10 }}>Shift Archive</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#60a5fa' }}>{shifts.length} מטחים</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, minHeight: 'calc(100vh - 70px)' }}>

        {/* Shifts sidebar */}
        <div style={{ background: '#fff', borderLeft: '1px solid #e5e7eb', overflowY: 'auto' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>בחר מטח</div>
          {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>טוען...</div>
            : shifts.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>אין מטחים</div>
            : shifts.map(s => {
              const shReps = reports.filter(r => r.shift_id === s.id && !r.is_merged)
              const shOpen = shReps.filter(r => !CLOSED_STATUSES.includes(r.status)).length
              const isSelected = selectedShift?.id === s.id
              return (
                <div key={s.id} onClick={() => setSelectedShift(s)} style={{
                  padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                  background: isSelected ? '#eff6ff' : '#fff',
                  borderRight: isSelected ? '3px solid #1d4ed8' : '3px solid transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {editingShiftId === s.id ? (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <input
                        value={editingShiftName}
                        onChange={e => setEditingShiftName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameShift(s.id, editingShiftName); if (e.key === 'Escape') setEditingShiftId(null) }}
                        autoFocus
                        style={{ flex: 1, fontSize: 12, padding: '2px 6px', border: '1px solid #1d4ed8', borderRadius: 5, direction: 'rtl', outline: 'none' }}
                      />
                      <button onClick={() => renameShift(s.id, editingShiftName)} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditingShiftId(null)} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: 13, color: isSelected ? '#1d4ed8' : '#1f2937', flex: 1 }}>{s.name}</span>
                      <button onClick={e => { e.stopPropagation(); setEditingShiftId(s.id); setEditingShiftName(s.name) }}
                        style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#9ca3af', padding: '2px 4px' }}>✏️</button>
                    </div>
                  )}
                    {s.is_active && <span style={{ background: '#e1f5ee', color: '#085041', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>פעיל</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    {new Date(s.started_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {s.ended_at && ` — ${new Date(s.ended_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {duration(s.started_at, s.ended_at)} | {shReps.length} אירועים | {shOpen} פתוחים
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Shift content */}
        <div style={{ padding: 18, overflowY: 'auto' }}>
          {!selectedShift ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>בחר מטח מהרשימה</div>
          ) : (
            <>
              {/* Shift header */}
              <div style={{ background: '#0f172a', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{selectedShift.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                    פתיחה: {new Date(selectedShift.started_at).toLocaleString('he-IL')}
                    {selectedShift.ended_at && ` | סגירה: ${new Date(selectedShift.ended_at).toLocaleString('he-IL')}`}
                    {' | משך: '}{duration(selectedShift.started_at, selectedShift.ended_at)}
                  </div>
                </div>
                {selectedShift.is_active && <span style={{ background: '#e1f5ee', color: '#085041', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>מטח פעיל</span>}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { n: stats.total, l: 'סה"כ אירועים', c: '#60a5fa' },
                  { n: stats.open, l: 'פתוחים', c: '#f87171' },
                  { n: stats.closed, l: 'סגורים', c: '#4ade80' },
                  { n: stats.critical, l: 'דחופים', c: '#e24b4a' },
                  { n: stats.casualties, l: 'נפגעים', c: '#a78bfa' },
                ].map(s => (
                  <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', flex: 1, minWidth: 100, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.n}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Company breakdown */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {ALL_COMPANIES.map(c => {
                  const cfg = COMPANY_CFG[c]
                  const count = shiftReports.filter(r => r.assigned_company === c).length
                  return (
                    <div key={c} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.mapColor, display: 'inline-block' }}/>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}: {count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Filters */}
              <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', border: '1px solid #e5e7eb' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש..." style={{ ...inp, width: 180 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
                  <option value="">כל הסטטוסים</option>
                  {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={inp}>
                  <option value="">כל הפלוגות</option>
                  {ALL_COMPANIES.map(c => <option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
                </select>
                <span style={{ fontSize: 12, color: '#6b7280', marginRight: 'auto' }}>{filtered.length} אירועים</span>
              </div>

              {/* Reports table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>אין אירועים במטח זה</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                      <thead>
                        <tr>{['עדיפות', 'פלוגה', 'עיר', 'רחוב', 'שעה', 'סטטוס', 'כוח', 'נפגעים', 'תוכן', 'קשר גיאו', 'סיבת סגירה'].map(h => (
                          <th key={h} style={{ ...thStyle, textAlign: ['נפגעים'].includes(h) ? 'center' : 'right' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {filtered.map(r => {
                          const pc = PRIORITY_CFG[r.priority || 'רגיל']
                          const sc = STATUS_CFG[r.status || 'חדש']
                          const company = r.assigned_company as Company | null
                          const companyCfg = company && COMPANY_CFG[company]
                          return (
                            <tr key={r.id} style={{ background: CLOSED_STATUSES.includes(r.status) ? '#f9fafb' : 'transparent' }}>
                              <td style={cell}>
                                <span style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{r.priority || 'רגיל'}</span>
                              </td>
                              <td style={cell}>
                                {companyCfg ? <span style={{ background: companyCfg.bg, color: companyCfg.color, border: `1px solid ${companyCfg.border}`, borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{companyCfg.label}</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                              </td>
                              <td style={cell}><b>{r.city}</b></td>
                              <td style={cell}>{r.street}</td>
                              <td style={{ ...cell, whiteSpace: 'nowrap', color: '#6b7280', fontSize: 11 }}>{new Date(r.report_time).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td>
                              <td style={cell}>
                                <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{r.status}</span>
                              </td>
                              <td style={{ ...cell, fontSize: 11, color: r.assigned_unit ? '#374151' : '#d1d5db' }}>{r.assigned_unit || '—'}</td>
                              <td style={{ ...cell, textAlign: 'center' }}>
                                {(r.casualties ?? 0) > 0 ? <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{r.casualties}</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                              </td>
                              <td style={{ ...cell, maxWidth: 150 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140, fontSize: 11 }}>{r.report_content || '—'}</span></td>
                              <td style={cell}><span style={{ fontSize: 11, color: r.geo_status !== 'ללא קשר' ? '#dc2626' : '#9ca3af' }}>{r.geo_status}</span></td>
                              <td style={{ ...cell, fontSize: 11, color: r.close_reason ? '#374151' : '#d1d5db' }}>{r.close_reason || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <SideNav />
      <BottomNav onNewReport={() => router.push('/?newReport=1')} onSummary={() => router.push('/?summary=1')} />
    </div>
  )
}
