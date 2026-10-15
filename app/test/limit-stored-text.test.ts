import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  limitTitle,
  limitUrl,
  MAX_STORED_TITLE,
  MAX_STORED_URL
} from '../src/shared/limit-stored-text'
import { HistoryStore } from '../src/main/store/history-store'
import { parseHistory } from '../src/main/store/parse-history'
import { getHistoryPath } from '../src/main/store/read-history-file'
import { toSessionFile } from '../src/main/store/serialize-session'
import { hydrateTab } from '../src/main/store/hydrate-tab'
import { buildInitialState } from '../src/main/store/build-initial-state'

const HUGE = `https://x.com/?q=${'a'.repeat(100_000)}`

test('limitUrl corta em 2048 e deixa o resto passar', () => {
  assert.equal(limitUrl(HUGE).length, MAX_STORED_URL)
  assert.equal(limitUrl('https://x.com'), 'https://x.com')
  assert.equal(limitTitle('t'.repeat(5000)).length, MAX_STORED_TITLE)
})

test('session.json: URL gigante é cortada ao gravar e ao ler', () => {
  const { state } = buildInitialState({
    theme: 'light',
    session: null,
    tabsFile: { urls: [HUGE], window: {} },
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  })
  const file = toSessionFile(state, [
    { spaceId: 'personal', url: HUGE, title: 'T'.repeat(2000) }
  ])
  assert.ok(file.tabs.every(tab => tab.url.length <= MAX_STORED_URL))
  assert.ok(file.closed[0].url.length <= MAX_STORED_URL)
  assert.ok(file.closed[0].title.length <= MAX_STORED_TITLE)
  const tab = hydrateTab({
    ...file.tabs[0],
    url: HUGE,
    title: 'T'.repeat(2000)
  })
  assert.equal(tab.url.length, MAX_STORED_URL)
  assert.equal(tab.title.length, MAX_STORED_TITLE)
})

test('history.jsonl: visita com URL gigante é gravada cortada, e o arquivo antigo é lido cortado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'limit-test-'))
  try {
    const store = new HistoryStore(dir)
    store.record('personal', HUGE, 'T'.repeat(2000), 1000)
    const [entry] = store.getEntries('personal')
    assert.equal(entry.url.length, MAX_STORED_URL)
    assert.equal(entry.title.length, MAX_STORED_TITLE)
    store.saveNow()
    const written = readFileSync(getHistoryPath(dir), 'utf8')
    assert.ok(written.length < 4000, `arquivo com ${written.length} bytes`)

    const legacy = `${JSON.stringify({ spaceId: 'personal', url: HUGE, title: 'x', visitedAt: 5 })}\n`
    const parsed = parseHistory(legacy)
    assert.equal(
      parsed.histories.get('personal')?.list[0].url.length,
      MAX_STORED_URL
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
