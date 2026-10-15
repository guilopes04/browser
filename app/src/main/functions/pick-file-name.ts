// Nome de arquivo para a pasta Downloads: sem separadores de caminho e sem sobrescrever. "a.zip"
// vira "a (1).zip", "a (2).zip"... Pura (quem pergunta ao disco é o `exists` recebido).

const FALLBACK_NAME = 'download'

export function sanitizeFileName(name: string): string {
  // o servidor manda o nome: nada de ../, de pastas nem de arquivo oculto de nome vazio
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[\u0000-\u001f]/g, '').trim()
  const noLeadingDots = cleaned.replace(/^\.+/, '')
  return noLeadingDots || FALLBACK_NAME
}

export function pickFileName(
  name: string,
  exists: (candidate: string) => boolean
): string {
  const clean = sanitizeFileName(name)
  if (!exists(clean)) return clean
  const dot = clean.lastIndexOf('.')
  // ".tar.gz": só a última extensão é separada, o que basta para o contador
  const stem = dot > 0 ? clean.slice(0, dot) : clean
  const extension = dot > 0 ? clean.slice(dot) : ''
  for (let n = 1; n < 10_000; n++) {
    const candidate = `${stem} (${n})${extension}`
    if (!exists(candidate)) return candidate
  }
  return `${stem} (${Date.now()})${extension}`
}
