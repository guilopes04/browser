// O que fazer com um download que a página iniciou. Pura.
//
// Com gesto recente do usuário na aba (ou pedido pelo próprio app, como "Salvar imagem como"), o
// download segue. Sem gesto, o usuário decide num diálogo: um por vez e, depois de uma recusa,
// um intervalo sem novos diálogos. E nenhuma aba segura mais de 20 downloads ao mesmo tempo.
import type { DownloadPrompt } from '../web-guard'

export const MAX_DOWNLOADS_PER_TAB = 20
// depois de o usuário recusar, a aba não pergunta de novo por este tempo
export const DOWNLOAD_COOLDOWN_MS = 10_000

export type DownloadDecision =
  // baixa já
  | 'allow'
  // baixa se o usuário permitir no diálogo
  | 'ask'
  // recusa em silêncio
  | 'reject-limit'
  | 'reject-busy'
  | 'reject-cooldown'

export interface DownloadFacts {
  // o app pediu este download (menu "Salvar imagem como")
  userInitiated: boolean
  hasGesture: boolean
  // downloads em andamento nesta aba
  running: number
  prompt: DownloadPrompt | undefined
  now: number
}

export function decideDownload(facts: DownloadFacts): DownloadDecision {
  if (facts.running >= MAX_DOWNLOADS_PER_TAB) return 'reject-limit'
  if (facts.userInitiated || facts.hasGesture) return 'allow'
  if (facts.prompt?.pending) return 'reject-busy'
  if (facts.prompt && facts.now < facts.prompt.deniedUntil)
    return 'reject-cooldown'
  return 'ask'
}
