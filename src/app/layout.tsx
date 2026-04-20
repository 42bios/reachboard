import './globals.css'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { resolveLocale } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Reachboard',
  description: 'Reception wallboard for Microsoft Teams presence and availability',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get('accept-language'))

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}
