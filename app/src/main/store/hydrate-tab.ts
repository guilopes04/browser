// Aba do session.json -> aba em memória: volta dormente, sem áudio e sem carregar.
import type { SessionFile, Tab } from '@shared/types'

export function hydrateTab(saved: SessionFile['tabs'][number]): Tab {
  return {
    ...saved,
    audible: false,
    dormant: saved.url !== '',
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null
  }
}
