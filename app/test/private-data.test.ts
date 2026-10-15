import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { dialog, session } from 'electron'
import { stripFragment, stripFragmentFromTitle } from '@shared/strip-fragment'
import { clearBrowsingData } from '../src/main/actions/clear-browsing-data'
import { describeClearData } from '../src/main/functions/describe-clear-data'
import { appendMainLog } from '../src/main/services/error-log'
import { buildMenuTemplate } from '../src/main/services/app-menu'
import { HistoryStore } from '../src/main/store/history-store'
import { parseHistory } from '../src/main/store/parse-history'
import {
  appendPrivate,
  protectDataFiles
} from '../src/main/store/private-files'
import { getHistoryPath } from '../src/main/store/read-history-file'
import { toSessionFile } from '../src/main/store/serialize-session'
import {
  serializeAll,
  serializeTitle,
  serializeVisit
} from '../src/main/store/serialize-history'
import {
  addHistoryEntry,
  createSpaceHistory,
  limitEntriesPerHost,
  MAX_HISTORY_BYTES,
  MAX_PER_HOST,
  trimHistoryBytes
} from '../src/main/store/space-history'
import { startSessionWriter } from '../src/main/store/session-writer'
import { writeAtomic } from '../src/main/store/write-atomic'
import { fakeContext } from './fake-main'

function withDir(run: (dir: string) => void | Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'private-data-'))
  const done = () => rmSync(dir, { recursive: true, force: true })
  try {
    const result = run(dir)
    if (result instanceof Promise) return result.finally(done)
    done()
  } catch (error) {
    done()
    throw error
  }
}

const mode = (path: string) => statSync(path).mode & 0o777

test('stripFragment tira só o #fragmento', () => {
  assert.equal(
    stripFragment('https://a.com/cb#access_token=abc'),
    'https://a.com/cb'
  )
  assert.equal(
    stripFragment('https://a.com/p?q=1#/rota'),
    'https://a.com/p?q=1'
  )
  assert.equal(stripFragment('https://a.com/p'), 'https://a.com/p')
})

test('writeAtomic grava 0600, sem deixar .tmp, e corrige quem já existia aberto', () =>
  withDir(dir => {
    const path = join(dir, 'sub', 'session.json')
    writeAtomic(path, '{"a":1}')
    assert.equal(readFileSync(path, 'utf8'), '{"a":1}')
    assert.equal(mode(path), 0o600)
    assert.equal(mode(join(dir, 'sub')), 0o700)
    assert.equal(existsSync(`${path}.tmp`), false)

    // arquivo de versão anterior (0644) e .tmp antigo: o novo conteúdo nasce 0600
    chmodSync(path, 0o644)
    writeFileSync(`${path}.tmp`, 'lixo', { mode: 0o644 })
    writeAtomic(path, '{"a":2}')
    assert.equal(readFileSync(path, 'utf8'), '{"a":2}')
    assert.equal(mode(path), 0o600)
  }))

test('protectDataFiles dá 0600 a sessão, histórico e logs que já existiam com 0644', () =>
  withDir(dir => {
    mkdirSync(join(dir, 'logs'))
    const files = [
      'session.json',
      'history.jsonl',
      'history-personal.json',
      'history-work.json.migrado',
      join('logs', 'main.log')
    ]
    for (const file of files)
      writeFileSync(join(dir, file), 'x', { mode: 0o644 })
    chmodSync(dir, 0o755)

    protectDataFiles(dir)

    for (const file of files) assert.equal(mode(join(dir, file)), 0o600, file)
    assert.equal(mode(dir), 0o700)
    assert.equal(mode(join(dir, 'logs')), 0o700)
    // pasta sem nada: não lança
    protectDataFiles(join(dir, 'nao-existe'))
  }))

test('appendPrivate cria 0600 e corrige o arquivo antigo na primeira gravação', () =>
  withDir(dir => {
    const novo = join(dir, 'novo.log')
    appendPrivate(novo, 'a\n')
    appendPrivate(novo, 'b\n')
    assert.equal(readFileSync(novo, 'utf8'), 'a\nb\n')
    assert.equal(mode(novo), 0o600)

    const antigo = join(dir, 'antigo.log')
    writeFileSync(antigo, 'x\n', { mode: 0o644 })
    appendPrivate(antigo, 'y\n')
    assert.equal(mode(antigo), 0o600)
    assert.equal(readFileSync(antigo, 'utf8'), 'x\ny\n')
  }))

test('main.log nasce 0600', () =>
  withDir(dir => {
    const file = join(dir, 'logs', 'main.log')
    appendMainLog(file, 'linha\n')
    assert.equal(mode(file), 0o600)
  }))

test('o session.json e o history.jsonl gravados não levam #fragmento', () =>
  withDir(dir => {
    const { store } = fakeContext(['https://a.com/cb#access_token=SEGREDO'])
    store.pushClosed({
      spaceId: 'personal',
      url: 'https://b.com/#id_token=SEGREDO2',
      title: 'B'
    })
    const file = toSessionFile(store.state, store.closed)
    assert.equal(file.tabs[0].url, 'https://a.com/cb')
    assert.equal(file.closed[0].url, 'https://b.com/')

    const path = join(dir, 'session.json')
    const writer = startSessionWriter(store, path)
    writer.saveNow()
    writer.dispose()
    assert.equal(readFileSync(path, 'utf8').includes('SEGREDO'), false)
    assert.equal(mode(path), 0o600)

    const history = new HistoryStore(dir)
    history.record('personal', 'https://c.com/cb#access_token=SEGREDO3', 'C', 1)
    history.setTitle('personal', 'https://c.com/cb#x=SEGREDO4', 'C2')
    history.saveNow()
    const text = readFileSync(getHistoryPath(dir), 'utf8')
    assert.equal(text.includes('SEGREDO'), false)
    assert.ok(text.includes('https://c.com/cb'))
    assert.equal(mode(getHistoryPath(dir)), 0o600)
    assert.equal(
      serializeVisit('s', {
        url: 'https://d.com/#x',
        title: 't',
        visitedAt: 1
      }).includes('#'),
      false
    )
    assert.equal(
      serializeTitle('s', 'https://d.com/#x', 't').includes('#'),
      false
    )
  }))

test('histórico antigo com #fragmento é reescrito limpo e com 0600 ao ser lido', () =>
  withDir(dir => {
    const path = getHistoryPath(dir)
    const line = (url: string, at: number) =>
      JSON.stringify({ spaceId: 'personal', url, title: 'T', visitedAt: at })
    writeFileSync(
      path,
      `${line('https://a.com/cb#access_token=SEGREDO', 1)}\n${line('https://b.com/', 2)}\n`,
      { mode: 0o644 }
    )
    const store = new HistoryStore(dir)
    assert.equal(store.getEntries('personal').length, 2)
    assert.equal(readFileSync(path, 'utf8').includes('SEGREDO'), false)
    assert.equal(mode(path), 0o600)
  }))

test('no máximo 500 entradas por host em cada espaço (as mais antigas saem)', () => {
  const history = createSpaceHistory()
  for (let i = 0; i < MAX_PER_HOST + 50; i++)
    addHistoryEntry(history, {
      url: `https://flood.example/p${i}`,
      title: `p${i}`,
      visitedAt: i + 1
    })
  addHistoryEntry(history, {
    url: 'https://outro.example/',
    title: 'outro',
    visitedAt: 10_000
  })
  const flood = history.list.filter(entry =>
    entry.url.includes('flood.example')
  )
  assert.equal(flood.length, MAX_PER_HOST)
  assert.equal(history.list.length, MAX_PER_HOST + 1)
  // ficaram as 500 mais recentes; a mais antiga que sobrou é a 51ª
  assert.equal(flood[flood.length - 1].url, 'https://flood.example/p50')
  assert.equal(history.byKey.has('flood.example/p49'), false)
  assert.equal(history.byKey.has('flood.example/p50'), true)
  assert.equal(history.byKey.size, history.list.length)
  // www e sem www são o mesmo host
  const other = createSpaceHistory()
  for (let i = 0; i < 600; i++)
    addHistoryEntry(other, {
      url: `https://${i % 2 ? 'www.' : ''}a.com/${i}`,
      title: '',
      visitedAt: i + 1
    })
  assert.equal(other.list.length, MAX_PER_HOST)
  assert.equal(limitEntriesPerHost(other), 0)
})

test('arquivo lido com um host acima do limite é reescrito já dentro dele', () =>
  withDir(dir => {
    const lines: string[] = []
    for (let i = 0; i < 700; i++)
      lines.push(
        JSON.stringify({
          spaceId: 'personal',
          url: `https://flood.example/p${i}`,
          title: 'T',
          visitedAt: i + 1
        })
      )
    writeFileSync(getHistoryPath(dir), `${lines.join('\n')}\n`)
    const store = new HistoryStore(dir)
    assert.equal(store.getEntries('personal').length, MAX_PER_HOST)
    const onDisk = readFileSync(getHistoryPath(dir), 'utf8').trim().split('\n')
    assert.equal(onDisk.length, MAX_PER_HOST)
  }))

test('histórico passou de 10 MB: as visitas mais antigas saem e o arquivo cai abaixo do limite', () =>
  withDir(dir => {
    const title = 'T'.repeat(500)
    const lines: string[] = []
    // 20 mil entradas em 100 sites, com títulos longos: o arquivo passa de 10 MB
    for (let i = 0; i < 20_000; i++)
      lines.push(
        JSON.stringify({
          spaceId: 'personal',
          url: `https://s${i % 100}.example/${'x'.repeat(100)}${i}`,
          title,
          visitedAt: i + 1
        })
      )
    writeFileSync(getHistoryPath(dir), `${lines.join('\n')}\n`)
    assert.ok(statSync(getHistoryPath(dir)).size > MAX_HISTORY_BYTES)

    const store = new HistoryStore(dir)
    const entries = store.getEntries('personal')
    assert.ok(entries.length < 20_000 && entries.length > 10_000)
    assert.ok(statSync(getHistoryPath(dir)).size <= MAX_HISTORY_BYTES)
    // saíram as mais antigas; a mais nova ficou
    assert.equal(entries[0].visitedAt, 20_000)
    assert.ok(entries.every(entry => entry.visitedAt > 1))
  }))

test('trimHistoryBytes descarta a visita mais antiga de qualquer espaço', () => {
  const histories = new Map([
    ['a', createSpaceHistory()],
    ['b', createSpaceHistory()]
  ])
  for (let i = 1; i <= 10; i++)
    addHistoryEntry(histories.get(i % 2 ? 'a' : 'b')!, {
      url: `https://s${i}.example/`,
      title: 'T'.repeat(100),
      visitedAt: i
    })
  const size = (text: string) => Buffer.byteLength(text)
  const total = size(serializeAll(histories))
  trimHistoryBytes(histories, Math.floor(total / 2))
  const kept = size(serializeAll(histories))
  assert.ok(kept <= total / 2)
  const left = [...histories.values()].flatMap(history => history.list)
  assert.ok(left.length >= 4 && left.length < 10)
  assert.ok(left.every(entry => entry.visitedAt > 10 - left.length))
})

test('clearSpace apaga o histórico de um espaço da memória e do disco (e os arquivos antigos dele)', () =>
  withDir(dir => {
    const store = new HistoryStore(dir)
    store.record('personal', 'https://a.com/', 'A', 1)
    store.record('work', 'https://b.com/', 'B', 2)
    store.saveNow()
    writeFileSync(join(dir, 'history-personal.json.migrado'), '{"entries":[]}')
    writeFileSync(join(dir, 'history-work.json.migrado'), '{"entries":[]}')

    store.clearSpace('personal')

    assert.deepEqual(store.getEntries('personal'), [])
    assert.equal(store.getEntries('work').length, 1)
    const text = readFileSync(getHistoryPath(dir), 'utf8')
    assert.equal(text.includes('a.com'), false)
    assert.ok(text.includes('b.com'))
    assert.equal(existsSync(join(dir, 'history-personal.json.migrado')), false)
    assert.equal(existsSync(join(dir, 'history-work.json.migrado')), true)
    // gravações seguintes continuam funcionando
    store.record('personal', 'https://c.com/', 'C', 3)
    store.saveNow()
    assert.ok(readFileSync(getHistoryPath(dir), 'utf8').includes('c.com'))
    assert.equal(
      parseHistory(readFileSync(getHistoryPath(dir), 'utf8')).histories.get(
        'personal'
      )?.list.length,
      1
    )
  }))

test('o diálogo de limpar dados tem Cancelar como padrão e diz o que apaga', () => {
  const options = describeClearData('Pessoal')
  assert.deepEqual(options.buttons, ['Limpar dados', 'Cancelar'])
  assert.equal(options.defaultId, 1)
  assert.equal(options.cancelId, 1)
  assert.ok(options.message.includes('Pessoal'))
  for (const word of [
    'cookies',
    'cache',
    'service workers',
    'histórico',
    'abas fechadas'
  ])
    assert.ok(options.detail.includes(word), word)
})

test('Arquivo > Limpar dados de navegação… existe, em português, sem atalho', () => {
  const { ctx } = fakeContext()
  const file = buildMenuTemplate(ctx).find(item => item.label === 'Arquivo')
  const submenu = file?.submenu as { label?: string; accelerator?: string }[]
  const item = submenu.find(
    entry => entry.label === 'Limpar dados de navegação…'
  )
  assert.ok(item)
  assert.equal(item.accelerator, undefined)
})

function clearEnv() {
  const calls: string[] = []
  const ses = {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1 Safari/1',
    setUserAgent() {},
    setPermissionRequestHandler() {},
    setPermissionCheckHandler() {},
    setDevicePermissionHandler() {},
    setBluetoothPairingHandler() {},
    webRequest: { onBeforeRequest() {}, onHeadersReceived() {} },
    on() {},
    clearStorageData: async () => void calls.push('storage'),
    clearCache: async () => void calls.push('cache'),
    clearAuthCache: async () => void calls.push('auth'),
    clearHostResolverCache: async () => void calls.push('dns')
  }
  const env = fakeContext(['https://a.com'])
  const cleared: string[] = []
  ;(env.ctx as any).history = {
    record() {},
    setTitle() {},
    saveNow() {},
    clearSpace: (spaceId: string) => void cleared.push(spaceId)
  }
  return { ...env, calls, cleared, ses }
}

test('Limpar dados confirmado: só o espaço atual — cookies, cache, histórico e abas fechadas', async () => {
  const { ctx, store, calls, cleared, ses } = clearEnv()
  store.pushClosed({ spaceId: 'personal', url: 'https://a.com/', title: 'A' })
  store.pushClosed({ spaceId: 'work', url: 'https://b.com/', title: 'B' })
  const originalFrom = session.fromPartition
  const originalBox = dialog.showMessageBox
  const partitions: string[] = []
  ;(session as any).fromPartition = (name: string) => {
    partitions.push(name)
    return ses
  }
  ;(dialog as any).showMessageBox = async () => ({ response: 0 })
  try {
    const snapshots: unknown[] = []
    store.subscribe(change => {
      if (change.kind === 'view') snapshots.push(store.state.clearedData)
    })
    const done = await clearBrowsingData(ctx)

    assert.equal(done, true)
    assert.deepEqual(partitions, ['persist:space-personal'])
    assert.deepEqual([...calls].sort(), ['auth', 'cache', 'dns', 'storage'])
    assert.deepEqual(cleared, ['personal'])
    assert.deepEqual(
      store.closed.map(entry => entry.spaceId),
      ['work']
    )
    // a sidebar ganha o aviso pelo snapshot
    assert.equal(store.state.clearedData?.spaceId, 'personal')
    assert.ok(snapshots.length >= 1)
  } finally {
    ;(session as any).fromPartition = originalFrom
    ;(dialog as any).showMessageBox = originalBox
  }
})

test('Limpar dados cancelado não apaga nada', async () => {
  const { ctx, store, calls, cleared, ses } = clearEnv()
  store.pushClosed({ spaceId: 'personal', url: 'https://a.com/', title: 'A' })
  const originalFrom = session.fromPartition
  const originalBox = dialog.showMessageBox
  ;(session as any).fromPartition = () => ses
  ;(dialog as any).showMessageBox = async () => ({ response: 1 })
  try {
    assert.equal(await clearBrowsingData(ctx), false)
    assert.deepEqual(calls, [])
    assert.deepEqual(cleared, [])
    assert.equal(store.closed.length, 1)
    assert.equal(store.state.clearedData, null)
  } finally {
    ;(session as any).fromPartition = originalFrom
    ;(dialog as any).showMessageBox = originalBox
  }
})

test('página sem <title>: o título que o Chromium tira do endereço também perde o #fragmento', () => {
  const url = 'http://127.0.0.1:8581/cb#access_token=SEGREDO&state=x'
  // título derivado do endereço (sem o esquema)
  assert.equal(
    stripFragmentFromTitle(
      '127.0.0.1:8581/cb#access_token=SEGREDO&state=x',
      url
    ),
    '127.0.0.1:8581/cb'
  )
  // o fragmento no meio de outro título
  assert.equal(
    stripFragmentFromTitle('Login #access_token=SEGREDO&state=x ok', url),
    'Login  ok'
  )
  // título normal, sem fragmento no endereço, ou fragmento que não aparece: fica como está
  assert.equal(
    stripFragmentFromTitle('Issue #123', 'https://a.com/x'),
    'Issue #123'
  )
  assert.equal(
    stripFragmentFromTitle('Issue #123', 'https://a.com/x#topo'),
    'Issue #123'
  )
  assert.equal(stripFragmentFromTitle('Banco', url), 'Banco')
})
