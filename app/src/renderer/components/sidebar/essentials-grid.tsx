import { getTileColor } from '@shared/tile-appearance'
import { openFavorite } from '../../actions'
import { getFavoriteLetter } from '../../favorite-letter'
import { currentSpace } from '../../state'
import { Tile } from '../tile'

export function EssentialsGrid() {
  const essentials = (currentSpace.value?.favorites ?? [])
    .filter(favorite => favorite.essential)
    .slice(0, 4)
  if (essentials.length === 0) return null

  return (
    <div class="essentials">
      {essentials.map(favorite => (
        <button
          key={favorite.id}
          type="button"
          class="essential"
          aria-label={favorite.title}
          onClick={() => openFavorite(favorite)}
        >
          <Tile
            size={22}
            letter={
              favorite.letter ?? getFavoriteLetter(favorite.title, favorite.url)
            }
            color={favorite.tile || getTileColor(favorite.title)}
            favicon={favorite.favicon}
          />
        </button>
      ))}
    </div>
  )
}
