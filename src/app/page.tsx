import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ReceptionBoard } from '@/components/ReceptionBoard'
import { getSessionFromCookies } from '@/lib/auth'
import { getReceptionConfig } from '@/lib/config'
import { resolveLocale } from '@/lib/i18n'

export default async function Page() {
  const session = await getSessionFromCookies()
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get('accept-language'))

  if (!session) {
    redirect('/api/auth/login')
  }

  if (!session.allowed) {
    redirect('/unauthorized?reason=group')
  }

  const config = await getReceptionConfig()

  return (
    <ReceptionBoard
      canManage={session.canManage}
      boardTitle={config.boardTitle}
      boardDescription={config.boardDescription}
      autoRefreshSeconds={config.autoRefreshSeconds}
      locale={locale}
    />
  )
}
