// Título da página para guardar: sem controles nem marcas bidi e sem o #fragmento que o Chromium
// copia do endereço quando a página não tem <title>. Puro.
import { sanitizeTitle } from '@shared/sanitize-title'
import { stripFragmentFromTitle } from '@shared/strip-fragment'

export function pageTitle(title: string, url: string): string {
  return stripFragmentFromTitle(sanitizeTitle(title), url)
}
