import { NextResponse } from 'next/server'
import { createSetupSession, RETURN_TO_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, STATE_COOKIE } from '@/lib/auth'
import { getReceptionConfig } from '@/lib/config'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Bitte eine E-Mail-Adresse eingeben.' }, { status: 400 })
  }

  const config = await getReceptionConfig()

  if (config.settingsAllowedGroupNames.length > 0) {
    return NextResponse.json(
      { error: 'Der Setup-Zugang ist deaktiviert, sobald mindestens eine Admin-Gruppe gesetzt ist.' },
      { status: 403 },
    )
  }

  if (!config.setupUsers.map((value) => value.toLowerCase()).includes(email)) {
    return NextResponse.json({ error: 'Dieser Setup-User ist nicht freigegeben.' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, await createSetupSession(email), {
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
}
