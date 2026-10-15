// Linha do userData/logs/main.log para um erro do main. Pura.

// o rastro de um erro de renderer pode ser enorme; o log não cresce sem limite por linha
const MAX_LINE_CHARS = 4000

export type ErrorKind = 'uncaughtException' | 'unhandledRejection' | 'warning'

function describe(error: unknown): string {
  if (error instanceof Error)
    return error.stack || `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

export function formatErrorLog(
  kind: ErrorKind,
  error: unknown,
  now = new Date()
): string {
  const text = describe(error).replace(/\r?\n/g, '\n    ')
  const clipped =
    text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)}…` : text
  return `${now.toISOString()} [Main][${kind}] ${clipped}\n`
}
