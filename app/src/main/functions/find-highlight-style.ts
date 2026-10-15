// As cores dos resultados da busca no design (Busca.dc.html): o ativo em #F5B54A, os outros em
// #FBE7A6, com o texto em #17181C. O Chromium pinta os destaques; ::search-text deixa a página
// trocar as cores (o raio e o halo de 2 px do design não existem para esse pseudo-elemento).
import type { WebContents } from 'electron'

export const FIND_HIGHLIGHT_CSS = `::search-text{background-color:#FBE7A6;color:#17181C}::search-text:current{background-color:#F5B54A;color:#17181C}`

// devolve a chave para remover depois, ou null se a página não aceitou
export async function insertFindHighlightStyle(
  wc: WebContents
): Promise<string | null> {
  try {
    return await wc.insertCSS(FIND_HIGHLIGHT_CSS)
  } catch {
    return null
  }
}

export function removeFindHighlightStyle(wc: WebContents, key: string): void {
  wc.removeInsertedCSS(key).catch(() => {})
}
