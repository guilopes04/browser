// Ativação por quadro, como o Chromium a entende: um gesto do usuário ativa o quadro em que
// aconteceu, os ancestrais dele e os descendentes da MESMA origem. Um quadro de outra origem (o
// anúncio num iframe) não herda o clique dado na página. Pop-up, download e "abrir em outro app"
// só valem para o quadro que pede se ele foi ativado. Puro: recebe os quadros, os gestos e o
// relógio; quem lê o Electron é snapshot-frames.ts.
import { GESTURE_WINDOW_MS } from './user-gesture'

export interface FrameInfo {
  // processo + token do quadro: estável enquanto o quadro existe
  key: string
  parentKey: string | null
  // origem de segurança ("http://host:porta", ou "null" para opaca: sandbox, data:)
  origin: string
  url: string
}

// um gesto reportado pelo preload do quadro (a origem é a do documento que o recebeu)
export interface FrameGesture {
  at: number
  key: string
  origin: string
}

// activated: quem pede foi ativado pelo gesto; foreign: há quem possa estar pedindo (ou quem
// pede é) um quadro que não recebeu gesto; unknown: sem quadros para julgar
export type Activation = 'activated' | 'foreign' | 'unknown'

// o preload reporta de forma síncrona, então o atraso real é de milissegundos; mais que isto entre
// o gesto visto pelo main e o último relato é um quadro que não reportou (sem preload)
export const FRAME_REPORT_STALE_MS = 500
// profundidade máxima da cadeia de pais (protege contra um ciclo impossível)
const MAX_DEPTH = 64

export interface ActivationFacts {
  frames: readonly FrameInfo[]
  gestures: readonly FrameGesture[]
  // o último gesto visto pelo main (tecla ou clique), antes de chegar à página
  tabGestureAt: number | undefined
  // origem de quem pede (referrer do window.open, iniciador do download), ou null se não se sabe
  requesterOrigin: string | null
  now: number
  windowMs?: number
}

const OPAQUE = new Set(['', 'null'])

// origens opacas nunca são iguais a nada, nem a outra opaca
export function isSameOrigin(a: string, b: string): boolean {
  return a === b && !OPAQUE.has(a)
}

// a origem de uma URL; null quando é opaca ou não é uma URL
export function originOfUrl(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const origin = new URL(url).origin
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

// quem pode ser o quadro que pede: o de origem de segurança igual, ou o de endereço da mesma
// origem (um quadro em sandbox tem origem opaca mas o endereço continua dizendo de onde veio)
function mayBeRequester(frame: FrameInfo, origin: string): boolean {
  if (origin === 'null') return frame.origin === 'null'
  return frame.origin === origin || originOfUrl(frame.url) === origin
}

function chainOf(
  byKey: ReadonlyMap<string, FrameInfo>,
  key: string
): FrameInfo[] {
  const chain: FrameInfo[] = []
  let current = byKey.get(key)
  while (current && chain.length < MAX_DEPTH) {
    chain.push(current)
    current = current.parentKey ? byKey.get(current.parentKey) : undefined
  }
  return chain
}

// o gesto em `gestureFrame` ativa `target`?
function isActivatedBy(
  byKey: ReadonlyMap<string, FrameInfo>,
  gestureFrame: FrameInfo,
  target: FrameInfo
): boolean {
  if (target.key === gestureFrame.key) return true
  // ancestrais do quadro do gesto
  if (chainOf(byKey, gestureFrame.key).some(f => f.key === target.key))
    return true
  // descendentes da mesma origem
  return (
    isSameOrigin(target.origin, gestureFrame.origin) &&
    chainOf(byKey, target.key).some(f => f.key === gestureFrame.key)
  )
}

// os quadros que receberam um gesto ainda válido: os que o preload reportou (se o quadro
// continua sendo o mesmo documento) e, se o main viu um gesto que nenhum quadro reportou, a
// página principal, que é onde um clique cai quando o quadro não tem preload
function gestureFrames(
  facts: ActivationFacts,
  byKey: ReadonlyMap<string, FrameInfo>
): FrameInfo[] {
  const windowMs = facts.windowMs ?? GESTURE_WINDOW_MS
  const fresh = (at: number) => at <= facts.now && facts.now - at <= windowMs
  const found: FrameInfo[] = []
  let newestReport = -Infinity
  for (const gesture of facts.gestures) {
    const frame = byKey.get(gesture.key)
    if (!fresh(gesture.at) || !frame || frame.origin !== gesture.origin)
      continue
    found.push(frame)
    newestReport = Math.max(newestReport, gesture.at)
  }
  const seen = facts.tabGestureAt
  if (
    seen !== undefined &&
    fresh(seen) &&
    seen - newestReport > FRAME_REPORT_STALE_MS
  ) {
    const top = [...byKey.values()].find(f => f.parentKey === null)
    if (top && !found.includes(top)) found.push(top)
  }
  return found
}

export function judgeActivation(facts: ActivationFacts): Activation {
  if (facts.frames.length === 0) return 'unknown'
  const byKey = new Map(facts.frames.map(frame => [frame.key, frame]))
  const activated = gestureFrames(facts, byKey)
  if (activated.length === 0) return 'foreign'
  // quem pede é o quadro daquela origem. Sem origem (referrer vazio por noreferrer, quadro
  // opaco), qualquer quadro pode ser: todos precisam ter sido ativados
  const named = facts.requesterOrigin
    ? facts.frames.filter(frame =>
        mayBeRequester(frame, facts.requesterOrigin!)
      )
    : []
  const candidates = named.length > 0 ? named : facts.frames
  return candidates.every(frame =>
    activated.some(gesture => isActivatedBy(byKey, gesture, frame))
  )
    ? 'activated'
    : 'foreign'
}
