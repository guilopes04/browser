// Teclas digitadas enquanto a barra de busca abre (a view dela ainda não existe na tela). O main
// as consome (portão de teclas, shared/early-key.ts) e as aplica ao estado da busca, na ordem.
// Puro.
import { applyEarlyKeyToText, type EarlyKey } from './early-key'

export type FindKeyAction =
  // o texto da busca depois da tecla
  | { kind: 'text'; text: string }
  | { kind: 'step'; forward: boolean }
  | { kind: 'close' }
  // a barra não usa a tecla (setas, ⇥, ⌘↵): descartada
  | { kind: 'ignore' }

export function readFindEarlyKey(text: string, key: EarlyKey): FindKeyAction {
  if (key.key === 'Escape') return { kind: 'close' }
  if (key.key === 'Enter')
    return key.meta ? { kind: 'ignore' } : { kind: 'step', forward: !key.shift }
  const next = applyEarlyKeyToText(text, key)
  return next === null ? { kind: 'ignore' } : { kind: 'text', text: next }
}
