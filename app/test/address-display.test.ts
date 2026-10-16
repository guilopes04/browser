import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeAddress, isInsecureUrl } from '../src/shared/address-display'
import {
  displayHostname,
  displayIdnLabel,
  isSafeIdnLabel
} from '../src/shared/idn-host'
import { decodeIdnLabel, decodePunycode } from '../src/shared/punycode'
import { splitHost } from '../src/shared/registrable-domain'

// o URL do navegador sempre entrega o host em punycode; os testes partem do Unicode como a
// pessoa (ou o atacante) o digitaria
const asUrlHost = (unicode: string) => new URL(`https://${unicode}/`).hostname

test('punycode: decodifica os rótulos conhecidos e recusa o inválido', () => {
  assert.equal(decodeIdnLabel('xn--bcher-kva'), 'bücher')
  assert.equal(decodeIdnLabel('xn--maana-pta'), 'mañana')
  assert.equal(decodeIdnLabel('xn--e1afmkfd'), 'пример')
  assert.equal(decodeIdnLabel('XN--BCHER-KVA'), 'bücher')
  assert.equal(decodeIdnLabel('exemplo'), null)
  assert.equal(decodeIdnLabel('xn--!!!'), null)
  assert.equal(decodePunycode('99999999999'), null)
  assert.equal(decodeIdnLabel(`xn--${'a'.repeat(70)}`), null)
})

test('IDN: um script só (ou o ASCII, que é latim) aparece em Unicode', () => {
  assert.equal(displayHostname(asUrlHost('pão.com.br')), 'pão.com.br')
  // cirílico puro que não imita um nome latino
  const yandex = 'яндекс.рф'
  assert.equal(displayHostname(asUrlHost(yandex)), yandex)
  // japonês: han com hiragana é uma mistura legítima
  const japanese = '日本語ひらがな.jp'
  assert.equal(displayHostname(asUrlHost(japanese)), japanese)
  // dígito e hífen são neutros
  assert.equal(displayIdnLabel('xn--bcher-kva'), 'bücher')
  assert.equal(displayHostname('exemplo-1.com'), 'exemplo-1.com')
})

test('IDN: mistura de scripts fica em punycode (a "а" cirílica de apple.com)', () => {
  const apple = 'аpple.com'
  const host = asUrlHost(apple)
  assert.match(host, /^xn--/)
  assert.equal(displayHostname(host), host)
  // grego com latim
  const google = 'gοogle.com'
  assert.equal(displayHostname(asUrlHost(google)), asUrlHost(google))
  assert.equal(isSafeIdnLabel('gοogle'), false)
})

test('IDN: cirílico que só tem letras parecidas com as latinas fica em punycode', () => {
  // "аррӏе" inteiro em cirílico: nenhuma letra latina, mas lê-se "apple"
  const fake = 'аррӏе'
  assert.equal(isSafeIdnLabel(fake), false)
  const host = asUrlHost(`${fake}.com`)
  assert.equal(displayHostname(host), host)
  assert.match(host, /^xn--80ak6aa92e\.com$/)
})

test('IDN: controle de direção e invisível nunca aparecem decodificados', () => {
  assert.equal(isSafeIdnLabel('a‮b'), false)
  assert.equal(isSafeIdnLabel('a​b'), false)
  assert.equal(isSafeIdnLabel(''), false)
})

test('domínio registrável: dois últimos rótulos, com as exceções de duas partes', () => {
  assert.deepEqual(splitHost('mail.google.com'), {
    subdomain: 'mail.',
    domain: 'google.com'
  })
  assert.deepEqual(splitHost('google.com'), {
    subdomain: '',
    domain: 'google.com'
  })
  assert.deepEqual(splitHost('exemplo.com.br'), {
    subdomain: '',
    domain: 'exemplo.com.br'
  })
  assert.deepEqual(splitHost('a.b.exemplo.com.br'), {
    subdomain: 'a.b.',
    domain: 'exemplo.com.br'
  })
  assert.deepEqual(splitHost('www.bbc.co.uk'), {
    subdomain: 'www.',
    domain: 'bbc.co.uk'
  })
  assert.deepEqual(splitHost('receita.fazenda.gov.br'), {
    subdomain: 'receita.',
    domain: 'fazenda.gov.br'
  })
  // o próprio sufixo
  assert.deepEqual(splitHost('com.br'), { subdomain: '', domain: 'com.br' })
})

test('domínio registrável: plataformas de hospedagem tratam cada subdomínio como dono', () => {
  assert.deepEqual(splitHost('evil.github.io'), {
    subdomain: '',
    domain: 'evil.github.io'
  })
  assert.deepEqual(splitHost('app.evil.vercel.app'), {
    subdomain: 'app.',
    domain: 'evil.vercel.app'
  })
})

test('domínio registrável: IP, IPv6 e nome de uma parte ficam inteiros', () => {
  assert.deepEqual(splitHost('127.0.0.1'), {
    subdomain: '',
    domain: '127.0.0.1'
  })
  assert.deepEqual(splitHost('[::1]'), { subdomain: '', domain: '[::1]' })
  assert.deepEqual(splitHost('localhost'), {
    subdomain: '',
    domain: 'localhost'
  })
  assert.deepEqual(splitHost('intranet'), { subdomain: '', domain: 'intranet' })
})

test('endereço: o domínio verdadeiro de um host enganoso está sempre separado', () => {
  const spoof = describeAddress(
    'https://contas.google.com.sessao-segura.exemplo.tk/login?next=/'
  )
  assert.equal(spoof.subdomain, 'contas.google.com.sessao-segura.')
  assert.equal(spoof.domain, 'exemplo.tk')
  assert.equal(spoof.path, '/login?next=/')
  assert.equal(spoof.insecure, false)
  assert.equal(spoof.kind, 'web')
})

test('endereço: porta junto do domínio, www some e a raiz não mostra caminho', () => {
  const local = describeAddress('http://127.0.0.1:9601/')
  assert.equal(local.domain, '127.0.0.1:9601')
  assert.equal(local.subdomain, '')
  assert.equal(local.path, '')
  const www = describeAddress('https://www.exemplo.com.br:8443/a/b')
  assert.equal(www.subdomain, '')
  assert.equal(www.domain, 'exemplo.com.br:8443')
  assert.equal(www.host, 'exemplo.com.br:8443')
})

test('endereço: IDN seguro aparece decodificado; o enganoso, em punycode', () => {
  const ok = describeAddress(`https://${asUrlHost('pão.com.br')}/receitas`)
  assert.equal(ok.domain, 'pão.com.br')
  const host = asUrlHost('аpple.com')
  const fake = describeAddress(`https://${host}/`)
  assert.equal(fake.domain, host)
})

test('endereço: http é "não seguro"; https, arquivo e about não', () => {
  assert.equal(describeAddress('http://exemplo.com/').insecure, true)
  assert.equal(isInsecureUrl('http://exemplo.com:8080/x'), true)
  assert.equal(isInsecureUrl('HTTP://EXEMPLO.COM'), true)
  assert.equal(isInsecureUrl('https://exemplo.com/'), false)
  assert.equal(isInsecureUrl('file:///tmp/a.html'), false)
  assert.equal(isInsecureUrl('about:blank'), false)
  assert.equal(isInsecureUrl(''), false)
  assert.equal(isInsecureUrl('não é url'), false)
  assert.equal(describeAddress('file:///tmp/a%20b.html').kind, 'file')
  assert.equal(
    describeAddress('file:///tmp/a%20b.html').domain,
    'arquivo local'
  )
  assert.equal(describeAddress('about:blank').kind, 'about')
  assert.equal(describeAddress('').kind, 'other')
})
