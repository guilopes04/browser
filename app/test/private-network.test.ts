import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getNetworkHost,
  isIpLiteral,
  isPrivateAddress,
  isPrivateHost,
  isPrivateHostname,
  normalizeHost,
  parseIPv6
} from '@shared/private-network'

test('IPv4: loopback, redes privadas, link-local, CGNAT e reservados são locais', () => {
  for (const address of [
    '127.0.0.1',
    '127.255.255.254',
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.18.222',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '198.18.0.1',
    '224.0.0.251',
    '255.255.255.255'
  ])
    assert.equal(isPrivateAddress(address), true, address)
})

test('IPv4: endereços públicos e as bordas das faixas privadas não são locais', () => {
  for (const address of [
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '192.169.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '11.0.0.1',
    '203.0.113.5',
    '223.255.255.255'
  ])
    assert.equal(isPrivateAddress(address), false, address)
})

test('IPv6: loopback, ULA, link-local, multicast e IPv4 embutido', () => {
  for (const address of [
    '::1',
    '::',
    '[::1]',
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'fe80::1%en0',
    'febf::1',
    'ff02::1',
    // IPv4 mapeado, na forma que o parser de URL entrega (grupos hexadecimais)
    '::ffff:7f00:1',
    '::ffff:127.0.0.1',
    '::ffff:c0a8:101',
    '64:ff9b::7f00:1',
    '2002:7f00:1::1'
  ])
    assert.equal(isPrivateAddress(address), true, address)
  for (const address of [
    '2001:4860:4860::8888',
    '2606:4700::6812:10cd',
    '::ffff:808:808',
    '2002:808:808::1'
  ])
    assert.equal(isPrivateAddress(address), false, address)
})

test('parseIPv6 expande :: e rejeita texto inválido', () => {
  assert.deepEqual(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 1])
  assert.deepEqual(parseIPv6('1:2:3:4:5:6:7:8'), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(
    parseIPv6('::ffff:1.2.3.4'),
    [0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]
  )
  assert.equal(parseIPv6('1::2::3'), null)
  assert.equal(parseIPv6('1:2:3'), null)
  assert.equal(parseIPv6('gggg::1'), null)
  assert.equal(parseIPv6('example.com'), null)
})

test('nomes de rede local: localhost, .local, domínios reservados e nomes de uma palavra', () => {
  for (const host of [
    'localhost',
    'LOCALHOST',
    'app.localhost',
    'impressora.local',
    'nas.home.arpa',
    'meu.dev.internal',
    'servidor.lan',
    'app.test',
    'roteador',
    'localhost.'
  ])
    assert.equal(isPrivateHostname(host), true, host)
  for (const host of [
    'example.com',
    'localhost.example.com',
    'local.example.org',
    'github.com',
    'a.b.co.uk',
    ''
  ])
    assert.equal(isPrivateHostname(host), false, host)
})

test('isPrivateHost junta endereço e nome', () => {
  assert.equal(isPrivateHost('192.168.1.1'), true)
  assert.equal(isPrivateHost('[::1]'), true)
  assert.equal(isPrivateHost('printer.local'), true)
  assert.equal(isPrivateHost('8.8.8.8'), false)
  assert.equal(isPrivateHost('example.com'), false)
})

test('isIpLiteral e normalizeHost', () => {
  assert.equal(isIpLiteral('1.2.3.4'), true)
  assert.equal(isIpLiteral('[::1]'), true)
  assert.equal(isIpLiteral('example.com'), false)
  assert.equal(isIpLiteral('1.2.3'), false)
  assert.equal(normalizeHost(' [::1] '), '::1')
  assert.equal(normalizeHost('Example.COM.'), 'example.com')
})

test('getNetworkHost lê o host de http, https, ws e wss; outro esquema é null', () => {
  assert.equal(getNetworkHost('http://127.0.0.1:8080/x'), '127.0.0.1')
  assert.equal(getNetworkHost('https://Example.com/'), 'example.com')
  assert.equal(getNetworkHost('ws://localhost:9229/'), 'localhost')
  assert.equal(getNetworkHost('wss://[::1]:3000/'), '::1')
  // o parser de URL entrega IPv4 em notação decimal, hexa ou octal já normalizado
  assert.equal(getNetworkHost('http://2130706433/'), '127.0.0.1')
  assert.equal(getNetworkHost('http://0x7f.1/'), '127.0.0.1')
  assert.equal(getNetworkHost('http://[::ffff:127.0.0.1]/'), '::ffff:7f00:1')
  assert.equal(getNetworkHost('data:text/plain,oi'), null)
  assert.equal(getNetworkHost('blob:https://a.com/x'), null)
  assert.equal(getNetworkHost('file:///etc/hosts'), null)
  assert.equal(getNetworkHost('não é url'), null)
  // as formas disfarçadas do loopback também são locais
  assert.equal(
    isPrivateHost(getNetworkHost('http://2130706433/') as string),
    true
  )
  assert.equal(
    isPrivateHost(getNetworkHost('http://[::ffff:127.0.0.1]/') as string),
    true
  )
})
