import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { sanitizeTitle } from '@shared/sanitize-title'
import { getTabLabel } from '@shared/tab-label'
import type { HistoryEntry, Tab } from '@shared/types'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import {
  buildPaletteSections,
  type PaletteInput
} from '../src/main/functions/build-palette-sections'
import { createDefaultSpaces } from '../src/main/store/default-spaces'
import { hydrateTab } from '../src/main/store/hydrate-tab'
import { HistoryStore } from '../src/main/store/history-store'
import { getHistoryPath } from '../src/main/store/read-history-file'
import { toSessionFile } from '../src/main/store/serialize-session'
import { fakeContext } from './fake-main'

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'titulos-frag-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const RLO = '\u202E'

test('sanitizeTitle: controles C0 e C1 e marcas bidi viram espaço', () => {
  assert.equal(sanitizeTitle('Pagina normal'), 'Pagina normal')
  assert.equal(sanitizeTitle('a\nb\tc\rd'), 'a b c d')
  assert.equal(sanitizeTitle(`abc${RLO}def`), 'abc def')
  // sobreposição (LRE RLE PDF LRO RLO) e isolamento (LRI RLI FSI PDI)
  for (const mark of [
    '\u202A',
    '\u202B',
    '\u202C',
    '\u202D',
    '\u202E',
    '\u2066',
    '\u2067',
    '\u2068',
    '\u2069'
  ])
    assert.equal(
      sanitizeTitle(`a${mark}b`),
      'a b',
      mark.charCodeAt(0).toString(16)
    )
  // C0, DEL e C1
  assert.equal(
    sanitizeTitle('x\u0000\u0007\u001b[31my\u007f\u0085\u009fz'),
    'x [31my z'
  )
  // vários seguidos viram um espaço só, e as pontas são aparadas
  assert.equal(sanitizeTitle('\n\n  oi\u202E\u202E\n'), 'oi')
  assert.equal(sanitizeTitle('\u202E\u202D'), '')
  // texto legítimo (acentos, emoji, árabe, hebraico) fica como está
  assert.equal(sanitizeTitle('Ação 🚀 مرحبا שלום'), 'Ação 🚀 مرحبا שלום')
})

test('o rótulo da aba na sidebar nunca leva controles nem bidi', () => {
  assert.equal(getTabLabel(`gnp.moc${RLO}`, 'https://x.com'), 'gnp.moc')
  assert.equal(getTabLabel(`${RLO}\n`, 'https://www.x.com/a'), 'x.com')
  assert.equal(getTabLabel('', ''), 'Nova aba')
})

test('título da página é limpo ao chegar (aba e histórico) e ao ler a sessão', () => {
  const { ctx, store, makeLive } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const live = makeLive(tab, 'https://a.com/')
  const titles: string[] = []
  ;(ctx as any).history = {
    record(_s: string, _u: string, title: string) {
      titles.push(title)
    },
    setTitle(_s: string, _u: string, title: string) {
      titles.push(title)
    },
    saveNow() {}
  }
  attachTabEvents(ctx, tab.id, live.wc as unknown as WebContents)

  live.wc.emit('page-title-updated', {}, `Banco${RLO}\u0007 seguro\n`)
  assert.equal(store.getTab(tab.id)?.title, 'Banco seguro')
  assert.deepEqual(titles, ['Banco seguro'])

  const hydrated = hydrateTab({
    id: 'x',
    spaceId: 'personal',
    url: 'https://a.com',
    title: `A${RLO}B`,
    favicon: null,
    muted: false,
    lastActiveAt: 1
  })
  assert.equal(hydrated.title, 'A B')
})

test('HistoryStore guarda o título sem controles nem bidi', () => {
  const dir = mkdtempSync(join(tmpdir(), 'titulos-'))
  try {
    const history = new HistoryStore(dir)
    history.record('personal', 'https://a.com/', `Oi${RLO}\n`, 1)
    history.setTitle('personal', 'https://a.com/', `Oi${RLO}\u0007 de novo`)
    assert.equal(history.getEntries('personal')[0].title, 'Oi de novo')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('paleta: título de aba, favorito e histórico chega limpo', () => {
  const spaces = createDefaultSpaces()
  spaces[0].favorites.push({
    id: 'sujo',
    title: `Sujo${RLO}\nSite`,
    url: 'https://sujo.example/',
    favicon: null,
    essential: false,
    tile: '#6A4FB3'
  })
  const tab = (title: string): Tab => ({
    id: 't1',
    spaceId: 'personal',
    url: 'https://aba.example/',
    title,
    favicon: null,
    audible: false,
    muted: false,
    dormant: false,
    lastActiveAt: 1,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null,
    blockedPopups: 0,
    dialogBlocked: false
  })
  const history: HistoryEntry[] = [
    {
      url: 'https://hist.example/',
      title: `Hist${RLO}\u0007órico`,
      visitedAt: 5
    }
  ]
  const input = (text: string): PaletteInput => ({
    text,
    scope: 'all',
    spaces,
    tabs: [tab(`Aba${RLO}\nsuja`)],
    currentSpaceId: 'personal',
    activeTabId: null,
    history: id => (id === 'personal' ? history : []),
    searchUrl: 'https://www.google.com/search?q=%s',
    canReopen: false
  })
  const titles = (text: string) =>
    buildPaletteSections(input(text)).flatMap(section =>
      section.items.flatMap(item => ('title' in item ? [item.title] : []))
    )
  assert.ok(titles('').includes('Aba suja'))
  assert.ok(titles('aba').includes('Aba suja'))
  assert.ok(titles('sujo').includes('Sujo Site'))
  assert.ok(titles('hist').includes('Hist órico'))
  for (const title of [
    ...titles(''),
    ...titles('aba'),
    ...titles('sujo'),
    ...titles('hist')
  ])
    assert.equal(sanitizeTitle(title), title)
})

test('o título derivado do endereço não leva o fragmento para o histórico nem para a sessão', () =>
  withTempDir(dir => {
    const url =
      'http://127.0.0.1:8581/fragment#access_token=SEGREDO_NO_FRAGMENTO'
    const derived = '127.0.0.1:8581/fragment#access_token=SEGREDO_NO_FRAGMENTO'
    const history = new HistoryStore(dir)
    history.record('personal', url, derived, 1)
    history.setTitle('personal', url, derived)
    history.saveNow()
    assert.equal(
      readFileSync(getHistoryPath(dir), 'utf8').includes('SEGREDO'),
      false
    )

    const { store } = fakeContext([url])
    const [tab] = store.getTabsOfSpace('personal')
    store.patchTab(tab.id, { title: derived })
    store.pushClosed({ spaceId: 'personal', url, title: derived })
    assert.equal(
      JSON.stringify(toSessionFile(store.state, store.closed)).includes(
        'SEGREDO'
      ),
      false
    )
  }))
