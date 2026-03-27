import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.APP_PASSWORD || 'changeme123'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password === PASSWORD) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('geo_auth', PASSWORD, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('geo_auth')
  return res
}
