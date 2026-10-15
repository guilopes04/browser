// Valores padrão do app: janela e configurações.
import type { Rect, Settings } from '@shared/types'

export const DEFAULT_BOUNDS: Rect = { x: 0, y: 0, width: 1440, height: 900 }

export const DEFAULT_SETTINGS: Settings = {
  suspendAfterSec: 1800,
  neverSuspendAudible: true,
  hiddenSidebarStyle: 'hidden',
  searchUrl: 'https://www.google.com/search?q=%s'
}

// sessão antiga ou editada à mão: valor inválido volta ao padrão em vez de derrubar o app
export function sanitizeSettings(
  saved: Partial<Settings> | undefined
): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...saved }
  if (
    typeof settings.suspendAfterSec !== 'number' ||
    !Number.isFinite(settings.suspendAfterSec) ||
    settings.suspendAfterSec < 0
  ) {
    settings.suspendAfterSec = DEFAULT_SETTINGS.suspendAfterSec
  }
  if (typeof settings.neverSuspendAudible !== 'boolean')
    settings.neverSuspendAudible = DEFAULT_SETTINGS.neverSuspendAudible
  if (
    settings.hiddenSidebarStyle !== 'hidden' &&
    settings.hiddenSidebarStyle !== 'compact'
  )
    settings.hiddenSidebarStyle = DEFAULT_SETTINGS.hiddenSidebarStyle
  if (
    typeof settings.searchUrl !== 'string' ||
    !settings.searchUrl.includes('%s')
  ) {
    settings.searchUrl = DEFAULT_SETTINGS.searchUrl
  }
  return settings
}
