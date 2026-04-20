import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import { getReceptionConfig } from '@/lib/config'

export const SESSION_COOKIE = 'avioo_reception_session'
export const STATE_COOKIE = 'avioo_reception_state'
export const RETURN_TO_COOKIE = 'avioo_reception_return_to'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

type ReceptionSession = {
  sub: string
  name: string
  email: string
  allowed: boolean
  allowedGroups: string[]
  canManage: boolean
  adminGroups: string[]
}

function getTenantId() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID
  if (!tenantId) throw new Error('MS_GRAPH_TENANT_ID is not configured.')
  return tenantId
}

function getClientId() {
  const clientId = process.env.MS_GRAPH_CLIENT_ID
  if (!clientId) throw new Error('MS_GRAPH_CLIENT_ID is not configured.')
  return clientId
}

function getClientSecret() {
  const secret = process.env.MS_GRAPH_CLIENT_SECRET
  if (!secret) throw new Error('MS_GRAPH_CLIENT_SECRET is not configured.')
  return secret
}

function getSessionSecret() {
  return new TextEncoder().encode(process.env.RECEPTION_SESSION_SECRET || getClientSecret())
}

export function getBaseUrl(request: NextRequest) {
  const configuredBaseUrl = process.env.RECEPTION_PUBLIC_BASE_URL?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '')
  }

  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) throw new Error('Host header is missing.')
  return `${proto}://${host}`
}

export function getAuthorizeUrl(request: NextRequest, state: string) {
  const baseUrl = getBaseUrl(request)
  const tenantId = getTenantId()
  const clientId = getClientId()
  const redirectUri = `${baseUrl}/api/auth/callback`
  const scope = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Group.Read.All'].join(' ')

  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

export async function exchangeCodeForToken(request: NextRequest, code: string) {
  const baseUrl = getBaseUrl(request)
  const tenantId = getTenantId()
  const clientId = getClientId()
  const clientSecret = getClientSecret()
  const redirectUri = `${baseUrl}/api/auth/callback`

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  return payload as {
    access_token: string
    id_token?: string
  }
}

async function graphMe(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Graph /me failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as {
    id: string
    displayName?: string | null
    mail?: string | null
    userPrincipalName?: string | null
  }
}

async function graphGroupMemberships(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.group?$select=id,displayName', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Graph group lookup failed: ${response.status} ${await response.text()}`)
  }
  const payload = (await response.json()) as {
    value?: Array<{ id: string; displayName?: string | null }>
  }
  return (payload.value ?? []).map((group) => ({
    id: group.id,
    displayName: group.displayName?.trim() || '',
  }))
}

export async function buildSessionFromAccessToken(accessToken: string): Promise<ReceptionSession> {
  const config = await getReceptionConfig()
  const [me, groups] = await Promise.all([graphMe(accessToken), graphGroupMemberships(accessToken)])
  const allowedNames = config.allowedGroupNames.map((value) => value.toLowerCase())
  const adminNames = config.settingsAllowedGroupNames.map((value) => value.toLowerCase())
  const email = (me.mail || me.userPrincipalName || '').trim().toLowerCase()
  const matched = groups
    .map((group) => group.displayName)
    .filter((name) => allowedNames.includes(name.toLowerCase()))
  const adminMatched = groups
    .map((group) => group.displayName)
    .filter((name) => adminNames.includes(name.toLowerCase()))
  const setupUsers = config.setupUsers.map((value) => value.toLowerCase())
  const canManage = adminMatched.length > 0 || (email ? setupUsers.includes(email) : false)

  return {
    sub: me.id,
    name: me.displayName?.trim() || me.mail || me.userPrincipalName || 'Reception User',
    email: me.mail || me.userPrincipalName || '',
    allowed: matched.length > 0,
    allowedGroups: matched,
    canManage,
    adminGroups: adminMatched,
  }
}

export async function signSession(session: ReceptionSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSessionSecret())
}

export async function createSetupSession(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const name = normalizedEmail.split('@')[0] || normalizedEmail

  return signSession({
    sub: `setup:${normalizedEmail}`,
    name,
    email: normalizedEmail,
    allowed: false,
    allowedGroups: [],
    canManage: true,
    adminGroups: [],
  })
}

export async function verifySession(token?: string | null): Promise<ReceptionSession | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    return {
      sub: String(payload.sub || ''),
      name: String(payload.name || ''),
      email: String(payload.email || ''),
      allowed: Boolean(payload.allowed),
      allowedGroups: Array.isArray(payload.allowedGroups) ? payload.allowedGroups.map(String) : [],
      canManage: Boolean(payload.canManage),
      adminGroups: Array.isArray(payload.adminGroups) ? payload.adminGroups.map(String) : [],
    }
  } catch {
    return null
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifySession(token)
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: new Date(0) })
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: new Date(0) })
}
