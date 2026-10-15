import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeDownload } from '../src/shared/describe-download'
import {
  pickFileName,
  sanitizeFileName
} from '../src/main/functions/pick-file-name'
import { summarizeDownloads } from '../src/main/functions/summarize-downloads'
import { AppStore } from '../src/main/store/app-store'
import { buildInitialState } from '../src/main/store/build-initial-state'
import { openDownloads } from '../src/main/actions/open-downloads'
import { shell } from 'electron'
import { fakeContext } from './fake-main'

test('progresso somado só conta downloads com tamanho conhecido', () => {
  assert.deepEqual(summarizeDownloads([]), { active: 0, percent: null })
  assert.deepEqual(
    summarizeDownloads([
      { received: 50, total: 100 },
      { received: 30, total: 100 }
    ]),
    { active: 2, percent: 40 }
  )
  assert.deepEqual(summarizeDownloads([{ received: 10, total: 0 }]), {
    active: 1,
    percent: null
  })
  assert.equal(summarizeDownloads([{ received: 500, total: 100 }]).percent, 100)
})

test('nome único na pasta Downloads, sem sobrescrever', () => {
  const taken = new Set(['a.zip', 'a (1).zip'])
  assert.equal(
    pickFileName('b.zip', n => taken.has(n)),
    'b.zip'
  )
  assert.equal(
    pickFileName('a.zip', n => taken.has(n)),
    'a (2).zip'
  )
  assert.equal(
    pickFileName('semextensao', n => n === 'semextensao'),
    'semextensao (1)'
  )
})

test('nome vindo do servidor não escapa da pasta', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd')
  assert.equal(sanitizeFileName('..\\x\\y.txt'), 'y.txt')
  assert.equal(sanitizeFileName('.bashrc'), 'bashrc')
  assert.equal(sanitizeFileName(''), 'download')
  assert.equal(sanitizeFileName('a\u0000b.txt'), 'ab.txt')
})

test('o ícone mostra percentual, concluído e falha', () => {
  const idle = describeDownload(null)
  assert.deepEqual([idle.tone, idle.text], ['idle', null])
  const running = describeDownload({
    active: 1,
    percent: 68,
    lastPath: null,
    lastName: null,
    lastFailed: false
  })
  assert.deepEqual([running.tone, running.text], ['progress', '68%'])
  const unknown = describeDownload({
    active: 1,
    percent: null,
    lastPath: null,
    lastName: null,
    lastFailed: false
  })
  assert.equal(unknown.text, '…')
  const done = describeDownload({
    active: 0,
    percent: null,
    lastPath: '/Users/x/Downloads/a.zip',
    lastName: 'a.zip',
    lastFailed: false
  })
  assert.deepEqual([done.tone, done.text], ['done', 'Concluído'])
  assert.ok(done.label.includes('a.zip'))
  const failed = describeDownload({
    active: 0,
    percent: null,
    lastPath: null,
    lastName: null,
    lastFailed: true
  })
  assert.equal(failed.tone, 'failed')
})

test('o store só avisa a shell quando o estado dos downloads muda', () => {
  const { state } = buildInitialState({
    theme: 'light',
    session: null,
    tabsFile: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  })
  const store = new AppStore(state)
  const changes: string[] = []
  store.subscribe(change => changes.push(change.kind))
  const same = { ...store.state.downloads }
  store.setDownloads(same)
  assert.deepEqual(changes, [])
  store.setDownloads({ ...same, active: 1, percent: 10 })
  assert.deepEqual(changes, ['view'])
})

test('clicar em Downloads concluído mostra o arquivo no Finder e limpa o aviso', () => {
  const { ctx, store } = fakeContext()
  const shown: string[] = []
  const opened: string[] = []
  const stub = shell as unknown as {
    showItemInFolder: (path: string) => void
    openPath: (path: string) => Promise<string>
  }
  stub.showItemInFolder = path => void shown.push(path)
  stub.openPath = async path => {
    opened.push(path)
    return ''
  }
  store.setDownloads({
    active: 0,
    percent: null,
    lastPath: '/Users/x/Downloads/a.zip',
    lastName: 'a.zip',
    lastFailed: false
  })
  openDownloads(ctx)
  assert.deepEqual(shown, ['/Users/x/Downloads/a.zip'])
  assert.equal(store.state.downloads.lastPath, null)
  // sem arquivo novo, o próximo clique abre a pasta Downloads
  openDownloads(ctx)
  assert.equal(shown.length, 1)
  assert.equal(opened.length, 1)
})
