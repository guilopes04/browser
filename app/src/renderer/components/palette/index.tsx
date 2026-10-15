// Paleta ⌘K e ⌘L (Paleta.dc.html e PaletaVazia.dc.html): véu de 18% sobre a janela inteira e a
// caixa de 640 px no alto. Vive na shell, que o main sobe por cima da página enquanto ela está
// aberta.
import {
  closePalette,
  paletteMode,
  paletteResultText,
  paletteScope,
  paletteSections,
  paletteSelected,
  paletteVisible
} from '../../palette-state'
import { currentSpace } from '../../state'
import { PaletteInput } from './palette-input'
import { PaletteSection } from './palette-section'
import { usePaletteKeys } from './use-palette-keys'

function Footer({ empty }: { empty: boolean }) {
  const scopeHint =
    paletteScope.value === 'all'
      ? `⇥ busca só no ${currentSpace.value?.name ?? 'espaço atual'}`
      : '⇥ busca em todos os espaços'
  // no modo endereço, sem linha escolhida, ↵ navega o que foi digitado
  const goes = paletteMode.value === 'address' && paletteSelected.value === -1
  return (
    <div class="pal-footer">
      <span>↑↓ para navegar</span>
      <span>{goes ? '↵ para ir' : '↵ para abrir'}</span>
      <span class="grow" />
      <span>
        {empty ? 'Digite um endereço ou termo para buscar' : scopeHint}
      </span>
    </div>
  )
}

export function Palette() {
  usePaletteKeys()
  if (!paletteVisible.value) return null
  const sections = paletteSections.value
  const empty = paletteResultText.value.trim() === ''

  // as linhas têm índice contínuo entre as seções
  let offset = 0
  return (
    <div
      class="pal-scrim"
      onMouseDown={event => {
        if (event.target === event.currentTarget) closePalette()
      }}
    >
      {sections && (
        <div
          class="pal"
          role="dialog"
          aria-label="Paleta de comandos"
          // clicar na caixa (lupa, linhas, rodapé) não tira o foco do campo: só o próprio campo
          // recebe o clique de verdade
          onMouseDown={event => {
            if (!(event.target instanceof HTMLInputElement))
              event.preventDefault()
          }}
        >
          <PaletteInput />
          <div class="pal-body" id="pal-list" role="listbox">
            {sections.map(section => {
              const start = offset
              offset += section.items.length
              return (
                <PaletteSection
                  key={section.id}
                  section={section}
                  offset={start}
                  compact={empty}
                />
              )
            })}
          </div>
          <Footer empty={empty} />
        </div>
      )}
    </div>
  )
}
