'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Role = 'פלוגה א' | 'פלוגה ב' | 'פלוגה ג' | 'אגם'

const ROLES: { role: Role; label: string; color: string; bg: string; border: string }[] = [
  { role: 'פלוגה א', label: "פלוגה א'", color: '#f87171', bg: '#450a0a', border: '#7f1d1d' },
  { role: 'פלוגה ב', label: "פלוגה ב'", color: '#60a5fa', bg: '#0c1a2e', border: '#1d4ed8' },
  { role: 'פלוגה ג', label: "פלוגה ג'", color: '#4ade80', bg: '#052e16', border: '#166534' },
  { role: 'אגם', label: 'אג"ם — מפקד יחידה', color: '#fbbf24', bg: '#1c0f00', border: '#92400e' },
]

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    if (!selectedRole) { setError('בחר דרג כניסה'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role: selectedRole }),
    })
    if (res.ok) { router.push('/'); router.refresh() }
    else setError('סיסמה שגויה — נסה שוב')
    setLoading(false)
  }

  const selected = ROLES.find(r => r.role === selectedRole)

  return (
    <div style={{
      minHeight: '100vh', background: '#050912',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', direction: 'rtl', padding: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(226,75,74,0.06) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

        {/* Logo section */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            {/* Outer glow ring */}
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'conic-gradient(from 0deg, #e24b4a, #185fa5, #1d9e75, #ba7517, #e24b4a)', opacity: 0.4, filter: 'blur(8px)' }}/>
            {/* Ring */}
            <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid rgba(226,75,74,0.5)' }}/>
            <Image src="/logo.png" alt="ISR-1" width={100} height={100} style={{ borderRadius: '50%', display: 'block', position: 'relative', zIndex: 1 }}/>
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>ISR-1</div>
          <div style={{ color: '#e24b4a', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>ISRAEL NATIONAL SEARCH & RESCUE</div>
          <div style={{ color: '#475569', fontSize: 12 }}>מערכת ניהול אירועים מבצעיים</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(15,23,42,0.95)', borderRadius: 20, padding: 28, border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>

          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>בחר דרג כניסה</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLES.slice(0, 3).map(r => (
                <div key={r.role} onClick={() => setSelectedRole(r.role)} style={{
                  padding: '12px 10px', borderRadius: 12,
                  border: `1px solid ${selectedRole === r.role ? r.border : 'rgba(255,255,255,0.06)'}`,
                  background: selectedRole === r.role ? r.bg : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  boxShadow: selectedRole === r.role ? `0 0 16px ${r.color}22` : 'none',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedRole === r.role ? r.color : '#334155', margin: '0 auto 6px', transition: 'all 0.15s' }}/>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selectedRole === r.role ? r.color : '#64748b' }}>{r.label}</div>
                </div>
              ))}
              {/* HQ spans full width */}
              <div onClick={() => setSelectedRole('אגם')} style={{
                padding: '12px 10px', borderRadius: 12, gridColumn: '1 / -1',
                border: `1px solid ${selectedRole === 'אגם' ? ROLES[3].border : 'rgba(255,255,255,0.06)'}`,
                background: selectedRole === 'אגם' ? ROLES[3].bg : 'rgba(255,255,255,0.02)',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                boxShadow: selectedRole === 'אגם' ? `0 0 16px ${ROLES[3].color}22` : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedRole === 'אגם' ? ROLES[3].color : '#64748b' }}>
                  {selectedRole === 'אגם' ? '★ ' : ''}{ROLES[3].label}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>סיסמה</div>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="הכנס סיסמה..."
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: `1px solid ${selected ? selected.border : 'rgba(255,255,255,0.08)'}`,
                background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 14,
                fontFamily: 'Arial', outline: 'none', direction: 'rtl',
                boxSizing: 'border-box', transition: 'border 0.15s',
              }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(127,29,29,0.5)', color: '#fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14, border: '1px solid #7f1d1d' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password || !selectedRole}
            style={{
              width: '100%', padding: 13, borderRadius: 10, border: 'none',
              background: loading || !password || !selectedRole
                ? 'rgba(255,255,255,0.05)'
                : selected ? `linear-gradient(135deg, ${selected.color}cc, ${selected.color}88)` : '#e24b4a',
              color: loading || !password || !selectedRole ? '#334155' : '#fff',
              fontWeight: 800, fontSize: 15, cursor: loading || !password || !selectedRole ? 'default' : 'pointer',
              fontFamily: 'Arial', letterSpacing: 0.5,
              boxShadow: selectedRole && password ? `0 4px 20px ${selected?.color}44` : 'none',
              transition: 'all 0.15s',
            }}>
            {loading ? 'מתחבר...' : selectedRole ? `כניסה — ${ROLES.find(r=>r.role===selectedRole)?.label}` : 'כניסה'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10, color: '#1e293b' }}>
            ISRAEL NATIONAL SEARCH & RESCUE UNIT — SECURE ACCESS
          </div>
        </div>
      </div>
    </div>
  )
}
