// Pinta os resultados da busca com as cores do design na página da sessão: insere o CSS e guarda a
// chave para tirá-lo ao fechar. O CSS inserido vale só para o documento atual, então entra de novo
// a cada página nova (inclusive a que ainda carregava ao abrir a barra, como a aba que acordou).
import type { WebContents } from 'electron'
import type { FindSession, MainContext } from '../context'
import {
  insertFindHighlightStyle,
  removeFindHighlightStyle
} from './find-highlight-style'

export function applyFindHighlight(
  ctx: MainContext,
  session: FindSession,
  wc: WebContents
): void {
  void insertFindHighlightStyle(wc).then(key => {
    if (!key) return
    // a barra fechou (ou outra abriu) enquanto o CSS entrava: ele sai
    if (ctx.find === session && !wc.isDestroyed()) session.cssKey = key
    else if (!wc.isDestroyed()) removeFindHighlightStyle(wc, key)
  })
}
