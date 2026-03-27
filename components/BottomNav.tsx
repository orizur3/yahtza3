'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getUserRole(): string {
  if (typeof document === 'undefined') return 'אגם'
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=')
    acc[k] = decodeURIComponent(v || '')
    return acc
  }, {} as Record<string, string>)
  return cookies['user_role'] || 'אגם'
}

export default function BottomNav({ onNewReport, onSummary, onNewShift }: {
  onNewReport?: () => void
  onSummary?: () => void
  onNewShift?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const role = typeof window !== 'undefined' ? getUserRole() : 'אגם'
  const [hasCritical, setHasCritical] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('reports').select('id,priority,status')
      if (data) {
        const active = data.filter((r: any) => r.priority === 'דחוף' && !['הושלם','נסגר כדיווח שווא'].includes(r.status))
        setHasCritical(active.length > 0)
      }
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [])

  const isActive = (path: string) => pathname === path

  const navBtn = (path: string, icon: React.ReactNode, label: string, onClick?: () => void) => (
    <button
      onClick={() => onClick ? onClick() : router.push(path)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 3, padding: '4px 0',
        color: isActive(path) ? '#e24b4a' : '#64748b',
      }}
    >
      {icon}
      <span style={{ fontSize: 9, fontWeight: isActive(path) ? 700 : 400, color: isActive(path) ? '#e24b4a' : '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )

  const sz = 22

  return (
    <>
      <style>{`
        @keyframes isr-red { 0%{box-shadow:0 0 0 0 rgba(226,75,74,.7)} 70%{box-shadow:0 0 0 10px rgba(226,75,74,0)} 100%{box-shadow:0 0 0 0 rgba(226,75,74,0)} }
        .pulse-red { animation: isr-red 1.5s ease-in-out infinite }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 0, right: 0, left: 0, zIndex: 1000,
        background: '#0f172a', borderTop: '1px solid #1e293b',
        display: 'flex', alignItems: 'center',
        padding: '8px 8px 14px',
      }}>

        {/* מסך ראשי */}
        {navBtn('/', <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, 'מסך ראשי')}

        {/* ניהול כוח אדם */}
        {navBtn('/personnel', <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, 'כוח אדם')}

        {/* אירוע חדש — center red button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 2 }}>
          <button onClick={onNewReport} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div className={hasCritical ? 'pulse-red' : ''} style={{
              background: '#e24b4a', borderRadius: '50%', width: 52, height: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid #0f172a', marginTop: -18,
              boxShadow: '0 4px 12px rgba(226,75,74,0.4)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span style={{ fontSize: 9, color: '#64748b' }}>אירוע חדש</span>
          </button>
        </div>

        {/* יומן */}
        {navBtn('/log', <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, 'יומן')}

        {/* סיכום יומי */}
        <button
          onClick={onSummary}
          style={{ background: 'none', border: 'none', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', color: '#64748b' }}
        >
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>סיכום יומי</span>
        </button>

      </div>
    </>
  )
}
