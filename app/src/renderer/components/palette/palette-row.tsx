// Uma linha da paleta. Medidas e cores de Paleta.dc.html e PaletaVazia.dc.html.
import { useEffect, useRef } from 'preact/hooks'
import { paletteSelected } from '../../palette-state'
import { ActionRow } from './action-row'
import { FavoriteRow } from './favorite-row'
import { HistoryRow } from './history-row'
import { runPaletteItem } from './run-item'
import { TabRow } from './tab-row'
import type { PaletteRowProps } from './types'

export function PaletteRow(props: PaletteRowProps) {
  const { item, index, selected, compact } = props
  const ref = useRef<HTMLDivElement>(null)

  // a seleção por teclado acompanha a rolagem
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const kind =
    item.kind === 'tab' && !compact
      ? 'tab'
      : item.kind === 'action' && compact
        ? 'compact'
        : 'plain'

  return (
    <div
      ref={ref}
      id={`pal-row-${index}`}
      class="pal-row"
      data-kind={kind}
      data-selected={selected}
      role="option"
      aria-selected={selected}
      onMouseMove={() => {
        if (paletteSelected.value !== index) paletteSelected.value = index
      }}
      onClick={() => runPaletteItem(item)}
    >
      {item.kind === 'tab' && <TabRow {...props} />}
      {item.kind === 'favorite' && <FavoriteRow {...props} />}
      {item.kind === 'history' && <HistoryRow {...props} />}
      <ActionRow {...props} />
    </div>
  )
}
