// Que pedido o estado da busca faz ao Chromium (webContents.findInPage). Puro.
import type { FindState } from './find-state'

// restart: texto novo, "Aa" trocado ou página que recarregou (sessão nova de busca)
// next e previous: o mesmo texto, para o resultado seguinte ou anterior
export type FindDirection = 'restart' | 'next' | 'previous'

export interface FindRequest {
  text: string
  options: { forward: boolean; findNext: boolean; matchCase: boolean }
}

// findNext do Electron é "começar uma sessão nova" (como a documentação diz): true abre a sessão,
// false segue a que já existe. Seguir sem sessão não faz nada e o Chromium nem responde (o
// found-in-page nunca vem), por isso ↵ e ⌘G sem sessão viva recomeçam a busca. Sem texto não há
// pedido: findInPage('') lança erro
export function getFindRequest(
  state: FindState,
  direction: FindDirection
): FindRequest | null {
  if (state.text === '') return null
  const follow = direction !== 'restart' && state.live
  return {
    text: state.text,
    options: {
      forward: direction !== 'previous',
      findNext: !follow,
      matchCase: state.matchCase
    }
  }
}
