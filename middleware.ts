import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl, SESSION_COOKIE, verifySession } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isSettingsPage = pathname === '/settings'
  const isSettingsApi = pathname.startsWith('/api/settings')
  const isSettingsPath = isSettingsPage || isSettingsApi
  const isBoardPath = !isSettingsPath

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/unauthorized'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySession(token)

  if (!session) {
    if (isSettingsPage) {
      return NextResponse.next()
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/api/auth/login', getBaseUrl(request))
    loginUrl.searchParams.set('returnTo', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (isSettingsApi && !session.canManage) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/unauthorized?reason=admin', getBaseUrl(request)))
  }

  if (isSettingsPage && !session.canManage) {
    return NextResponse.next()
  }

  if (isBoardPath && !session.allowed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/unauthorized?reason=group', getBaseUrl(request)))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
