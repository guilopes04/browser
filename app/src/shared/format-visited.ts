// Quando uma página do histórico foi visitada, no texto curto da paleta. Pura.

const DAY_MS = 86_400_000

function startOfDay(time: number): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatVisited(visitedAt: number, now: number): string {
  const diff = now - visitedAt
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`
  // dias de calendário (24 h e virada do dia nem sempre coincidem)
  const days = Math.round((startOfDay(now) - startOfDay(visitedAt)) / DAY_MS)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  const date = new Date(visitedAt)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}
