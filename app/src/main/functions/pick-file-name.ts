// Nome de arquivo para a pasta Downloads: sem separadores de caminho e sem sobrescrever. "a.zip"
// vira "a (1).zip", "a (2).zip"... Pura (quem pergunta ao disco é o `exists` recebido).

const FALLBACK_NAME = 'download'

// controles de direção de texto (U+202E e afins): invertem a ordem de exibição e disfarçam a
// extensão do arquivo
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

export function sanitizeFileName(name: string): string {
  // o servidor manda o nome: nada de ../, de pastas nem de arquivo oculto de nome vazio
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    .replace(/[\u0000-\u001f]/g, '')
    .replace(BIDI_CONTROLS, '')
    .trim()
  const noLeadingDots = cleaned.replace(/^\.+/, '')
  return noLeadingDots || FALLBACK_NAME
}

// os nomes a tentar, em ordem: o próprio, "a (1).zip", "a (2).zip"... e, no fim, um com a hora
export function* fileNameCandidates(name: string): Generator<string> {
  const clean = sanitizeFileName(name)
  yield clean
  const dot = clean.lastIndexOf('.')
  // ".tar.gz": só a última extensão é separada, o que basta para o contador
  const stem = dot > 0 ? clean.slice(0, dot) : clean
  const extension = dot > 0 ? clean.slice(dot) : ''
  for (let n = 1; n < 10_000; n++) yield `${stem} (${n})${extension}`
  yield `${stem} (${Date.now()})${extension}`
}

export function pickFileName(
  name: string,
  exists: (candidate: string) => boolean
): string {
  let last = ''
  for (const candidate of fileNameCandidates(name)) {
    last = candidate
    if (!exists(candidate)) return candidate
  }
  return last
}
