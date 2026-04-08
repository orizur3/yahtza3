'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BottomNav({ onNewReport }: { onNewReport?: () => void; onSummary?: () => void; onNewShift?: () => void }) {
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

  return (
    <>
      <style>{`
        @keyframes isr-red { 0%{box-shadow:0 0 0 0 rgba(226,75,74,.7)} 70%{box-shadow:0 0 0 12px rgba(226,75,74,0)} 100%{box-shadow:0 0 0 0 rgba(226,75,74,0)} }
        .pulse-red { animation: isr-red 1.5s ease-in-out infinite }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={onNewReport}
          title="פתח אירוע חדש"
          className={hasCritical ? 'pulse-red' : ''}
          style={{
            background: '#e24b4a',
            borderRadius: '50%',
            width: 58,
            height: 58,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid white',
            boxShadow: '0 4px 16px rgba(226,75,74,0.5)',
            cursor: 'pointer',
          }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  )
}
