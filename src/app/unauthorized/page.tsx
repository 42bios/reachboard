import Link from 'next/link'
import { headers } from 'next/headers'
import { messages, resolveLocale } from '@/lib/i18n'

export default async function UnauthorizedPage() {
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get('accept-language'))
  const copy = messages[locale].unauthorized

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)]">
        <h1 className="text-2xl font-semibold text-slate-950">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {copy.description}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/api/auth/login"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {copy.signIn}
          </Link>
          <Link
            href="/api/auth/logout"
            className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copy.signOut}
          </Link>
        </div>
      </div>
    </main>
  )
}
