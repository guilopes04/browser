// Tamanho de arquivo como o Finder mostra (base 1000), em português. Puro.

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'tamanho desconhecido'
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  // até 9,9 com uma casa; de 10 em diante, inteiro
  const text =
    unit === 0 || value >= 10 ? String(Math.round(value)) : value.toFixed(1)
  return `${text.replace('.', ',').replace(/,0$/, '')} ${UNITS[unit]}`
}
