import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

export type ReceptionConfig = {
  displayGroupName: string
  allowedGroupNames: string[]
  settingsAllowedGroupNames: string[]
  setupUsers: string[]
  boardTitle: string
  boardDescription: string
  autoRefreshSeconds: number
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseRefresh(value?: string | null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 5) return 15
  return Math.round(parsed)
}

const DEFAULTS: ReceptionConfig = {
  displayGroupName: process.env.RECEPTION_GROUP_NAME || 'Reception',
  allowedGroupNames: splitCsv(process.env.RECEPTION_ALLOWED_GROUPS || 'Reception,IT'),
  settingsAllowedGroupNames: splitCsv(
    process.env.RECEPTION_SETTINGS_ALLOWED_GROUPS || process.env.RECEPTION_ALLOWED_GROUPS || 'IT',
  ),
  setupUsers: splitCsv(process.env.RECEPTION_SETUP_USERS || ''),
  boardTitle: process.env.RECEPTION_BOARD_TITLE || 'Reachboard',
  boardDescription:
    process.env.RECEPTION_BOARD_DESCRIPTION || 'Live overview of availability, location, and calendar-based presence.',
  autoRefreshSeconds: parseRefresh(process.env.RECEPTION_AUTO_REFRESH_SECONDS),
}

function getConfigPath() {
  return process.env.RECEPTION_CONFIG_PATH || '/data/settings.json'
}

function normalizeConfig(input: Partial<ReceptionConfig>): ReceptionConfig {
  return {
    displayGroupName: (input.displayGroupName || DEFAULTS.displayGroupName).trim(),
    allowedGroupNames: Array.from(
      new Set((input.allowedGroupNames ?? DEFAULTS.allowedGroupNames).map((entry) => entry.trim()).filter(Boolean)),
    ),
    settingsAllowedGroupNames: Array.from(
      new Set((input.settingsAllowedGroupNames ?? DEFAULTS.settingsAllowedGroupNames).map((entry) => entry.trim()).filter(Boolean)),
    ),
    setupUsers: Array.from(
      new Set((input.setupUsers ?? DEFAULTS.setupUsers).map((entry) => entry.trim().toLowerCase()).filter(Boolean)),
    ),
    boardTitle: (input.boardTitle || DEFAULTS.boardTitle).trim(),
    boardDescription: (input.boardDescription || DEFAULTS.boardDescription).trim(),
    autoRefreshSeconds: (() => {
      const parsed = Number(input.autoRefreshSeconds)
      if (!Number.isFinite(parsed) || parsed < 5) return DEFAULTS.autoRefreshSeconds
      return Math.round(parsed)
    })(),
  }
}

export async function getReceptionConfig(): Promise<ReceptionConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ReceptionConfig>
    return normalizeConfig(parsed)
  } catch {
    return DEFAULTS
  }
}

export async function saveReceptionConfig(input: Partial<ReceptionConfig>) {
  const config = normalizeConfig(input)
  const configPath = getConfigPath()
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}
