// Ranking da paleta (⌘K): todas as palavras precisam aparecer no título ou no endereço. Puro.
import { normalizeText } from './normalize-text'
import { displayUrl } from './display-url'
import { stripScheme } from './url-key'
import type { NormalizedText } from './types'

export function normalizeForMatch(title: string, url: string): NormalizedText {
  return {
    title: normalizeText(title),
    url: normalizeText(displayUrl(stripScheme(url)))
  }
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true
  const code = text.charCodeAt(index - 1)
  // ASCII sem passar pela expressão (é a maioria, e roda uma vez por entrada do histórico)
  if (code < 128)
    return !(
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90)
    )
  return !LETTER_OR_DIGIT.test(text[index - 1])
}

// 0 = não combina. Maior = melhor: começo do título > começo de palavra > dentro do título >
// começo do domínio > dentro do endereço. Recebe o texto já normalizado (ver normalizeForMatch)
export function scoreNormalized(
  words: string[],
  title: string,
  url: string,
  // words.join(' '), para quem pontua milhares de entradas calcular uma vez só
  phrase = words.join(' ')
): number {
  let total = 0
  for (const word of words) {
    let best = 0
    const inTitle = title.indexOf(word)
    if (inTitle === 0) best = 5
    else if (inTitle > 0) best = isWordStart(title, inTitle) ? 4 : 2
    const inUrl = url.indexOf(word)
    if (inUrl === 0) best = Math.max(best, 3)
    else if (inUrl > 0) best = Math.max(best, 1)
    if (best === 0) return 0
    total += best
  }
  // a consulta inteira no começo do título vale mais que palavras soltas
  if (words.length > 1 && title.startsWith(phrase)) total += 3
  return total
}

export function scoreMatch(
  words: string[],
  title: string,
  url: string
): number {
  const normalized = normalizeForMatch(title, url)
  return scoreNormalized(words, normalized.title, normalized.url)
}

export interface Rankable {
  title: string
  url: string
  // epoch ms: desempata resultados de mesma nota (o mais recente vem antes)
  recency: number
  // texto já normalizado (histórico grande guarda isso para não refazer a conta a cada tecla)
  normalized?: NormalizedText
}

interface Scored<T> {
  item: T
  score: number
  recency: number
}

function isBetter<T>(a: Scored<T>, b: Scored<T>): boolean {
  return a.score > b.score || (a.score === b.score && a.recency > b.recency)
}

// os `limit` melhores, sem ordenar tudo: com 20 mil entradas quase todas combinam numa letra só.
// `accept` só roda nos que combinam
export function rankMatches<T>(
  items: readonly T[],
  words: string[],
  read: (item: T) => Rankable,
  limit: number,
  accept?: (item: T) => boolean
): T[] {
  if (limit <= 0) return []
  const top: Scored<T>[] = []
  const phrase = words.join(' ')
  for (const item of items) {
    const { title, url, recency, normalized } = read(item)
    const score = normalized
      ? scoreNormalized(words, normalized.title, normalized.url, phrase)
      : scoreMatch(words, title, url)
    if (score === 0) continue
    const candidate = { item, score, recency }
    if (top.length === limit && !isBetter(candidate, top[limit - 1])) continue
    if (accept && !accept(item)) continue
    // empate fica depois de quem já estava (ordem original)
    let at = top.findIndex(other => isBetter(candidate, other))
    if (at === -1) at = top.length
    top.splice(at, 0, candidate)
    if (top.length > limit) top.pop()
  }
  return top.map(entry => entry.item)
}
