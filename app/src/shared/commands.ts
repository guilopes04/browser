// Ações da paleta (⌘K): só entram as que o app já executa (docs/arquitetura.md, seção 4).
import {
  FIXED_SHORTCUTS,
  getSpaceShortcuts,
  getTabShortcuts
} from './shortcuts'
import type { CommandId, Space, SpaceId } from './types'

// comandos que existem mas não têm atalho: só a paleta os dispara
const NON_SHORTCUT_COMMANDS: readonly CommandId[] = ['suspend-tab']

// o main só executa o que está na lista fechada
export function isKnownCommand(value: unknown): value is CommandId {
  if (NON_SHORTCUT_COMMANDS.includes(value as CommandId)) return true
  return [
    ...FIXED_SHORTCUTS,
    ...getTabShortcuts(),
    ...getSpaceShortcuts(9)
  ].some(shortcut => shortcut.command === value)
}

export interface PaletteAction {
  command: CommandId
  label: string
  // atalho exibido; vazio quando o comando só existe na paleta
  keys: string
  // palavras extras que também encontram a ação
  keywords: string
}

export interface ActionState {
  spaces: Space[]
  currentSpaceId: SpaceId
  // a aba ativa tem página (Nova aba não recarrega)
  canReload: boolean
  // a aba ativa está viva e não é Nova aba
  canSuspend: boolean
  canReopen: boolean
}

function keysOf(command: CommandId): string {
  return (
    FIXED_SHORTCUTS.find(shortcut => shortcut.command === command)?.keys ?? ''
  )
}

export function getPaletteActions(state: ActionState): PaletteAction[] {
  const actions: PaletteAction[] = [
    {
      command: 'new-tab',
      label: 'Nova aba',
      keys: keysOf('new-tab'),
      keywords: 'abrir criar'
    },
    {
      command: 'close-tab',
      label: 'Fechar aba',
      keys: keysOf('close-tab'),
      keywords: 'encerrar'
    }
  ]
  if (state.canReopen)
    actions.push({
      command: 'reopen-tab',
      label: 'Reabrir aba fechada',
      keys: keysOf('reopen-tab'),
      keywords: 'restaurar desfazer'
    })
  if (state.canReload)
    actions.push({
      command: 'reload',
      label: 'Recarregar',
      keys: keysOf('reload'),
      keywords: 'atualizar página'
    })
  actions.push({
    command: 'toggle-sidebar',
    label: 'Mostrar ou ocultar sidebar',
    keys: keysOf('toggle-sidebar'),
    keywords: 'barra lateral esconder alternar'
  })
  if (state.canSuspend)
    actions.push({
      command: 'suspend-tab',
      label: 'Suspender aba',
      keys: '',
      keywords: 'dormir liberar memória'
    })
  // ⌃1…⌃9: só os nove primeiros espaços têm comando
  state.spaces.slice(0, 9).forEach((space, index) => {
    if (space.id === state.currentSpaceId) return
    actions.push({
      command: `space-${(index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`,
      label: `Trocar para ${space.name}`,
      keys: `⌃${index + 1}`,
      keywords: 'espaço mudar ir'
    })
  })
  return actions
}
