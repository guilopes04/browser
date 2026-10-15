// Que pedido o estado da busca faz ao Chromium (webContents.findInPage). Puro.
import type { FindState } from './find-state'

// restart: texto novo ou "Aa" trocado (sessão nova de busca, que começa no destaque ativo)
// reload: a página mudou (navegação, aba que acordou): sessão nova do começo da página
// next e previous: o mesmo texto, para o resultado seguinte ou anterior
export type FindDirection = 'restart' | 'reload' | 'next' | 'previous'

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
  const follow =
    (direction === 'next' || direction === 'previous') && state.live
  return {
    text: state.text,
    options: {
      forward: direction !== 'previous',
      findNext: !follow,
      matchCase: state.matchCase
    }
  }
}

// o Chromium guarda o destaque ativo da sessão anterior, mesmo de uma página que já foi embora, e
// uma sessão nova com o mesmo texto começa depois dele ("2 de 3" numa página recém-carregada).
// Antes de recomeçar numa página nova, a sessão anterior é encerrada
export function shouldResetFindSession(direction: FindDirection): boolean {
  return direction === 'reload'
}
