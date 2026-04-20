export type AppLocale = 'de' | 'en'

export function resolveLocale(input?: string | null): AppLocale {
  const normalized = (input ?? '').trim().toLowerCase()
  return normalized.startsWith('en') ? 'en' : 'de'
}

export function getLocaleTag(locale: AppLocale) {
  return locale === 'de' ? 'de-DE' : 'en-US'
}

export const messages = {
  de: {
    board: {
      office: 'Büro',
      remote: 'Remote',
      searchAddPlaceholder: 'Person zum Hinzufügen suchen ...',
      searchPlaceholder: 'Name, Abteilung oder Status',
      showHeader: 'Kopfbereich einblenden',
      hideHeader: 'Kopfbereich ausblenden',
      done: 'Fertig',
      edit: 'Bearbeiten',
      settings: 'Einstellungen',
      refresh: 'Aktualisieren',
      hide: 'Ausblenden',
      editBoard: 'Board bearbeiten',
      editBoardHint: 'Personen verschieben, mit X ausblenden und über die Suche wieder hinzufügen.',
      resetAlphabetical: 'Alphabetisch zurücksetzen',
      visibleSummary: '{visible} sichtbar / {total} gesamt',
      hiddenPeople: 'Ausgeblendete Personen',
      loading: 'Reachboard wird geladen...',
      allEmployees: 'Alle Mitarbeitenden',
      peopleCount: '{count} Personen',
      noResults: 'Keine Treffer',
      noResultsHint: 'Für diesen Bereich gibt es aktuell keine passenden Personen.',
      hidePerson: '{name} ausblenden',
      autoRefresh: 'Auto-Refresh alle {seconds} Sekunden',
      lastUpdated: 'Zuletzt aktualisiert:',
    },
    settings: {
      saveFailed: 'Die Reachboard-Einstellungen konnten nicht gespeichert werden.',
      saveSuccess: 'Einstellungen gespeichert. Reachboard verwendet den neuen Stand sofort.',
      badge: 'Reachboard Settings',
      title: 'Einstellungen',
      signedInAs: 'Angemeldet als {name}. Hier steuerst du Zugriffsgruppen, Anzeigegruppe und Board-Verhalten.',
      backToBoard: 'Zum Board',
      save: 'Speichern',
      saving: 'Speichern ...',
      board: 'Board',
      access: 'Zugriff',
      boardTitle: 'Board-Titel',
      description: 'Beschreibung',
      autoRefreshSeconds: 'Auto-Refresh in Sekunden',
      displayGroup: 'Angezeigte Entra-Gruppe',
      viewerGroups: 'Viewer-Gruppen',
      adminGroups: 'Settings-Admin-Gruppen',
      setupUsers: 'Setup-User (E-Mail / UPN)',
      adminGroupRequired: 'Bitte mindestens eine Settings-Admin-Gruppe angeben.',
    },
    setup: {
      failed: 'Der temporäre Setup-Login ist fehlgeschlagen.',
      badge: 'Temporärer Setup-Zugang',
      title: 'Reachboard einrichten',
      description:
        'Solange noch keine Admin-Gruppe gesetzt ist, kann sich ein definierter Setup-User einmalig ohne Passwort anmelden, um die erste Admin-Gruppe zu hinterlegen.',
      setupUser: 'Setup-User (E-Mail / UPN)',
      allowedUsers: 'Erlaubte Setup-User: {users}',
      signIn: 'Temporär anmelden',
      signingIn: 'Anmelden ...',
    },
    unauthorized: {
      title: 'Kein Zugriff',
      description: 'Dieses Reachboard ist nur für autorisierte Microsoft-365-Gruppen freigegeben.',
      signIn: 'Mit Microsoft anmelden',
      signOut: 'Abmelden',
    },
  },
  en: {
    board: {
      office: 'Office',
      remote: 'Remote',
      searchAddPlaceholder: 'Search for a person to add ...',
      searchPlaceholder: 'Name, department, or status',
      showHeader: 'Show header',
      hideHeader: 'Hide header',
      done: 'Done',
      edit: 'Edit',
      settings: 'Settings',
      refresh: 'Refresh',
      hide: 'Hide',
      editBoard: 'Edit board',
      editBoardHint: 'Reorder people, hide them with X, and restore them through search.',
      resetAlphabetical: 'Reset alphabetical order',
      visibleSummary: '{visible} visible / {total} total',
      hiddenPeople: 'Hidden people',
      loading: 'Reachboard is loading...',
      allEmployees: 'All employees',
      peopleCount: '{count} people',
      noResults: 'No results',
      noResultsHint: 'There are currently no matching people for this view.',
      hidePerson: 'Hide {name}',
      autoRefresh: 'Auto-refresh every {seconds} seconds',
      lastUpdated: 'Last updated:',
    },
    settings: {
      saveFailed: 'Could not save the Reachboard settings.',
      saveSuccess: 'Settings saved. Reachboard is already using the updated values.',
      badge: 'Reachboard Settings',
      title: 'Settings',
      signedInAs: 'Signed in as {name}. Manage access groups, the display group, and board behavior here.',
      backToBoard: 'Back to board',
      save: 'Save',
      saving: 'Saving ...',
      board: 'Board',
      access: 'Access',
      boardTitle: 'Board title',
      description: 'Description',
      autoRefreshSeconds: 'Auto-refresh in seconds',
      displayGroup: 'Displayed Entra group',
      viewerGroups: 'Viewer groups',
      adminGroups: 'Settings admin groups',
      setupUsers: 'Setup users (email / UPN)',
      adminGroupRequired: 'Please specify at least one settings admin group.',
    },
    setup: {
      failed: 'The temporary setup login failed.',
      badge: 'Temporary setup access',
      title: 'Set up Reachboard',
      description:
        'As long as no admin group has been configured yet, a predefined setup user can sign in once without a password to configure the first admin group.',
      setupUser: 'Setup user (email / UPN)',
      allowedUsers: 'Allowed setup users: {users}',
      signIn: 'Temporary sign-in',
      signingIn: 'Signing in ...',
    },
    unauthorized: {
      title: 'No access',
      description: 'This Reachboard is only available to authorized Microsoft 365 groups.',
      signIn: 'Sign in with Microsoft',
      signOut: 'Sign out',
    },
  },
} as const

export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}
