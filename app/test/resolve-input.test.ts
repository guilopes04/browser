import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveInput, resolveTyped } from '@shared/resolve-input'

const SEARCH = 'https://www.google.com/search?q=%s'

test('URL completa passa direto', () => {
  assert.equal(
    resolveInput('https://electronjs.org/docs', SEARCH),
    'https://electronjs.org/docs'
  )
  assert.equal(resolveInput('  http://a.com  ', SEARCH), 'http://a.com')
})

test('domínio sem esquema vira https', () => {
  assert.equal(resolveInput('electronjs.org', SEARCH), 'https://electronjs.org')
  assert.equal(
    resolveInput('github.com/electron/electron', SEARCH),
    'https://github.com/electron/electron'
  )
})

test('localhost e IP viram http', () => {
  assert.equal(resolveInput('localhost:3000', SEARCH), 'http://localhost:3000')
  assert.equal(
    resolveInput('127.0.0.1:8080/x', SEARCH),
    'http://127.0.0.1:8080/x'
  )
})

test('*.localhost e domínios de rede local viram http', () => {
  assert.equal(
    resolveInput('b.localhost:18771/p/sub', SEARCH),
    'http://b.localhost:18771/p/sub'
  )
  assert.equal(resolveInput('app.test:8080', SEARCH), 'http://app.test:8080')
  assert.equal(
    resolveInput('nas.local/admin', SEARCH),
    'http://nas.local/admin'
  )
  assert.equal(
    resolveInput('api.internal:9000', SEARCH),
    'http://api.internal:9000'
  )
})

test('domínio público sem esquema vai de https e guarda o http para o fallback', () => {
  assert.deepEqual(resolveTyped('example.com/x', SEARCH), {
    url: 'https://example.com/x',
    httpFallback: 'http://example.com/x'
  })
  // quem digitou o esquema, ou o servidor local, não tem fallback
  assert.equal(resolveTyped('https://example.com', SEARCH).httpFallback, null)
  assert.equal(resolveTyped('localhost:3000', SEARCH).httpFallback, null)
  assert.equal(resolveTyped('gatos fofos', SEARCH).httpFallback, null)
})

test('texto livre vira busca', () => {
  assert.equal(
    resolveInput('gatos fofos', SEARCH),
    'https://www.google.com/search?q=gatos%20fofos'
  )
  assert.equal(
    resolveInput('palavra', SEARCH),
    'https://www.google.com/search?q=palavra'
  )
})

test('esquemas perigosos viram busca, vazio vira vazio', () => {
  assert.ok(
    resolveInput('javascript:alert(1)', SEARCH).startsWith(
      'https://www.google.com/search'
    )
  )
  assert.equal(resolveInput('   ', SEARCH), '')
  assert.equal(resolveInput('about:blank', SEARCH), 'about:blank')
})
