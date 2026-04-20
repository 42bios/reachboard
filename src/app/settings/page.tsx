import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionFromCookies } from '@/lib/auth'
import { getReceptionConfig } from '@/lib/config'
import { resolveLocale } from '@/lib/i18n'
import { SettingsForm } from './SettingsForm'
import { SetupAccessForm } from './SetupAccessForm'

export default async function SettingsPage() {
  const config = await getReceptionConfig()
  const session = await getSessionFromCookies()
  const requestHeaders = await headers()
  const locale = resolveLocale(requestHeaders.get('accept-language'))

  if (!session) {
    if (config.settingsAllowedGroupNames.length === 0 && config.setupUsers.length > 0) {
      return <SetupAccessForm setupUsers={config.setupUsers} locale={locale} />
    }
    redirect('/api/auth/login?returnTo=/settings')
  }

  if (!session.canManage) {
    redirect('/unauthorized?reason=admin')
  }

  return <SettingsForm initialConfig={config} userName={session.name} locale={locale} />
}
