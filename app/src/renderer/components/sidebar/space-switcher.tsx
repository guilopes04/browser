import { SPACE_TOKENS } from '@shared/tokens'
import { api } from '../../api'
import { currentSpace, snapshot, theme } from '../../state'
import { ChevronDownIcon } from '../icons'

export function SpaceSwitcher() {
  const snap = snapshot.value
  const space = currentSpace.value
  if (!snap || !space) return null

  const accentOf = (color: keyof typeof SPACE_TOKENS) =>
    SPACE_TOKENS[color][theme.value].accent
  const others = snap.spaces
    .map((other, index) => ({ space: other, shortcut: index + 1 }))
    .filter(entry => entry.space.id !== space.id)
  // clicar no espaço atual passa para o próximo (o seletor completo vem depois)
  const next = others[0]?.space

  return (
    <div class="space-row">
      <button
        type="button"
        class="space-btn"
        aria-label={`Espaço atual: ${space.name}. Trocar de espaço`}
        onClick={() => next && api.send('space:switch', { spaceId: next.id })}
      >
        <span class="space-dot" aria-hidden="true" />
        <span class="space-name">{space.name}</span>
        <ChevronDownIcon color="var(--sec)" />
      </button>
      <div class="grow" />
      {others.map(({ space: other, shortcut }) => (
        <button
          key={other.id}
          type="button"
          class="icon-btn"
          aria-label={`Trocar para ${other.name} (⌃${shortcut})`}
          onClick={() => api.send('space:switch', { spaceId: other.id })}
        >
          <span
            class="other-dot"
            aria-hidden="true"
            style={{ background: accentOf(other.color) }}
          />
        </button>
      ))}
    </div>
  )
}
