// Teclado da paleta: ↑↓ navegam (dão a volta), ↵ executa, ⌘↵ abre o endereço em nova aba, ⌥↵ busca
// na web, ⇥ alterna o escopo, esc fecha. O ouvinte é da janela, não do campo: clicar fora do
// campo não deixa a paleta sem teclado. As teclas digitadas enquanto ela abria chegam do main
// (keys:early) e entram no texto por aqui, na ordem em que foram digitadas.
import { useEffect } from 'preact/hooks'
import { isPrintableKey } from '@shared/early-key'
import { api } from '../../api'
import {
  closePalette,
  movePaletteSelection,
  paletteMode,
  paletteSelected,
  paletteText,
  paletteTouched,
  paletteVisible,
  setPaletteText,
  togglePaletteScope,
  whenResultsReady
} from '../../palette-state'
import { navigateTypedText, runPaletteItem } from './run-item'

export const PALETTE_INPUT_ID = 'pal-input'

export interface KeyLike {
  key: string
  metaKey: boolean
  altKey: boolean
  ctrlKey: boolean
  preventDefault(): void
}

// forwarded: a tecla veio do main, então não vai sozinha para o campo
function isPrintable(event: KeyLike, forwarded: boolean): boolean {
  return (
    isPrintableKey(event.key) &&
    !event.metaKey &&
    !event.ctrlKey &&
    (forwarded || !event.altKey)
  )
}

function onEnter(event: KeyLike): void {
  const kind = event.metaKey ? 'open-url' : event.altKey ? 'web-search' : null
  // sem linha escolhida, no modo endereço, ↵ vai para o que foi digitado
  if (
    !kind &&
    paletteMode.value === 'address' &&
    paletteSelected.value === -1
  ) {
    navigateTypedText(paletteText.value)
    return
  }
  // com a consulta do texto atual ainda a caminho, espera por ela em vez de usar a lista velha
  whenResultsReady(items => {
    const item = kind
      ? items.find(other => other.kind === kind)
      : items[paletteSelected.value]
    if (item) runPaletteItem(item)
  })
}

export function handleKey(event: KeyLike, forwarded: boolean): void {
  if (!paletteVisible.value) return

  const input = document.getElementById(
    PALETTE_INPUT_ID
  ) as HTMLInputElement | null
  if (forwarded || !input) {
    // a tecla não chega ao campo por conta própria (veio do main, ou o campo ainda não existe):
    // entra no texto. No modo endereço, a URL ainda intacta está selecionada: digitar a substitui
    const base =
      paletteMode.value === 'address' && !paletteTouched.value
        ? ''
        : paletteText.value
    if (isPrintable(event, forwarded)) {
      event.preventDefault()
      setPaletteText(base + event.key)
      return
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      setPaletteText(Array.from(base).slice(0, -1).join(''))
      return
    }
  } else if (document.activeElement !== input && !event.metaKey) {
    // o foco saiu do campo: volta, e a tecla digitada cai nele
    input.focus()
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      movePaletteSelection(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      movePaletteSelection(-1)
      break
    case 'Tab': {
      event.preventDefault()
      // no modo endereço, a URL intacta não é uma consulta
      const hasQuery =
        paletteText.value.trim() !== '' &&
        (paletteMode.value === 'search' || paletteTouched.value)
      if (hasQuery) togglePaletteScope()
      break
    }
    case 'Escape':
      event.preventDefault()
      closePalette()
      break
    case 'Enter':
      event.preventDefault()
      onEnter(event)
      break
  }
}

function onKeyDown(event: KeyboardEvent): void {
  // o IME ainda está compondo: ↵ e setas são dele
  if (event.isComposing) return
  handleKey(event, false)
}

export function usePaletteKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    const stopForwarded = api.on('keys:early', ({ target, key: early }) => {
      if (target.kind !== 'palette') return
      handleKey(
        {
          key: early.key,
          altKey: early.alt,
          metaKey: early.meta,
          ctrlKey: false,
          preventDefault: () => {}
        },
        true
      )
    })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      stopForwarded()
    }
  }, [])
}
