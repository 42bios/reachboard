import { NextRequest, NextResponse } from 'next/server'
import {
  buildSessionFromAccessToken,
  clearAuthCookies,
  exchangeCodeForToken,
  getBaseUrl,
  RETURN_TO_COOKIE,
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
} from '@/lib/auth'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = request.cookies.get(STATE_COOKIE)?.value
  const storedReturnTo = request.cookies.get(RETURN_TO_COOKIE)?.value || '/'

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/unauthorized?reason=state', getBaseUrl(request)))
  }

  try {
    const tokenPayload = await exchangeCodeForToken(request, code)
    const session = await buildSessionFromAccessToken(tokenPayload.access_token)
    const safeReturnTo = storedReturnTo.startsWith('/') ? storedReturnTo : '/'
    const target = new URL(session.allowed ? safeReturnTo : '/unauthorized?reason=group', getBaseUrl(request))
    const response = NextResponse.redirect(target)
    response.cookies.set(SESSION_COOKIE, await signSession(session), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    response.cookies.set(STATE_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })
    response.cookies.set(RETURN_TO_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })
    return response
  } catch {
    const response = NextResponse.redirect(new URL('/unauthorized?reason=login', getBaseUrl(request)))
    clearAuthCookies(response)
    return response
  }
}
