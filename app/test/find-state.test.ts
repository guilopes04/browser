import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyFindResult,
  beginFindRequest,
  createFindState,
  focusFind,
  formatFindCount,
  replaceFindText,
  resetFindResults,
  setFindMatchCase,
  toFindViewState,
  typeFindText,
  type FindResult,
  type FindState
} from '@shared/find-state'

function result(extra: Partial<FindResult> = {}): FindResult {
  return {
    requestId: 1,
    activeMatchOrdinal: 1,
    matches: 3,
    finalUpdate: true,
    ...extra
  }
}

// um estado com texto e um pedido em andamento
function searching(text = 'abc', requestId = 1): FindState {
  return beginFindRequest(typeFindText(createFindState(), text), requestId)
}

test('estado inicial: sem texto, sem resultado, sem diferenciar maiúsculas', () => {
  const state = createFindState()
  assert.equal(state.text, '')
  assert.equal(state.status, 'idle')
  assert.equal(state.matchCase, false)
  assert.equal(state.live, false)
  assert.equal(formatFindCount(state), '')
  assert.equal(createFindState(true).matchCase, true)
})

test('digitar na caixa não troca a revisão do texto; o main trocando, sim', () => {
  const typed = typeFindText(createFindState(), 'ab')
  assert.equal(typed.text, 'ab')
  assert.equal(typed.status, 'pending')
  assert.equal(typed.textRevision, 0)

  const replaced = replaceFindText(typed, 'abc')
  assert.equal(replaced.text, 'abc')
  assert.equal(replaced.textRevision, 1)
})

test('o texto vazio zera a busca: sem resultado, sem pedido e sem sessão', () => {
  const state = applyFindResult(searching(), result())
  assert.equal(state.matches, 3)
  const cleared = typeFindText(state, '')
  assert.equal(cleared.status, 'idle')
  assert.equal(cleared.matches, 0)
  assert.equal(cleared.active, 0)
  assert.equal(cleared.requestId, null)
  assert.equal(cleared.live, false)
  assert.equal(formatFindCount(cleared), '')
})

test('texto novo segue mostrando o contador anterior até a resposta nova', () => {
  const state = applyFindResult(searching('ab'), result({ matches: 5 }))
  const typed = typeFindText(state, 'abc')
  assert.equal(typed.status, 'pending')
  assert.equal(typed.live, false)
  assert.equal(formatFindCount(typed), '1 de 5')
})

test('beginFindRequest marca o pedido e a sessão viva', () => {
  const state = beginFindRequest(typeFindText(createFindState(), 'a'), 7)
  assert.equal(state.requestId, 7)
  assert.equal(state.status, 'pending')
  assert.equal(state.live, true)
})

test('applyFindResult: a resposta do pedido atual vira "N de M"', () => {
  const state = applyFindResult(
    searching(),
    result({ activeMatchOrdinal: 2, matches: 3 })
  )
  assert.equal(state.status, 'done')
  assert.equal(state.active, 2)
  assert.equal(state.matches, 3)
  assert.equal(formatFindCount(state), '2 de 3')
})

test('applyFindResult ignora resposta de outro pedido e devolve o mesmo estado', () => {
  const state = searching('abc', 5)
  assert.equal(applyFindResult(state, result({ requestId: 4 })), state)
  // sem texto não há o que responder
  const idle = createFindState()
  assert.equal(applyFindResult(idle, result({ requestId: 1 })), idle)
})

test('resposta parcial sem posição ativa mantém a anterior, dentro do total', () => {
  let state = applyFindResult(
    searching(),
    result({ activeMatchOrdinal: 4, matches: 6, finalUpdate: false })
  )
  assert.equal(state.status, 'pending')
  assert.equal(state.active, 4)
  state = applyFindResult(
    state,
    result({ activeMatchOrdinal: 0, matches: 5, finalUpdate: false })
  )
  assert.equal(state.active, 4)
  state = applyFindResult(
    state,
    result({ activeMatchOrdinal: 0, matches: 2, finalUpdate: true })
  )
  assert.equal(state.active, 2)
  assert.equal(state.status, 'done')
})

test('"Nenhum resultado" só depois da resposta final', () => {
  const pending = searching()
  assert.equal(formatFindCount(pending), '')
  const none = applyFindResult(
    pending,
    result({ matches: 0, activeMatchOrdinal: 0 })
  )
  assert.equal(formatFindCount(none), 'Nenhum resultado')
  // uma resposta parcial com zero não conta como o fim
  const partial = applyFindResult(
    pending,
    result({ matches: 0, activeMatchOrdinal: 0, finalUpdate: false })
  )
  assert.equal(formatFindCount(partial), '')
})

test('o primeiro "zero" transitório do Chromium é corrigido pela resposta seguinte', () => {
  let state = applyFindResult(
    searching(),
    result({ matches: 0, activeMatchOrdinal: 0 })
  )
  assert.equal(formatFindCount(state), 'Nenhum resultado')
  state = applyFindResult(state, result({ matches: 3, activeMatchOrdinal: 1 }))
  assert.equal(formatFindCount(state), '1 de 3')
})

test('números grandes levam o ponto de milhar do português', () => {
  const state = applyFindResult(
    searching(),
    result({ activeMatchOrdinal: 1234, matches: 12345 })
  )
  assert.equal(formatFindCount(state), '1.234 de 12.345')
})

test('"Aa": trocar recomeça (pendente, sem sessão); repetir o mesmo valor não muda nada', () => {
  const state = applyFindResult(searching(), result())
  const on = setFindMatchCase(state, true)
  assert.equal(on.matchCase, true)
  assert.equal(on.status, 'pending')
  assert.equal(on.live, false)
  assert.equal(setFindMatchCase(on, true), on)
  // sem texto, ligar o "Aa" não inicia busca
  assert.equal(setFindMatchCase(createFindState(), true).status, 'idle')
})

test('página nova: o que se sabia dela não vale mais', () => {
  const state = applyFindResult(searching(), result())
  const reset = resetFindResults(state)
  assert.equal(reset.status, 'pending')
  assert.equal(reset.matches, 0)
  assert.equal(reset.active, 0)
  assert.equal(reset.requestId, null)
  assert.equal(reset.live, false)
  assert.equal(reset.text, 'abc')
  assert.equal(resetFindResults(createFindState()).status, 'idle')
})

test('focusFind sobe a revisão de foco e deixa o texto selecionado até alguém digitar', () => {
  const focused = focusFind(typeFindText(createFindState(), 'abc'))
  assert.equal(focused.focusRevision, 1)
  assert.equal(focused.selected, true)
  assert.equal(typeFindText(focused, 'abcd').selected, false)
  assert.equal(replaceFindText(focused, 'x').selected, false)
})

test('toFindViewState leva texto, contador formatado, "Aa" e as cores', () => {
  const state = applyFindResult(
    setFindMatchCase(replaceFindText(searching('café'), 'café'), true),
    result()
  )
  const live = beginFindRequest(state, 1)
  assert.deepEqual(toFindViewState(live, 'dark', '#8E9BF2'), {
    text: 'café',
    textRevision: 1,
    focusRevision: 0,
    matchCase: true,
    count: '1 de 3',
    theme: 'dark',
    accent: '#8E9BF2'
  })
})
