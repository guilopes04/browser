import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatVisited } from '@shared/format-visited'

const now = new Date(2026, 9, 15, 14, 30).getTime()
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime()

test('minutos, hoje, ontem, dias e data', () => {
  assert.equal(formatVisited(now - 20_000, now), 'agora')
  assert.equal(formatVisited(now - 5 * 60_000, now), 'há 5 min')
  assert.equal(formatVisited(at(15, 6), now), 'hoje')
  assert.equal(formatVisited(at(14, 23, 50), now), 'ontem')
  assert.equal(formatVisited(at(14, 1), now), 'ontem')
  assert.equal(formatVisited(at(12, 9), now), 'há 3 dias')
  assert.equal(formatVisited(at(5, 9), now), '05/10/2026')
})
