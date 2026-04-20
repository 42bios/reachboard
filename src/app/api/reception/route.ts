import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getReceptionConfig } from '@/lib/config'
import { getLocaleTag, resolveLocale, type AppLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

type PresenceStatus =
  | 'office'
  | 'remote'
  | 'short-absence'
  | 'long-absence'
  | 'busy'
  | 'dnd'
  | 'offline'
  | 'away'
  | 'available'
  | 'unknown'

type GraphPresenceSnapshot = {
  id: string
  availability?: string | null
  activity?: string | null
  workLocationType?: string | null
}

type GraphCurrentScheduleSnapshot = {
  email: string
  status?: string | null
  endTime?: string | null
  endDateTime?: string | null
  endTimeZone?: string | null
  nextStartTime?: string | null
  nextStartDateTime?: string | null
  nextStartTimeZone?: string | null
  nextStatus?: string | null
  isAllDay?: boolean
}

type GraphAutomaticRepliesSnapshot = {
  email: string
  status?: string | null
  scheduledStartDateTime?: string | null
  scheduledStartTimeZone?: string | null
  scheduledEndDateTime?: string | null
  scheduledEndTimeZone?: string | null
}

type GraphGroupUser = {
  id: string
  givenName?: string | null
  surname?: string | null
  displayName?: string | null
  mail?: string | null
  userPrincipalName?: string | null
  jobTitle?: string | null
  department?: string | null
  accountEnabled?: boolean | null
}

type LocationKind = 'office' | 'remote' | null

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const RECEPTION_DISPLAY_TIME_ZONE = 'Europe/Berlin'

function normalizeReceptionTimeZone(value?: string | null) {
  const normalized = value?.trim()
  const mapping: Record<string, string> = {
    'W. Europe Standard Time': 'Europe/Berlin',
    'Central Europe Standard Time': 'Europe/Budapest',
    'Romance Standard Time': 'Europe/Paris',
    UTC: 'UTC',
  }

  const candidate = normalized ? (mapping[normalized] ?? normalized) : 'Europe/Berlin'
  try {
    new Intl.DateTimeFormat('de-DE', { timeZone: candidate })
    return candidate
  } catch {
    return 'Europe/Berlin'
  }
}

function formatScheduleClock(value?: string | null, timeZone?: string | null) {
  if (!value) return null
  const normalizedValue = value.trim()
  const normalizedTimeZone = normalizeReceptionTimeZone(timeZone)

  // Graph getSchedule often already returns local wall-clock values together with a
  // separate Windows time zone. In that case we should not shift the value again.
  const localClockMatch = normalizedValue.match(/T(\d{2}):(\d{2})/)
  const hasExplicitOffset = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalizedValue)
  if (localClockMatch && !hasExplicitOffset && normalizedTimeZone !== 'UTC') {
    return `${localClockMatch[1]}:${localClockMatch[2]}`
  }

  try {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: normalizedTimeZone === 'UTC' ? RECEPTION_DISPLAY_TIME_ZONE : normalizedTimeZone,
    }).format(new Date(normalizedValue))
  } catch {
    return null
  }
}

function parseGraphDateTime(value?: string | null, timeZone?: string | null) {
  if (!value) return null
  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  if (/(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalizedValue)) {
    const parsed = new Date(normalizedValue)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const normalizedTimeZone = normalizeReceptionTimeZone(timeZone)
  const utcCandidate = normalizedTimeZone === 'UTC' ? `${normalizedValue}Z` : normalizedValue
  const parsed = new Date(utcCandidate)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatGraphRequestDateTime(date: Date) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: RECEPTION_DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return formatter.format(date).replace(' ', 'T')
}

function formatDisplayDate(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatShortDisplayDate(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

async function getAppToken() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID
  const clientId = process.env.MS_GRAPH_CLIENT_ID
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Graph app credentials are not configured.')
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Graph token request failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  return payload.access_token as string
}

async function graphFetch(token: string, path: string, options?: RequestInit) {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    cache: 'no-store',
  })
}

async function graphJson<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const response = await graphFetch(token, path, options)
  if (!response.ok) {
    throw new Error(`Graph request failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

async function graphListAll<T>(token: string, path: string) {
  type GraphListPayload<U> = { value: U[]; '@odata.nextLink'?: string }

  const results: T[] = []
  let nextPath: string | null = path

  while (nextPath) {
    const payload: GraphListPayload<T> = await graphJson(token, nextPath)
    results.push(...(payload.value ?? []))
    nextPath = payload['@odata.nextLink'] ?? null
  }

  return results
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''")
}

async function findGroupByDisplayName(token: string, displayName: string) {
  const trimmed = displayName.trim()
  const filter = encodeURIComponent(`displayName eq '${escapeODataString(trimmed)}'`)
  const payload = await graphJson<{
    value: Array<{
      id: string
      displayName?: string | null
    }>
  }>(token, `/groups?$select=id,displayName&$top=5&$filter=${filter}`)

  return (
    payload.value.find(
      (group) => (group.displayName ?? '').trim().toLowerCase() === trimmed.toLowerCase(),
    ) ?? null
  )
}

async function getGroupUsers(token: string, groupId: string) {
  return graphListAll<GraphGroupUser>(
    token,
    `/groups/${encodeURIComponent(groupId)}/transitiveMembers/microsoft.graph.user?$select=id,givenName,surname,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled`,
  )
}

async function getUserPhotoDataUrl(token: string, userId: string) {
  const response = await graphFetch(token, `/users/${encodeURIComponent(userId)}/photo/$value`)
  if (!response.ok) return null
  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:${contentType};base64,${base64}`
}

async function getUserPresencesByEntraIds(token: string, userIds: string[]) {
  const ids = Array.from(new Set(userIds.map((value) => value.trim()).filter(Boolean)))
  if (!ids.length) return new Map<string, GraphPresenceSnapshot>()

  try {
    const payload = await graphJson<{
      value?: Array<{
        id: string
        availability?: string | null
        activity?: string | null
        workLocation?: {
          type?: string | null
        } | null
      }>
    }>(token, '/communications/getPresencesByUserId', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })

    const snapshots = new Map<string, GraphPresenceSnapshot>()
    for (const item of payload.value ?? []) {
      snapshots.set(item.id, {
        id: item.id,
        availability: item.availability ?? null,
        activity: item.activity ?? null,
        workLocationType: item.workLocation?.type ?? null,
      })
    }
    return snapshots
  } catch {
    return new Map<string, GraphPresenceSnapshot>()
  }
}

async function getUsersCurrentScheduleByEmail(token: string, userEmails: string[], reference = new Date()) {
  const emails = Array.from(new Set(userEmails.map((value) => value.trim().toLowerCase()).filter(Boolean)))
  if (!emails.length) return new Map<string, GraphCurrentScheduleSnapshot>()

  const anchorEmail = emails[0]
  const dayStart = new Date(reference)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(reference)
  dayEnd.setHours(23, 59, 59, 999)

  try {
    const payload = await graphJson<{
      value?: Array<{
        scheduleId: string
        scheduleItems?: Array<{
          status?: string | null
          start?: { dateTime?: string | null; timeZone?: string | null } | null
          end?: { dateTime?: string | null; timeZone?: string | null } | null
        }>
      }>
    }>(token, `/users/${encodeURIComponent(anchorEmail)}/calendar/getSchedule`, {
      method: 'POST',
      body: JSON.stringify({
        schedules: emails,
        startTime: {
          dateTime: formatGraphRequestDateTime(dayStart),
          timeZone: 'W. Europe Standard Time',
        },
        endTime: {
          dateTime: formatGraphRequestDateTime(dayEnd),
          timeZone: 'W. Europe Standard Time',
        },
        availabilityViewInterval: 30,
      }),
    })

    const snapshots = new Map<string, GraphCurrentScheduleSnapshot>()
    for (const entry of payload.value ?? []) {
      const scheduleItems = entry.scheduleItems ?? []
      const currentItem = scheduleItems
        .filter((item) => {
          const start = parseGraphDateTime(item.start?.dateTime ?? null, item.start?.timeZone ?? null)
          const end = parseGraphDateTime(item.end?.dateTime ?? null, item.end?.timeZone ?? null)
          return !!start && !!end && start <= reference && end > reference && (item.status ?? '').toLowerCase() !== 'free'
        })
        .sort((a, b) => {
          const left = parseGraphDateTime(a.end?.dateTime ?? null, a.end?.timeZone ?? null)?.getTime() ?? Number.MAX_SAFE_INTEGER
          const right = parseGraphDateTime(b.end?.dateTime ?? null, b.end?.timeZone ?? null)?.getTime() ?? Number.MAX_SAFE_INTEGER
          return left - right
        })[0]

      const nextItem = scheduleItems
        .filter((item) => {
          const start = parseGraphDateTime(item.start?.dateTime ?? null, item.start?.timeZone ?? null)
          return !!start && start > reference && (item.status ?? '').toLowerCase() !== 'free'
        })
        .sort((a, b) => {
          const left = parseGraphDateTime(a.start?.dateTime ?? null, a.start?.timeZone ?? null)?.getTime() ?? Number.MAX_SAFE_INTEGER
          const right = parseGraphDateTime(b.start?.dateTime ?? null, b.start?.timeZone ?? null)?.getTime() ?? Number.MAX_SAFE_INTEGER
          return left - right
        })[0]

      const email = entry.scheduleId.trim().toLowerCase()
      snapshots.set(email, {
        email,
        status: currentItem?.status ?? null,
        endTime: formatScheduleClock(currentItem?.end?.dateTime ?? null, currentItem?.end?.timeZone ?? null),
        endDateTime: currentItem?.end?.dateTime ?? null,
        endTimeZone: currentItem?.end?.timeZone ?? null,
        nextStartTime: formatScheduleClock(nextItem?.start?.dateTime ?? null, nextItem?.start?.timeZone ?? null),
        nextStartDateTime: nextItem?.start?.dateTime ?? null,
        nextStartTimeZone: nextItem?.start?.timeZone ?? null,
        nextStatus: nextItem?.status ?? null,
        isAllDay: !!(
          currentItem?.start?.dateTime &&
          currentItem?.end?.dateTime &&
          currentItem.start.dateTime.endsWith('T00:00:00.0000000') &&
          currentItem.end.dateTime.endsWith('T00:00:00.0000000')
        ),
      })
    }
    return snapshots
  } catch {
    return new Map<string, GraphCurrentScheduleSnapshot>()
  }
}

async function getUsersAutomaticRepliesByEmail(token: string, userEmails: string[]) {
  const emails = Array.from(new Set(userEmails.map((value) => value.trim().toLowerCase()).filter(Boolean)))
  const results = new Map<string, GraphAutomaticRepliesSnapshot>()
  if (!emails.length) return results

  await Promise.all(
    emails.map(async (email) => {
      try {
        const payload = await graphJson<{
          automaticRepliesSetting?: {
            status?: string | null
            scheduledStartDateTime?: { dateTime?: string | null; timeZone?: string | null } | null
            scheduledEndDateTime?: { dateTime?: string | null; timeZone?: string | null } | null
          } | null
        }>(token, `/users/${encodeURIComponent(email)}/mailboxSettings?$select=automaticRepliesSetting`)

        results.set(email, {
          email,
          status: payload.automaticRepliesSetting?.status ?? null,
          scheduledStartDateTime: payload.automaticRepliesSetting?.scheduledStartDateTime?.dateTime ?? null,
          scheduledStartTimeZone: payload.automaticRepliesSetting?.scheduledStartDateTime?.timeZone ?? null,
          scheduledEndDateTime: payload.automaticRepliesSetting?.scheduledEndDateTime?.dateTime ?? null,
          scheduledEndTimeZone: payload.automaticRepliesSetting?.scheduledEndDateTime?.timeZone ?? null,
        })
      } catch {
        // Keep best-effort behavior if mailbox settings are unavailable for a user.
      }
    }),
  )

  return results
}

function buildPersonName(user: GraphGroupUser) {
  const first = user.givenName?.trim() ?? ''
  const last = user.surname?.trim() ?? ''
  const combined = [first, last].filter(Boolean).join(' ').trim()
  return combined || user.displayName?.trim() || user.mail || user.userPrincipalName || user.id
}

function getTeamsPresenceInfo(input: string | null | undefined, locale: AppLocale) {
  const normalized = (input ?? '').trim().toLowerCase()

  if (!normalized) return { kind: 'unknown' as PresenceStatus, label: locale === 'de' ? 'Kein Live-Status' : 'No live status' }
  if (normalized === 'inacall' || normalized === 'inaconferencecall') return { kind: 'busy' as PresenceStatus, label: locale === 'de' ? 'Im Gespräch' : 'In a call' }
  if (normalized === 'presenting') return { kind: 'busy' as PresenceStatus, label: locale === 'de' ? 'Präsentiert' : 'Presenting' }
  if (normalized === 'busy') return { kind: 'busy' as PresenceStatus, label: locale === 'de' ? 'Beschäftigt' : 'Busy' }
  if (normalized === 'donotdisturb' || normalized === 'focusing') return { kind: 'dnd' as PresenceStatus, label: locale === 'de' ? 'Nicht stören' : 'Do not disturb' }
  if (normalized === 'away' || normalized === 'berightback') return { kind: 'away' as PresenceStatus, label: locale === 'de' ? 'Kurz abwesend' : 'Away' }
  if (normalized === 'offline' || normalized === 'offwork') return { kind: 'offline' as PresenceStatus, label: 'Offline' }
  return { kind: 'available' as PresenceStatus, label: locale === 'de' ? 'Verfügbar' : 'Available' }
}

function statusPresentationV3(params: {
  baseStatus: PresenceStatus
  endTime?: string | null
  nextTime?: string | null
  absenceEnd?: Date | null
  teamsLabel?: string | null
  scheduleStatus?: string | null
  isAllDay?: boolean
  locale: AppLocale
}) {
  const { locale } = params
  const scheduleStatus = (params.scheduleStatus ?? '').toLowerCase()

  if (params.baseStatus === 'office') {
    return { kind: 'office' as const, accent: 'green' as const, title: locale === 'de' ? 'Im Büro' : 'In the office', subtitle: '' }
  }

  if (params.baseStatus === 'remote') {
    return {
      kind: 'remote' as const,
      accent: 'green' as const,
      title: locale === 'de' ? 'Home Office' : 'Remote',
      subtitle: params.isAllDay ? (locale === 'de' ? 'Ganztägig verfügbar' : 'Available all day') : '',
    }
  }

  if (params.baseStatus === 'short-absence') {
    return {
      kind: 'short-absence' as const,
      accent: 'yellow' as const,
      title: locale === 'de' ? 'Kurz abwesend' : 'Away',
      subtitle: params.nextTime ? (locale === 'de' ? `Verfügbar bis ${params.nextTime}` : `Available until ${params.nextTime}`) : '',
    }
  }

  if (params.baseStatus === 'long-absence') {
    return {
      kind: 'long-absence' as const,
      accent: 'violet' as const,
      title: locale === 'de' ? 'Außer Haus' : 'Out of office',
      subtitle: params.absenceEnd ? (locale === 'de' ? `Bis ${formatShortDisplayDate(params.absenceEnd, locale)}` : `Until ${formatShortDisplayDate(params.absenceEnd, locale)}`) : '',
    }
  }

  if (params.baseStatus === 'busy') {
    return {
      kind: 'busy' as const,
      accent: 'gray' as const,
      title: params.teamsLabel ?? (locale === 'de' ? 'Beschäftigt' : 'Busy'),
      subtitle: params.endTime ? (locale === 'de' ? `Verfügbar ab ${params.endTime}` : `Available from ${params.endTime}`) : '',
    }
  }

  if (params.baseStatus === 'dnd') {
    return {
      kind: 'dnd' as const,
      accent: 'gray' as const,
      title: params.teamsLabel ?? (locale === 'de' ? 'Nicht stören' : 'Do not disturb'),
      subtitle: params.endTime ? (locale === 'de' ? `Verfügbar ab ${params.endTime}` : `Available from ${params.endTime}`) : '',
    }
  }

  if (params.baseStatus === 'offline') {
    return { kind: 'offline' as const, accent: 'gray' as const, title: 'Offline', subtitle: '' }
  }

  if (params.baseStatus === 'unknown') {
    return { kind: 'unknown' as const, accent: 'gray' as const, title: locale === 'de' ? 'Kein Live-Status' : 'No live status', subtitle: '' }
  }

  if (params.baseStatus === 'away') {
    return {
      kind: 'away' as const,
      accent: 'yellow' as const,
      title: params.teamsLabel ?? (locale === 'de' ? 'Kurz abwesend' : 'Away'),
      subtitle: params.nextTime ? (locale === 'de' ? `Verfügbar bis ${params.nextTime}` : `Available until ${params.nextTime}`) : '',
    }
  }

  return {
    kind: 'available' as const,
    accent: 'green' as const,
    title: locale === 'de' ? 'Verfügbar' : 'Available',
    subtitle: params.nextTime
      ? locale === 'de'
        ? `Verfügbar bis ${params.nextTime}`
        : `Available until ${params.nextTime}`
      : params.isAllDay || scheduleStatus === 'free'
        ? locale === 'de' ? 'Ganztägig verfügbar' : 'Available all day'
        : '',
  }
}

function resolveLocationKind(params: {
  workLocationType?: string | null
  scheduleStatus?: string | null
  baseStatus: PresenceStatus
}): LocationKind {
  const workLocationType = (params.workLocationType ?? '').trim().toLowerCase()
  const scheduleStatus = (params.scheduleStatus ?? '').trim().toLowerCase()

  if (workLocationType === 'remote' || scheduleStatus === 'workingelsewhere' || params.baseStatus === 'remote') return 'remote'
  if (workLocationType === 'office' || params.baseStatus === 'office') return 'office'
  return null
}

export async function GET(request: Request) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const locale = resolveLocale(searchParams.get('lang') || request.headers.get('accept-language'))

  const now = new Date()
  const token = await getAppToken()
  const config = await getReceptionConfig()
  const group = await findGroupByDisplayName(token, config.displayGroupName)

  if (!group) {
    return NextResponse.json(
      { generatedAt: now.toISOString(), people: [], error: `Group '${config.displayGroupName}' was not found.` },
      { status: 200 },
    )
  }

  const groupUsers = await getGroupUsers(token, group.id)
  const users = groupUsers
    .filter((user) => user.accountEnabled !== false)
    .filter((user) => !!(user.mail ?? user.userPrincipalName))
    .map((user) => ({
      id: user.id,
      name: buildPersonName(user),
      email: (user.mail ?? user.userPrincipalName ?? '').trim(),
      jobTitle: user.jobTitle ?? null,
      department: user.department?.trim() || '',
    }))

  const [automaticReplies, presenceSnapshots, schedules, photos] = await Promise.all([
    getUsersAutomaticRepliesByEmail(token, users.map((user) => user.email)),
    getUserPresencesByEntraIds(token, users.map((user) => user.id)),
    getUsersCurrentScheduleByEmail(token, users.map((user) => user.email), now),
    Promise.all(
      users.map(async (user) => ({
        id: user.id,
        image: await getUserPhotoDataUrl(token, user.id).catch(() => null),
      })),
    ),
  ])

  const photoMap = new Map(photos.map((entry) => [entry.id, entry.image]))

  const people = users
    .map((user) => {
      const presence = presenceSnapshots.get(user.id)
      const schedule = schedules.get(user.email.trim().toLowerCase())
      const automaticReply = automaticReplies.get(user.email.trim().toLowerCase())
      const presenceInfo = getTeamsPresenceInfo(presence?.activity ?? presence?.availability, locale)
      const presenceStatus = presenceInfo.kind
      const workLocationType = (presence?.workLocationType ?? '').trim().toLowerCase()
      const scheduleStatus = (schedule?.status ?? '').toLowerCase()
      const automaticReplyStatus = (automaticReply?.status ?? '').toLowerCase()

      let endTime: string | null = schedule?.endTime ?? null
      let baseStatus: PresenceStatus = 'unknown'
      let absenceEnd: Date | null = null
      let isTimedAbsence = false

      const automaticReplyStart = parseGraphDateTime(
        automaticReply?.scheduledStartDateTime ?? null,
        automaticReply?.scheduledStartTimeZone ?? null,
      )
      const automaticReplyEnd = parseGraphDateTime(
        automaticReply?.scheduledEndDateTime ?? null,
        automaticReply?.scheduledEndTimeZone ?? null,
      )
      const automaticReplyActive =
        automaticReplyStatus === 'alwaysenabled' ||
        (automaticReplyStatus === 'scheduled' &&
          !!automaticReplyEnd &&
          (!automaticReplyStart || automaticReplyStart <= now) &&
          automaticReplyEnd > now)

      if (automaticReplyActive) {
        absenceEnd = automaticReplyEnd
        isTimedAbsence = false
        baseStatus = 'long-absence'
        endTime = null
      } else if (scheduleStatus === 'oof') {
        absenceEnd = parseGraphDateTime(schedule?.endDateTime ?? null, schedule?.endTimeZone ?? null)
        isTimedAbsence = false
        baseStatus = 'long-absence'
      } else if (presenceStatus === 'busy') {
        baseStatus = 'busy'
      } else if (presenceStatus === 'dnd') {
        baseStatus = 'dnd'
      } else if (presenceStatus === 'away') {
        baseStatus = 'away'
      } else if (presenceStatus === 'offline') {
        baseStatus = 'offline'
        endTime = null
      } else if (presenceStatus === 'available') {
        if (workLocationType === 'remote') baseStatus = 'remote'
        else if (scheduleStatus === 'workingelsewhere') baseStatus = 'remote'
        else if (workLocationType === 'office') baseStatus = 'office'
        else baseStatus = 'available'
      } else if (scheduleStatus === 'workingelsewhere') {
        baseStatus = 'remote'
        endTime = null
      } else if (['busy', 'tentative'].includes(scheduleStatus)) {
        baseStatus = 'busy'
      } else if (scheduleStatus === 'free') {
        if (workLocationType === 'remote') baseStatus = 'remote'
        else if (workLocationType === 'office') baseStatus = 'office'
        else baseStatus = 'available'
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: photoMap.get(user.id) ?? null,
        jobTitle: user.jobTitle,
        department: user.department,
        sortName: user.name.toLocaleLowerCase('de-DE'),
        activeAbsenceType: null,
        locationKind: resolveLocationKind({ workLocationType, scheduleStatus, baseStatus }),
        status: statusPresentationV3({
          baseStatus,
          endTime,
          nextTime: schedule?.nextStartTime ?? null,
          absenceEnd,
          teamsLabel: presenceInfo.label,
          scheduleStatus,
          isAllDay: schedule?.isAllDay ?? false,
          locale,
        }),
      }
    })
    .sort((a, b) => a.sortName.localeCompare(b.sortName, 'de-DE'))

  return NextResponse.json({
    generatedAt: now.toISOString(),
    people,
  })
}


