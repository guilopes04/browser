// Texto de uma aba na sidebar. Puro.
import { sanitizeTitle } from './sanitize-title'
import { getHostname } from './url-parts'

// título mostrado: o da página (sem controles nem marcas bidi); sem título, o hostname; sem nada,
// "Nova aba"
export function getTabLabel(title: string, url: string): string {
  const clean = sanitizeTitle(title)
  if (clean) return clean
  if (!url) return 'Nova aba'
  return getHostname(url) || url
}
