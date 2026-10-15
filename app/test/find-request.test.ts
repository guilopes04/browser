import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getFindRequest, shouldResetFindSession } from '@shared/find-request'
import {
  beginFindRequest,
  createFindState,
  setFindMatchCase,
  typeFindText
} from '@shared/find-state'

const typed = typeFindText(createFindState(), 'banana')
const live = beginFindRequest(typed, 1)

test('sem texto não há pedido (findInPage("") lança erro)', () => {
  assert.equal(getFindRequest(createFindState(), 'restart'), null)
  assert.equal(getFindRequest(createFindState(), 'next'), null)
})

test('texto novo abre uma sessão: findNext true, para a frente', () => {
  assert.deepEqual(getFindRequest(typed, 'restart'), {
    text: 'banana',
    options: { forward: true, findNext: true, matchCase: false }
  })
})

test('com a sessão viva, próximo e anterior a seguem (findNext false)', () => {
  assert.deepEqual(getFindRequest(live, 'next')?.options, {
    forward: true,
    findNext: false,
    matchCase: false
  })
  assert.deepEqual(getFindRequest(live, 'previous')?.options, {
    forward: false,
    findNext: false,
    matchCase: false
  })
})

test('sem sessão viva, seguir recomeça: o Chromium não responde a quem segue o nada', () => {
  assert.deepEqual(getFindRequest(typed, 'next')?.options, {
    forward: true,
    findNext: true,
    matchCase: false
  })
  assert.deepEqual(getFindRequest(typed, 'previous')?.options, {
    forward: false,
    findNext: true,
    matchCase: false
  })
})

test('o "Aa" vai no pedido', () => {
  const state = beginFindRequest(setFindMatchCase(typed, true), 2)
  assert.equal(getFindRequest(state, 'next')?.options.matchCase, true)
  assert.equal(getFindRequest(state, 'restart')?.options.matchCase, true)
})

test('página nova: sessão nova do começo, mesmo com a sessão anterior viva', () => {
  assert.deepEqual(getFindRequest(live, 'reload')?.options, {
    forward: true,
    findNext: true,
    matchCase: false
  })
  // só a página nova encerra a sessão anterior antes: digitar segue do destaque ativo
  assert.equal(shouldResetFindSession('reload'), true)
  assert.equal(shouldResetFindSession('restart'), false)
  assert.equal(shouldResetFindSession('next'), false)
})
