// Calcula o texto normalizado de cada entrada em fatias (uma vez só), para a primeira consulta da
// paleta já encontrar tudo pronto sem travar o main por mais que alguns milissegundos.
import type { SpaceId } from '@shared/types'
import { getSearchText } from './get-search-text'
import type { SpaceHistory } from './space-history'

const SLICE = 2000

export function warmSearchText(histories: Map<SpaceId, SpaceHistory>): void {
  const queue = [...histories.values()].flatMap(history => history.list)
  let next = 0
  const step = () => {
    const end = Math.min(next + SLICE, queue.length)
    for (; next < end; next++) getSearchText(queue[next])
    if (next < queue.length) setImmediate(step)
  }
  step()
}
