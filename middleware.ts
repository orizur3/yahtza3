import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PASSWORDS: Record<string, string> = {
  'פלוגה א': process.env.PASSWORD_COMPANY_A || 'alpha123',
  'פלוגה ב': process.env.PASSWORD_COMPANY_B || 'bravo123',
  'פלוגה ג': process.env.PASSWORD_COMPANY_C || 'charlie123',
  'אגם':     process.env.PASSWORD_HQ || 'hq123',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }
  const token = request.cookies.get('auth_token')?.value
  const role = request.cookies.get('user_role')?.value
  const validPasswords = Object.values(PASSWORDS)
  if (token && validPasswords.includes(token) && role) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
