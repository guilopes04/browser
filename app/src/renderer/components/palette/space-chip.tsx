// Selo do espaço de origem (ponto no destaque do espaço). Mesma regra para abas, favoritos e
// histórico: só aparece quando o item é de outro espaço que não o atual.
import { SPACE_CHIP } from '@shared/tokens'
import type { SpaceId } from '@shared/types'
import { snapshot } from '../../state'

export function SpaceChip({ spaceId }: { spaceId: SpaceId }) {
  const snap = snapshot.value
  const space = snap?.spaces.find(other => other.id === spaceId)
  if (!snap || !space || spaceId === snap.window.spaceId) return null
  const chip = SPACE_CHIP[space.color][snap.theme]
  return (
    <span class="pal-chip" style={{ background: chip.bg, color: chip.text }}>
      <span class="pal-chip-dot" style={{ background: chip.dot }} />
      {space.name}
    </span>
  )
}
