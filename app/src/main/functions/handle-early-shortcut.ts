// ⌘K, ⌘L e ⌘T são do app, mesmo em sites que os usam (Slack, Linear). Tratados aqui, na entrada da
// tecla, e não pelo menu: o atalho do menu só dispara depois de a página devolver a tecla como
// "não tratada", uma ida e volta ao renderer dela. Com a página ocupada, as teclas digitadas
// logo depois do atalho chegavam a ela antes de a paleta (ou a Nova aba) abrir, e a página ainda
// via o próprio atalho.
import type { Input } from 'electron'
import { runCommand } from '../actions/run-command'
import type { MainContext } from '../context'

const COMMANDS = {
  k: 'palette',
  l: 'focus-address',
  t: 'new-tab'
} as const

// devolve true quando a tecla era do app (e foi consumida)
export function handleEarlyShortcut(
  ctx: MainContext,
  event: { preventDefault(): void },
  input: Input
): boolean {
  if (
    input.type !== 'keyDown' ||
    !input.meta ||
    input.shift ||
    input.alt ||
    input.control
  )
    return false
  const key = input.key.toLowerCase()
  if (key !== 'k' && key !== 'l' && key !== 't') return false

  event.preventDefault()
  // segurar o atalho não pode abrir e fechar a paleta (nem abrir uma pilha de abas) em sequência
  if (input.isAutoRepeat) return true
  runCommand(ctx, COMMANDS[key])
  return true
}
