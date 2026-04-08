# מערכת דיווחי אירועים — הוראות הפעלה

## דרישות מקדימות
- Node.js 18+ (בדוק: `node -v`)
- חשבון Supabase חינמי
- Google Maps API Key

---

## צעד 1 — חלץ את הקבצים
מקם את התיקייה `geo-reports` בכל מקום במחשב.

---

## צעד 2 — Supabase (2 דקות)

1. כנס ל-https://supabase.com → "New project"
2. בחר שם וסיסמה לפרויקט
3. לאחר יצירה: כנס ל-**SQL Editor** (סרגל שמאלי)
4. העתק את תוכן הקובץ `supabase-schema.sql` והרץ אותו (כפתור Run)
5. כנס ל-**Settings → API** — העתק:
   - **Project URL** (נראה כך: `https://xxxx.supabase.co`)
   - **anon public** key

---

## צעד 3 — Google Maps API (3 דקות)

1. כנס ל-https://console.cloud.google.com
2. צור פרויקט חדש (או השתמש בקיים)
3. חפש "Geocoding API" → **Enable**
4. כנס ל-**APIs & Services → Credentials → Create Credentials → API Key**
5. העתק את ה-Key

---

## צעד 4 — קובץ הגדרות

העתק את הקובץ `.env.local.example` לקובץ חדש בשם `.env.local`:

```bash
cp .env.local.example .env.local
```

פתח `.env.local` ומלא את הערכים:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## צעד 5 — הפעלה

```bash
cd geo-reports
npm install
npm run dev
```

פתח דפדפן: **http://localhost:3000**

---

## בעיות נפוצות

| בעיה | פתרון |
|------|--------|
| `npm install` נכשל | בדוק שיש Node 18+ |
| "שגיאה בשמירת הדיווח" | בדוק Supabase URL ו-anon key ב-.env.local |
| "Geocoding נכשל" | בדוק שה-Google Maps API Key נכון ו-Geocoding API מופעל |
| לא מוצג קשר גיאוגרפי | ודא ש-Geocoding הצליח — בדוק Console בדפדפן (F12) |
| הטבלה לא מתרעננת | ודא שהרצת את ה-SQL עם `alter publication supabase_realtime add table reports` |

---

## בדיקת קשרים גיאוגרפיים

כדי לבדוק שהמערכת מזהה נכון:
1. הזן דיווח עם כתובת ראשונה (למשל "הרצל 1, ראשון לציון")
2. הזן דיווח עם כתובת שנייה קרובה (למשל "רוטשילד 5, ראשון לציון")
3. אם הם באזור קרוב בפועל — תראה badge "רחובות קרובים" / "מצטלבים"
