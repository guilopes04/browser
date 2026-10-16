import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { redactUrls } from '@shared/redact-urls'
import {
  describeError,
  formatErrorLog
} from '../src/main/functions/format-error-log'
import { logError } from '../src/main/functions/log-error'

test('redactUrls deixa só o host de cada endereço', () => {
  assert.equal(
    redactUrls(
      'falha em https://bank.example.com/conta/123?token=abc#frag e mais'
    ),
    'falha em https://bank.example.com/… e mais'
  )
  assert.equal(
    redactUrls('http://usuario:senha@exemplo.invalid:8080/x?y=1'),
    'http://exemplo.invalid:8080/…'
  )
  assert.equal(
    redactUrls('(wss://chat.example/socket?k=1) e HTTPS://A.com/p'),
    '(wss://chat.example/…) e https://A.com/…'
  )
  assert.equal(redactUrls('sem endereço aqui'), 'sem endereço aqui')
  assert.equal(redactUrls('http://[::1]:3000/x'), 'http://[::1]:3000/…')
})

test('o log do main (arquivo e console) não leva URL completa', () => {
  const error = new Error('Failed to load https://a.com/segredo?token=XYZ#h')
  error.stack = `Error: Failed to load https://a.com/segredo?token=XYZ#h\n    at x (file.js:1:1)`
  const line = formatErrorLog('uncaughtException', error, new Date(0))
  assert.equal(line.includes('segredo'), false)
  assert.equal(line.includes('XYZ'), false)
  assert.ok(line.includes('https://a.com/…'))
  assert.equal(describeError('texto').includes('texto'), true)

  const printed: unknown[][] = []
  const spy = mock.method(console, 'error', (...args: unknown[]) => {
    printed.push(args)
  })
  try {
    logError('[Tab][destroyed]', 'falha em http://x.example/a?b=c', error)
    logError('[Session][saveNow]', 'sem erro')
  } finally {
    spy.mock.restore()
  }
  const text = printed.flat().join(' ')
  assert.equal(text.includes('segredo'), false)
  assert.equal(text.includes('token'), false)
  assert.ok(text.includes('http://x.example/…'))
  assert.ok(text.includes('https://a.com/…'))
  assert.ok(text.includes('[Session][saveNow] sem erro'))
})
