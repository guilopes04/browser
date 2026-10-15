// Aba do session.json -> aba em memória: volta dormente, sem áudio e sem carregar.
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import type { SessionFile, Tab } from '@shared/types'

export function hydrateTab(saved: SessionFile['tabs'][number]): Tab {
  return {
    ...saved,
    url: limitUrl(saved.url),
    title: limitTitle(saved.title),
    audible: false,
    dormant: saved.url !== '',
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null,
    blockedPopups: 0,
    dialogBlocked: false
  }
}
