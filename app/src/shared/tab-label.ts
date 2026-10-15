// Texto de uma aba na sidebar. Puro.
import { getHostname } from './url-parts'

// título mostrado: o da página; sem título, o hostname; sem nada, "Nova aba"
export function getTabLabel(title: string, url: string): string {
  if (title.trim()) return title
  if (!url) return 'Nova aba'
  return getHostname(url) || url
}
