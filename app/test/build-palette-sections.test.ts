import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HistoryEntry, Space, Tab } from '@shared/types'
import {
  buildPaletteSections,
  type PaletteInput
} from '../src/main/functions/build-palette-sections'
import { createDefaultSpaces } from '../src/main/store/default-spaces'

const SEARCH = 'https://www.google.com/search?q=%s'

function tab(
  id: string,
  spaceId: string,
  url: string,
  title: string,
  lastActiveAt: number
): Tab {
  return {
    id,
    spaceId,
    url,
    title,
    favicon: null,
    audible: false,
    muted: false,
    dormant: false,
    lastActiveAt,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null
  }
}

const spaces: Space[] = createDefaultSpaces()
spaces[0].favorites.push({
  id: 'p-roadmap',
  title: 'Roadmap no Linear',
  url: 'https://linear.app/roadmap',
  favicon: null,
  essential: false,
  tile: '#6A4FB3'
})

const tabs: Tab[] = [
  tab(
    'p1',
    'personal',
    'https://www.electronjs.org/docs/latest/api/web-contents-view',
    'WebContentsView | Electron',
    100
  ),
  tab(
    'p2',
    'personal',
    'https://github.com/gilas/navegador/pulls',
    'Pull requests de gilas/navegador',
    90
  ),
  tab(
    'p3',
    'personal',
    'https://developer.mozilla.org/pt-BR/docs/Web/CSS/:has',
    'CSS :has() na MDN',
    70
  ),
  tab(
    'w1',
    'work',
    'https://console.aws.amazon.com/cloudwatch/',
    'CloudWatch, logs de produção',
    80
  ),
  tab(
    'w2',
    'work',
    'https://linear.app/team/issues',
    'Minhas issues no Linear',
    60
  ),
  tab('n1', 'personal', '', '', 200)
]

const personalHistory: HistoryEntry[] = [
  {
    url: 'https://linear.app/changelog',
    title: 'Changelog do Linear',
    visitedAt: 50
  },
  { url: 'https://linear.app/roadmap', title: 'Roadmap', visitedAt: 40 },
  { url: 'https://example.org/a', title: 'Outra coisa', visitedAt: 30 }
]

function input(overrides: Partial<PaletteInput> = {}): PaletteInput {
  return {
    text: '',
    scope: 'all',
    spaces,
    tabs,
    currentSpaceId: 'personal',
    activeTabId: 'p1',
    history: spaceId => (spaceId === 'personal' ? personalHistory : []),
    searchUrl: SEARCH,
    canReopen: false,
    ...overrides
  }
}

test('consulta vazia: abas recentes de todos os espaços (sem a ativa nem Nova aba) e ações', () => {
  const sections = buildPaletteSections(input())
  assert.deepEqual(
    sections.map(section => section.id),
    ['recent', 'actions']
  )
  const recent = sections[0].items.map(
    item => item.kind === 'tab' && item.tabId
  )
  // três, como em PaletaVazia.dc.html
  assert.deepEqual(recent, ['p2', 'w1', 'p3'])
  const actions = sections[1].items.map(
    item => item.kind === 'action' && item.command
  )
  assert.deepEqual(actions, [
    'new-tab',
    'close-tab',
    'reload',
    'toggle-sidebar',
    'space-2'
  ])
  // todas com chip de atalho; Suspender aba só aparece quando a consulta a encontra
  assert.ok(
    sections[1].items.every(item => item.kind === 'action' && item.keys !== '')
  )
  const found = buildPaletteSections(input({ text: 'suspender' })).find(
    section => section.id === 'actions'
  )
  assert.equal(
    found?.items.some(
      item => item.kind === 'action' && item.command === 'suspend-tab'
    ),
    true
  )
})

test('com "linear": abas, favoritos, histórico (sem repetir o que já aparece) e ações', () => {
  const sections = buildPaletteSections(input({ text: 'linear' }))
  assert.deepEqual(
    sections.map(section => section.id),
    ['tabs', 'favorites', 'history', 'actions']
  )
  const [tabsSection, favorites, history, actions] = sections
  assert.deepEqual(
    tabsSection.items.map(
      item => item.kind === 'tab' && [item.tabId, item.spaceId]
    ),
    [['w2', 'work']]
  )
  assert.deepEqual(
    favorites.items.map(
      item => item.kind === 'favorite' && [item.title, item.spaceId]
    ),
    // pela nota: "Linear" abre com a palavra; "Roadmap no Linear" a tem no meio
    [
      ['Linear', 'work'],
      ['Roadmap no Linear', 'personal']
    ]
  )
  // o /roadmap do histórico já é favorito
  assert.deepEqual(
    history.items.map(item => item.kind === 'history' && item.title),
    ['Changelog do Linear']
  )
  // o design: "Abrir linear.app em nova aba" e "Buscar “linear” na web"
  assert.deepEqual(actions.items, [
    { kind: 'open-url', url: 'https://linear.app/', label: 'linear.app' },
    {
      kind: 'web-search',
      text: 'linear',
      url: 'https://www.google.com/search?q=linear'
    }
  ])
})

test('escopo "current": só o espaço atual', () => {
  const sections = buildPaletteSections(
    input({ text: 'linear', scope: 'current' })
  )
  assert.equal(
    sections.find(section => section.id === 'tabs'),
    undefined
  )
  const favorites = sections.find(section => section.id === 'favorites')
  assert.deepEqual(
    favorites?.items.map(item => item.kind === 'favorite' && item.title),
    ['Roadmap no Linear']
  )
})

test('acento e caixa não atrapalham: "PRODUCAO" acha "produção"', () => {
  const [section] = buildPaletteSections(input({ text: 'PRODUCAO' }))
  assert.equal(section.id, 'tabs')
  assert.equal(section.items[0].kind === 'tab' && section.items[0].tabId, 'w1')
})

test('endereço digitado vira "abrir em nova aba" com o endereço resolvido', () => {
  const actions = buildPaletteSections(
    input({ text: 'github.com/gilas' })
  ).find(section => section.id === 'actions')
  assert.deepEqual(actions?.items[0], {
    kind: 'open-url',
    url: 'github.com/gilas',
    label: 'github.com/gilas'
  })
  const search = buildPaletteSections(input({ text: 'receita de bolo' })).at(-1)
  assert.deepEqual(search?.items, [
    {
      kind: 'web-search',
      text: 'receita de bolo',
      url: 'https://www.google.com/search?q=receita%20de%20bolo'
    }
  ])
})

test('comando que combina com o texto aparece nas ações antes de abrir e buscar', () => {
  const actions = buildPaletteSections(input({ text: 'recarr' })).at(-1)
  assert.deepEqual(
    actions?.items.map(item =>
      item.kind === 'action' ? item.command : item.kind
    ),
    ['reload', 'web-search']
  )
})

test('Nova aba não recarrega nem suspende, e reabrir só existe com aba fechada', () => {
  const sections = buildPaletteSections(
    input({ activeTabId: 'n1', canReopen: true })
  )
  const actions = sections.find(section => section.id === 'actions')
  assert.deepEqual(
    actions?.items.map(item => item.kind === 'action' && item.command),
    ['new-tab', 'close-tab', 'reopen-tab', 'toggle-sidebar', 'space-2']
  )
})

test('consulta com 1000 entradas de histórico leva menos de 10 ms', () => {
  const big: HistoryEntry[] = Array.from({ length: 1000 }, (_, i) => ({
    url: `https://site${i % 50}.exemplo.com/pagina/${i}`,
    title: `Página ${i} sobre linear e outros assuntos`,
    visitedAt: i
  }))
  const heavy = input({ text: 'linear assuntos', history: () => big })
  buildPaletteSections(heavy)
  const start = performance.now()
  for (let i = 0; i < 20; i++) buildPaletteSections(heavy)
  const average = (performance.now() - start) / 20
  assert.ok(average < 10, `média de ${average.toFixed(2)} ms`)
})

test('histórico de dois espaços: os melhores entre os dois, com o espaço de cada um', () => {
  const workHistory: HistoryEntry[] = [
    { url: 'https://wiki.test/linear-guia', title: 'Guia', visitedAt: 70 },
    { url: 'https://changelog.test/', title: 'Linear changelog', visitedAt: 10 }
  ]
  const sections = buildPaletteSections(
    input({
      text: 'linear',
      history: spaceId =>
        spaceId === 'personal' ? personalHistory : workHistory
    })
  )
  const history = sections.find(section => section.id === 'history')
  assert.deepEqual(
    history?.items.map(
      item => item.kind === 'history' && [item.title, item.spaceId]
    ),
    [
      // título começa com "Linear": nota mais alta, mesmo sendo o mais antigo
      ['Linear changelog', 'work'],
      ['Changelog do Linear', 'personal'],
      ['Guia', 'work']
    ]
  )
})

function median(run: () => void, rounds = 31): number {
  const times: number[] = []
  for (let i = 0; i < rounds; i++) {
    const start = performance.now()
    run()
    times.push(performance.now() - start)
  }
  times.sort((x, y) => x - y)
  return times[Math.floor(rounds / 2)]
}

test('20 mil entradas de histórico: consulta em até 10 ms com o texto já normalizado', () => {
  const big: HistoryEntry[] = Array.from({ length: 20_000 }, (_, i) => ({
    url: `https://site${i % 50}.exemplo.com.br/pagina/${i}/produção`,
    title: `Página ${i} sobre linear e outros assuntos de ação`,
    visitedAt: 20_000 - i
  }))
  // pior caso: todas as 20 mil combinam com as duas palavras. A primeira consulta guarda o texto
  // normalizado em cada entrada (a HistoryStore faz isso em fatias, depois da abertura). A
  // mediana, não a média: os testes rodam em paralelo e um tropeço da máquina não conta
  const heavy = input({ text: 'linear assuntos', history: () => big })
  buildPaletteSections(heavy)
  const typical = median(() => buildPaletteSections(heavy))
  assert.ok(typical < 10, `mediana de ${typical.toFixed(2)} ms`)
  // uma letra só combina com quase tudo: ainda assim sem ordenar as 20 mil
  const wide = input({ text: 'a', history: () => big })
  const single = median(() => buildPaletteSections(wide))
  assert.ok(single < 10, `mediana de ${single.toFixed(2)} ms`)
})
