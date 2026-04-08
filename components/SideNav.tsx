'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
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

interface SideNavProps {
  onNewShift?: () => void
  onSummary?: () => void
  onExcel?: () => void
  currentShiftName?: string
  onWidthChange?: (w: number) => void
  darkMode?: boolean
  onToggleDark?: () => void
  collapsed?: boolean
  onCollapse?: (c: boolean) => void
}

export default function SideNav({
  onNewShift, onSummary, onExcel, currentShiftName,
  onWidthChange, darkMode, onToggleDark
}: SideNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const role = typeof window !== 'undefined' ? getUserRole() : 'אגם'
  const isHQ = role === 'אגם'

  // Read/write collapsed state from localStorage
  const getCollapsed = () => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidenav-collapsed') === 'true'
  }
  const [collapsed, setCollapsedState] = typeof window !== 'undefined'
    ? [getCollapsed(), (v: boolean) => {
        localStorage.setItem('sidenav-collapsed', String(v))
      }]
    : [false, () => {}]

  const [localCollapsed, setLocalCollapsed] = require('react').useState(getCollapsed)

  const toggleCollapsed = () => {
    const next = !localCollapsed
    setLocalCollapsed(next)
    localStorage.setItem('sidenav-collapsed', String(next))
    onWidthChange?.(next ? 52 : 200)
  }

  useEffect(() => {
    onWidthChange?.(localCollapsed ? 52 : 200)
  }, [localCollapsed])

  const isActive = (path: string) => pathname === path

  const navBtn = (
    path: string | null,
    icon: string,
    label: string,
    onClick?: () => void,
    accent?: string
  ) => {
    const active = path ? isActive(path) : false
    return (
      <button
        key={label}
        onClick={() => onClick ? onClick() : path && router.push(path)}
        title={label}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: localCollapsed ? 0 : 10,
          padding: localCollapsed ? '10px 0' : '9px 12px',
          justifyContent: localCollapsed ? 'center' : 'flex-start',
          background: active ? 'var(--accent-light)' : 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          color: accent || (active ? 'var(--accent)' : 'var(--text-secondary)'),
          fontSize: localCollapsed ? 20 : 13,
          fontWeight: active ? 700 : 400,
          direction: 'rtl',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          transition: 'background 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
        {!localCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      </button>
    )
  }

  const divider = <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

  const width = localCollapsed ? 52 : 200

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 900,
      width,
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 6px 12px',
      transition: 'width 0.2s ease',
      overflowX: 'hidden',
      overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: localCollapsed ? 'center' : 'space-between',
        padding: '10px 4px 8px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 6,
        flexShrink: 0,
      }}>
        {!localCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <Image src="/logo.png" alt="ISR-1" width={30} height={30} style={{ borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>ISR-1</div>
              {currentShiftName && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                  {currentShiftName}
                </div>
              )}
            </div>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={localCollapsed ? 'פתח סרגל' : 'סגור סרגל'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>
          {localCollapsed ? '‹' : '›'}
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navBtn('/', '⊞', 'מסך ראשי')}
        {navBtn('/log', '📖', 'יומן מבצעים')}
        {navBtn('/personnel', '👥', 'כוח אדם ורכבים')}
        {isHQ && navBtn('/dashboard', '📊', 'דשבורד פיקוד')}
        {isHQ && navBtn('/shifts', '🗂', 'מטחים קודמים')}
        {divider}
        {isHQ && navBtn(null, '🔄', 'מטח חדש', onNewShift, '#185fa5')}
        {navBtn(null, '📋', 'סיכום יומי', onSummary)}
        {navBtn(null, '📊', 'ייצוא Excel', onExcel, '#166534')}
        {divider}
        {navBtn(null, darkMode ? '☀️' : '🌙', darkMode ? 'מצב בהיר' : 'מצב כהה', onToggleDark)}
        {navBtn(null, '🚪', 'יציאה', () => {
          document.cookie = 'auth_token=; Max-Age=0; path=/'
          document.cookie = 'user_role=; Max-Age=0; path=/'
          window.location.href = '/login'
        }, '#dc2626')}
      </div>
    </div>
  )
}
