// Destinos que uma página nunca abre sozinha: arquivos locais (esta versão não os abre) e a
// própria interface do app (app://shell), que só a janela da shell carrega.
import { isLocalFileUrl } from '@shared/is-local-file-url'

export function isBlockedNavigation(url: string): boolean {
  return isLocalFileUrl(url) || /^app:/i.test(url.trim())
}
