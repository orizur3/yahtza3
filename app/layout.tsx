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
          :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f8fafc;
            --bg-tertiary: #f1f5f9;
            --bg-card: #ffffff;
            --border: #e2e8f0;
            --border-strong: #cbd5e1;
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-muted: #94a3b8;
            --header-bg: #1e293b;
            --header-text: #f8fafc;
            --accent: #1d4ed8;
            --accent-light: #eff6ff;
            --red: #e24b4a;
            --nav-bg: #0f172a;
            --nav-text: #64748b;
            --nav-active: #e24b4a;
          }
          [data-theme="dark"] {
            --bg-primary: #0a0f1a;
            --bg-secondary: #0f172a;
            --bg-tertiary: #1e293b;
            --bg-card: #0f172a;
            --border: #1e293b;
            --border-strong: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #475569;
            --header-bg: #020817;
            --header-text: #f8fafc;
            --accent: #378add;
            --accent-light: #1e3a5f;
            --red: #e24b4a;
            --nav-bg: #0f172a;
            --nav-text: #64748b;
            --nav-active: #e24b4a;
          }
          * { font-family: 'Rubik', Arial, sans-serif !important; box-sizing: border-box; }
          body { margin: 0; padding: 0; background: var(--bg-secondary); color: var(--text-primary); transition: background 0.2s, color 0.2s; }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
