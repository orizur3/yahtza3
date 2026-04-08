'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Vehicle, Personnel, PersonnelRole, COMPANY_CFG, ALL_COMPANIES, Company } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '../../components/BottomNav'
import SideNav from '../../components/SideNav'

function getUserRole(): string {
  if (typeof document === 'undefined') return 'אגם'
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = decodeURIComponent(v || '')
    return acc
  }, {} as Record<string, string>)
  return cookies['user_role'] || 'אגם'
}

const VEHICLE_TYPES = ['סילברדו', 'ראם', 'מיניבוס', 'אחר']
const DIVISIONS = ['1', '2', '3', '4', 'מפקדה']
const ROLES: PersonnelRole[] = ['מפקד', 'מהנדס', 'מטפל בכיר', 'חובש', 'מחלץ']
const ROLE_ICONS: Record<string, string> = {
  'מפקד': '★', 'מהנדס': '⚙', 'מטפל בכיר': '🩺', 'חובש': '+', 'מחלץ': '⛏'
}

const COMPANY_COLORS: Record<string, string> = {
  'פלוגה א': '#e24b4a', 'פלוגה ב': '#185fa5', 'פלוגה ג': '#1d9e75'
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('אגם')
  const [filterCompany, setFilterCompany] = useState('')
  const [showAddPersonnel, setShowAddPersonnel] = useState(false)
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [dragPerson, setDragPerson] = useState<Personnel | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [quickAddVehicleId, setQuickAddVehicleId] = useState<string | null>(null)
  const [pickFromUnassigned, setPickFromUnassigned] = useState<string | null>(null)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddRole, setQuickAddRole] = useState<PersonnelRole>('מחלץ')
  const router = useRouter()

  const isHQ = userRole === 'אגם'
  const myCompany = isHQ ? (filterCompany || '') : userRole

  useEffect(() => { setUserRole(getUserRole()) }, [])

  const load = useCallback(async () => {
    const company = myCompany
    const [{ data: p }, { data: v }] = await Promise.all([
      company
        ? supabase.from('personnel').select('*').eq('company', company).order('name')
        : supabase.from('personnel').select('*').order('company,name'),
      company
        ? supabase.from('vehicles').select('*').eq('company', company).order('division,name')
        : supabase.from('vehicles').select('*').order('company,division,name'),
    ])
    if (p) setPersonnel(p as Personnel[])
    if (v) setVehicles(v as Vehicle[])
    setLoading(false)
  }, [myCompany])

  useEffect(() => { load() }, [load])

  // Drag handlers - prevent double assignment
  const handleDrop = async (vehicleId: string | null) => {
    if (!dragPerson) return
    // Check if person already assigned to a different vehicle
    if (vehicleId && dragPerson.vehicle_id && dragPerson.vehicle_id !== vehicleId) {
      const vName = vehicles.find(v => v.id === vehicleId)?.name || ''
      const currentVName = vehicles.find(v => v.id === dragPerson.vehicle_id)?.name || ''
      if (!confirm(`${dragPerson.name} כבר משובץ ל${currentVName}. להעביר ל${vName}?`)) {
        setDragPerson(null); setDragOver(null); return
      }
    }
    await supabase.from('personnel').update({ vehicle_id: vehicleId }).eq('id', dragPerson.id)
    setDragPerson(null)
    setDragOver(null)
    load()
  }

  const unassignedPersonnel = personnel.filter(p => !p.vehicle_id)
  const getVehiclePersonnel = (vid: string) => personnel.filter(p => p.vehicle_id === vid)

  const accentColor = myCompany ? (COMPANY_COLORS[myCompany] || '#185fa5') : '#185fa5'

  const inp: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px',
    fontSize: 13, direction: 'rtl', outline: 'none', width: '100%',
    boxSizing: 'border-box' as any, fontFamily: 'Arial'
  }

  const PersonCard = ({ p, draggable = true }: { p: Personnel; draggable?: boolean }) => (
    <div
      draggable={draggable && !isHQ}
      onDragStart={() => setDragPerson(p)}
      onDragEnd={() => { setDragPerson(null); setDragOver(null) }}
      style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '8px 10px', cursor: draggable && !isHQ ? 'grab' : 'default',
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: dragPerson?.id === p.id ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: accentColor + '22',
        border: `1.5px solid ${accentColor}44`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 13, fontWeight: 700, color: accentColor, flexShrink: 0
      }}>
        {ROLE_ICONS[p.role] || p.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: 10, color: '#6b7280' }}>{p.role}{p.phone ? ' · ' + p.phone : ''}</div>
      </div>
      {!isHQ && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); setEditingPersonnel(p); setShowAddPersonnel(true) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '2px 4px' }}>✏</button>
          <button onClick={e => { e.stopPropagation(); if(confirm('למחוק?')) supabase.from('personnel').delete().eq('id', p.id).then(load) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 14, padding: '2px 4px' }}>✕</button>
        </div>
      )}
    </div>
  )

  const VehicleCard = ({ v }: { v: Vehicle }) => {
    const members = getVehiclePersonnel(v.id)
    const isOver = dragOver === v.id
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(v.id) }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => handleDrop(v.id)}
        style={{
          background: isOver ? accentColor + '0d' : '#fff',
          border: `2px solid ${isOver ? accentColor : '#e5e7eb'}`,
          borderRadius: 12, padding: 14, transition: 'all 0.15s',
          minWidth: 200,
        }}
      >
        {/* Vehicle header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 20 }}>🚐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{v.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              {v.vehicle_type}{v.division ? ' · מחלקה ' + v.division : ''}
            </div>
          </div>
          {!isHQ && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setEditingVehicle(v); setShowAddVehicle(true) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '2px' }}>✏</button>
              <button onClick={() => { if(confirm('למחוק רכב?')) supabase.from('vehicles').delete().eq('id', v.id).then(load) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 14, padding: '2px' }}>✕</button>
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 40 }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 12, padding: '8px 0' }}>
              {isHQ ? 'ריק' : 'גרור חבר לכאן'}
            </div>
          ) : members.map(p => <PersonCard key={p.id} p={p} />)}
        </div>

        {/* Drop indicator */}
        {isOver && !isHQ && (
          <div style={{ marginTop: 8, padding: '6px', borderRadius: 6, border: `2px dashed ${accentColor}`, textAlign: 'center', fontSize: 12, color: accentColor }}>
            שחרר לשיבוץ
          </div>
        )}
      </div>
    )
  }

  // Group by company for HQ view
  const companiesInView = isHQ
    ? (filterCompany ? [filterCompany] : ALL_COMPANIES)
    : [myCompany]

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', paddingRight: 200, background: '#f3f4f6', fontFamily: 'Arial, sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>→ ראשי</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Image src="/logo.png" alt="ISR-1" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>כוח אדם ורכבים</div>
          <div style={{ color: '#475569', fontSize: 10 }}>
            {isHQ ? 'אג"ם — כל הפלוגות' : (COMPANY_CFG[myCompany as Company]?.label || myCompany)}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {!isHQ && (
            <>
              <button onClick={() => { setEditingVehicle(null); setShowAddVehicle(true) }}
                style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1d4ed8', borderRadius: 8, padding: '7px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                + רכב
              </button>
              <button onClick={() => { setEditingPersonnel(null); setShowAddPersonnel(true) }}
                style={{ background: '#e24b4a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                + חבר צוות
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#1e293b', padding: '8px 22px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>{personnel.length} <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>חברים</span></span>
        <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>{vehicles.length} <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>רכבים</span></span>
        <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>{personnel.filter(p => p.vehicle_id).length} <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>משובצים</span></span>
        <span style={{ fontSize: 13, color: '#f87171', fontWeight: 700 }}>{personnel.filter(p => !p.vehicle_id).length} <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>לא משובצים</span></span>
        {isHQ && (
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            style={{ background: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 7, padding: '4px 8px', fontSize: 12, direction: 'rtl', outline: 'none', marginRight: 'auto' }}>
            <option value="">כל הפלוגות</option>
            {ALL_COMPANIES.map(c => <option key={c} value={c}>{COMPANY_CFG[c].label}</option>)}
          </select>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>טוען...</div> : (
          companiesInView.map(company => {
            const compVehicles = vehicles.filter(v => v.company === company)
            const compPersonnel = personnel.filter(p => p.company === company)
            const compUnassigned = compPersonnel.filter(p => !p.vehicle_id)
            const cfg = COMPANY_CFG[company as Company]

            return (
              <div key={company} style={{ marginBottom: 28 }}>
                {isHQ && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ background: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border}`, borderRadius: 20, padding: '3px 14px', fontSize: 13, fontWeight: 700 }}>{cfg?.label}</span>
                    <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{compPersonnel.length} חברים · {compVehicles.length} רכבים</span>
                  </div>
                )}

                {/* Vehicles grid */}
                {compVehicles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                    {compVehicles.map(v => <VehicleCard key={v.id} v={v} />)}
                  </div>
                )}

                {/* Unassigned pool */}
                {compUnassigned.length > 0 && (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver('unassigned-' + company) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => handleDrop(null)}
                    style={{
                      background: dragOver === 'unassigned-' + company ? '#fffbeb' : '#f9fafb',
                      border: `2px dashed ${dragOver === 'unassigned-' + company ? '#f59e0b' : '#d1d5db'}`,
                      borderRadius: 12, padding: 14, transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>
                      לא משובצים ({compUnassigned.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                      {compUnassigned.map(p => <PersonCard key={p.id} p={p} />)}
                    </div>
                  </div>
                )}

                {compVehicles.length === 0 && compPersonnel.length === 0 && !isHQ && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    הוסף רכב וחברי צוות כדי להתחיל
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Personnel Modal */}
      {showAddPersonnel && (
        <PersonnelModal
          initial={editingPersonnel}
          company={myCompany}
          onSave={async (data: any) => {
            if (editingPersonnel) {
              await supabase.from('personnel').update(data).eq('id', editingPersonnel.id)
            } else {
              await supabase.from('personnel').insert({ ...data, company: myCompany })
            }
            setShowAddPersonnel(false); setEditingPersonnel(null); load()
          }}
          onClose={() => { setShowAddPersonnel(false); setEditingPersonnel(null) }}
        />
      )}

      {/* Vehicle Modal */}
      {showAddVehicle && (
        <VehicleModal
          initial={editingVehicle}
          onSave={async (data: any) => {
            if (editingVehicle) {
              await supabase.from('vehicles').update(data).eq('id', editingVehicle.id)
            } else {
              await supabase.from('vehicles').insert({ ...data, company: myCompany })
            }
            setShowAddVehicle(false); setEditingVehicle(null); load()
          }}
          onClose={() => { setShowAddVehicle(false); setEditingVehicle(null) }}
        />
      )}

      <BottomNav onNewReport={() => { router.push('/?newReport=1') }} onSummary={() => router.push('/?summary=1')} />
    </div>
  )
}

function PersonnelModal({ initial, company, onSave, onClose }: any) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState<PersonnelRole>(initial?.role || 'מחלץ')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [saving, setSaving] = useState(false)
  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, direction: 'rtl', outline: 'none', width: '100%', boxSizing: 'border-box' as any, fontFamily: 'Arial' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{initial ? 'עריכת חבר צוות' : 'הוספת חבר צוות'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>שם מלא *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="שם ושם משפחה" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>תפקיד</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ROLES.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${role === r ? '#1d4ed8' : '#d1d5db'}`, background: role === r ? '#eff6ff' : '#fff', color: role === r ? '#1d4ed8' : '#374151', fontSize: 12, fontWeight: role === r ? 700 : 400, cursor: 'pointer' }}>
                  {ROLE_ICONS[r]} {r}
                </button>
              ))}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>טלפון</label><input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-0000000" type="tel" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>ביטול</button>
          <button onClick={async () => {
            if (!name.trim()) { alert('שם הוא שדה חובה'); return }
            setSaving(true)
            await onSave({ name: name.trim(), role, phone: phone || null })
            setSaving(false)
          }} disabled={saving} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VehicleModal({ initial, onSave, onClose }: any) {
  const [name, setName] = useState(initial?.name || '')
  const [vtype, setVtype] = useState(initial?.vehicle_type || 'סילברדו')
  const [division, setDivision] = useState(initial?.division || '')
  const [saving, setSaving] = useState(false)
  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, direction: 'rtl', outline: 'none', width: '100%', boxSizing: 'border-box' as any, fontFamily: 'Arial' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{initial ? 'עריכת רכב' : 'הוספת רכב'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>שם הרכב *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="ניידת 3, סילברדו א..." /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>סוג רכב</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {VEHICLE_TYPES.map(t => (
                <button key={t} onClick={() => setVtype(t)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${vtype === t ? '#1d4ed8' : '#d1d5db'}`, background: vtype === t ? '#eff6ff' : '#fff', color: vtype === t ? '#1d4ed8' : '#374151', fontSize: 12, fontWeight: vtype === t ? 700 : 400, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>שיוך מחלקתי</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setDivision('')} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${!division ? '#1d4ed8' : '#d1d5db'}`, background: !division ? '#eff6ff' : '#fff', color: !division ? '#1d4ed8' : '#374151', fontSize: 12, cursor: 'pointer' }}>ללא</button>
              {DIVISIONS.map(d => (
                <button key={d} onClick={() => setDivision(d)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${division === d ? '#1d4ed8' : '#d1d5db'}`, background: division === d ? '#eff6ff' : '#fff', color: division === d ? '#1d4ed8' : '#374151', fontSize: 12, fontWeight: division === d ? 700 : 400, cursor: 'pointer' }}>
                  {d === 'מפקדה' ? 'מפקדה' : 'מחלקה ' + d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>ביטול</button>
          <button onClick={async () => {
            if (!name.trim()) { alert('שם הרכב הוא שדה חובה'); return }
            setSaving(true)
            await onSave({ name: name.trim(), vehicle_type: vtype, division: division || null, is_available: true })
            setSaving(false)
          }} disabled={saving} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: saving ? '#9ca3af' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  )
}
