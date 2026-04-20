'use client'

import { useState } from 'react'
import { Save, Settings2 } from 'lucide-react'
import type { ReceptionConfig } from '@/lib/config'
import { interpolate, messages, type AppLocale } from '@/lib/i18n'

type Props = {
  initialConfig: ReceptionConfig
  userName: string
  locale: AppLocale
}

function listToText(values: string[]) {
  return values.join('\n')
}

export function SettingsForm({ initialConfig, userName, locale }: Props) {
  const copy = messages[locale].settings
  const [boardTitle, setBoardTitle] = useState(initialConfig.boardTitle)
  const [boardDescription, setBoardDescription] = useState(initialConfig.boardDescription)
  const [displayGroupName, setDisplayGroupName] = useState(initialConfig.displayGroupName)
  const [allowedGroupNames, setAllowedGroupNames] = useState(listToText(initialConfig.allowedGroupNames))
  const [settingsAllowedGroupNames, setSettingsAllowedGroupNames] = useState(listToText(initialConfig.settingsAllowedGroupNames))
  const [setupUsers, setSetupUsers] = useState(listToText(initialConfig.setupUsers))
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(String(initialConfig.autoRefreshSeconds))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    setError(null)

    const normalizedAdminGroups = settingsAllowedGroupNames
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (normalizedAdminGroups.length === 0) {
      setSaving(false)
      setError(copy.adminGroupRequired)
      return
    }

    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardTitle,
        boardDescription,
        displayGroupName,
        allowedGroupNames,
        settingsAllowedGroupNames,
        setupUsers,
        autoRefreshSeconds: Number(autoRefreshSeconds),
      }),
    }).catch(() => null)

    setSaving(false)

    if (!response || !response.ok) {
      const payload = await response?.json().catch(() => null)
      setError(payload?.error || copy.saveFailed)
      return
    }

    setMessage(copy.saveSuccess)
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-4 font-[Segoe_UI,Aptos,Calibri,Arial,sans-serif] text-slate-900 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                <Settings2 size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">{copy.title}</h1>
              <p className="mt-1 text-[14px] text-slate-500">{interpolate(copy.signedInAs, { name: userName })}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {copy.backToBoard}
              </a>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded-[22px] border px-4 py-3 text-[13px] ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
            <h2 className="text-[18px] font-semibold text-slate-950">{copy.board}</h2>
            <div className="mt-4 space-y-4">
              <Field label={copy.boardTitle}>
                <input value={boardTitle} onChange={(e) => setBoardTitle(e.target.value)} className="input" />
              </Field>
              <Field label={copy.description}>
                <textarea value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} className="input min-h-[88px]" />
              </Field>
              <Field label={copy.autoRefreshSeconds}>
                <input value={autoRefreshSeconds} onChange={(e) => setAutoRefreshSeconds(e.target.value)} type="number" min={10} className="input" />
              </Field>
              <Field label={copy.displayGroup}>
                <input value={displayGroupName} onChange={(e) => setDisplayGroupName(e.target.value)} className="input" />
              </Field>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
            <h2 className="text-[18px] font-semibold text-slate-950">{copy.access}</h2>
            <div className="mt-4 space-y-4">
              <Field label={copy.viewerGroups}>
                <textarea value={allowedGroupNames} onChange={(e) => setAllowedGroupNames(e.target.value)} className="input min-h-[120px]" />
              </Field>
              <Field label={copy.adminGroups}>
                <textarea value={settingsAllowedGroupNames} onChange={(e) => setSettingsAllowedGroupNames(e.target.value)} className="input min-h-[120px]" />
              </Field>
              <Field label={copy.setupUsers}>
                <textarea value={setupUsers} onChange={(e) => setSetupUsers(e.target.value)} className="input min-h-[120px]" />
              </Field>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      {children}
    </label>
  )
}
