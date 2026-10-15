import { formatVisited } from '@shared/format-visited'
import { RowIcon } from './row-icon'
import { SpaceChip } from './space-chip'
import type { PaletteRowProps } from './types'

export function HistoryRow({ item }: PaletteRowProps) {
  if (item.kind !== 'history') return null
  return (
    <>
      <RowIcon name="clock" />
      <span class="pal-title">{item.title}</span>
      <SpaceChip spaceId={item.spaceId} />
      <span class="pal-right">{formatVisited(item.visitedAt, Date.now())}</span>
    </>
  )
}
