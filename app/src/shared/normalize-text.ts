// Texto da busca (⌘K): sem acento nem caixa, e a consulta quebrada em palavras. Puro.

const COMBINING_MARKS = /\p{M}/gu

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

export function toQueryWords(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(Boolean)
}
