// Tecla digitada -> atalho do app. O main trata os atalhos na entrada da tecla (antes da página),
// com preventDefault, e o menu fica só como rótulo: uma página que captura ⌘W, ⌘R ou ⌃Tab com
// preventDefault não consegue mais travar o app. Os atalhos vêm de shared/shortcuts.ts, a mesma
// tabela do menu: um atalho novo lá entra aqui sozinho. Puro.
import type { Shortcut } from './shortcuts'

// o que o Electron entrega em before-input-event (KeyboardEvent.key e .code)
export interface KeyInput {
  key: string
  code: string
  shift: boolean
  control: boolean
  alt: boolean
  meta: boolean
}

interface Compiled {
  shortcut: Shortcut
  meta: boolean
  control: boolean
  shift: boolean
  // "plus" casa + e = (⌘+ e ⌘= aumentam o zoom, com ou sem ⇧)
  key: string
}

const KEY_NAMES: Record<string, string> = { plus: '+', tab: 'tab' }

// 'CmdOrCtrl+Shift+T' -> modificadores e a tecla. O app é de macOS: CmdOrCtrl é o ⌘
function compile(shortcut: Shortcut): Compiled {
  const compiled: Compiled = {
    shortcut,
    meta: false,
    control: false,
    shift: false,
    key: ''
  }
  for (const part of shortcut.accelerator.split('+')) {
    const name = part.toLowerCase()
    if (name === 'cmdorctrl' || name === 'cmd' || name === 'command')
      compiled.meta = true
    else if (name === 'ctrl' || name === 'control') compiled.control = true
    else if (name === 'shift') compiled.shift = true
    else compiled.key = name === 'plus' ? 'plus' : (KEY_NAMES[name] ?? name)
  }
  // 'CmdOrCtrl+-': o "-" some no split
  if (compiled.key === '' && shortcut.accelerator.endsWith('+-'))
    compiled.key = '-'
  return compiled
}

const cache = new WeakMap<readonly Shortcut[], Compiled[]>()

function compiled(shortcuts: readonly Shortcut[]): Compiled[] {
  let list = cache.get(shortcuts)
  if (!list) {
    list = shortcuts.map(compile)
    cache.set(shortcuts, list)
  }
  return list
}

// a tecla pelo que ela escreve; em teclado não latino (cirílico, grego...) vale a posição física
export function keyOf(input: Pick<KeyInput, 'key' | 'code'>): string {
  const { key, code } = input
  if (key.length === 1 && key.charCodeAt(0) < 128) return key.toLowerCase()
  if (key === 'Tab') return 'tab'
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]
  return key.toLowerCase()
}

export function matchShortcut(
  input: KeyInput,
  shortcuts: readonly Shortcut[]
): Shortcut | null {
  // ⌥ nunca é atalho do app (⌥⌘I, do desenvolvedor, é do menu)
  if (input.alt) return null
  const key = keyOf(input)
  for (const candidate of compiled(shortcuts)) {
    if (candidate.meta !== input.meta || candidate.control !== input.control)
      continue
    if (candidate.key === 'plus') {
      if (key === '+' || key === '=') return candidate.shortcut
      continue
    }
    if (candidate.key !== key || candidate.shift !== input.shift) continue
    return candidate.shortcut
  }
  return null
}
