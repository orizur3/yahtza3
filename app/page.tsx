'use client'

import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { geocodeAddress, computeGeoFields, recomputeAllGeo, Report, GeoStatus, Priority, ReportStatus, PRIORITY_CFG, STATUS_CFG, ALL_STATUSES, ALL_PRIORITIES, CLOSED_STATUSES, Comment, Shift, Company, UserRole, COMPANY_CFG, ALL_COMPANIES } from '../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '../components/BottomNav'
import SideNav from '../components/SideNav'

declare global { interface Window { google: any; initMap: () => void } }

const GEO_CFG: Record<GeoStatus, {bg:string;color:string;border:string}> = {
  'מצטלבים':       { bg:'#fcebeb', color:'#a32d2d', border:'#f09595' },
  'מקבילים':       { bg:'#faeeda', color:'#633806', border:'#ef9f27' },
  'רחובות קרובים': { bg:'#faeeda', color:'#633806', border:'#ef9f27' },
  'ללא קשר':       { bg:'#f1efe8', color:'#444441', border:'#b4b2a9' },
}

function getUserRole(): UserRole {
  if (typeof document === 'undefined') return 'אגם'
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = decodeURIComponent(v || '')
    return acc
  }, {} as Record<string, string>)
  return (cookies['user_role'] as UserRole) || 'אגם'
}

function GeoBadge({ status }: { status: GeoStatus }) {
  const c = GEO_CFG[status] ?? GEO_CFG['ללא קשר']
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{status !== 'ללא קשר' && '● '}{status}</span>
}

function CompanyBadge({ company }: { company: Company | null }) {
  if (!company) return <span style={{ color:'#d1d5db', fontSize:11 }}>—</span>
  const c = COMPANY_CFG[company]
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{c.label}</span>
}

function Toast({ items, onDismiss }: { items:{id:number;msg:string;type:string}[]; onDismiss:(id:number)=>void }) {
  return (
    <div style={{ position:'fixed', top:14, left:'50%', transform:'translateX(-50%)', zIndex:9999, display:'flex', flexDirection:'column', gap:8, minWidth:340 }}>
      {items.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)} style={{ padding:'11px 16px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', direction:'rtl', background:t.type==='warn'?'#e24b4a':'#1d9e75', color:'#fff' }}>
          {t.type==='warn'?'⚠️ ':'✓ '}{t.msg}
          <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>לחץ לסגירה</div>
        </div>
      ))}
    </div>
  )
}


function CloseReasonModal({ report, onConfirm, onClose }: { report: Report; onConfirm: (status: ReportStatus, reason: string) => void; onClose: () => void }) {
  const [status, setStatus] = useState<ReportStatus>('הושלם')
  const [reason, setReason] = useState('')
  const REASONS: Record<ReportStatus, string[]> = {
    'הושלם': ['טופל בהצלחה', 'כוחות שחררו את הזירה', 'האירוע הוכל', 'הועבר לגורם מוסמך'],
    'נסגר כדיווח שווא': ['דיווח שגוי', 'אין אירוע בשטח', 'כפל דיווח', 'מידע לא מדויק'],
    'חדש': [], 'ממתין לאימות': [], 'כוחות בדרך': [], 'כוחות בזירה': [],
  }
  const reasons = REASONS[status] || []
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:24, minWidth:360, direction:'rtl' }}>
        <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700 }}>סגירת אירוע</h3>
        <p style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>{report.street}, {report.city}</p>
        <div style={{ marginBottom:14 }}>
          {(['הושלם','נסגר כדיווח שווא'] as ReportStatus[]).map(s => {
            const cfg = STATUS_CFG[s]
            return <div key={s} onClick={()=>setStatus(s)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`2px solid ${status===s?cfg.border:'#e5e7eb'}`, background:status===s?cfg.bg:'#fff', cursor:'pointer', marginBottom:8 }}>
              <span style={{ width:12, height:12, borderRadius:'50%', background:cfg.dot }}/>
              <span style={{ fontWeight:600, color:cfg.color, fontSize:14 }}>{s}</span>
            </div>
          })}
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:6, color:'#374151' }}>סיבת סגירה</label>
          <select value={reason} onChange={e=>setReason(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, direction:'rtl', outline:'none', marginBottom:8, boxSizing:'border-box' as any }}>
            <option value="">בחר סיבה...</option>
            {reasons.map(r=><option key={r} value={r}>{r}</option>)}
            <option value="other">אחר (הקלד ידנית)</option>
          </select>
          {(reason === 'other' || !reasons.includes(reason)) && reason !== '' && (
            <input value={reason === 'other' ? '' : reason} onChange={e=>setReason(e.target.value)}
              placeholder="סיבה ידנית..."
              style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, direction:'rtl', outline:'none', boxSizing:'border-box' as any }}/>
          )}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13 }}>ביטול</button>
          <button onClick={()=>onConfirm(status, reason)} style={{ padding:'8px 20px', borderRadius:7, border:'none', background:'#1d4ed8', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>סגור אירוע</button>
        </div>
      </div>
    </div>
  )
}

function BulkCloseModal({ count, onConfirm, onClose }: { count:number; onConfirm:(s:ReportStatus)=>void; onClose:()=>void }) {
  const [status, setStatus] = useState<ReportStatus>('הושלם')
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:24, minWidth:320, direction:'rtl' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>סגירת {count} אירועים</h3>
        {(['הושלם','נסגר כדיווח שווא'] as ReportStatus[]).map(s => {
          const cfg = STATUS_CFG[s]
          return <div key={s} onClick={()=>setStatus(s)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`2px solid ${status===s?cfg.border:'#e5e7eb'}`, background:status===s?cfg.bg:'#fff', cursor:'pointer', marginBottom:8 }}>
            <span style={{ width:12, height:12, borderRadius:'50%', background:cfg.dot, display:'inline-block' }}/>
            <span style={{ fontWeight:600, color:cfg.color, fontSize:14 }}>{s}</span>
          </div>
        })}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13 }}>ביטול</button>
          <button onClick={()=>onConfirm(status)} style={{ padding:'8px 20px', borderRadius:7, border:'none', background:'#1d4ed8', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>סגור {count} אירועים</button>
        </div>
      </div>
    </div>
  )
}

function MergeModal({ reports, selectedIds, onConfirm, onClose }: { reports:Report[]; selectedIds:string[]; onConfirm:(k:string,m:string)=>void; onClose:()=>void }) {
  const selected = reports.filter(r=>selectedIds.includes(r.id))
  const [keepId, setKeepId] = useState(selectedIds[0])
  if (selected.length !== 2) return null
  const mergeId = selectedIds.find(id=>id!==keepId)!
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:24, minWidth:380, direction:'rtl' }}>
        <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700 }}>איחוד שתי כתובות</h3>
        <p style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>בחר איזו רשומה תישאר ראשית</p>
        {selected.map(r => (
          <div key={r.id} onClick={()=>setKeepId(r.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`2px solid ${keepId===r.id?'#1d4ed8':'#e5e7eb'}`, background:keepId===r.id?'#eff6ff':'#fff', cursor:'pointer', marginBottom:8 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${keepId===r.id?'#1d4ed8':'#d1d5db'}`, background:keepId===r.id?'#1d4ed8':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {keepId===r.id && <div style={{ width:6, height:6, borderRadius:'50%', background:'#fff' }}/>}
            </div>
            <div><div style={{ fontWeight:700, fontSize:14 }}>{r.street}, {r.city}</div><div style={{ fontSize:11, color:'#6b7280' }}>{r.report_content||'—'}</div></div>
          </div>
        ))}
        <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
          התוצאה: <b>{selected.find(r=>r.id===keepId)?.street} / {selected.find(r=>r.id===mergeId)?.street}</b>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13 }}>ביטול</button>
          <button onClick={()=>onConfirm(keepId,mergeId)} style={{ padding:'8px 20px', borderRadius:7, border:'none', background:'#7f77dd', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>איחוד</button>
        </div>
      </div>
    </div>
  )
}

function ShiftModal({ currentShift, onStart, onClose }: { currentShift:Shift|null; onStart:(name:string)=>void; onClose:()=>void }) {
  const [name, setName] = useState('')
  const today = new Date().toLocaleDateString('he-IL')
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:24, minWidth:360, direction:'rtl' }}>
        <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700 }}>פתיחת מטח חדש</h3>
        <p style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>{currentShift?`מטח "${currentShift.name}" ייסגר. אירועים פתוחים יועברו למטח החדש, סגורים יישמרו בארכיון.`:'פתיחת המטח הראשון'}</p>
        <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6, color:'#374151' }}>שם המטח</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={`${today} — בוקר`}
          style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, direction:'rtl', outline:'none', boxSizing:'border-box' as any, marginBottom:16 }}/>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13 }}>ביטול</button>
          <button onClick={()=>onStart(name.trim()||`${today} — מטח`)} style={{ padding:'8px 20px', borderRadius:7, border:'none', background:'#0f172a', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>פתח מטח</button>
        </div>
      </div>
    </div>
  )
}

function CommentsModal({ report, onClose, onLogEntry }: { report:Report; onClose:()=>void; onLogEntry:(c:string,id:string)=>void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('מפעיל')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editText, setEditText] = useState('')

  const load = useCallback(async()=>{
    const {data} = await supabase.from('report_comments').select('*').eq('report_id',report.id).order('created_at',{ascending:true})
    if(data) setComments(data as Comment[])
  },[report.id])

  useEffect(()=>{load()},[load])

  const add = async()=>{
    if(!text.trim()) return
    setSaving(true)
    await supabase.from('report_comments').insert({report_id:report.id,content:text.trim(),created_by:author})
    onLogEntry(`תגובה נוספה לאירוע ${report.street}, ${report.city}: "${text.trim()}" — ${author}`,report.id)
    setText(''); setSaving(false); load()
  }

  const saveEdit = async(id:string)=>{
    if(!editText.trim()) return
    await supabase.from('report_comments').update({content:editText.trim()}).eq('id',id)
    setEditingId(null); load()
  }

  const inp:React.CSSProperties = {border:'1px solid #d1d5db',borderRadius:7,padding:'7px 10px',fontSize:13,direction:'rtl',outline:'none',width:'100%',boxSizing:'border-box' as any,fontFamily:'Arial,sans-serif'}
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:22, width:'100%', maxWidth:480, maxHeight:'80vh', display:'flex', flexDirection:'column', direction:'rtl' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>💬 עדכונים — {report.street}, {report.city}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', marginBottom:12 }}>
          {comments.length===0
            ? <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>אין עדכונים עדיין</div>
            : comments.map(c=>(
              <div key={c.id} style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:8, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>{c.created_by}</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(c.created_at).toLocaleString('he-IL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span>
                    <button onClick={()=>{setEditingId(c.id);setEditText(c.content)}} style={{ background:'none', border:'none', fontSize:11, color:'#6b7280', cursor:'pointer' }}>✏️</button>
                  </div>
                </div>
                {editingId===c.id
                  ? <div style={{ display:'flex', gap:6 }}>
                      <input value={editText} onChange={e=>setEditText(e.target.value)} style={{ ...inp, flex:1 }}/>
                      <button onClick={()=>saveEdit(c.id)} style={{ padding:'4px 10px', borderRadius:6, border:'none', background:'#1d4ed8', color:'#fff', fontSize:12, cursor:'pointer' }}>שמור</button>
                      <button onClick={()=>setEditingId(null)} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #d1d5db', background:'#fff', fontSize:12, cursor:'pointer' }}>ביטול</button>
                    </div>
                  : <div style={{ fontSize:13, color:'#374151' }}>{c.content}</div>
                }
              </div>
            ))
          }
        </div>
        <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12 }}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="הוסף עדכון..." style={{ ...inp, minHeight:60, resize:'vertical', marginBottom:8 }}/>
          <div style={{ display:'flex', gap:8 }}>
            <input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="שמך" style={{ ...inp, width:140 }}/>
            <button onClick={add} disabled={saving||!text.trim()} style={{ flex:1, padding:'8px', borderRadius:7, border:'none', background:saving||!text.trim()?'#9ca3af':'#1d4ed8', color:'#fff', fontWeight:700, fontSize:13, cursor:saving||!text.trim()?'default':'pointer' }}>
              {saving?'שומר...':'הוסף עדכון'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RelatedModal({ report, all, onClose }: { report:Report|null; all:Report[]; onClose:()=>void }) {
  if(!report) return null
  const related = all.filter(r=>report.geo_related_reports?.includes(r.id))
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:22, minWidth:340, maxWidth:500, maxHeight:'80vh', overflowY:'auto', direction:'rtl' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>דיווחים קשורים</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {!related.length ? <p style={{ color:'#888', fontSize:13 }}>אין דיווחים קשורים</p> : related.map(r=>(
          <div key={r.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>{r.street}, {r.city}</div>
            <div style={{ fontSize:11, color:'#666', marginTop:3 }}>{r.report_content||'—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


function AuditModal({ reportId, reportLabel, onClose }: { reportId: string; reportLabel: string; onClose: () => void }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('report_audit').select('*').eq('report_id', reportId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEntries(data); setLoading(false) })
  }, [reportId])

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:22, width:'100%', maxWidth:500, maxHeight:'80vh', overflowY:'auto', direction:'rtl' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>📋 היסטוריית שינויים — {reportLabel}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {loading ? <div style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>טוען...</div>
          : entries.length === 0 ? <div style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>אין היסטוריה</div>
          : entries.map(e => (
            <div key={e.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>{e.changed_by}</span>
                  {e.changed_by_role && <span style={{ fontSize:10, background:'#eff6ff', color:'#1d4ed8', borderRadius:20, padding:'1px 7px' }}>{e.changed_by_role}</span>}
                  <span style={{ fontSize:11, background:e.action==='create'?'#e1f5ee':e.action==='delete'?'#fcebeb':'#f9fafb', color:e.action==='create'?'#085041':e.action==='delete'?'#a32d2d':'#374151', borderRadius:20, padding:'1px 7px' }}>{e.action==='create'?'יצירה':e.action==='delete'?'מחיקה':'עדכון'}</span>
                </div>
                <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(e.created_at).toLocaleString('he-IL', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</span>
              </div>
              {e.field_name && <div style={{ fontSize:12, color:'#6b7280' }}>
                <span style={{ fontWeight:600 }}>{e.field_name}:</span> {e.old_value||'—'} → <span style={{ color:'#1d9e75', fontWeight:600 }}>{e.new_value||'—'}</span>
              </div>}
            </div>
          ))
        }
      </div>
    </div>
  )
}

function InteractiveMap({ reports, focusReport, userRole }: { reports:Report[]; focusReport:Report|null; userRole:UserRole }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const initMap = useCallback(()=>{
    if(!mapRef.current||!window.google) return
    const withCoords = reports.filter(r=>r.latitude&&r.longitude&&!r.is_merged)
    const center = focusReport?.latitude?{lat:focusReport.latitude,lng:focusReport.longitude!}
      :withCoords.length>0?{lat:withCoords[0].latitude!,lng:withCoords[0].longitude!}
      :{lat:31.9730,lng:34.7925}
    if(!mapInstanceRef.current){
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current,{
        center,zoom:14,
        mapTypeControl:true,
        mapTypeControlOptions:{
          style:window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position:window.google.maps.ControlPosition.TOP_LEFT,
          mapTypeIds:['roadmap','satellite','hybrid']
        },
        fullscreenControl:true,streetViewControl:false
      })
    } else { mapInstanceRef.current.setCenter(center); if(focusReport?.latitude) mapInstanceRef.current.setZoom(17) }
    markersRef.current.forEach(m=>m.setMap(null)); markersRef.current=[]
    withCoords.forEach(r=>{
      const company = r.assigned_company as Company|null
      const mapColor = company&&COMPANY_CFG[company]?COMPANY_CFG[company].mapColor
        :r.geo_status==='מצטלבים'?'#e24b4a':r.geo_status==='מקבילים'||r.geo_status==='רחובות קרובים'?'#ba7517':'#185fa5'
      const isActive = focusReport?.id===r.id
      const marker = new window.google.maps.Marker({
        position:{lat:r.latitude!,lng:r.longitude!},
        map:mapInstanceRef.current,
        icon:{path:window.google.maps.SymbolPath.CIRCLE,scale:isActive?18:13,fillColor:mapColor,fillOpacity:1,strokeColor:'#fff',strokeWeight:isActive?4:3},
        zIndex:isActive?999:1,
      })
      const sc = STATUS_CFG[r.status||'חדש']
      const pc = PRIORITY_CFG[r.priority||'רגיל']
      const compLabel = company&&COMPANY_CFG[company]?`<span style="background:${COMPANY_CFG[company].bg};color:${COMPANY_CFG[company].color};border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700">${COMPANY_CFG[company].label}</span>`:'';
      const info = `<div style="direction:rtl;font-family:Arial;min-width:200px;padding:4px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.street}, ${r.city}</div>
        <div style="display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span style="background:${pc.bg};color:${pc.color};border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700">${r.priority||'רגיל'}</span>
          <span style="background:${sc.bg};color:${sc.color};border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700">${r.status||'חדש'}</span>
          ${compLabel}
        </div>
        ${r.assigned_unit?`<div style="font-size:12px;color:#1d4ed8;margin-bottom:3px">כוח: ${r.assigned_unit}</div>`:''}
        ${r.casualties?`<div style="font-size:12px;color:#dc2626;margin-bottom:3px">נפגעים: ${r.casualties}</div>`:''}
        ${r.geo_summary?`<div style="font-size:12px;color:#b45309;font-weight:600;margin-bottom:3px">${r.geo_summary}</div>`:''}
        ${r.report_content?`<div style="font-size:12px;color:#374151">${r.report_content}</div>`:''}
        ${r.maps_url?`<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((r.location_text||r.street+','+r.city)+',Israel')}" target="_blank" style="font-size:11px;color:#1d4ed8;display:block;margin-top:6px">נווט למיקום →</a>`:''}
      </div>`
      const iw = new window.google.maps.InfoWindow({content:info})
      marker.addListener('click',()=>{markersRef.current.forEach(m=>m._iw?.close());iw.open(mapInstanceRef.current,marker);marker._iw=iw})
      markersRef.current.push(marker)
    })
  },[reports,focusReport,userRole])

  useEffect(()=>{
    if(!apiKey) return
    if(window.google){initMap();return}
    window.initMap=initMap
    const s=document.createElement('script')
    s.src=`https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
    s.async=true; document.head.appendChild(s)
    return ()=>{if(s.parentNode)s.parentNode.removeChild(s)}
  },[])

  useEffect(()=>{if(window.google)initMap()},[reports,focusReport,initMap])

  return (
    <div style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
      <div style={{ background:'#1e293b', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', direction:'rtl' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🗺 מפת דיווחים</span>
          {userRole==='אגם' && <div style={{ display:'flex', gap:8 }}>
            {ALL_COMPANIES.map(c=><span key={c} style={{ fontSize:11, color:COMPANY_CFG[c].mapColor }}>● {COMPANY_CFG[c].label}</span>)}
          </div>}
        </div>
        <span style={{ fontSize:11, color:'#94a3b8' }}>{reports.filter(r=>r.latitude&&!r.is_merged).length} דיווחים</span>
      </div>
      <div ref={mapRef} style={{ width:'100%', height:420 }}>
        {!apiKey&&<div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:13 }}>Google Maps API Key לא מוגדר</div>}
      </div>
    </div>
  )
}

function AuditHistory({reportId}:{reportId:string}) {
  const [entries,setEntries] = React.useState<any[]>([])
  React.useEffect(()=>{
    import('../lib/supabase').then(({supabase})=>{
      supabase.from('report_audit').select('*').eq('report_id',reportId).order('created_at',{ascending:false}).limit(10)
        .then(({data}:any)=>{ if(data) setEntries(data) })
    })
  },[reportId])
  if(entries.length===0) return <div style={{color:'var(--text-muted)',fontSize:11}}>אין היסטוריה</div>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:200,overflowY:'auto'}}>
      {entries.map((e:any)=>(
        <div key={e.id} style={{display:'flex',gap:8,alignItems:'center',fontSize:11,color:'var(--text-secondary)'}}>
          <span style={{color:'var(--text-muted)',flexShrink:0}}>{new Date(e.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
          <span style={{fontWeight:600,color:'var(--text-primary)'}}>{e.changed_by}</span>
          <span>{e.field_name}: </span>
          {e.old_value&&<span style={{textDecoration:'line-through',color:'#f87171'}}>{e.old_value}</span>}
          {e.new_value&&<span style={{color:'#4ade80',marginRight:4}}>{e.new_value}</span>}
        </div>
      ))}
    </div>
  )
}

function exportToCSV(reports:Report[]) {
  const headers=['עיר','רחוב','פלוגה','שעת דיווח','עדיפות','סטטוס','כוח מוקצה','נפגעים','מדווח','תוכן','קשר גיאוגרפי']
  const rows=reports.map(r=>[r.city,r.street,r.assigned_company||'',new Date(r.report_time).toLocaleString('he-IL'),r.priority||'רגיל',r.status||'חדש',r.assigned_unit||'',r.casualties??0,r.reported_by??'',r.report_content??'',r.geo_summary??''])
  const csv=[headers,...rows].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}))
  a.download=`דיווחים_${new Date().toLocaleDateString('he-IL').replace(/\//g,'-')}.csv`; a.click()
}

function exportDailySummary(reports:Report[],shifts:Shift[],userRole?:string) {
  const today=new Date().toLocaleDateString('he-IL')
  // Filter by company for non-HQ
  const companyReports = userRole && userRole !== 'אגם'
    ? reports.filter(r => r.assigned_company === userRole)
    : reports
  const active=companyReports.filter(r=>!r.is_merged)
  const open=active.filter(r=>!CLOSED_STATUSES.includes(r.status))
  const closed=active.filter(r=>CLOSED_STATUSES.includes(r.status))
  const falseReports=active.filter(r=>r.status==='נסגר כדיווח שווא')
  const withCasualties=active.filter(r=>(r.casualties||0)>0)
  const totalCasualties=active.reduce((a,r)=>a+(r.casualties||0),0)
  const noUnit=open.filter(r=>!r.assigned_unit)
  const noContent=open.filter(r=>!r.report_content)
  const longOpen=open.filter(r=>(new Date().getTime()-new Date(r.report_time).getTime())>3600000)
  const withGeo=active.filter(r=>r.geo_status!=='ללא קשר')

  // Response times
  const getResponseTime=(r:Report)=>{
    // Approximate from report_time — in production would use audit log timestamps
    return null
  }

  // City breakdown
  const cityCount:Record<string,number>={}
  active.forEach(r=>{cityCount[r.city]=(cityCount[r.city]||0)+1})
  const topCities=Object.entries(cityCount).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const html=`<html dir="rtl"><head><meta charset="utf-8"><title>סיכום יומי מורחב</title>
  <style>
    body{font-family:Arial;direction:rtl;padding:30px;font-size:12px;color:#1f2937}
    h1{font-size:22px;color:#0f172a;margin-bottom:4px}
    h2{font-size:15px;color:#1e293b;margin-top:24px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px}
    .meta{color:#6b7280;font-size:11px;margin-bottom:20px}
    .stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
    .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;text-align:center;min-width:80px}
    .stat-n{font-size:24px;font-weight:800;color:#1d4ed8}
    .stat-l{font-size:11px;color:#6b7280;margin-top:2px}
    .red{color:#dc2626}.green{color:#1d9e75}.orange{color:#d97706}.gray{color:#6b7280}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
    th{background:#0f172a;color:white;padding:7px 8px;text-align:right}
    td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even){background:#f9fafb}
    .badge{display:inline-block;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700}
    .flag{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:11px;color:#dc2626}
    .company-row{display:flex;gap:12px;margin-bottom:16px}
    .company-card{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center}
  </style>
  </head><body>
  <h1>סיכום יומי מורחב — ${today}</h1>
  <div class="meta">הופק: ${new Date().toLocaleString('he-IL')} | ${shifts.length} מטחים</div>

  <h2>סטטיסטיקות כלליות</h2>
  <div class="stats">
    <div class="stat"><div class="stat-n">${active.length}</div><div class="stat-l">סה"כ אירועים</div></div>
    <div class="stat"><div class="stat-n red">${open.length}</div><div class="stat-l">פתוחים</div></div>
    <div class="stat"><div class="stat-n green">${closed.length}</div><div class="stat-l">סגורים</div></div>
    <div class="stat"><div class="stat-n orange">${active.filter(r=>r.priority==='דחוף').length}</div><div class="stat-l">דחופים</div></div>
    <div class="stat"><div class="stat-n" style="color:#7c3aed">${totalCasualties}</div><div class="stat-l">נפגעים כולל</div></div>
    <div class="stat"><div class="stat-n" style="color:#7c3aed">${withCasualties.length}</div><div class="stat-l">אירועים עם נפגעים</div></div>
    <div class="stat"><div class="stat-n gray">${falseReports.length}</div><div class="stat-l">דיווחי שווא</div></div>
    <div class="stat"><div class="stat-n" style="color:#0891b2">${withGeo.length}</div><div class="stat-l">קשר גיאוגרפי</div></div>
  </div>
  ${closed.length>0?`<div style="font-size:11px;color:#6b7280;margin-bottom:16px">אחוז סגירה: <b>${Math.round((closed.length/active.length)*100)}%</b> | שווא מסגורים: <b>${closed.length>0?Math.round((falseReports.length/closed.length)*100):0}%</b></div>`:''}

  <h2>פילוח לפי פלוגה</h2>
  <div class="company-row">
    ${ALL_COMPANIES.map(c=>{
      const cfg=COMPANY_CFG[c]
      const cr=active.filter(r=>r.assigned_company===c)
      const co=cr.filter(r=>!CLOSED_STATUSES.includes(r.status))
      const cc=cr.filter(r=>CLOSED_STATUSES.includes(r.status))
      const ccas=cr.reduce((a,r)=>a+(r.casualties||0),0)
      return `<div class="company-card" style="border-color:${cfg.border}">
        <div style="font-weight:800;font-size:13px;color:${cfg.color};margin-bottom:8px">${cfg.label}</div>
        <div style="display:flex;justify-content:space-around">
          <div><div style="font-size:18px;font-weight:800;color:#dc2626">${co.length}</div><div style="font-size:10px;color:#6b7280">פתוחים</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#1d9e75">${cc.length}</div><div style="font-size:10px;color:#6b7280">סגורים</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#7c3aed">${ccas}</div><div style="font-size:10px;color:#6b7280">נפגעים</div></div>
        </div>
      </div>`
    }).join('')}
  </div>

  ${shifts.length>0?`
  <h2>מטחים היום</h2>
  <table><thead><tr><th>שם מטח</th><th>פתיחה</th><th>סגירה</th><th>אירועים</th><th>פתוחים</th></tr></thead><tbody>
    ${shifts.map(s=>{const sr=active.filter(r=>r.shift_id===s.id);const so=sr.filter(r=>!CLOSED_STATUSES.includes(r.status));return`<tr><td><b>${s.name}</b></td><td>${new Date(s.started_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</td><td>${s.ended_at?new Date(s.ended_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}):'<b style="color:#1d9e75">פעיל</b>'}</td><td>${sr.length}</td><td>${so.length}</td></tr>`}).join('')}
  </tbody></table>`:''}

  <h2>עומס גיאוגרפי — ערים</h2>
  <table><thead><tr><th>עיר</th><th>סה"כ</th><th>פתוחים</th><th>נפגעים</th></tr></thead><tbody>
    ${topCities.map(([city,count])=>{const cr=active.filter(r=>r.city===city);const co=cr.filter(r=>!CLOSED_STATUSES.includes(r.status));const ccas=cr.reduce((a,r)=>a+(r.casualties||0),0);return`<tr><td><b>${city}</b></td><td>${count}</td><td>${co.length}</td><td>${ccas}</td></tr>`}).join('')}
  </tbody></table>

  ${(noUnit.length>0||noContent.length>0||longOpen.length>0)?`
  <h2>דגלים מבצעיים</h2>
  ${noUnit.length>0?`<div class="flag">⚠️ ${noUnit.length} אירועים פתוחים ללא כוח מוקצה</div>`:''}
  ${noContent.length>0?`<div class="flag">⚠️ ${noContent.length} אירועים פתוחים ללא תיאור</div>`:''}
  ${longOpen.length>0?`<div class="flag">⏱ ${longOpen.length} אירועים פתוחים מעל שעה</div>`:''}
  `:''}

  <h2>אירועים פתוחים</h2>
  <table><thead><tr><th>פלוגה</th><th>עיר</th><th>רחוב</th><th>עדיפות</th><th>סטטוס</th><th>כוח</th><th>נפגעים</th><th>שעה</th></tr></thead><tbody>
    ${open.sort((a,b)=>PRIORITY_CFG[a.priority||'רגיל'].sort-PRIORITY_CFG[b.priority||'רגיל'].sort).map(r=>`<tr><td>${r.assigned_company?COMPANY_CFG[r.assigned_company as Company]?.label||r.assigned_company:'—'}</td><td>${r.city}</td><td>${r.street}</td><td>${r.priority||'רגיל'}</td><td>${r.status}</td><td>${r.assigned_unit||'—'}</td><td>${r.casualties||0}</td><td>${new Date(r.report_time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</td></tr>`).join('')}
  </tbody></table>

  ${closed.length>0?`
  <h2>אירועים שנסגרו</h2>
  <table><thead><tr><th>פלוגה</th><th>עיר</th><th>רחוב</th><th>סטטוס</th><th>סיבת סגירה</th><th>נפגעים</th></tr></thead><tbody>
    ${closed.map(r=>`<tr><td>${r.assigned_company?COMPANY_CFG[r.assigned_company as Company]?.label||r.assigned_company:'—'}</td><td>${r.city}</td><td>${r.street}</td><td>${r.status}</td><td>${r.close_reason||'—'}</td><td>${r.casualties||0}</td></tr>`).join('')}
  </tbody></table>`:''}

  </body></html>`
  // Show in modal instead of new tab
  const modal = document.createElement('div')
  modal.id = 'summary-modal'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;overflow-y:auto;direction:rtl'
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'background:#fff;max-width:900px;margin:20px auto;border-radius:12px;overflow:hidden'
  const header = document.createElement('div')
  header.style.cssText = 'background:#0f172a;padding:12px 20px;display:flex;justify-content:space-between;align-items:center'
  header.innerHTML = '<span style="color:#fff;font-weight:700;font-size:15px">סיכום יומי — ' + today + '</span><div style="display:flex;gap:8px"><button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:7px;padding:7px 16px;cursor:pointer;font-size:13px;font-family:Arial">הדפס</button><button id="close-summary" style="background:#334155;color:#fff;border:none;border-radius:7px;padding:7px 16px;cursor:pointer;font-size:13px;font-family:Arial">סגור</button></div>'
  const body = document.createElement('div')
  const cleanHtml = html.replace(/<html[^>]*>|<\/html>|<!DOCTYPE[^>]*>|<head>[\s\S]*?<\/head>|<body>|<\/body>/gi,'')
  body.innerHTML = cleanHtml
  wrapper.appendChild(header)
  wrapper.appendChild(body)
  modal.appendChild(wrapper)
  document.body.appendChild(modal)
  document.getElementById('close-summary')?.addEventListener('click', () => modal.remove())
}

type FormData={city:string;street:string;casualties:number;reported_by:string;report_content:string;forces_dispatched:string;status:ReportStatus;priority:Priority;assigned_unit:string;assigned_company:Company|''}
const emptyForm=():FormData=>({city:'',street:'',casualties:0,reported_by:'',report_content:'',forces_dispatched:'',status:'חדש',priority:'רגיל',assigned_unit:'',assigned_company:''})

function ReportForm({initial,onSubmit,onCancel,geocoding,userRole}:{initial?:FormData;onSubmit:(f:FormData)=>void;onCancel:()=>void;geocoding:boolean;userRole:UserRole}) {
  const [form,setForm]=useState<FormData>(initial??emptyForm())
  const [availableVehicles,setAvailableVehicles]=useState<{id:string;name:string;vehicle_type:string}[]>([])
  const set=(k:keyof FormData)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm(f=>({...f,[k]:e.target.value}))
  const handleUnit=(e:React.ChangeEvent<HTMLInputElement>)=>{const v=e.target.value;setForm(f=>({...f,assigned_unit:v,status:v.trim()&&f.status==='חדש'?'כוחות בדרך':f.status}))}

  // Load available vehicles for this company
  useEffect(()=>{
    const company = (userRole === 'אגם' ? form.assigned_company : userRole) as string
    if(!company) return
    supabase.from('vehicles').select('id,name,vehicle_type').eq('company',company).eq('is_available',true).order('name')
      .then(({data}:any)=>{ if(data) setAvailableVehicles(data) })
  },[form.assigned_company,userRole])
  const inp:React.CSSProperties={width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontFamily:'Arial,sans-serif',direction:'rtl',outline:'none',boxSizing:'border-box' as any}
  return (
    <div style={{direction:'rtl'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px'}}>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>עיר *</label><input style={inp} value={form.city} onChange={set('city')} placeholder="תל אביב"/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>רחוב *</label><input style={inp} value={form.street} onChange={set('street')} placeholder="הרצל 12"/></div>
        {userRole==='אגם'
          ? <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>פלוגה <span style={{color:'#e24b4a'}}>*</span></label>
              <select style={inp} value={form.assigned_company} onChange={set('assigned_company')}>
                <option value="">בחר פלוגה</option>
                {ALL_COMPANIES.map(c=><option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
              </select>
            </div>
          : <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>פלוגה</label>
              <input style={{...inp,background:'#f9fafb',color:'#6b7280'}} value={userRole} readOnly/>
            </div>
        }
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>עדיפות</label>
          <select style={inp} value={form.priority} onChange={set('priority')}>{ALL_PRIORITIES.map(p=><option key={p}>{p}</option>)}</select>
        </div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>סטטוס</label>
          <select style={inp} value={form.status} onChange={set('status')}>{ALL_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        </div>

        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>נפגעים</label><input style={inp} type="number" min={0} value={form.casualties} onChange={set('casualties')}/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>מדווח</label><input style={inp} value={form.reported_by} onChange={set('reported_by')} placeholder="שם המדווח"/></div>
        <div style={{gridColumn:'1 / -1'}}>
          <label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>כוחות / כוח מוקצה</label>
          {availableVehicles.length > 0 ? (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <select
                value={availableVehicles.find(v=>v.name===form.assigned_unit)?form.assigned_unit:'__other__'}
                onChange={e=>{
                  if(e.target.value==='__other__'){setForm(f=>({...f,assigned_unit:''}))}
                  else if(e.target.value){setForm(f=>({...f,assigned_unit:e.target.value,status:f.status==='חדש'?'כוחות בדרך':f.status}))}
                }}
                size={Math.min(availableVehicles.length+2, 5)}
                style={{...inp, height:'auto', overflow:'visible'}}>
                <option value="__other__">✏ הזן ידנית...</option>
                {availableVehicles.map(v=><option key={v.id} value={v.name}>{v.name} ({v.vehicle_type})</option>)}
              </select>
              {!availableVehicles.find(v=>v.name===form.assigned_unit) && (
                <input style={{...inp,marginTop:4}} value={form.assigned_unit} onChange={handleUnit} placeholder="כתוב שם כוח ידנית..."/>
              )}
            </div>
          ) : (
            <input style={inp} value={form.assigned_unit} onChange={handleUnit} placeholder="ניידת 3, אמבולנס, יחידה א..."/>
          )}
        </div>
        <div style={{gridColumn:'1 / -1'}}><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>תוכן דיווח</label><textarea style={{...inp,resize:'vertical',minHeight:58} as any} value={form.report_content} onChange={set('report_content')}/></div>
      </div>
      {geocoding&&<div style={{marginTop:10,padding:'8px 12px',background:'#eff6ff',borderRadius:7,fontSize:12,color:'#1d4ed8'}}>⏳ מבצע Geocoding...</div>}
      <div style={{display:'flex',gap:8,marginTop:14,justifyContent:'flex-end'}}>
        <button onClick={onCancel} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:13}}>ביטול</button>
        <button onClick={()=>{
          if(!form.city||!form.street){alert('עיר ורחוב הם שדות חובה');return;}
          if(userRole==='אגם'&&!form.assigned_company){alert('חובה לבחור פלוגה');return;}
          onSubmit(form)
        }} disabled={geocoding}
          style={{padding:'8px 22px',borderRadius:7,border:'none',background:geocoding?'#9ca3af':'#1d4ed8',color:'#fff',fontWeight:700,fontSize:13,cursor:geocoding?'default':'pointer'}}>
          {geocoding?'מבצע Geocoding...':initial?'עדכן דיווח':'שמור דיווח'}
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  const [reports,setReports]=useState<Report[]>([])
  const [shifts,setShifts]=useState<Shift[]>([])
  const [currentShift,setCurrentShift]=useState<Shift|null>(null)
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [editReport,setEditReport]=useState<Report|null>(null)
  const [relatedModal,setRelatedModal]=useState<Report|null>(null)
  const [commentsReport,setCommentsReport]=useState<Report|null>(null)
  const [auditReport,setAuditReport]=useState<Report|null>(null)
  const [closeReport,setCloseReport]=useState<Report|null>(null)
  const [focusReport,setFocusReport]=useState<Report|null>(null)
  const [toasts,setToasts]=useState<{id:number;msg:string;type:string}[]>([])
  const [geocoding,setGeocoding]=useState(false)
  const [showAdvSearch,setShowAdvSearch]=useState(false)
  const [search,setSearch]=useState('')
  const [filterGeoStatus,setFilterGeoStatus]=useState('')
  const [filterReportStatus,setFilterReportStatus]=useState('')
  const [filterPriority,setFilterPriority]=useState('')
  const [filterCity,setFilterCity]=useState('')
  const [filterCompany,setFilterCompany]=useState('')
  const [filterDateFrom,setFilterDateFrom]=useState('')
  const [filterDateTo,setFilterDateTo]=useState('')
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [showBulkClose,setShowBulkClose]=useState(false)
  const [showMerge,setShowMerge]=useState(false)
  const [showShiftModal,setShowShiftModal]=useState(false)
  const [userRole,setUserRole]=useState<UserRole>('אגם')
  const [mapKey,setMapKey]=useState(0)
  const [viewMode,setViewMode]=useState<'table'|'list'|'cards'>('table')
  const [expandedRow,setExpandedRow]=useState<string|null>(null)
  const [sidebarWidth,setSidebarWidth]=useState(200)
  const [darkMode,setDarkMode]=useState<boolean>(()=>{
    if(typeof window==='undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  // Apply theme to document
  useEffect(()=>{
    if(typeof document !== 'undefined'){
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    }
  },[darkMode])
  const router=useRouter()
  const mapSectionRef=useRef<HTMLDivElement>(null)

  useEffect(()=>{ setUserRole(getUserRole()) },[])

  const toast=useCallback((msg:string,type='warn')=>{const id=Date.now();setToasts(t=>[{id,msg,type},...t]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),6000)},[])

  const addLog=useCallback(async(content:string,reportId?:string)=>{
    await supabase.from('event_log').insert({
      entry_type:'auto',
      content,
      created_by:'מערכת',
      related_report_id:reportId||null,
      shift_id:currentShift?.id||null,
      reported_by_role:userRole,
      diary_date:new Date().toISOString().split('T')[0]
    })
  },[currentShift,userRole])


  const addAudit = useCallback(async (reportId: string, action: string, fieldName?: string, oldValue?: string, newValue?: string) => {
    await supabase.from('report_audit').insert({
      report_id: reportId,
      changed_by: 'מפעיל',
      changed_by_role: userRole,
      field_name: fieldName || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      action,
    })
  }, [userRole])

  const loadData=useCallback(async()=>{
    const [{data:reps},{data:sh}]=await Promise.all([
      supabase.from('reports').select('*').order('report_time',{ascending:false}),
      supabase.from('shifts').select('*').order('started_at',{ascending:false}),
    ])
    if(reps) setReports(reps as Report[])
    if(sh){setShifts(sh as Shift[]);setCurrentShift((sh as Shift[]).find(s=>s.is_active)||null)}
    setLoading(false)
  },[])

  useEffect(()=>{
    loadData()
    const ch=supabase.channel('v7').on('postgres_changes',{event:'*',schema:'public',table:'reports'},()=>loadData()).on('postgres_changes',{event:'*',schema:'public',table:'shifts'},()=>loadData()).subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[loadData])

  const handleLogout=async()=>{await fetch('/api/logout',{method:'POST'});router.push('/login')}
  const focusOnMap=(r:Report)=>{setFocusReport(r);mapSectionRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}


  const handleCloseWithReason = async (r: Report, status: ReportStatus, reason: string) => {
    const oldStatus = r.status
    await supabase.from('reports').update({ status, close_reason: reason || null }).eq('id', r.id)
    await supabase.from('report_audit').insert({ report_id: r.id, changed_by: 'מפעיל', changed_by_role: userRole, field_name: 'status', old_value: oldStatus, new_value: status, action: 'close' })
    const logMsg = `אירוע נסגר: ${r.street}, ${r.city} | סטטוס: ${status}${reason ? ' | סיבה: ' + reason : ''}`
    await addLog(logMsg, r.id)
    toast(`${r.street} נסגר — ${status}`, 'ok')
    loadData()
  }

  const quickUpdate=async(id:string,fields:Partial<Report>,logMsg?:string)=>{
    const r = reports.find(x=>x.id===id)
    if(r && fields.status && fields.status !== r.status) {
      await supabase.from('report_audit').insert({report_id:id,changed_by:'מפעיל',changed_by_role:userRole,field_name:'status',old_value:r.status,new_value:fields.status as string,action:'update'})
      await addLog(`סטטוס שונה: ${r.street}, ${r.city} | ${r.status} → ${fields.status}`,id)
    }
    if(r && fields.priority && fields.priority !== r.priority) {
      await supabase.from('report_audit').insert({report_id:id,changed_by:'מפעיל',changed_by_role:userRole,field_name:'priority',old_value:r.priority,new_value:fields.priority as string,action:'update'})
      await addLog(`עדיפות שונתה: ${r.street}, ${r.city} | ${r.priority} → ${fields.priority}`,id)
    }
    await supabase.from('reports').update(fields).eq('id',id)
    if(logMsg) await addLog(logMsg,id)
    loadData()
  }

  const handleUnitUpdate=async(r:Report,unit:string)=>{
    const newStatus=unit.trim()&&r.status==='חדש'?'כוחות בדרך':r.status
    await supabase.from('reports').update({assigned_unit:unit,status:newStatus}).eq('id',r.id)
    if(unit.trim()){
      await supabase.from('report_audit').insert({report_id:r.id,changed_by:'מפעיל',changed_by_role:userRole,field_name:'assigned_unit',old_value:r.assigned_unit||'',new_value:unit,action:'update'})
      await addLog(`כוח הוקצה: "${unit}" לאירוע ${r.street}, ${r.city}${newStatus==='כוחות בדרך'?' | סטטוס עודכן אוטומטית לכוחות בדרך':''}`,r.id)
    }
    loadData()
  }

  const handleBulkClose=async(status:ReportStatus)=>{
    for(const id of selectedIds){const r=reports.find(x=>x.id===id);await supabase.from('reports').update({status}).eq('id',id);if(r)await addLog(`אירוע נסגר (${status}): ${r.street}, ${r.city}`,id)}
    setSelectedIds([]);setShowBulkClose(false);toast(`${selectedIds.length} אירועים נסגרו`,'ok');loadData()
  }

  const handleMerge=async(keepId:string,mergeId:string)=>{
    const keep=reports.find(r=>r.id===keepId),merge=reports.find(r=>r.id===mergeId)
    if(!keep||!merge) return
    const mergedStreet=`${keep.street} / ${merge.street}`
    const mergedContent=[keep.report_content,merge.report_content].filter(Boolean).join(' | ')
    const mergedForces=[keep.forces_dispatched,merge.forces_dispatched].filter(Boolean).join(' | ')
    const mergedUnit=[keep.assigned_unit,merge.assigned_unit].filter(Boolean).join(', ')
    const mergedCasualties=(keep.casualties||0)+(merge.casualties||0)
    await supabase.from('reports').update({
      street:mergedStreet,
      location_text:`${mergedStreet}, ${keep.city}`,
      casualties:mergedCasualties,
      report_content:mergedContent||null,
      forces_dispatched:mergedForces||null,
      assigned_unit:mergedUnit||null,
      merged_with:[...(keep.merged_with||[]),mergeId]
    }).eq('id',keepId)
    await supabase.from('reports').update({is_merged:true}).eq('id',mergeId)
    await addLog(`אירועים אוחדו: ${keep.street} + ${merge.street} → ${mergedStreet}`,keepId)
    setSelectedIds([]);setShowMerge(false);toast(`האירועים אוחדו: ${mergedStreet}`,'ok');loadData()
  }

  const handleStartShift=async(name:string)=>{
    if(currentShift) await supabase.from('shifts').update({is_active:false,ended_at:new Date().toISOString()}).eq('id',currentShift.id)
    const {data:newShift}=await supabase.from('shifts').insert({name,date:new Date().toISOString().split('T')[0],is_active:true,started_at:new Date().toISOString()}).select().single()
    if(newShift){
      // Transfer only open (non-closed) reports to new shift
      const openReports = reports.filter(r => !CLOSED_STATUSES.includes(r.status) && !r.is_merged)
      for(const r of openReports){
        await supabase.from('reports').update({shift_id:(newShift as Shift).id}).eq('id',r.id)
      }
      await addLog(`מטח חדש נפתח: "${name}" — ${openReports.length} אירועים פתוחים הועברו, סגורים נשמרו בארכיון`)
      toast(`מטח "${name}" נפתח — ${openReports.length} אירועים פתוחים הועברו`,'ok')
    }
    setShowShiftModal(false)
    setFocusReport(null)
    setMapKey(k => k + 1)
    loadData()
  }

  const handleCreate=async(form:FormData)=>{
    setGeocoding(true)
    const coords=await geocodeAddress(form.street,form.city)
    setGeocoding(false)
    if(!coords) toast('Geocoding נכשל','warn')
    const company = userRole==='אגם'?form.assigned_company as Company||null:userRole as Company
    if(userRole==='אגם'&&!company){
      toast('חובה לבחור פלוגה','warn')
      setGeocoding(false)
      return
    }
    const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.street+','+form.city+',Israel')}`
    const newReport={
      city:form.city,street:form.street,location_text:`${form.street}, ${form.city}`,maps_url:mapsUrl,
      report_time:new Date().toISOString(),casualties:Number(form.casualties)||0,
      reported_by:form.reported_by||null,report_content:form.report_content||null,forces_dispatched:form.forces_dispatched||null,
      status:form.status||'חדש',priority:form.priority||'רגיל',assigned_unit:form.assigned_unit||null,
      assigned_company:company,shift_id:currentShift?.id||null,
      latitude:coords?.lat??null,longitude:coords?.lng??null,
      geo_status:'ללא קשר' as GeoStatus,geo_related_reports:[],geo_summary:coords?'':'geocoding נכשל',geo_distance_meters:null,
      is_merged:false,merged_with:[],
    }
    const {data:inserted}=await supabase.from('reports').insert(newReport).select().single()
    if(!inserted){toast('שגיאה בשמירת הדיווח','warn');return}
    const allWithNew=[...reports,inserted as Report]
    const currentShiftOnly=[...currentShiftReports.filter(r=>r.id!==inserted.id),(inserted as Report)]
    const geoFields=computeGeoFields(inserted as Report,currentShiftOnly)
    await supabase.from('reports').update(geoFields).eq('id',inserted.id)
    await addAudit(inserted.id, 'create')
    await addLog(`אירוע חדש: ${form.street}, ${form.city} | ${company||'ללא פלוגה'} | עדיפות: ${form.priority}`,inserted.id)
    if(geoFields.geo_status!=='ללא קשר'){
      toast(`נמצא קשר גיאוגרפי: ${geoFields.geo_summary}`,'warn')
      for(const relId of geoFields.geo_related_reports){const rel=allWithNew.find(r=>r.id===relId);if(rel)await supabase.from('reports').update(computeGeoFields(rel,allWithNew)).eq('id',relId)}
    } else {toast(`הדיווח נשמר: ${form.street}, ${form.city}`,'ok')}
    setShowForm(false); loadData()
  }

  const handleUpdate=async(form:FormData)=>{
    if(!editReport) return
    setGeocoding(true)
    let lat=editReport.latitude,lng=editReport.longitude
    if(form.street!==editReport.street||form.city!==editReport.city){const coords=await geocodeAddress(form.street,form.city);if(coords){lat=coords.lat;lng=coords.lng}}
    setGeocoding(false)
    const company=userRole==='אגם'?form.assigned_company as Company||null:userRole as Company
    const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.street+','+form.city+',Israel')}`
    const updated={...form,latitude:lat,longitude:lng,maps_url:mapsUrl,location_text:`${form.street}, ${form.city}`,assigned_company:company}
    const geoFields=computeGeoFields({...editReport,...updated} as Report,reports)
    await supabase.from('reports').update({...updated,...geoFields}).eq('id',editReport.id)
    await addLog(`אירוע עודכן: ${form.street}, ${form.city}`,editReport.id)
    setEditReport(null); loadData()
  }

  const handleDelete=async(id:string)=>{
    if(!confirm('למחוק את הדיווח?')) return
    const r=reports.find(x=>x.id===id)
    await supabase.from('reports').delete().eq('id',id)
    const remaining=reports.filter(r=>r.id!==id)
    const recomputed=recomputeAllGeo(remaining)
    for(const rep of recomputed){const orig=remaining.find(x=>x.id===rep.id);if(orig&&(orig.geo_status!==rep.geo_status||JSON.stringify(orig.geo_related_reports)!==JSON.stringify(rep.geo_related_reports))){await supabase.from('reports').update({geo_status:rep.geo_status,geo_related_reports:rep.geo_related_reports,geo_summary:rep.geo_summary,geo_distance_meters:rep.geo_distance_meters}).eq('id',rep.id)}}
    if(r) await addLog(`אירוע נמחק: ${r.street}, ${r.city}`)
    loadData()
  }

  // Filter by role
  const roleFilteredReports = userRole==='אגם'?reports:reports.filter(r=>r.assigned_company===userRole)

  // Show only current shift reports in main table (or all if no shift)
  const currentShiftReports = currentShift
    ? roleFilteredReports.filter(r => r.shift_id === currentShift.id && !r.is_merged)
    : roleFilteredReports.filter(r => !r.is_merged)
  const sortedReports=[...currentShiftReports].sort((a,b)=>{
    // Closed reports always go to bottom
    const aClosed = CLOSED_STATUSES.includes(a.status)
    const bClosed = CLOSED_STATUSES.includes(b.status)
    if (aClosed && !bClosed) return 1
    if (!aClosed && bClosed) return -1
    const pa=PRIORITY_CFG[a.priority||'רגיל'].sort,pb=PRIORITY_CFG[b.priority||'רגיל'].sort
    if(pa!==pb) return pa-pb
    return new Date(b.report_time).getTime()-new Date(a.report_time).getTime()
  })
  // Clear geo links that point to reports from other shifts
  const currentShiftIds = new Set(currentShiftReports.map(r => r.id))
  const reportsWithCleanGeo = sortedReports.map(r => {
    if (!r.geo_related_reports?.length) return r
    const validRelated = r.geo_related_reports.filter(id => currentShiftIds.has(id))
    if (validRelated.length === r.geo_related_reports.length) return r
    return {
      ...r,
      geo_related_reports: validRelated,
      geo_status: validRelated.length === 0 ? 'ללא קשר' as const : r.geo_status,
      geo_summary: validRelated.length === 0 ? '' : r.geo_summary,
    }
  })

  // Group geo-related reports together
  const geoGrouped: Report[] = []
  const addedIds = new Set<string>()
  reportsWithCleanGeo.forEach(r => {
    if (addedIds.has(r.id)) return
    geoGrouped.push(r)
    addedIds.add(r.id)
    if (r.geo_status !== 'ללא קשר' && r.geo_related_reports?.length) {
      r.geo_related_reports.forEach(relId => {
        const rel = reportsWithCleanGeo.find(x => x.id === relId && !addedIds.has(x.id))
        if (rel) { geoGrouped.push(rel); addedIds.add(rel.id) }
      })
    }
  })

  const filtered=geoGrouped.filter(r=>{
    const s=`${r.city} ${r.street} ${r.report_content??''} ${r.assigned_unit??''}`.toLowerCase()
    const rDate=new Date(r.report_time)
    return (!search||s.includes(search.toLowerCase()))&&(!filterGeoStatus||r.geo_status===filterGeoStatus)&&(!filterReportStatus||r.status===filterReportStatus)&&(!filterPriority||r.priority===filterPriority)&&(!filterCity||r.city===filterCity)&&(!filterCompany||r.assigned_company===filterCompany)&&(!filterDateFrom||rDate>=new Date(filterDateFrom))&&(!filterDateTo||rDate<=new Date(filterDateTo+'T23:59:59'))
  })

  const toggleSelect=(id:string)=>setSelectedIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
  const toggleSelectAll=()=>setSelectedIds(s=>s.length===filtered.length?[]:filtered.map(r=>r.id))

  const cities=roleFilteredReports.filter(r=>!r.is_merged).map(r=>r.city).filter((v,i,a)=>v&&a.indexOf(v)===i)
  const openCount=currentShiftReports.filter(r=>!CLOSED_STATUSES.includes(r.status)&&!r.is_merged).length
  const criticalCount=currentShiftReports.filter(r=>r.priority==='דחוף'&&!CLOSED_STATUSES.includes(r.status)&&!r.is_merged).length
  const hasActiveFilters=search||filterGeoStatus||filterReportStatus||filterPriority||filterCity||filterCompany||filterDateFrom||filterDateTo

  const isHQ=userRole==='אגם'
  const roleColor=isHQ?'#ba7517':COMPANY_CFG[userRole as Company]?.color||'#185fa5'
  const roleBg=isHQ?'#faeeda':COMPANY_CFG[userRole as Company]?.bg||'#e6f1fb'

  const cell:React.CSSProperties={padding:'9px 10px',fontSize:12,borderBottom:'1px solid var(--border)',verticalAlign:'middle',color:'var(--text-primary)'}
  const thStyle:React.CSSProperties={padding:'8px 10px',fontSize:11,fontWeight:700,color:'var(--text-secondary)',background:'var(--bg-tertiary)',textAlign:'right',whiteSpace:'nowrap',borderBottom:'1px solid var(--border)'}
  const inp:React.CSSProperties={border:'1px solid #d1d5db',borderRadius:7,padding:'7px 10px',fontSize:13,direction:'rtl',outline:'none'}

  return (
    <div style={{direction:'rtl',minHeight:'100vh',background:'var(--bg-secondary)',color:'var(--text-primary)',fontFamily:"'Rubik',Arial,sans-serif",paddingBottom:80,paddingRight:sidebarWidth,transition:'padding-right 0.2s'}}>
      <Toast items={toasts} onDismiss={id=>setToasts(t=>t.filter(x=>x.id!==id))}/>
      <RelatedModal report={relatedModal} all={reports} onClose={()=>setRelatedModal(null)}/>
      {closeReport&&<CloseReasonModal report={closeReport} onConfirm={async(status,reason)=>{await handleCloseWithReason(closeReport,status,reason);setCloseReport(null)}} onClose={()=>setCloseReport(null)}/>}
      {auditReport&&<AuditModal reportId={auditReport.id} reportLabel={auditReport.street+', '+auditReport.city} onClose={()=>setAuditReport(null)}/>}
      {commentsReport&&<CommentsModal report={commentsReport} onClose={()=>setCommentsReport(null)} onLogEntry={(c,id)=>addLog(c,id)}/>}
      {showBulkClose&&<BulkCloseModal count={selectedIds.length} onConfirm={handleBulkClose} onClose={()=>setShowBulkClose(false)}/>}
      {showMerge&&<MergeModal reports={reports} selectedIds={selectedIds} onConfirm={handleMerge} onClose={()=>setShowMerge(false)}/>}
      {showShiftModal&&<ShiftModal currentShift={currentShift} onStart={handleStartShift} onClose={()=>setShowShiftModal(false)}/>}

      {/* Header */}
      <div style={{background:'var(--header-bg)',padding:'10px 22px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>

          <button onClick={()=>setDarkMode(d=>!d)} title='מצב יום/לילה' style={{background:'none',color:'#94a3b8',border:'1px solid #334155',borderRadius:8,padding:'7px 10px',fontSize:13,cursor:'pointer'}}>{darkMode?'☀️':'🌙'}</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <Image src="/logo.png" alt="ISR-1" width={48} height={48} style={{borderRadius:'50%'}}/>
          <div style={{color:'#fff',fontWeight:700,fontSize:14,textAlign:'center'}}>מערכת ניהול אירועים</div>
          <div style={{background:roleBg,color:roleColor,borderRadius:20,padding:'2px 12px',fontSize:12,fontWeight:700}}>
            {isHQ?'אג"ם — מפקד יחידה':COMPANY_CFG[userRole as Company]?.label}
          </div>
          {currentShift&&<div style={{background:'#1e3a5f',borderRadius:20,padding:'2px 10px',fontSize:11,color:'#93c5fd'}}>מטח: {currentShift.name} | {currentShiftReports.length} אירועים</div>}
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center'}}>
          {currentShiftReports.filter(r=>r.priority==='דחוף'&&!CLOSED_STATUSES.includes(r.status)).length>0&&<div style={{background:'#450a0a',borderRadius:8,padding:'6px 12px',textAlign:'center'}}><div style={{fontSize:20,fontWeight:800,color:'#f87171'}}>{currentShiftReports.filter(r=>r.priority==='דחוף'&&!CLOSED_STATUSES.includes(r.status)).length}</div><div style={{fontSize:10,color:'#94a3b8'}}>דחופים</div></div>}
          <div style={{background:'#1e293b',borderRadius:8,padding:'6px 12px',textAlign:'center'}}><div style={{fontSize:20,fontWeight:800,color:'#60a5fa'}}>{currentShiftReports.filter(r=>!CLOSED_STATUSES.includes(r.status)).length}</div><div style={{fontSize:10,color:'#94a3b8'}}>פתוחים</div></div>

        </div>
      </div>

      {/* Stats */}
      <div style={{background:'#1e293b',padding:'8px 22px',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
        {[
          {n:roleFilteredReports.filter(r=>!r.is_merged).length,l:'סה"כ',c:'#60a5fa'},
          {n:roleFilteredReports.filter(r=>r.priority==='דחוף'&&!r.is_merged).length,l:'דחוף',c:'#f87171'},
          {n:openCount,l:'פתוחים',c:'#a78bfa'},
          {n:roleFilteredReports.reduce((a,r)=>a+(r.casualties||0),0),l:'נפגעים',c:'#f09595'},
        ].map(s=><div key={s.l} style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:18,fontWeight:700,color:s.c}}>{s.n}</span><span style={{fontSize:11,color:'#94a3b8'}}>{s.l}</span></div>)}
        {isHQ&&ALL_COMPANIES.map(c=>{
          const count=reports.filter(r=>r.assigned_company===c&&!r.is_merged).length
          const cfg=COMPANY_CFG[c]
          return <div key={c} style={{display:'flex',alignItems:'center',gap:5,background:cfg.bg+'33',borderRadius:20,padding:'3px 10px'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:cfg.mapColor,display:'inline-block'}}/>
            <span style={{fontSize:12,color:cfg.color,fontWeight:700}}>{cfg.label}: {count}</span>
          </div>
        })}
      </div>

      <div style={{padding:16}}>
        {(showForm||editReport)&&(
          <div style={{background:'#fff',borderRadius:12,padding:18,marginBottom:14,border:'1px solid #e5e7eb'}}>
            <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>{editReport?'עריכת דיווח':'דיווח חדש'}</h3>
            <ReportForm
              initial={editReport?{city:editReport.city,street:editReport.street,casualties:editReport.casualties,reported_by:editReport.reported_by??'',report_content:editReport.report_content??'',forces_dispatched:editReport.forces_dispatched??'',status:(editReport.status||'חדש') as ReportStatus,priority:(editReport.priority||'רגיל') as Priority,assigned_unit:editReport.assigned_unit??'',assigned_company:(editReport.assigned_company as Company)||''}:undefined}
              onSubmit={editReport?handleUpdate:handleCreate}
              onCancel={()=>{setShowForm(false);setEditReport(null)}}
              geocoding={geocoding} userRole={userRole}
            />
          </div>
        )}

        {selectedIds.length>0&&(
          <div style={{background:'#0f172a',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',gap:8,alignItems:'center',direction:'rtl',border:'1px solid #1e293b'}}>
            <span style={{fontSize:13,color:'#94a3b8'}}>{selectedIds.length} אירועים נבחרו</span>
            <button onClick={()=>setShowBulkClose(true)} style={{background:'#166534',color:'#86efac',border:'1px solid #15803d',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ סגור את כולם</button>
            {selectedIds.length===2&&<button onClick={()=>setShowMerge(true)} style={{background:'#3c3489',color:'#afa9ec',border:'1px solid #534ab7',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>⟷ איחוד כתובות</button>}
            <button onClick={()=>setSelectedIds([])} style={{background:'none',color:'#94a3b8',border:'1px solid #334155',borderRadius:7,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>ביטול</button>
          </div>
        )}

        {/* Filters */}
        <div style={{background: darkMode?'#0f172a':'#fff',borderRadius:10,padding:'10px 14px',marginBottom:12,border:`1px solid ${darkMode?'#1e293b':'#e5e7eb'}`}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:2,background:'var(--bg-tertiary)',borderRadius:8,padding:2}}>
              {(['table','list','cards'] as const).map(mode=>(
                <button key={mode} onClick={()=>setViewMode(mode)}
                  title={mode==='table'?'תצוגת טבלה':mode==='list'?'תצוגת רשימה':'תצוגת קלפים'}
                  style={{background:viewMode===mode?'var(--bg-card)':'transparent',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:15,color:viewMode===mode?'var(--accent)':'var(--text-muted)'}}>
                  {mode==='table'?'⊞':mode==='list'?'☰':'⊟'}
                </button>
              ))}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="חיפוש חופשי..."  style={{...inp,width:160}}/>
            <select value={filterReportStatus} onChange={e=>setFilterReportStatus(e.target.value)} style={inp}>
              <option value="">כל הסטטוסים</option>
              {ALL_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={inp}>
              <option value="">כל העדיפויות</option>
              {ALL_PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
            {isHQ&&<select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)} style={inp}>
              <option value="">כל הפלוגות</option>
              {ALL_COMPANIES.map(c=><option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
            </select>}
            <select value={filterCity} onChange={e=>setFilterCity(e.target.value)} style={inp}>
              <option value="">כל הערים</option>
              {cities.map(c=><option key={c}>{c}</option>)}
            </select>
            <button onClick={()=>setShowAdvSearch(!showAdvSearch)} style={{...inp,background:showAdvSearch?'#eff6ff':'#fff',color:showAdvSearch?'#1d4ed8':'#374151',cursor:'pointer'}}>🔍 {showAdvSearch?'▲':'▼'}</button>
            {hasActiveFilters&&<button onClick={()=>{setSearch('');setFilterGeoStatus('');setFilterReportStatus('');setFilterPriority('');setFilterCity('');setFilterCompany('');setFilterDateFrom('');setFilterDateTo('')}} style={{...inp,background:'#fef2f2',color:'#dc2626',cursor:'pointer',border:'1px solid #fecaca'}}>✕</button>}
            <span style={{fontSize:12,color:'#6b7280',marginRight:'auto'}}>{filtered.length} דיווחים</span>
          </div>
          {showAdvSearch&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f0f0f0',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}><label style={{fontSize:12,color:'#6b7280'}}>מתאריך:</label><input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={inp}/></div>
              <div style={{display:'flex',alignItems:'center',gap:6}}><label style={{fontSize:12,color:'#6b7280'}}>עד:</label><input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={inp}/></div>
              <select value={filterGeoStatus} onChange={e=>setFilterGeoStatus(e.target.value)} style={inp}>
                <option value="">כל קשרי הגיאו</option>
                {(['מצטלבים','מקבילים','רחובות קרובים','ללא קשר'] as GeoStatus[]).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{background:'var(--bg-card)',borderRadius:12,border:'1px solid var(--border)',overflow:'hidden',marginBottom:18}}>
          {loading?<div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>טוען...</div>
            :filtered.length===0?<div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>{reports.length===0?'אין דיווחים — לחץ + דיווח חדש':'לא נמצאו תוצאות'}</div>
            :(
            <>
            {viewMode==='cards'&&(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12,padding:'0 0 16px'}}>
                {filtered.map(r=>{
                  const pc=PRIORITY_CFG[r.priority||'רגיל']
                  const sc=STATUS_CFG[r.status]
                  const isClosed=CLOSED_STATUSES.includes(r.status)
                  return (
                    <div key={r.id} onClick={()=>{focusOnMap(r);setExpandedRow(x=>x===r.id?null:r.id)}}
                      style={{background:'var(--bg-card)',border:`1px solid var(--border)`,borderRadius:12,padding:14,cursor:'pointer',opacity:isClosed?0.6:1,borderTop:`3px solid ${pc?.color||'#94a3b8'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div style={{fontWeight:700,fontSize:13,color:'var(--text-primary)'}}>{r.street}, {r.city}</div>
                        <span style={{background:sc?.bg||'var(--bg-tertiary)',color:sc?.color||'var(--text-muted)',borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:600,flexShrink:0,marginRight:4}}>{r.status}</span>
                      </div>
                      <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap'}}>
                        <span style={{background:pc?.bg,color:pc?.color,borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700}}>{r.priority||'רגיל'}</span>
                        {r.assigned_company&&<span style={{background:'var(--accent-light)',color:'var(--accent)',borderRadius:20,padding:'1px 7px',fontSize:10}}>{r.assigned_company}</span>}
                        {(r.casualties||0)>0&&<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:20,padding:'1px 7px',fontSize:10}}>🩺 {r.casualties}</span>}
                      </div>
                      {r.report_content&&<div style={{fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6}}>{r.report_content.slice(0,100)}{r.report_content.length>100?'...':''}</div>}
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)'}}>
                        <span>{r.assigned_unit||'ללא כוח'}</span>
                        <span>{new Date(r.report_time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                      {expandedRow===r.id&&<div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}><AuditHistory reportId={r.id}/></div>}
                    </div>
                  )
                })}
              </div>
            )}

            {viewMode==='list'&&(
              <div style={{display:'flex',flexDirection:'column',gap:3,padding:'0 0 16px'}}>
                {filtered.map(r=>{
                  const pc=PRIORITY_CFG[r.priority||'רגיל']
                  const sc=STATUS_CFG[r.status]
                  const isClosed=CLOSED_STATUSES.includes(r.status)
                  const isExp=expandedRow===r.id
                  return (
                    <div key={r.id} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',opacity:isClosed?0.6:1}}>
                      <div onClick={()=>{focusOnMap(r);setExpandedRow(x=>x===r.id?null:r.id)}}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',borderRight:`4px solid ${pc?.color||'#94a3b8'}`}}>
                        <span style={{color:'var(--text-muted)',fontSize:14}}>{isExp?'▾':'▸'}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:13,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.street}, {r.city}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{r.assigned_unit||'ללא כוח'} · {new Date(r.report_time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                        <span style={{background:pc?.bg,color:pc?.color,borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700,flexShrink:0}}>{r.priority||'רגיל'}</span>
                        <span style={{background:sc?.bg||'var(--bg-tertiary)',color:sc?.color||'var(--text-secondary)',borderRadius:20,padding:'2px 8px',fontSize:11,flexShrink:0}}>{r.status}</span>
                      </div>
                      {isExp&&(
                        <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',background:'var(--accent-light)'}}>
                          {r.report_content&&<div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8}}>{r.report_content}</div>}
                          <AuditHistory reportId={r.id}/>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {viewMode==='table'&&<div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:isHQ?1200:1100}}>
                <thead>
                  <tr>
                    <th style={{...thStyle,textAlign:'center',width:36}}><input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={toggleSelectAll} style={{cursor:'pointer'}}/></th>
                    {['עדיפות','עיר','רחוב','שעה',...(isHQ?['פלוגה']:[]  ),'סטטוס','כוח','נפגעים','תוכן','🔴 גיאו','🧠 פירוט','קשור','💬','📋','נווט','פעולות'].map(h=>(
                      <th key={h} style={{...thStyle,textAlign:['נפגעים','נווט','פעולות','💬'].includes(h)?'center':'right'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r=>{
                    const isSelected=selectedIds.includes(r.id)
                    const company=r.assigned_company as Company|null
                    const companyCfg=company&&COMPANY_CFG[company]?COMPANY_CFG[company]:null
                    const isGeoRelated = r.geo_status !== 'ללא קשר'
                    const rowBg=isSelected?'var(--accent-light)':r.priority==='דחוף'&&!CLOSED_STATUSES.includes(r.status)?'rgba(226,75,74,0.08)':focusReport?.id===r.id?'rgba(55,138,221,0.08)':isGeoRelated?'rgba(250,199,117,0.08)':'var(--bg-card)'
                    const borderTop = isGeoRelated ? '2px solid #fac775' : undefined
                    const pc=PRIORITY_CFG[r.priority||'רגיל'],sc=STATUS_CFG[r.status||'חדש']
                    const hasGeo=r.geo_status!=='ללא קשר'
                    const navUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((r.location_text||r.street+','+r.city)+',Israel')}`
                    return(
                      <tr key={r.id} style={{background:rowBg,borderTop,cursor:'pointer'}} onClick={()=>{focusOnMap(r);setExpandedRow(x=>x===r.id?null:r.id)}}>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(r.id)} style={{cursor:'pointer'}}/></td>
                        <td style={cell} onClick={e=>e.stopPropagation()}>
                          <select value={r.priority||'רגיל'} onChange={e=>quickUpdate(r.id,{priority:e.target.value as Priority})}
                            style={{border:`1px solid ${pc.border}`,borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,background:pc.bg,color:pc.color,cursor:'pointer',outline:'none',direction:'rtl'}}>
                            {ALL_PRIORITIES.map(p=><option key={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={cell} onClick={()=>focusOnMap(r)}>
                          <b style={{borderRight:companyCfg?`3px solid ${companyCfg.mapColor}`:'none',paddingRight:companyCfg?6:0,color:'var(--text-primary)'}}>{r.city}</b>
                        </td>
                        <td style={{...cell,color:'var(--text-primary)'}} onClick={()=>focusOnMap(r)}>{r.street}</td>
                        <td style={{...cell,whiteSpace:'nowrap',color:'var(--text-secondary)',fontSize:11}}>{new Date(r.report_time).toLocaleString('he-IL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</td>
                        {isHQ&&<td style={cell} onClick={e=>e.stopPropagation()}><CompanyBadge company={company}/></td>}
                        <td style={cell} onClick={e=>e.stopPropagation()}>
                          <select value={r.status||'חדש'} onChange={e=>quickUpdate(r.id,{status:e.target.value as ReportStatus})}
                            style={{border:`1px solid ${sc.border}`,borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,background:sc.bg,color:sc.color,cursor:'pointer',outline:'none',direction:'rtl',maxWidth:110}}>
                            {ALL_STATUSES.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{...cell,maxWidth:100}} onClick={e=>e.stopPropagation()}>
                          <input defaultValue={r.assigned_unit||''} onBlur={e=>{if(e.target.value!==r.assigned_unit)handleUnitUpdate(r,e.target.value)}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} placeholder="הוסף כוח..."
                            style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:6,padding:'3px 7px',fontSize:11,direction:'rtl',outline:'none',background:'transparent'}}/>
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {(r.casualties??0)>0?<span style={{background:'#fee2e2',color:'#dc2626',borderRadius:20,padding:'2px 7px',fontSize:11,fontWeight:700}}>{r.casualties}</span>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,maxWidth:200}} onClick={()=>focusOnMap(r)}><span style={{display:'block',fontSize:11,whiteSpace:'pre-wrap',wordBreak:'break-word',maxWidth:190,lineHeight:'1.4'}}>{r.report_content||<span style={{color:'#d1d5db'}}>—</span>}</span></td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {r.merged_with?.length ? <span style={{fontSize:11,color:'#7f77dd',fontWeight:600}}>⟷ מאוחד</span> : <GeoBadge status={r.geo_status}/>}
                        </td>
                        <td style={cell}>
                          {r.merged_with?.length ? <span style={{fontSize:11,color:'#9ca3af'}}>כתובות אוחדו</span>
                            : r.geo_summary?<span style={{fontSize:11,fontWeight:hasGeo?600:400,color:hasGeo?'#dc2626':'#6b7280'}}>{r.geo_summary}</span>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {!r.merged_with?.length && r.geo_related_reports?.length?<button onClick={()=>setRelatedModal(r)} style={{background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:7,padding:'3px 7px',fontSize:11,cursor:'pointer',fontWeight:600}}>צפה ({r.geo_related_reports.length})</button>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setCommentsReport(r)} style={{background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:7,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>💬</button>
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setAuditReport(r)} style={{background:'#fafafa',color:'#6b7280',border:'1px solid #e5e7eb',borderRadius:7,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>📋</button>
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <a href={navUrl} target="_blank" rel="noreferrer" style={{display:'inline-block',background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:7,padding:'3px 7px',fontSize:11,textDecoration:'none',fontWeight:600}}>🧭</a>
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',gap:3,justifyContent:'center'}}>
                            <button onClick={()=>{setEditReport(r);setShowForm(false);window.scrollTo(0,0)}} style={{background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:6,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>עריכה</button>
                            <button onClick={()=>handleDelete(r.id)} style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:6,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>מחק</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}
            </>
          )}
        </div>

        <div ref={mapSectionRef}>
          <InteractiveMap key={mapKey} reports={currentShiftReports} focusReport={focusReport} userRole={userRole}/>
        </div>
      </div>
      <SideNav
        onNewShift={isHQ?()=>setShowShiftModal(true):undefined}
        onSummary={()=>exportDailySummary(reports,shifts,userRole)}
        onExcel={()=>exportToCSV(filtered)}
        currentShiftName={currentShift?.name}
        onWidthChange={setSidebarWidth}
        darkMode={darkMode}
        onToggleDark={()=>setDarkMode(d=>!d)}
      />
      <BottomNav onNewReport={()=>{setShowForm(true);setEditReport(null);window.scrollTo(0,0)}} onSummary={()=>exportDailySummary(reports,shifts,userRole)} onNewShift={()=>setShowShiftModal(true)}/>
    </div>
  )
}
