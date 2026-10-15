// Teclas que chegam enquanto a paleta ou a Nova aba abrem. O foco passa da página para a shell
// em algum momento depois do ⌘K, ⌘L ou ⌘T, e as teclas digitadas nesse intervalo iam para a página
// ou se perdiam. Nele, o main as intercepta e as repassa à shell por IPC, que mantém a ordem com o
// evento que abre a paleta (ou com a criação da aba). Puro.
import type { TabId } from './types'

export interface EarlyKeyInput {
  type: string
  key: string
  meta: boolean
  control: boolean
  alt: boolean
  shift: boolean
  isComposing?: boolean
}

// o que a shell recebe (keys:early)
export interface EarlyKey {
  key: string
  alt: boolean
  meta: boolean
  shift: boolean
}

// quem espera as teclas: a caixa da paleta ou o campo de busca da Nova aba (aquela aba)
export type KeyGateTarget =
  { kind: 'palette' } | { kind: 'new-tab'; tabId: TabId }

export type EarlyKeyAction =
  // a shell recebe a tecla por IPC
  | { kind: 'forward'; key: EarlyKey }
  // a tecla é descartada: nem a página nem a shell a veem
  | { kind: 'swallow' }
  // composição (acento por tecla morta, IME): o resto da palavra é do campo, sem repasse
  | { kind: 'compose' }
  // segue o caminho normal (atalho de menu, modificador, soltar de tecla)
  | { kind: 'pass' }

// as teclas que a paleta e a Nova aba tratam além do texto
const NAMED_KEYS = new Set([
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'ArrowUp',
  'ArrowDown'
])

// mexem no cursor ou apagam adiante: o texto repassado só cresce no fim e não tem cursor, então
// elas não têm como valer. Descartadas, em vez de irem para a página (um Delete numa caixa de
// entrada de e-mail apagaria mensagens)
const UNMODELED_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

// um caractere de texto (event.key de "a", "ç", "𝒜", " "); as teclas com nome têm mais de um
// Array.from: um caractere fora do plano básico ocupa dois códigos
export function isPrintableKey(key: string): boolean {
  return Array.from(key).length === 1
}

// o texto depois de uma tecla repassada: caracteres entram no fim, Backspace apaga o último.
// null = a tecla não edita o texto
export function applyEarlyKeyToText(
  text: string,
  early: EarlyKey
): string | null {
  if (early.key === 'Backspace') return Array.from(text).slice(0, -1).join('')
  if (isPrintableKey(early.key) && !early.meta) return text + early.key
  return null
}

export function classifyEarlyKey(input: EarlyKeyInput): EarlyKeyAction {
  if (input.type !== 'keyDown') return { kind: 'pass' }
  if (input.isComposing || input.key === 'Dead' || input.key === 'Process')
    return { kind: 'compose' }
  if (input.control) return { kind: 'pass' }
  const key = input.key
  // ⌘ só vale no ⌘↵ (abrir em nova aba); o resto de ⌘ é atalho do menu
  if (input.meta && key !== 'Enter') return { kind: 'pass' }
  if (UNMODELED_KEYS.has(key)) return { kind: 'swallow' }
  if (!isPrintableKey(key) && !NAMED_KEYS.has(key)) return { kind: 'pass' }
  return {
    kind: 'forward',
    key: { key, alt: input.alt, meta: input.meta, shift: input.shift }
  }
}

export function isSameTarget(a: KeyGateTarget, b: KeyGateTarget): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'palette' || (b.kind === 'new-tab' && a.tabId === b.tabId)
}
