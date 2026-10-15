// Tecla digitada enquanto a barra de busca abre: entra no texto da busca, na ordem em que foi
// digitada (↵ e ⇧↵ andam pelos resultados, esc fecha). Não importa nada que precise do Electron em
// tempo de execução: o portão de teclas é testado no Node.
import { readFindEarlyKey } from '@shared/find-early-key'
import type { EarlyKey } from '@shared/early-key'
import type { MainContext } from '../context'
import { closeFind } from './close-find'
import { followFind } from './follow-find'
import { replaceFindTextAndSearch } from './replace-find-text'

export function applyFindEarlyKey(ctx: MainContext, key: EarlyKey): void {
  const session = ctx.find
  if (!session) return
  // o texto selecionado (seleção da página, ⌘F de novo) some com a primeira tecla de texto
  const { state } = session
  const action = readFindEarlyKey(state.selected ? '' : state.text, key)
  switch (action.kind) {
    case 'text':
      replaceFindTextAndSearch(ctx, action.text)
      break
    case 'step':
      followFind(ctx, action.forward)
      break
    case 'close':
      closeFind(ctx)
      break
  }
}
