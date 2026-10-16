import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FRAME_REPORT_STALE_MS,
  isSameOrigin,
  judgeActivation,
  originOfUrl,
  type FrameGesture,
  type FrameInfo
} from '../src/main/functions/frame-activation'
import { GESTURE_WINDOW_MS } from '../src/main/functions/user-gesture'

const MAIN: FrameInfo = {
  key: 'main',
  parentKey: null,
  origin: 'https://site.test',
  url: 'https://site.test/pagina'
}
const AD: FrameInfo = {
  key: 'ad',
  parentKey: 'main',
  origin: 'https://ads.test',
  url: 'https://ads.test/banner'
}
const OTHER_AD: FrameInfo = {
  key: 'ad2',
  parentKey: 'main',
  origin: 'https://outro-ads.test',
  url: 'https://outro-ads.test/x'
}
const SAME: FrameInfo = {
  key: 'same',
  parentKey: 'main',
  origin: 'https://site.test',
  url: 'https://site.test/widget'
}
// um iframe do anúncio dentro do anúncio
const AD_CHILD: FrameInfo = {
  key: 'ad-child',
  parentKey: 'ad',
  origin: 'https://ads.test',
  url: 'https://ads.test/filho'
}

const NOW = 1_000_000

function gestureIn(frame: FrameInfo, at = NOW - 100): FrameGesture {
  return { at, key: frame.key, origin: frame.origin }
}

function judge(
  frames: FrameInfo[],
  gestures: FrameGesture[],
  requesterOrigin: string | null,
  extra: { tabGestureAt?: number; now?: number } = {}
) {
  return judgeActivation({
    frames,
    gestures,
    tabGestureAt: extra.tabGestureAt ?? NOW - 100,
    requesterOrigin,
    now: extra.now ?? NOW
  })
}

test('origem: opaca nunca é igual a nada, nem a outra opaca', () => {
  assert.equal(isSameOrigin('https://a.test', 'https://a.test'), true)
  assert.equal(isSameOrigin('https://a.test', 'https://b.test'), false)
  assert.equal(isSameOrigin('null', 'null'), false)
  assert.equal(isSameOrigin('', ''), false)
  assert.equal(originOfUrl('https://a.test:8443/x?y#z'), 'https://a.test:8443')
  assert.equal(originOfUrl('data:text/html,x'), null)
  assert.equal(originOfUrl('about:blank'), null)
  assert.equal(originOfUrl(''), null)
  assert.equal(originOfUrl(undefined), null)
  assert.equal(originOfUrl('não é url'), null)
})

test('o clique na página principal não vale para o anúncio de outra origem (o achado da revisão)', () => {
  const frames = [MAIN, AD]
  const gestures = [gestureIn(MAIN)]
  // quem pede é o anúncio: o referrer do window.open dele é da origem dele
  assert.equal(judge(frames, gestures, 'https://ads.test'), 'foreign')
  // quem pede é a própria página
  assert.equal(judge(frames, gestures, 'https://site.test'), 'activated')
})

test('o gesto ativa o quadro, os ancestrais e os descendentes da mesma origem', () => {
  // clique no anúncio: vale para ele, para a página (ancestral) e para o filho dele (mesma origem)
  const frames = [MAIN, AD, AD_CHILD, OTHER_AD]
  const gestures = [gestureIn(AD)]
  assert.equal(judge(frames, gestures, 'https://ads.test'), 'activated')
  assert.equal(judge(frames, gestures, 'https://site.test'), 'activated')
  // o outro anúncio não herda o clique dado no primeiro
  assert.equal(judge(frames, gestures, 'https://outro-ads.test'), 'foreign')
})

test('iframe da mesma origem herda o clique na página, como no Chromium', () => {
  assert.equal(
    judge([MAIN, SAME], [gestureIn(MAIN)], 'https://site.test'),
    'activated'
  )
  // mas o descendente de outra origem dentro dele, não
  const deep: FrameInfo = {
    key: 'deep',
    parentKey: 'same',
    origin: 'https://ads.test',
    url: 'https://ads.test/fundo'
  }
  assert.equal(
    judge([MAIN, SAME, deep], [gestureIn(MAIN)], 'https://ads.test'),
    'foreign'
  )
})

test('sem origem de quem pede (noreferrer), todos os quadros precisam ter sido ativados', () => {
  // só a página: qualquer quadro que peça é o dela
  assert.equal(judge([MAIN], [gestureIn(MAIN)], null), 'activated')
  assert.equal(judge([MAIN, SAME], [gestureIn(MAIN)], null), 'activated')
  // com um anúncio de outra origem, pode ser ele: não vale
  assert.equal(judge([MAIN, AD], [gestureIn(MAIN)], null), 'foreign')
  // se o clique foi no anúncio, a página (ancestral) também está ativada: vale para os dois
  assert.equal(judge([MAIN, AD], [gestureIn(AD)], null), 'activated')
  // origem que nenhum quadro tem (já saiu): trata como desconhecida
  assert.equal(
    judge([MAIN, AD], [gestureIn(MAIN)], 'https://sumiu.test'),
    'foreign'
  )
})

test('vários cliques em quadros diferentes valem juntos, cada um por 5 s', () => {
  const frames = [MAIN, AD, OTHER_AD]
  const gestures = [gestureIn(AD, NOW - 4000), gestureIn(OTHER_AD, NOW - 100)]
  assert.equal(judge(frames, gestures, 'https://ads.test'), 'activated')
  assert.equal(judge(frames, gestures, 'https://outro-ads.test'), 'activated')
  // o do anúncio passa de 5 s: só o outro continua valendo
  const later = judge(frames, gestures, 'https://ads.test', {
    now: NOW + GESTURE_WINDOW_MS - 3000
  })
  assert.equal(later, 'foreign')
  assert.equal(
    judge(frames, gestures, 'https://outro-ads.test', {
      now: NOW + GESTURE_WINDOW_MS - 3000
    }),
    'activated'
  )
})

test('quadro em sandbox (origem opaca): quem pede vem pelo endereço, e nada herda dele', () => {
  const sandbox: FrameInfo = {
    key: 'sbx',
    parentKey: 'main',
    origin: 'null',
    url: 'https://ads.test/sandbox'
  }
  // o referrer diz https://ads.test; o quadro de origem opaca é o candidato pelo endereço
  assert.equal(
    judge([MAIN, sandbox], [gestureIn(MAIN)], 'https://ads.test'),
    'foreign'
  )
  // iniciador opaco de um download ("null"): só os quadros opacos
  assert.equal(judge([MAIN, sandbox], [gestureIn(MAIN)], 'null'), 'foreign')
  assert.equal(
    judge([MAIN, sandbox], [gestureIn(sandbox)], 'null'),
    'activated'
  )
  // dois quadros opacos não são da mesma origem: o clique num não ativa o filho opaco do outro
  const child: FrameInfo = {
    key: 'sbx-child',
    parentKey: 'sbx',
    origin: 'null',
    url: 'data:text/html,x'
  }
  assert.equal(
    judge([MAIN, sandbox, child], [gestureIn(sandbox)], 'null'),
    'foreign'
  )
})

test('gesto vencido, de quadro que sumiu ou que carregou outro documento não vale', () => {
  const frames = [MAIN, AD]
  assert.equal(
    judge(
      frames,
      [gestureIn(MAIN, NOW - GESTURE_WINDOW_MS - 1)],
      'https://site.test',
      {
        tabGestureAt: NOW - GESTURE_WINDOW_MS - 1
      }
    ),
    'foreign'
  )
  // o quadro do gesto não existe mais
  assert.equal(
    judge(
      frames,
      [{ at: NOW - 100, key: 'removido', origin: 'https://ads.test' }],
      'https://site.test'
    ),
    'activated'
  )
  // o anúncio navegou para outra origem depois do clique nele
  assert.equal(
    judge(
      [MAIN, { ...AD, origin: 'https://novo.test', url: 'https://novo.test/' }],
      [gestureIn(AD)],
      'https://novo.test',
      { tabGestureAt: NOW - 100 }
    ),
    'foreign'
  )
})

test('gesto que nenhum quadro reportou (sem preload) vale para a página principal, não para o anúncio', () => {
  const frames = [MAIN, AD]
  // o main viu o clique, o preload não reportou: o clique caiu na página
  assert.equal(judge(frames, [], 'https://site.test'), 'activated')
  assert.equal(judge(frames, [], 'https://ads.test'), 'foreign')
  // um relato velho (de antes do clique visto pelo main) também deixa o clique para a página
  const old = [gestureIn(AD, NOW - 3000)]
  assert.equal(
    judge(frames, old, 'https://site.test', { tabGestureAt: NOW - 100 }),
    'activated'
  )
  // o relato que acompanha o clique (no limite do atraso) não troca o dono
  const fresh = [gestureIn(AD, NOW - 100 - FRAME_REPORT_STALE_MS)]
  assert.equal(
    judge(frames, fresh, 'https://ads.test', { tabGestureAt: NOW - 100 }),
    'activated'
  )
})

test('sem gesto nenhum, ninguém foi ativado; sem quadros, não há como julgar', () => {
  assert.equal(
    judgeActivation({
      frames: [MAIN, AD],
      gestures: [],
      tabGestureAt: undefined,
      requesterOrigin: 'https://site.test',
      now: NOW
    }),
    'foreign'
  )
  assert.equal(judge([], [gestureIn(MAIN)], 'https://site.test'), 'unknown')
})
