import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizeUrl, RETURN_TO_COOKIE, STATE_COOKIE } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString('hex')
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/'
  const response = NextResponse.redirect(getAuthorizeUrl(request, state))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  response.cookies.set(RETURN_TO_COOKIE, returnTo.startsWith('/') ? returnTo : '/', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  return response
}
