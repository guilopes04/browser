import type { PaletteSection as Section } from '@shared/types'
import { paletteSelected } from '../../palette-state'
import { PaletteRow } from './palette-row'

const TITLES: Record<Section['id'], string> = {
  recent: 'Abas recentes',
  tabs: 'Abas abertas',
  favorites: 'Favoritos',
  history: 'Histórico',
  actions: 'Ações'
}

interface PaletteSectionProps {
  section: Section
  // posição do primeiro item da seção na lista de todos os itens
  offset: number
  compact: boolean
}

export function PaletteSection({
  section,
  offset,
  compact
}: PaletteSectionProps) {
  const selected = paletteSelected.value
  return (
    <section aria-label={TITLES[section.id]}>
      <div class="pal-section-title">{TITLES[section.id]}</div>
      {section.items.map((item, i) => (
        <PaletteRow
          key={offset + i}
          item={item}
          index={offset + i}
          selected={selected === offset + i}
          compact={compact}
        />
      ))}
    </section>
  )
}
