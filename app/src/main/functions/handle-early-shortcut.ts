// Os atalhos do app (⌘W, ⌘R, ⌘[, ⌘], ⌘S, ⌘1…⌘9, ⌃Tab, ⌃⇧Tab, ⇧⌘T, ⌘K, ⌘L, ⌘T, ⌘F, ⌘G, ⇧⌘G, ⌘+, ⌘−,
// ⌘0, ⌃1…⌃9 e os que a tabela de shared/shortcuts.ts ganhar) são tratados aqui, na entrada da
// tecla, antes da página e com preventDefault, e não pelo menu: o atalho do menu só dispara depois
// de a página devolver a tecla como "não tratada", e uma página que chama preventDefault em ⌘W ou
// ⌃Tab prenderia o usuário nela. O menu continua só como rótulo (e como caminho do clique do
// mouse). Também resolve a corrida do ⌘K, ⌘L, ⌘T e ⌘F: as teclas digitadas logo depois do atalho
// chegavam à página antes de a paleta (a Nova aba ou a barra de busca) abrir, e a página ainda via
// o próprio atalho.
import type { Input } from 'electron'
import { matchShortcut } from '@shared/match-shortcut'
import {
  FIXED_SHORTCUTS,
  getSpaceShortcuts,
  getTabShortcuts
} from '@shared/shortcuts'
import type { CommandId } from '@shared/types'
import { runCommand } from '../actions/run-command'
import type { MainContext } from '../context'

// ⌃1…⌃9: até nove espaços; o runCommand ignora o que não existe
const SHORTCUTS = [
  ...FIXED_SHORTCUTS,
  ...getTabShortcuts(),
  ...getSpaceShortcuts(9)
]

// segurar a tecla repete o atalho: só o zoom e o passo da busca (⌘G, ⇧⌘G seguem andando pelos
// resultados) fazem sentido repetir. Nos demais, segurar ⌘W fecharia uma pilha de abas e segurar
// ⌘K abriria e fecharia a paleta em sequência
const REPEATABLE: ReadonlySet<CommandId> = new Set([
  'zoom-in',
  'zoom-out',
  'find-next',
  'find-previous'
])

// devolve true quando a tecla era do app (e foi consumida)
export function handleEarlyShortcut(
  ctx: MainContext,
  event: { preventDefault(): void },
  input: Input
): boolean {
  // composição de texto (acento por tecla morta, IME) não é atalho
  if (input.isComposing) return false
  const shortcut = matchShortcut(input, SHORTCUTS)
  if (!shortcut) return false

  // a página não vê nem o keyDown nem o keyUp do atalho
  event.preventDefault()
  if (input.type !== 'keyDown') return true
  if (input.isAutoRepeat && !REPEATABLE.has(shortcut.command)) return true
  runCommand(ctx, shortcut.command)
  return true
}
