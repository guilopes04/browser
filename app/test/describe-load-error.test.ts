import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeLoadError } from '@shared/describe-load-error'

test('describeLoadError separa rede de problema e cobre os códigos comuns', () => {
  assert.equal(
    describeLoadError(-106, 'a.com').title,
    'Sem conexão com a internet'
  )
  assert.equal(
    describeLoadError(-105, 'a.com').title,
    'Endereço não encontrado'
  )
  assert.equal(
    describeLoadError(-102, 'a.com').title,
    'O site recusou a conexão'
  )
  assert.equal(describeLoadError(-107, 'a.com').kind, 'problem')
  assert.equal(describeLoadError(-202, 'a.com').kind, 'problem')
  assert.equal(
    describeLoadError(-9999, 'a.com').title,
    'Não foi possível abrir a página'
  )
})

test('só o erro de internet desconectada recarrega sozinho e oferece os ajustes de rede', () => {
  assert.equal(describeLoadError(-106, 'a.com').offline, true)
  assert.equal(describeLoadError(-105, 'a.com').offline, undefined)
  assert.equal(
    describeLoadError(-312, 'a.com').title,
    'Porta bloqueada por segurança'
  )
})
