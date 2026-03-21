import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'מערכת דיווחי אירועים',
  description: 'ניהול דיווחים גיאוגרפי בזמן אמת',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, padding: 0, fontFamily: 'Arial, sans-serif', background: '#f3f4f6' }}>
        {children}
      </body>
    </html>
  )
}
