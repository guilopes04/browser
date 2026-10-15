// Aba do session.json -> aba em memória: volta dormente, sem áudio e sem carregar.
import { isLocalFileUrl } from '@shared/is-local-file-url'
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import { sanitizeTitle } from '@shared/sanitize-title'
import type { SessionFile, Tab } from '@shared/types'

export function hydrateTab(saved: SessionFile['tabs'][number]): Tab {
  // um file:// no arquivo (sessão antiga ou editada à mão) volta como Nova aba
  const url = isLocalFileUrl(saved.url) ? '' : limitUrl(saved.url)
  return {
    ...saved,
    url,
    title: sanitizeTitle(limitTitle(saved.title)),
    audible: false,
    dormant: url !== '',
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null
  }
}
