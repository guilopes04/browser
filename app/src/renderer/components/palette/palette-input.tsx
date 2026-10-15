import { useLayoutEffect, useRef } from 'preact/hooks'
import { api } from '../../api'
import {
  paletteMode,
  paletteSelected,
  paletteShowCount,
  paletteText,
  paletteTouched,
  setPaletteText
} from '../../palette-state'
import { SearchIcon } from '../icons'
import { PALETTE_INPUT_ID } from './use-palette-keys'

const LABEL = 'Buscar abas, favoritos, histórico ou digitar endereço'

// o teclado (↑↓ ↵ esc ⇥) é do ouvinte da janela em use-palette-keys
export function PaletteInput() {
  const ref = useRef<HTMLInputElement>(null)
  const text = paletteText.value
  const selected = paletteSelected.value

  // o foco nasce no campo, na mesma tarefa em que ele aparece (antes de qualquer tecla seguinte,
  // por isso layout effect). Modo endereço: a URL fica selecionada (digitar a substitui); senão o
  // cursor vai para depois do texto
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    input.focus()
    if (paletteMode.value === 'address' && !paletteTouched.value) {
      input.select()
      // URL comprida: mostra o começo dela, não o fim da seleção
      input.scrollLeft = 0
    } else input.setSelectionRange(input.value.length, input.value.length)
    // o campo está na tela e com o foco: o main deixa de repassar as teclas
    api.send('keys:ready', { target: { kind: 'palette' } })
  }, [paletteShowCount.value])

  return (
    <div class="pal-search">
      <span class="pal-search-icon">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        id={PALETTE_INPUT_ID}
        class="pal-input"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="pal-list"
        aria-activedescendant={
          selected >= 0 ? `pal-row-${selected}` : undefined
        }
        aria-label={LABEL}
        placeholder={LABEL}
        spellcheck={false}
        autocomplete="off"
        value={text}
        onInput={event => setPaletteText(event.currentTarget.value)}
      />
      {text !== '' && <span class="pal-kbd">esc</span>}
    </div>
  )
}
