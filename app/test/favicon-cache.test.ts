import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFaviconCache } from '../src/main/functions/favicon-cache'

test('guarda e devolve; chave ausente dá undefined', () => {
  const cache = createFaviconCache(10, 1000)
  cache.set('a', 'data:a')
  assert.equal(cache.get('a'), 'data:a')
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.size, 1)
  assert.equal(cache.bytes, 6)
})

test('limite de itens: sai o usado há mais tempo', () => {
  const cache = createFaviconCache(2, 1000)
  cache.set('a', 'A')
  cache.set('b', 'B')
  cache.get('a')
  cache.set('c', 'C')
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('a'), 'A')
  assert.equal(cache.get('c'), 'C')
  assert.equal(cache.size, 2)
})

test('limite de bytes e item maior que o limite', () => {
  const cache = createFaviconCache(100, 10)
  cache.set('a', '123456')
  cache.set('b', '123456')
  assert.equal(cache.get('a'), undefined)
  assert.ok(cache.bytes <= 10)
  cache.set('enorme', 'x'.repeat(11))
  assert.equal(cache.get('enorme'), undefined)
  assert.equal(cache.get('b'), '123456')
})

test('regravar a mesma chave não soma bytes duas vezes', () => {
  const cache = createFaviconCache(10, 1000)
  cache.set('a', '1234')
  cache.set('a', '12')
  assert.equal(cache.bytes, 2)
  assert.equal(cache.size, 1)
})

test('sessão longa: milhares de favicons não passam do limite', () => {
  const cache = createFaviconCache(200, 4 * 1024 * 1024)
  for (let i = 0; i < 5000; i++)
    cache.set(`https://s${i}.com/f.png`, 'x'.repeat(2000))
  assert.ok(cache.size <= 200)
  assert.ok(cache.bytes <= 4 * 1024 * 1024)
})
