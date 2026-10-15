import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeForMatch,
  rankMatches,
  scoreMatch
} from '@shared/match-palette'
import { normalizeText, toQueryWords } from '@shared/normalize-text'
import { stripScheme, toUrlKey } from '@shared/url-key'

test('normalizeText tira acento e caixa', () => {
  assert.equal(normalizeText('Produção, AÇÃO'), 'producao, acao')
  assert.deepEqual(toQueryWords('  Anotações   do NAVEGADOR '), [
    'anotacoes',
    'do',
    'navegador'
  ])
  assert.deepEqual(toQueryWords('   '), [])
})

test('stripScheme e toUrlKey: sem esquema, sem www e sem barra final', () => {
  assert.equal(
    stripScheme('https://www.linear.app/team/issues'),
    'linear.app/team/issues'
  )
  assert.equal(stripScheme('http://localhost:3000/'), 'localhost:3000/')
  assert.equal(toUrlKey('https://Linear.app/roadmap/'), 'linear.app/roadmap')
  assert.equal(
    toUrlKey('http://linear.app/roadmap'),
    toUrlKey('https://www.linear.app/roadmap#x')
  )
})

test('toUrlKey: só o host perde a caixa; caminho e consulta diferenciam páginas', () => {
  assert.notEqual(
    toUrlKey('https://bit.ly/AbC'),
    toUrlKey('https://bit.ly/abc')
  )
  assert.notEqual(
    toUrlKey('https://youtu.be/dQw4w9WgXcQ'),
    toUrlKey('https://youtu.be/dqw4w9wgxcq')
  )
  assert.notEqual(
    toUrlKey('https://x.com/a?id=AbC'),
    toUrlKey('https://x.com/a?id=abc')
  )
  assert.equal(toUrlKey('HTTPS://WWW.Bit.LY/AbC'), 'bit.ly/AbC')
  assert.equal(toUrlKey('https://Bit.ly'), 'bit.ly')
  assert.equal(toUrlKey('https://Bit.ly?Q=1'), 'bit.ly?Q=1')
  assert.equal(toUrlKey('https://Bit.ly#/Rota'), 'bit.ly#/Rota')
  assert.equal(toUrlKey('https://Bit.ly:8080/A/'), 'bit.ly:8080/A')
})

test('toUrlKey: âncora comum é a mesma página, #/rota e #!/rota não', () => {
  assert.equal(
    toUrlKey('http://anchors.test/doc#a'),
    toUrlKey('http://anchors.test/doc#b')
  )
  assert.equal(toUrlKey('https://x.com/doc#'), toUrlKey('https://x.com/doc'))
  assert.equal(
    toUrlKey('https://x.com/a?q=1#topo'),
    toUrlKey('https://x.com/a?q=1')
  )
  assert.notEqual(
    toUrlKey('https://app.com/#/inbox'),
    toUrlKey('https://app.com/#/settings')
  )
  assert.notEqual(
    toUrlKey('https://app.com/#!/inbox'),
    toUrlKey('https://app.com/')
  )
})

test('scoreMatch: todas as palavras precisam combinar no título ou no endereço', () => {
  assert.equal(
    scoreMatch(
      ['linear'],
      'Minhas issues no Linear',
      'https://linear.app/team/issues'
    ) > 0,
    true
  )
  assert.equal(
    scoreMatch(
      ['linear', 'zzz'],
      'Minhas issues no Linear',
      'https://linear.app/x'
    ),
    0
  )
  assert.equal(
    scoreMatch(
      ['producao'],
      'CloudWatch, logs de produção',
      'https://console.aws.amazon.com/'
    ),
    4
  )
  // só o endereço combina
  assert.equal(
    scoreMatch(['amazon'], 'CloudWatch', 'https://console.aws.amazon.com/') > 0,
    true
  )
  // o esquema não conta
  assert.equal(scoreMatch(['https'], 'Página', 'https://exemplo.com'), 0)
})

test('scoreMatch: começo do título > começo de palavra > dentro > endereço', () => {
  const prefix = scoreMatch(['css'], 'CSS :has() na MDN', 'https://mdn.org')
  const wordStart = scoreMatch(['has'], 'CSS :has() na MDN', 'https://mdn.org')
  const inside = scoreMatch(['ha'], 'Chapéu', 'https://x.org')
  const urlOnly = scoreMatch(
    ['mozilla'],
    'Documentação',
    'https://developer.mozilla.org'
  )
  assert.ok(prefix > wordStart)
  assert.ok(wordStart > inside)
  assert.ok(inside > urlOnly)
})

test('rankMatches ordena por nota, desempata por recência e respeita o limite', () => {
  const items = [
    { title: 'Ver linear', url: 'https://a.com', recency: 5 },
    { title: 'Linear roadmap', url: 'https://b.com', recency: 1 },
    { title: 'Linear changelog', url: 'https://c.com', recency: 9 },
    { title: 'Outro assunto', url: 'https://d.com', recency: 99 }
  ]
  const ranked = rankMatches(items, ['linear'], item => item, 3)
  assert.deepEqual(
    ranked.map(item => item.url),
    ['https://c.com', 'https://b.com', 'https://a.com']
  )
  assert.equal(rankMatches(items, ['linear'], item => item, 1).length, 1)
})

test('consulta em 1000 itens leva bem menos de 10 ms (média de 20 rodadas)', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    title: `Página número ${i} sobre assunto ${i % 17} com ação`,
    url: `https://site${i % 40}.exemplo.com.br/caminho/${i}/produção`,
    recency: i
  }))
  const words = toQueryWords('assunto producao')
  rankMatches(items, words, item => item, 10)
  const start = performance.now()
  for (let i = 0; i < 20; i++) rankMatches(items, words, item => item, 10)
  const average = (performance.now() - start) / 20
  assert.ok(average < 10, `média de ${average.toFixed(2)} ms`)
})

test('rankMatches: accept só vale para quem combina e o limite conta depois dele', () => {
  const items = [
    { title: 'Linear A', url: 'https://a.com', recency: 3 },
    { title: 'Linear B', url: 'https://b.com', recency: 2 },
    { title: 'Linear C', url: 'https://c.com', recency: 1 },
    { title: 'Outro', url: 'https://d.com', recency: 9 }
  ]
  const asked: string[] = []
  const ranked = rankMatches(
    items,
    ['linear'],
    item => item,
    2,
    item => {
      asked.push(item.title)
      return item.title !== 'Linear A'
    }
  )
  assert.deepEqual(
    ranked.map(item => item.title),
    ['Linear B', 'Linear C']
  )
  assert.ok(!asked.includes('Outro'))
})

test('rankMatches: empate total mantém a ordem original e limite 0 devolve vazio', () => {
  const items = ['x1', 'x2', 'x3'].map(title => ({
    title,
    url: 'https://a.com',
    recency: 5
  }))
  assert.deepEqual(
    rankMatches(items, ['x'], item => item, 2).map(item => item.title),
    ['x1', 'x2']
  )
  assert.deepEqual(
    rankMatches(items, ['x'], item => item, 0),
    []
  )
})

test('rankMatches usa o texto já normalizado quando ele vem junto', () => {
  const entry = {
    title: 'Página Histórica Ácida',
    url: 'https://hist.test/page1',
    recency: 1,
    normalized: normalizeForMatch(
      'Página Histórica Ácida',
      'https://hist.test/page1'
    )
  }
  assert.equal(normalizeText('Histórica'), 'historica')
  assert.equal(rankMatches([entry], ['historica'], item => item, 5).length, 1)
  // o texto normalizado manda: sem ele a busca refaria a conta
  const stale = { ...entry, normalized: { title: 'outra coisa', url: 'x' } }
  assert.equal(rankMatches([stale], ['historica'], item => item, 5).length, 0)
})
