// A página não escolhe abrir arquivo local nem a interface do app: link, location, redirecionamento
// e iframe para esses destinos são cancelados em silêncio (como o Chrome faz com file:// vindo
// da web). Navegação digitada pelo usuário passa por loadURL e tem o próprio tratamento (navigate-tab).
import type { WebContents } from 'electron'
import { isBlockedNavigation } from './is-blocked-navigation'

export function guardTabNavigation(wc: WebContents): void {
  const guard = (event: { url: string; preventDefault(): void }) => {
    if (isBlockedNavigation(event.url)) event.preventDefault()
  }
  wc.on('will-navigate', guard)
  wc.on('will-redirect', guard)
  wc.on('will-frame-navigate', guard)
}
