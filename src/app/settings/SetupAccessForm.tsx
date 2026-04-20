'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { interpolate, messages, type AppLocale } from '@/lib/i18n'

type Props = {
  setupUsers: string[]
  locale: AppLocale
}

export function SetupAccessForm({ setupUsers, locale }: Props) {
  const copy = messages[locale].setup
  const [email, setEmail] = useState(setupUsers[0] ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)

    const response = await fetch('/api/auth/setup-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)

    setLoading(false)

    if (!response || !response.ok) {
      const payload = await response?.json().catch(() => null)
      setError(payload?.error || copy.failed)
      return
    }

    window.location.href = '/settings'
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-4 font-[Segoe_UI,Aptos,Calibri,Arial,sans-serif] text-slate-900 md:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-700">
            <KeyRound size={14} />
            {copy.badge}
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">{copy.title}</h1>
          <p className="mt-2 text-[14px] text-slate-500">{copy.description}</p>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.35)]">
          <label className="block">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{copy.setupUser}</div>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              placeholder="name@company.tld"
            />
          </label>

          {setupUsers.length > 0 ? (
            <p className="mt-3 text-[12px] text-slate-500">{interpolate(copy.allowedUsers, { users: setupUsers.join(', ') })}</p>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound size={14} />
              {loading ? copy.signingIn : copy.signIn}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
