// Monta as seções da paleta (⌘K) a partir do estado. Pura: nada de Electron aqui.
//   sem texto: abas recentes e ações
//   com texto: abas abertas, favoritos, histórico e ações (comandos que combinam, abrir o
//   endereço, buscar na web)
import { getPaletteActions, type ActionState } from '@shared/commands'
import { rankMatches } from '@shared/match-palette'
import { normalizeText, toQueryWords } from '@shared/normalize-text'
import { resolveTyped } from '@shared/resolve-input'
import { sanitizeTitle } from '@shared/sanitize-title'
import { getTabLabel } from '@shared/tab-label'
import type {
  HistoryEntry,
  PaletteItem,
  PaletteScope,
  PaletteSection,
  Space,
  SpaceId,
  Tab,
  TabId
} from '@shared/types'
import { getHostname, getSiteName, splitUrl } from '@shared/url-parts'
import { limitUrl } from '@shared/limit-stored-text'
import { toUrlKey } from '@shared/url-key'
import { getEntryKey } from '../store/get-entry-key'
import { getSearchText } from '../store/get-search-text'

export interface PaletteInput {
  text: string
  scope: PaletteScope
  spaces: Space[]
  tabs: Tab[]
  currentSpaceId: SpaceId
  activeTabId: TabId | null
  // mais recente primeiro, por espaço
  history: (spaceId: SpaceId) => readonly HistoryEntry[]
  searchUrl: string
  canReopen: boolean
}

// no lugar da busca de verdade, para saber se o texto virou endereço ou busca
const SEARCH_MARKER = 'search-marker:'

// PaletaVazia.dc.html mostra 3
const LIMIT_RECENT = 3
const LIMIT_TABS = 6
const LIMIT_FAVORITES = 4
const LIMIT_HISTORY = 5
const LIMIT_ACTIONS = 4

function toTabItem(tab: Tab): PaletteItem {
  return {
    kind: 'tab',
    tabId: tab.id,
    spaceId: tab.spaceId,
    title: getTabLabel(tab.title, tab.url),
    url: limitUrl(tab.url)
  }
}

// "linear" sugere linear.app quando o melhor resultado é desse site
function suggestSite(word: string, urls: string[]): string | null {
  if (!/^[\p{L}\p{N}-]+$/u.test(word)) return null
  const key = normalizeText(word)
  for (const url of urls) {
    const host = getHostname(url)
    if (host && normalizeText(getSiteName(url)) === key)
      return `https://${host}/`
  }
  return null
}

// o item leva o texto como foi digitado: quem abre resolve (https primeiro, com o recuo para http)
function toOpenUrlItem(resolved: string, url: string): PaletteItem {
  const { domain, path } = splitUrl(resolved)
  return { kind: 'open-url', url, label: `${domain}${path}` }
}

function getActionState(input: PaletteInput): ActionState {
  const active = input.tabs.find(tab => tab.id === input.activeTabId)
  return {
    spaces: input.spaces,
    currentSpaceId: input.currentSpaceId,
    canReload: active !== undefined && active.url !== '',
    canSuspend: active !== undefined && active.url !== '' && !active.dormant,
    canReopen: input.canReopen
  }
}

function buildEmpty(input: PaletteInput): PaletteSection[] {
  const recent = input.tabs
    .filter(tab => tab.url !== '' && tab.id !== input.activeTabId)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, LIMIT_RECENT)
    .map(toTabItem)
  // PaletaVazia.dc.html: toda ação da lista vazia tem o chip do atalho. As que só existem na
  // paleta (Suspender aba) aparecem quando a consulta as encontra
  const actions: PaletteItem[] = getPaletteActions(getActionState(input))
    .filter(({ keys }) => keys !== '')
    .map(({ command, label, keys }) => ({
      kind: 'action',
      command,
      label,
      keys
    }))
  return [
    { id: 'recent', items: recent },
    { id: 'actions', items: actions }
  ].filter(section => section.items.length > 0) as PaletteSection[]
}

export function buildPaletteSections(input: PaletteInput): PaletteSection[] {
  const text = input.text.trim()
  const words = toQueryWords(text)
  if (words.length === 0) return buildEmpty(input)

  const inScope = (spaceId: SpaceId) =>
    input.scope === 'all' || spaceId === input.currentSpaceId
  const spaces = input.spaces.filter(space => inScope(space.id))

  const openTabs = input.tabs.filter(
    tab => tab.url !== '' && inScope(tab.spaceId)
  )
  const tabs = rankMatches(
    openTabs,
    words,
    tab => ({
      title: getTabLabel(tab.title, tab.url),
      url: limitUrl(tab.url),
      recency: tab.lastActiveAt
    }),
    LIMIT_TABS
  ).map(toTabItem)

  const favorites = rankMatches(
    spaces.flatMap(space =>
      space.favorites.map(favorite => ({ space, favorite }))
    ),
    words,
    ({ favorite }) => ({ ...favorite, recency: 0 }),
    LIMIT_FAVORITES
  ).map(({ space, favorite }): PaletteItem => ({
    kind: 'favorite',
    favoriteId: favorite.id,
    spaceId: space.id,
    title: sanitizeTitle(favorite.title),
    url: limitUrl(favorite.url)
  }))

  // o que já aparece como aba ou favorito não se repete no histórico. O histórico de cada espaço
  // já tem uma entrada por página; a chave vem guardada nela, e o filtro só roda nos que combinam
  const seen = new Set<string>()
  for (const tab of openTabs) seen.add(toUrlKey(tab.url))
  for (const item of favorites)
    if (item.kind === 'favorite') seen.add(toUrlKey(item.url))
  const readEntry = (entry: HistoryEntry) => ({
    title: entry.title,
    url: entry.url,
    recency: entry.visitedAt,
    normalized: getSearchText(entry)
  })
  // os melhores de cada espaço (sem montar uma lista de 20 mil pares) e, entre eles, os melhores
  const candidates = spaces.flatMap(space =>
    rankMatches(
      input.history(space.id),
      words,
      readEntry,
      LIMIT_HISTORY,
      entry => !seen.has(getEntryKey(entry))
    ).map(entry => ({ spaceId: space.id, entry }))
  )
  const history = rankMatches(
    candidates,
    words,
    ({ entry }) => readEntry(entry),
    LIMIT_HISTORY
  ).map(({ spaceId, entry }): PaletteItem => ({
    kind: 'history',
    spaceId,
    title: sanitizeTitle(entry.title) || getHostname(entry.url) || entry.url,
    url: limitUrl(entry.url),
    visitedAt: entry.visitedAt
  }))

  const actions: PaletteItem[] = rankMatches(
    getPaletteActions(getActionState(input)),
    words,
    action => ({ title: action.label, url: action.keywords, recency: 0 }),
    LIMIT_ACTIONS
  ).map(({ command, label, keys }) => ({
    kind: 'action',
    command,
    label,
    keys
  }))

  // ⌘↵: o que foi digitado, se for um endereço; senão o site que o melhor resultado sugere
  const typed = resolveTyped(text, `${SEARCH_MARKER}%s`)
  const isAddress = typed.url !== '' && !typed.url.startsWith(SEARCH_MARKER)
  const suggested =
    words.length === 1
      ? suggestSite(
          text,
          [...tabs, ...favorites, ...history].flatMap(item =>
            'url' in item ? [item.url] : []
          )
        )
      : null
  if (isAddress) actions.push(toOpenUrlItem(typed.url, text))
  else if (suggested) actions.push(toOpenUrlItem(suggested, suggested))
  // ⌥↵
  actions.push({
    kind: 'web-search',
    text,
    url: input.searchUrl.replace('%s', encodeURIComponent(text))
  })

  return [
    { id: 'tabs', items: tabs },
    { id: 'favorites', items: favorites },
    { id: 'history', items: history },
    { id: 'actions', items: actions }
  ].filter(section => section.items.length > 0) as PaletteSection[]
}
