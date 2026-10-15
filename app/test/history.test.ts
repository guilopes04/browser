import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isHistoryUrl } from '../src/main/store/is-history-url'
import { HistoryStore } from '../src/main/store/history-store'
import { parseHistory } from '../src/main/store/parse-history'
import { getHistoryPath } from '../src/main/store/read-history-file'
import {
  addHistoryEntry,
  countEntries,
  createSpaceHistory,
  MAX_HISTORY,
  mergeSpaceHistory,
  setHistoryTitle,
  trimHistory,
  type SpaceHistory
} from '../src/main/store/space-history'

function withDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'history-test-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function strip(
  entries: readonly { url: string; title: string; visitedAt: number }[]
) {
  return entries.map(({ url, title, visitedAt }) => ({ url, title, visitedAt }))
}

test('isHistoryUrl só aceita http e https', () => {
  assert.equal(isHistoryUrl('https://a.com/x'), true)
  assert.equal(isHistoryUrl('http://localhost:3000'), true)
  assert.equal(isHistoryUrl('about:blank'), false)
  assert.equal(isHistoryUrl('data:text/html,oi'), false)
  assert.equal(isHistoryUrl('app://shell/index.html'), false)
})

test('addHistoryEntry: mais recente primeiro, endereço único, título não some', () => {
  const history = createSpaceHistory()
  addHistoryEntry(history, { url: 'https://a.com', title: 'A', visitedAt: 1 })
  addHistoryEntry(history, { url: 'https://b.com', title: 'B', visitedAt: 2 })
  addHistoryEntry(history, { url: 'https://a.com', title: '', visitedAt: 3 })
  assert.deepEqual(strip(history.list), [
    { url: 'https://a.com', title: 'A', visitedAt: 3 },
    { url: 'https://b.com', title: 'B', visitedAt: 2 }
  ])
  assert.equal(history.byKey.size, 2)
})

test('addHistoryEntry: mudar só a âncora é a mesma página (fica a âncora mais nova)', () => {
  const history = createSpaceHistory()
  const doc = 'http://anchors.test/doc'
  addHistoryEntry(history, {
    url: doc,
    title: 'Documento Âncoras',
    visitedAt: 1
  })
  addHistoryEntry(history, {
    url: `${doc}#a`,
    title: 'Documento Âncoras',
    visitedAt: 2
  })
  addHistoryEntry(history, { url: `${doc}#b`, title: '', visitedAt: 3 })
  assert.deepEqual(strip(history.list), [
    { url: `${doc}#b`, title: 'Documento Âncoras', visitedAt: 3 }
  ])
  // #/rota é outra página
  addHistoryEntry(history, { url: `${doc}#/rota`, title: 'Rota', visitedAt: 4 })
  assert.equal(history.list.length, 2)
  // o título chega pela página mesmo com outra âncora
  assert.equal(setHistoryTitle(history, `${doc}#c`, 'Novo título'), true)
  assert.equal(history.list[1].title, 'Novo título')
})

test('trimHistory guarda no máximo 20 mil no total (as visitas mais recentes, de qualquer espaço)', () => {
  const histories = new Map([
    ['a', createSpaceHistory()],
    ['b', createSpaceHistory()]
  ])
  // visitas intercaladas: as pares no espaço a e as ímpares no b (em cem sites, para o limite por
  // host, de 500, não entrar na conta)
  const site = (i: number) => `s${i % 100}.com/${i}`
  for (let i = 0; i < MAX_HISTORY + 25; i++)
    addHistoryEntry(histories.get(i % 2 ? 'b' : 'a') as SpaceHistory, {
      url: `https://${site(i)}`,
      title: String(i),
      visitedAt: i
    })
  trimHistory(histories)
  const a = histories.get('a') as SpaceHistory
  const b = histories.get('b') as SpaceHistory
  assert.equal(countEntries(histories), MAX_HISTORY)
  assert.equal(a.byKey.size + b.byKey.size, MAX_HISTORY)
  // as 25 mais antigas (de 0 a 24) saíram
  assert.equal(a.list[0].url, `https://${site(MAX_HISTORY + 24)}`)
  assert.equal(b.list[0].url, `https://${site(MAX_HISTORY + 23)}`)
  assert.equal(a.byKey.has(site(24)), false)
  assert.equal(b.byKey.has(site(25)), true)
  assert.equal(a.list[a.list.length - 1].url, `https://${site(26)}`)
  // um espaço vazio ou sem nada a cortar não quebra
  trimHistory(new Map([['x', createSpaceHistory()]]))
  trimHistory(histories)
  assert.equal(countEntries(histories), MAX_HISTORY)
})

test('setHistoryTitle só mexe quando há entrada e o título mudou', () => {
  const history = createSpaceHistory()
  addHistoryEntry(history, { url: 'https://a.com', title: '', visitedAt: 1 })
  history.list[0].search = { title: 'velho', url: 'a.com' }
  assert.equal(setHistoryTitle(history, 'https://a.com', 'A'), true)
  assert.equal(setHistoryTitle(history, 'https://a.com', 'A'), false)
  assert.equal(setHistoryTitle(history, 'https://b.com', 'B'), false)
  assert.equal(setHistoryTitle(history, 'https://a.com', ''), false)
  assert.equal(history.list[0].title, 'A')
  // o texto normalizado guardado perde a validade com o título novo
  assert.equal(history.list[0].search, undefined)
})

test('parseHistory descarta linhas inválidas, funde repetidas e ordena por data', () => {
  const text = [
    'não é json',
    JSON.stringify({
      spaceId: 'p',
      url: 'https://a.com/',
      title: 'A',
      visitedAt: 5,
      extra: true
    }),
    JSON.stringify({ spaceId: 'p', url: 7, title: 'x', visitedAt: 1 }),
    JSON.stringify({ spaceId: 'p', url: 'https://b.com/', title: 'B' }),
    JSON.stringify({
      spaceId: 'p',
      url: 'https://c.com/',
      title: 'C',
      visitedAt: 9
    }),
    JSON.stringify({
      spaceId: 'p',
      url: 'https://a.com/#x',
      title: '',
      visitedAt: 12
    }),
    JSON.stringify({ spaceId: 'p', url: 'https://c.com/', title: 'C2' }),
    JSON.stringify({
      spaceId: 'q',
      url: 'https://a.com/',
      title: 'A',
      visitedAt: 2
    }),
    '{"spaceId":"p","url":"https://corta.com/","tit'
  ].join('\n')
  const { histories, lines } = parseHistory(text)
  assert.equal(lines, 6)
  assert.deepEqual(strip(histories.get('p')?.list ?? []), [
    { url: 'https://a.com/#x', title: 'A', visitedAt: 12 },
    { url: 'https://c.com/', title: 'C2', visitedAt: 9 }
  ])
  assert.equal(histories.get('q')?.list.length, 1)
  assert.equal(parseHistory('').histories.size, 0)
})

test('HistoryStore grava history.jsonl por append e relê', () => {
  withDir(dir => {
    const store = new HistoryStore(dir)
    store.record('personal', 'https://a.com/', 'A', 10)
    store.record('personal', 'about:blank', 'x', 11)
    store.record('work', 'https://b.com/', '', 12)
    store.setTitle('work', 'https://b.com/', 'B')
    store.saveNow()
    store.record('personal', 'https://a.com/#fim', 'A', 20)
    store.saveNow()

    const lines = readFileSync(getHistoryPath(dir), 'utf8').trim().split('\n')
    assert.equal(lines.length, 4)
    assert.deepEqual(JSON.parse(lines[0]), {
      spaceId: 'personal',
      url: 'https://a.com/',
      title: 'A',
      visitedAt: 10
    })
    assert.deepEqual(JSON.parse(lines[2]), {
      spaceId: 'work',
      url: 'https://b.com/',
      title: 'B'
    })

    const reopened = new HistoryStore(dir)
    assert.deepEqual(strip(reopened.getEntries('work')), [
      { url: 'https://b.com/', title: 'B', visitedAt: 12 }
    ])
    // a visita com âncora substituiu a primeira ao reler, e o #fragmento não foi para o disco
    assert.deepEqual(strip(reopened.getEntries('personal')), [
      { url: 'https://a.com/', title: 'A', visitedAt: 20 }
    ])
    assert.equal(
      readFileSync(getHistoryPath(dir), 'utf8').includes('#fim'),
      false
    )
    assert.deepEqual(reopened.getEntries('outro'), [])
  })
})

test('HistoryStore: o que chega antes de o arquivo ser lido vale por cima dele', () => {
  withDir(dir => {
    writeFileSync(
      getHistoryPath(dir),
      `${JSON.stringify({ spaceId: 'p', url: 'https://velho.com/', title: 'Velho', visitedAt: 1 })}\n`
    )
    const store = new HistoryStore(dir)
    // nada foi lido ainda
    store.record('p', 'https://novo.com/', '', 50)
    store.setTitle('p', 'https://novo.com/', 'Novo')
    store.record('p', 'https://velho.com/', 'Velho', 60)
    assert.deepEqual(strip(store.getEntries('p')), [
      { url: 'https://velho.com/', title: 'Velho', visitedAt: 60 },
      { url: 'https://novo.com/', title: 'Novo', visitedAt: 50 }
    ])
    store.saveNow()
    const reopened = new HistoryStore(dir)
    assert.deepEqual(
      strip(reopened.getEntries('p')),
      strip(store.getEntries('p'))
    )
  })
})

test('HistoryStore compacta o arquivo quando sobram muitas linhas antigas', () => {
  withDir(dir => {
    const lines: string[] = []
    for (let i = 0; i < 6000; i++)
      lines.push(
        JSON.stringify({
          spaceId: 'p',
          url: 'https://a.com/',
          title: 'A',
          visitedAt: i
        })
      )
    writeFileSync(getHistoryPath(dir), `${lines.join('\n')}\n`)
    const store = new HistoryStore(dir)
    assert.equal(store.getEntries('p').length, 1)
    store.saveNow()
    const text = readFileSync(getHistoryPath(dir), 'utf8').trim()
    assert.equal(text.split('\n').length, 1)
    assert.equal(JSON.parse(text).visitedAt, 5999)
  })
})

test('HistoryStore migra o formato antigo (history-<espaço>.json) sem apagar nada', () => {
  withDir(dir => {
    writeFileSync(
      join(dir, 'history-personal.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { url: 'https://novo.com/', title: 'Novo', visitedAt: 20 },
          { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 10 }
        ]
      })
    )
    const store = new HistoryStore(dir)
    assert.deepEqual(strip(store.getEntries('personal')), [
      { url: 'https://novo.com/', title: 'Novo', visitedAt: 20 },
      { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 10 }
    ])
    assert.equal(existsSync(getHistoryPath(dir)), true)
    assert.ok(readdirSync(dir).includes('history-personal.json.migrado'))
    assert.equal(existsSync(join(dir, 'history-personal.json')), false)

    const reopened = new HistoryStore(dir)
    assert.equal(reopened.getEntries('personal').length, 2)
  })
})

function writeLegacy(dir: string, spaceId: string, entries: unknown[]): void {
  writeFileSync(
    join(dir, `history-${spaceId}.json`),
    JSON.stringify({ version: 1, entries })
  )
}

test('HistoryStore migra o formato antigo mesmo quando a primeira gravação vem antes da leitura', () => {
  withDir(dir => {
    writeLegacy(dir, 'personal', [
      { url: 'https://linear.test/changelog', title: 'Changelog', visitedAt: 5 }
    ])
    writeLegacy(dir, 'work', [
      { url: 'https://jira.test/board', title: 'Quadro antigo', visitedAt: 4 }
    ])
    const store = new HistoryStore(dir)
    // a aba ativa navega no primeiro segundo e o debounce grava antes dos 3 s da leitura adiada
    store.record('personal', 'https://keylog.test/', 'Página', 100)
    store.saveNow()

    assert.ok(readdirSync(dir).includes('history-personal.json.migrado'))
    assert.ok(readdirSync(dir).includes('history-work.json.migrado'))
    const reopened = new HistoryStore(dir)
    assert.deepEqual(strip(reopened.getEntries('personal')), [
      { url: 'https://keylog.test/', title: 'Página', visitedAt: 100 },
      { url: 'https://linear.test/changelog', title: 'Changelog', visitedAt: 5 }
    ])
    assert.deepEqual(strip(reopened.getEntries('work')), [
      { url: 'https://jira.test/board', title: 'Quadro antigo', visitedAt: 4 }
    ])
    // sem linhas repetidas no arquivo novo
    const lines = readFileSync(getHistoryPath(dir), 'utf8').trim().split('\n')
    assert.equal(lines.length, 3)
  })
})

test('HistoryStore migra o formato antigo na saída do app, antes dos 3 s da leitura', () => {
  withDir(dir => {
    writeLegacy(dir, 'personal', [
      { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 5 }
    ])
    const store = new HistoryStore(dir)
    store.record('personal', 'https://novo.com/', '', 50)
    store.setTitle('personal', 'https://novo.com/', 'Novo')
    // before-quit
    store.saveNow()
    assert.ok(readdirSync(dir).includes('history-personal.json.migrado'))
    const reopened = new HistoryStore(dir)
    assert.deepEqual(strip(reopened.getEntries('personal')), [
      { url: 'https://novo.com/', title: 'Novo', visitedAt: 50 },
      { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 5 }
    ])
  })
})

test('HistoryStore junta o formato antigo a um history.jsonl que já existe (criado sem migrar)', () => {
  withDir(dir => {
    writeFileSync(
      getHistoryPath(dir),
      `${JSON.stringify({ spaceId: 'personal', url: 'https://keylog.test/', title: 'Página', visitedAt: 100 })}\n${JSON.stringify({ spaceId: 'personal', url: 'https://x.com/#a', title: '', visitedAt: 30 })}\n`
    )
    writeLegacy(dir, 'personal', [
      { url: 'https://x.com/', title: 'X', visitedAt: 40 },
      { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 5 }
    ])
    const store = new HistoryStore(dir)
    // x.com: a visita mais nova é a do formato antigo; o título que faltava vem do outro
    assert.deepEqual(strip(store.getEntries('personal')), [
      { url: 'https://keylog.test/', title: 'Página', visitedAt: 100 },
      { url: 'https://x.com/', title: 'X', visitedAt: 40 },
      { url: 'https://antigo.com/', title: 'Antigo', visitedAt: 5 }
    ])
    assert.ok(readdirSync(dir).includes('history-personal.json.migrado'))
    const text = readFileSync(getHistoryPath(dir), 'utf8').trim()
    assert.equal(text.split('\n').length, 3)
    // uma terceira abertura não migra de novo
    assert.equal(new HistoryStore(dir).getEntries('personal').length, 3)
  })
})

test('mergeSpaceHistory: mesma página fica uma vez só, com a visita mais nova', () => {
  const target = createSpaceHistory()
  const source = createSpaceHistory()
  addHistoryEntry(target, { url: 'https://a.com/', title: '', visitedAt: 10 })
  addHistoryEntry(source, { url: 'https://b.com/', title: 'B', visitedAt: 5 })
  addHistoryEntry(source, { url: 'https://a.com/#x', title: 'A', visitedAt: 3 })
  mergeSpaceHistory(target, source)
  assert.deepEqual(strip(target.list), [
    { url: 'https://a.com/', title: 'A', visitedAt: 10 },
    { url: 'https://b.com/', title: 'B', visitedAt: 5 }
  ])
  assert.equal(target.byKey.size, 2)
})

test('HistoryStore respeita o limite total ao registrar visitas em vários espaços', () => {
  withDir(dir => {
    const lines: string[] = []
    for (let i = 0; i < MAX_HISTORY; i++)
      lines.push(
        JSON.stringify({
          spaceId: i % 2 ? 'b' : 'a',
          url: `https://s${i % 100}.com/${i}`,
          title: 'S',
          visitedAt: i + 1
        })
      )
    writeFileSync(getHistoryPath(dir), `${lines.join('\n')}\n`)
    const store = new HistoryStore(dir)
    store.record('b', 'https://nova.com/', 'Nova', MAX_HISTORY + 10)
    const total = store.getEntries('a').length + store.getEntries('b').length
    assert.equal(total, MAX_HISTORY)
    // saiu a visita mais antiga de todas (a 0, do espaço a)
    assert.equal(
      store.getEntries('a').some(e => e.url.endsWith('/0')),
      false
    )
    assert.equal(store.getEntries('b')[0].url, 'https://nova.com/')
  })
})

test('HistoryStore: a âncora comum (token de login) não fica na memória nem no disco; #/rota fica na memória', () => {
  withDir(dir => {
    const store = new HistoryStore(dir)
    store.record(
      'personal',
      'https://app.example/callback#access_token=SEGREDO&state=x',
      'Entrando',
      10
    )
    store.record('personal', 'https://spa.example/#/caixa', 'Caixa', 11)
    store.record('personal', 'https://doc.example/guia#secao-3', 'Guia', 12)
    // o que a paleta lê agora, com o app rodando
    assert.deepEqual(
      store.getEntries('personal').map(entry => entry.url),
      [
        'https://doc.example/guia',
        'https://spa.example/#/caixa',
        'https://app.example/callback'
      ]
    )
    // o título que a página manda depois acha a entrada mesmo com a âncora no endereço
    store.setTitle('personal', 'https://doc.example/guia#secao-4', 'Guia novo')
    assert.equal(store.getEntries('personal')[0].title, 'Guia novo')
    store.saveNow()
    const disk = readFileSync(getHistoryPath(dir), 'utf8')
    assert.equal(disk.includes('SEGREDO'), false)
    assert.equal(disk.includes('#'), false)
  })
})
