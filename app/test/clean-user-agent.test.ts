import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanUserAgent } from '../src/main/functions/clean-user-agent'

const BASE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
const CHROME_ONLY = `${BASE} Chrome/152.0.7977.149 Safari/537.36`

test('tira o token do app (nome de produto sem espaço) e o Electron', () => {
  const raw = `${BASE} GilasBrowser/0.1.0 Chrome/152.0.7977.149 Electron/44.7.2 Safari/537.36`
  assert.equal(cleanUserAgent(raw), CHROME_ONLY)
})

test('qualquer nome de app sai, inclusive com ponto e hífen', () => {
  const raw = `${BASE} meu-app.beta/2.0.0-rc.1 Chrome/152.0.7977.149 Electron/44.7.2 Safari/537.36`
  assert.equal(cleanUserAgent(raw), CHROME_ONLY)
})

test('um user agent já limpo não muda', () => {
  assert.equal(cleanUserAgent(CHROME_ONLY), CHROME_ONLY)
  assert.equal(cleanUserAgent(''), '')
})
