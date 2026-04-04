import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ISR-1 מערכת ניהול אירועים',
  description: 'Israel National Search & Rescue — Incident Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
        <style>{`
          * { font-family: 'Rubik', Arial, sans-serif !important; }
          body { margin: 0; padding: 0; }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Rubik', Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
