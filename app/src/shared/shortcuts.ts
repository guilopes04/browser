// Lista fechada de atalhos (docs/arquitetura.md, seção 4). O menu do app é gerado daqui.
import type { CommandId } from './types'

export type MenuGroup = 'file' | 'edit' | 'view' | 'navigate' | 'spaces'

export interface Shortcut {
  command: CommandId
  label: string
  // formato do Electron (Accelerator)
  accelerator: string
  // texto exibido na interface
  keys: string
  group: MenuGroup
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const FIXED_SHORTCUTS: Shortcut[] = [
  {
    command: 'new-tab',
    label: 'Nova aba',
    accelerator: 'CmdOrCtrl+T',
    keys: '⌘T',
    group: 'file'
  },
  {
    command: 'close-tab',
    label: 'Fechar aba',
    accelerator: 'CmdOrCtrl+W',
    keys: '⌘W',
    group: 'file'
  },
  {
    command: 'reopen-tab',
    label: 'Reabrir aba fechada',
    accelerator: 'CmdOrCtrl+Shift+T',
    keys: '⇧⌘T',
    group: 'file'
  },
  {
    command: 'find',
    label: 'Buscar na Página…',
    accelerator: 'CmdOrCtrl+F',
    keys: '⌘F',
    group: 'edit'
  },
  {
    command: 'find-next',
    label: 'Buscar Próximo',
    accelerator: 'CmdOrCtrl+G',
    keys: '⌘G',
    group: 'edit'
  },
  {
    command: 'find-previous',
    label: 'Buscar Anterior',
    accelerator: 'CmdOrCtrl+Shift+G',
    keys: '⇧⌘G',
    group: 'edit'
  },
  {
    command: 'toggle-sidebar',
    label: 'Mostrar ou ocultar sidebar',
    accelerator: 'CmdOrCtrl+S',
    keys: '⌘S',
    group: 'view'
  },
  {
    command: 'reload',
    label: 'Recarregar',
    accelerator: 'CmdOrCtrl+R',
    keys: '⌘R',
    group: 'view'
  },
  {
    command: 'zoom-in',
    label: 'Aumentar zoom',
    accelerator: 'CmdOrCtrl+Plus',
    keys: '⌘+',
    group: 'view'
  },
  {
    command: 'zoom-out',
    label: 'Diminuir zoom',
    accelerator: 'CmdOrCtrl+-',
    keys: '⌘−',
    group: 'view'
  },
  {
    command: 'zoom-reset',
    label: 'Tamanho real',
    accelerator: 'CmdOrCtrl+0',
    keys: '⌘0',
    group: 'view'
  },
  {
    command: 'back',
    label: 'Voltar',
    accelerator: 'CmdOrCtrl+[',
    keys: '⌘[',
    group: 'navigate'
  },
  {
    command: 'forward',
    label: 'Avançar',
    accelerator: 'CmdOrCtrl+]',
    keys: '⌘]',
    group: 'navigate'
  },
  {
    command: 'palette',
    label: 'Paleta de comandos',
    accelerator: 'CmdOrCtrl+K',
    keys: '⌘K',
    group: 'navigate'
  },
  {
    command: 'focus-address',
    label: 'Ir para o endereço',
    accelerator: 'CmdOrCtrl+L',
    keys: '⌘L',
    group: 'navigate'
  },
  {
    command: 'next-tab',
    label: 'Próxima aba',
    accelerator: 'Ctrl+Tab',
    keys: '⌃⇥',
    group: 'navigate'
  },
  {
    command: 'prev-tab',
    label: 'Aba anterior',
    accelerator: 'Ctrl+Shift+Tab',
    keys: '⌃⇧⇥',
    group: 'navigate'
  }
]

// ⌘1…⌘9: n-ésima aba do espaço; ⌘9 = a última
export function getTabShortcuts(): Shortcut[] {
  return DIGITS.map(n => ({
    command: `tab-${n}` as const,
    label: n === 9 ? 'Última aba' : `Aba ${n}`,
    accelerator: `CmdOrCtrl+${n}`,
    keys: `⌘${n}`,
    group: 'navigate' as const
  }))
}

// ⌃1…⌃n: só até o número de espaços existentes
export function getSpaceShortcuts(spaceCount: number): Shortcut[] {
  return DIGITS.filter(n => n <= spaceCount).map(n => ({
    command: `space-${n}` as const,
    label: `Ir para o espaço ${n}`,
    accelerator: `Ctrl+${n}`,
    keys: `⌃${n}`,
    group: 'spaces' as const
  }))
}
