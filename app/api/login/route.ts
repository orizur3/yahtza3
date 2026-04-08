import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PASSWORDS: Record<string, string> = {
  'פלוגה א': process.env.PASSWORD_COMPANY_A || 'alpha123',
  'פלוגה ב': process.env.PASSWORD_COMPANY_B || 'bravo123',
  'פלוגה ג': process.env.PASSWORD_COMPANY_C || 'charlie123',
  'אגם':     process.env.PASSWORD_HQ || 'hq123',
}

export async function POST(request: NextRequest) {
  const { password, role } = await request.json()
  if (!role || PASSWORDS[role] !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const response = NextResponse.json({ success: true, role })
  response.cookies.set('auth_token', password, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
  response.cookies.set('user_role', role, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
  return response
}
