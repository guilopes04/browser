// Nova aba (NovaAba.dc.html): só busca e os favoritos do espaço. Desenhada pela shell, sem webContents.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'
import { getTileColor } from '@shared/tile-appearance'
import { api } from '../../api'
import { openFavorite } from '../../actions'
import { getFavoriteLetter } from '../../favorite-letter'
import { getNewTabText, setNewTabText, submitNewTab } from '../../new-tab-state'
import { paletteVisible } from '../../palette-state'
import { activeTab, addressFocusRequest, currentSpace } from '../../state'
import { SearchIcon } from '../icons'
import { Tile } from '../tile'

export function NewTab() {
  const tab = activeTab.value
  const favorites = currentSpace.value?.favorites ?? []
  const inputRef = useRef<HTMLInputElement>(null)
  const request = addressFocusRequest.value
  const handledRequest = useRef(request)
  const paletteOpen = paletteVisible.value
  const tabId = tab?.id
  // o texto digitado logo depois do ⌘T chega do main antes do campo existir (new-tab-state.ts)
  const text = tabId ? getNewTabText(tabId) : ''

  // a Nova aba nasce com o foco no campo (na mesma tarefa em que ele aparece, antes de qualquer
  // tecla seguinte, por isso layout effect), com o cursor depois do que já foi digitado; ao fechar
  // a paleta (que tinha o foco) ele também volta
  useLayoutEffect(() => {
    const input = inputRef.current
    if (paletteOpen || !input || !tabId) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
    // o campo está na tela e com o foco: o main deixa de repassar as teclas
    api.send('keys:ready', { target: { kind: 'new-tab', tabId } })
  }, [tabId, paletteOpen])

  // ⌘L volta para o campo com o texto selecionado
  useEffect(() => {
    if (request === handledRequest.current) return
    handledRequest.current = request
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [request])

  if (!tab) return null

  return (
    <div class="new-tab">
      <div class="new-tab-column">
        <div class="nt-field">
          <span class="nt-field-icon">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            class="nt-input"
            type="text"
            spellcheck={false}
            aria-label="Buscar ou digitar endereço"
            placeholder="Buscar ou digitar endereço"
            value={text}
            onInput={event => setNewTabText(tab.id, event.currentTarget.value)}
            onKeyDown={event => {
              // ↵ do IME confirma a composição, não busca
              if (event.key === 'Enter' && !event.isComposing)
                submitNewTab(tab.id)
            }}
          />
          <span class="nt-kbd">⌘L</span>
        </div>
        <div class="nt-grid">
          {favorites.map(favorite => (
            <button
              key={favorite.id}
              type="button"
              class="nt-fav"
              onClick={() => openFavorite(favorite)}
            >
              <Tile
                size={44}
                letter={
                  favorite.letter ??
                  getFavoriteLetter(favorite.title, favorite.url)
                }
                color={favorite.tile || getTileColor(favorite.title)}
                favicon={favorite.favicon}
              />
              <span class="nt-fav-name">{favorite.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
