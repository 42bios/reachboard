'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building,
  ChevronDown,
  ChevronUp,
  GripVertical,
  House,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Users,
  X,
} from 'lucide-react'
import { getLocaleTag, interpolate, messages, type AppLocale } from '@/lib/i18n'

type ReceptionPerson = {
  id: string
  name: string
  email: string
  image?: string | null
  jobTitle?: string | null
  department: string
  sortName: string
  activeAbsenceType?: string | null
  locationKind?: 'office' | 'remote' | null
  status: {
    kind: string
    accent: 'green' | 'yellow' | 'violet' | 'gray'
    title: string
    subtitle: string
  }
}

type ReceptionPayload = {
  generatedAt: string
  people: ReceptionPerson[]
}

type LayoutState = {
  order: string[]
  hidden: string[]
}

type ReceptionBoardProps = {
  canManage?: boolean
  boardTitle?: string
  boardDescription?: string
  autoRefreshSeconds?: number
  locale?: AppLocale
}

const STORAGE_KEY = 'reachboard-layout-v1'
const HEADER_STORAGE_KEY = 'reachboard-header-collapsed-v1'

function readLayout(): LayoutState {
  if (typeof window === 'undefined') return { order: [], hidden: [] }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { order: [], hidden: [] }
    const parsed = JSON.parse(raw) as Partial<LayoutState>
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((value): value is string => typeof value === 'string') : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((value): value is string => typeof value === 'string') : [],
    }
  } catch {
    return { order: [], hidden: [] }
  }
}

function writeLayout(layout: LayoutState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
}

function readHeaderCollapsed() {
  if (typeof window === 'undefined') return true
  const value = window.localStorage.getItem(HEADER_STORAGE_KEY)
  if (value === null) return true
  return value === 'true'
}

function writeHeaderCollapsed(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(HEADER_STORAGE_KEY, value ? 'true' : 'false')
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="reception-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
      {initials}
    </div>
  )
}

function PresenceBadge({ kind, accent }: { kind: string; accent: ReceptionPerson['status']['accent'] }) {
  if (accent === 'violet') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="white" stroke="#c000d6" strokeWidth="2" />
        <path
          d="M14.8 12H8.8M8.8 12l2.8-2.8M8.8 12l2.8 2.8"
          fill="none"
          stroke="#c000d6"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'dnd') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#c23253" />
        <path d="M7 12h10" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === 'busy') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#c23253" />
      </svg>
    )
  }

  if (kind === 'away' || accent === 'yellow') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#ffd92e" />
        <path
          d="M12 6.8v5.1l3.4 2.4"
          fill="none"
          stroke="white"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'offline' || kind === 'unknown') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="white" stroke="#9ca3af" strokeWidth="2" />
        <path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#76b01f" />
      <path d="M7.2 12.2l3.1 3.2 6.5-7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LocationIcon({ kind }: { kind: string }) {
  if (kind === 'remote') return <House size={15} strokeWidth={1.9} className="text-slate-500" />
  if (kind === 'office') return <Building size={15} strokeWidth={1.9} className="text-slate-500" />
  return null
}

function LocationLabel({ kind, locale }: { kind?: 'office' | 'remote' | null; locale: AppLocale }) {
  if (!kind) return null

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
      <LocationIcon kind={kind} />
      {kind === 'office' ? messages[locale].board.office : messages[locale].board.remote}
    </span>
  )
}

export function ReceptionBoard({
  canManage = false,
  boardTitle = 'Reachboard',
  boardDescription = 'Live overview of availability, location, and calendar-based presence.',
  autoRefreshSeconds = 60,
  locale = 'de',
}: ReceptionBoardProps) {
  const copy = messages[locale].board
  const localeTag = getLocaleTag(locale)
  const [data, setData] = useState<ReceptionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [layout, setLayout] = useState<LayoutState>({ order: [], hidden: [] })
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    setLayout(readLayout())
    setHeaderCollapsed(readHeaderCollapsed())

    let active = true
    let timeoutId: number | null = null
    let failureCount = 0
    const baseIntervalMs = Math.max(5, autoRefreshSeconds) * 1000

    const run = async () => {
      try {
        const response = await fetch(`/api/reception?lang=${locale}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Reception fetch failed: ${response.status}`)
        }
        const payload = await response.json()
        if (!active) return
        setData(payload)
        failureCount = 0
      } catch {
        failureCount += 1
      } finally {
        if (!active) return
        setLoading(false)
        const nextDelayMs = failureCount ? Math.min(30000, baseIntervalMs * 2 ** Math.min(failureCount, 3)) : baseIntervalMs
        timeoutId = window.setTimeout(run, nextDelayMs)
      }
    }

    void run()

    return () => {
      active = false
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [autoRefreshSeconds, locale])

  async function manualRefresh() {
    setLoading(true)
    try {
      const response = await fetch(`/api/reception?lang=${locale}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Reception fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      setData(payload)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!data?.people) return
    setLayout((current) => {
      const knownIds = new Set(data.people.map((person) => person.id))
      const order = current.order.filter((id) => knownIds.has(id))
      const hidden = current.hidden.filter((id) => knownIds.has(id))
      const missing = data.people.map((person) => person.id).filter((id) => !order.includes(id))
      const next = { order: [...order, ...missing], hidden }
      writeLayout(next)
      return next
    })
  }, [data])

  useEffect(() => {
    if (!search.trim()) return
    const timeout = window.setTimeout(() => {
      setSearch('')
    }, 15000)
    return () => window.clearTimeout(timeout)
  }, [search])

  const allPeople = useMemo(() => data?.people ?? [], [data])
  const peopleById = useMemo(() => new Map(allPeople.map((person) => [person.id, person])), [allPeople])

  const orderedPeople = useMemo(() => {
    const order = layout.order.length ? layout.order : allPeople.map((person) => person.id)
    return order.map((id) => peopleById.get(id)).filter((person): person is ReceptionPerson => !!person)
  }, [allPeople, layout.order, peopleById])

  const visiblePeople = useMemo(() => orderedPeople.filter((person) => !layout.hidden.includes(person.id)), [orderedPeople, layout.hidden])

  const normalizedSearch = search.trim().toLocaleLowerCase(localeTag)

  const filteredVisiblePeople = useMemo(() => {
    return visiblePeople.filter((person) => {
      if (!normalizedSearch) return true
      return [person.name, person.email, person.department, person.jobTitle ?? '', person.status.title].some((value) =>
        value.toLocaleLowerCase(localeTag).includes(normalizedSearch),
      )
    })
  }, [localeTag, normalizedSearch, visiblePeople])

  const hiddenPeople = useMemo(() => {
    return orderedPeople
      .filter((person) => layout.hidden.includes(person.id))
      .filter((person) => {
        if (!normalizedSearch) return true
        return [person.name, person.email, person.department, person.jobTitle ?? ''].some((value) =>
          value.toLocaleLowerCase(localeTag).includes(normalizedSearch),
        )
      })
  }, [layout.hidden, localeTag, normalizedSearch, orderedPeople])

  function saveLayout(next: LayoutState) {
    setLayout(next)
    writeLayout(next)
  }

  function hidePerson(id: string) {
    if (layout.hidden.includes(id)) return
    saveLayout({ ...layout, hidden: [...layout.hidden, id] })
  }

  function showPerson(id: string) {
    saveLayout({ ...layout, hidden: layout.hidden.filter((value) => value !== id) })
  }

  function movePerson(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    const nextOrder = [...layout.order]
    const sourceIndex = nextOrder.indexOf(sourceId)
    const targetIndex = nextOrder.indexOf(targetId)
    if (sourceIndex === -1 || targetIndex === -1) return
    nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, sourceId)
    saveLayout({ ...layout, order: nextOrder })
  }

  function resetOrderAlphabetical() {
    const alphabeticalOrder = [...allPeople]
      .sort((a, b) => a.sortName.localeCompare(b.sortName, localeTag))
      .map((person) => person.id)
    saveLayout({ ...layout, order: alphabeticalOrder })
  }

  function toggleHeader() {
    setHeaderCollapsed((current) => {
      const next = !current
      writeHeaderCollapsed(next)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-3 py-3 font-['Segoe_UI',Aptos,Calibri,Arial,sans-serif] text-slate-900 md:px-4">
      <div className="pointer-events-none fixed right-3 top-3 z-40 md:right-4 md:top-4">
        <div className="pointer-events-auto flex flex-col gap-2 rounded-[26px] border border-white/70 bg-white/76 p-2 shadow-[0_24px_54px_-30px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:flex-row sm:items-center">
          <div className="flex min-w-[290px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/82 px-3 py-2.5 backdrop-blur-md">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={editing ? copy.searchAddPlaceholder : copy.searchPlaceholder}
              className="w-full bg-transparent text-[14px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-none space-y-4">
        {headerCollapsed ? (
          <header className="relative h-3 overflow-visible">
            <div className="absolute inset-x-2 top-0 h-[5px] rounded-b-[12px] border-x border-b border-white/70 bg-white/72 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl" />
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <button
                type="button"
                onClick={toggleHeader}
                className="inline-flex h-8 w-10 items-center justify-center rounded-b-2xl border border-white/70 border-t-0 bg-white/76 text-slate-600 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.4)] backdrop-blur-xl transition hover:bg-white/88 hover:text-slate-800"
                title={copy.showHeader}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </header>
        ) : (
          <header className="rounded-[24px] border border-slate-200 bg-white px-4 py-2 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-2">
              <div>
                <h1 className="text-[20px] font-semibold tracking-tight text-slate-950">{boardTitle}</h1>
                <p className="mt-0.5 text-[12px] text-slate-500">{boardDescription}</p>
              </div>

              <div className="flex justify-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing((value) => !value)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition ${
                      editing ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {editing ? copy.done : copy.edit}
                  </button>

                  {canManage ? (
                    <a
                      href="/settings"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings2 size={15} />
                      {copy.settings}
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={manualRefresh}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <RefreshCw size={15} />
                    {copy.refresh}
                  </button>

                  <button
                    type="button"
                    onClick={toggleHeader}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                    title={copy.hideHeader}
                  >
                    <ChevronUp size={15} />
                    {copy.hide}
                  </button>
                </div>
              </div>
            </div>
          </header>
        )}

        {editing ? (
          <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-950">{copy.editBoard}</h2>
                <p className="mt-1 text-[13px] text-slate-500">{copy.editBoardHint}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetOrderAlphabetical}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {copy.resetAlphabetical}
                </button>
                <div className="text-[12px] text-slate-400">{interpolate(copy.visibleSummary, { visible: visiblePeople.length, total: allPeople.length })}</div>
              </div>
            </div>

            {hiddenPeople.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-3 text-[12px] font-medium text-slate-600">{copy.hiddenPeople}</p>
                <div className="flex flex-wrap gap-2">
                  {hiddenPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => showPerson(person.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 transition hover:border-slate-300"
                    >
                      <Plus size={12} />
                      <span>{person.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {loading && !data ? (
          <section className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {copy.loading}
            </div>
          </section>
        ) : (
          <section className="space-y-2.5">
            <div className="flex items-end justify-between px-1">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-slate-950">{copy.allEmployees}</h2>
                <p className="text-[13px] text-slate-500">{interpolate(copy.peopleCount, { count: filteredVisiblePeople.length })}</p>
              </div>
            </div>

            {filteredVisiblePeople.length === 0 ? (
              <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white text-center shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Users size={20} />
                </div>
                <p className="text-[15px] font-semibold text-slate-900">{copy.noResults}</p>
                <p className="mt-1 text-[13px] text-slate-500">{copy.noResultsHint}</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2.5">
                {filteredVisiblePeople.map((person, index) => (
                  <article
                    key={person.id}
                    draggable={editing}
                    onDragStart={() => setDraggedId(person.id)}
                    onDragOver={(event) => {
                      if (!editing) return
                      event.preventDefault()
                    }}
                    onDrop={() => {
                      if (!editing || !draggedId) return
                      movePerson(draggedId, person.id)
                      setDraggedId(null)
                    }}
                    style={{ animationDelay: `${Math.min(index * 22, 220)}ms` }}
                    className={`reception-card rounded-[24px] border border-slate-200/90 px-3 py-2.5 ${editing ? 'cursor-move' : ''}`}
                  >
                    <div className="reception-card-body flex items-start gap-3">
                      <div className="relative shrink-0">
                        {person.image ? (
                          <img src={person.image} alt={person.name} className="reception-avatar h-11 w-11 rounded-full object-cover" />
                        ) : (
                          <InitialAvatar name={person.name} />
                        )}
                        <div className="reception-badge-shell absolute -bottom-1.5 -right-2.5">
                          <PresenceBadge kind={person.status.kind} accent={person.status.accent} />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {editing ? <GripVertical size={14} className="shrink-0 text-slate-300" /> : null}
                              <h3 className="min-w-0 pr-1 text-[15px] font-semibold leading-5 text-slate-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                                {person.name}
                              </h3>
                            </div>
                            <p className="mt-0.5 text-[12px] leading-4 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                              {person.jobTitle || person.email}
                            </p>
                          </div>

                          {editing ? (
                            <button
                              type="button"
                              onClick={() => hidePerson(person.id)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                              aria-label={interpolate(copy.hidePerson, { name: person.name })}
                            >
                              <X size={11} />
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-2.5">
                          <div className="flex flex-wrap items-start gap-2 text-[14px] font-medium text-slate-800">
                            <LocationLabel kind={person.locationKind ?? null} locale={locale} />
                            <span className="min-w-0 flex-1 text-[14px] leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                              {person.status.title}
                            </span>
                          </div>
                          {person.status.subtitle ? <p className="mt-1 pl-0 text-[12px] leading-4 text-slate-500">{person.status.subtitle}</p> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
          <span>{interpolate(copy.autoRefresh, { seconds: Math.max(5, autoRefreshSeconds) })}</span>
          <span>
            {copy.lastUpdated}{' '}
            {data?.generatedAt ? new Intl.DateTimeFormat(localeTag, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data.generatedAt)) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}
