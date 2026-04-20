import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getReceptionConfig, saveReceptionConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

function parseList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(await getReceptionConfig())
}

export async function PATCH(request: Request) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const settingsAllowedGroupNames = parseList(body.settingsAllowedGroupNames)

  if (settingsAllowedGroupNames.length === 0) {
    return NextResponse.json({ error: 'Bitte mindestens eine Settings-Admin-Gruppe angeben.' }, { status: 400 })
  }

  const nextConfig = await saveReceptionConfig({
    displayGroupName: typeof body.displayGroupName === 'string' ? body.displayGroupName : undefined,
    allowedGroupNames: parseList(body.allowedGroupNames),
    settingsAllowedGroupNames,
    setupUsers: parseList(body.setupUsers),
    boardTitle: typeof body.boardTitle === 'string' ? body.boardTitle : undefined,
    boardDescription: typeof body.boardDescription === 'string' ? body.boardDescription : undefined,
    autoRefreshSeconds: typeof body.autoRefreshSeconds === 'number' ? body.autoRefreshSeconds : Number(body.autoRefreshSeconds),
  })

  return NextResponse.json(nextConfig)
}
