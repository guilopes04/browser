import assert from 'node:assert/strict'
import { test } from 'node:test'
import { session, type Session } from 'electron'
import { getSpaceSession } from '../src/main/functions/get-space-session'
import { filterFaviconCandidates } from '../src/main/functions/filter-favicon-candidates'
import {
  createLocalNetworkGuard,
  type GuardRequest
} from '../src/main/functions/local-network-guard'

// DNS de mentira: nome -> endereços
function dns(table: Record<string, string[]>) {
  const asked: string[] = []
  const resolve = async (host: string) => {
    asked.push(host)
    const addresses = table[host]
    if (!addresses) throw new Error('NXDOMAIN')
    return addresses
  }
  return { resolve, asked, table }
}

const PUBLIC_PAGE = 'https://evil.example'

function request(url: string, extra: Partial<GuardRequest> = {}): GuardRequest {
  return { url, resourceType: 'xhr', initiatorOrigin: PUBLIC_PAGE, ...extra }
}

test('página pública não alcança loopback, rede privada, .local nem nomes de uma palavra', async () => {
  const { resolve } = dns({ 'evil.example': ['93.184.216.34'] })
  const guard = createLocalNetworkGuard(resolve)
  for (const url of [
    'http://127.0.0.1:9229/json',
    'http://localhost:3000/api',
    'http://192.168.0.1/admin',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:8080/',
    'http://[fd00::1]/',
    'http://impressora.local/',
    'http://roteador/',
    'http://2130706433/',
    'ws://localhost:9222/devtools/browser',
    'http://[::ffff:127.0.0.1]/'
  ])
    assert.equal(await guard.shouldBlock(request(url)), true, url)
})

test('página pública alcança a internet pública (e esquemas que não são de rede)', async () => {
  const { resolve } = dns({
    'evil.example': ['93.184.216.34'],
    'cdn.example.net': ['151.101.1.1']
  })
  const guard = createLocalNetworkGuard(resolve)
  assert.equal(
    await guard.shouldBlock(request('https://cdn.example.net/a.js')),
    false
  )
  assert.equal(
    await guard.shouldBlock(request('https://evil.example/api')),
    false
  )
  assert.equal(await guard.shouldBlock(request('http://8.8.8.8/')), false)
  assert.equal(await guard.shouldBlock(request('data:text/plain,oi')), false)
  assert.equal(
    await guard.shouldBlock(request('blob:https://evil.example/x')),
    false
  )
})

test('sem iniciador (endereço digitado, sessão restaurada) a rede local abre', async () => {
  const guard = createLocalNetworkGuard(dns({}).resolve)
  assert.equal(
    await guard.shouldBlock({
      url: 'http://localhost:3000/',
      resourceType: 'mainFrame'
    }),
    false
  )
  assert.equal(
    await guard.shouldBlock({
      url: 'http://192.168.0.1/',
      resourceType: 'mainFrame'
    }),
    false
  )
})

test('link, iframe e redirecionamento de página pública para a rede local também são cancelados', async () => {
  const guard = createLocalNetworkGuard(
    dns({ 'evil.example': ['93.184.216.34'] }).resolve
  )
  assert.equal(
    await guard.shouldBlock(
      request('http://192.168.0.1/reboot', { resourceType: 'mainFrame' })
    ),
    true
  )
  assert.equal(
    await guard.shouldBlock(
      request('http://localhost:8080/', { resourceType: 'subFrame' })
    ),
    true
  )
})

test('página da própria rede local fala com a rede local', async () => {
  const { resolve } = dns({})
  const guard = createLocalNetworkGuard(resolve)
  for (const initiatorOrigin of [
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://192.168.0.10',
    'http://painel.local',
    'http://[::1]:3000'
  ]) {
    assert.equal(
      await guard.shouldBlock(
        request('http://localhost:8080/api', { initiatorOrigin })
      ),
      false,
      initiatorOrigin
    )
    assert.equal(
      await guard.shouldBlock(
        request('http://192.168.0.1/', { initiatorOrigin })
      ),
      false,
      initiatorOrigin
    )
  }
})

test('nome público que a DNS aponta para a rede local é cancelado (rebinding simples)', async () => {
  const { resolve, asked } = dns({
    'evil.example': ['93.184.216.34'],
    'rebind.example': ['127.0.0.1'],
    'misto.example': ['93.184.216.34', '10.0.0.7'],
    'v6.example': ['::1']
  })
  const guard = createLocalNetworkGuard(resolve)
  assert.equal(
    await guard.shouldBlock(request('http://rebind.example:8080/')),
    true
  )
  assert.equal(await guard.shouldBlock(request('http://misto.example/')), true)
  assert.equal(await guard.shouldBlock(request('http://v6.example/')), true)
  assert.ok(asked.includes('rebind.example'), 'o nome foi resolvido antes')
  // nome que não resolve: o pedido segue e falha sozinho
  assert.equal(
    await guard.shouldBlock(request('http://nao-existe.example/')),
    false
  )
})

test('rebinding: a página carregada de IP público não vira local quando a DNS vira', async () => {
  let address = '93.184.216.34'
  let now = 1_000
  const guard = createLocalNetworkGuard(
    async host => {
      if (host === 'evil.example') return [address]
      throw new Error('NXDOMAIN')
    },
    () => now
  )
  // o documento carrega (zona gravada: pública)
  assert.equal(
    await guard.shouldBlock({
      url: 'https://evil.example/',
      resourceType: 'mainFrame'
    }),
    false
  )
  // a DNS passa a apontar para o loopback; a página pede ao próprio nome
  address = '127.0.0.1'
  now += 10_000
  assert.equal(
    await guard.shouldBlock(request('https://evil.example/admin')),
    true
  )
})

test('intranet: nome que resolve para IP privado é página da rede local', async () => {
  const { resolve } = dns({
    'jira.corp.example': ['10.0.1.5'],
    'api.corp.example': ['10.0.1.6']
  })
  const guard = createLocalNetworkGuard(resolve)
  // o documento carrega do 10.0.1.5: zona privada
  await guard.shouldBlock({
    url: 'https://jira.corp.example/',
    resourceType: 'mainFrame'
  })
  assert.equal(
    await guard.shouldBlock(
      request('https://api.corp.example/rest', {
        initiatorOrigin: 'https://jira.corp.example'
      })
    ),
    false
  )
  assert.equal(
    await guard.shouldBlock(
      request('http://10.0.1.9/', {
        initiatorOrigin: 'https://jira.corp.example'
      })
    ),
    false
  )
})

test('origem opaca (iframe com sandbox) vale pela página de topo da aba', async () => {
  const guard = createLocalNetworkGuard(
    dns({ 'evil.example': ['93.184.216.34'] }).resolve
  )
  assert.equal(
    await guard.shouldBlock(
      request('http://localhost:9000/', {
        initiatorOrigin: 'null',
        topUrl: 'https://evil.example/page'
      })
    ),
    true
  )
  assert.equal(
    await guard.shouldBlock(
      request('http://localhost:9000/', {
        initiatorOrigin: 'null',
        topUrl: 'http://localhost:3000/dev'
      })
    ),
    false
  )
  // sem como saber quem pediu, o pedido segue
  assert.equal(
    await guard.shouldBlock(
      request('http://localhost:9000/', { initiatorOrigin: 'null' })
    ),
    false
  )
})

test('o resultado da DNS é reaproveitado por 2 s e depois consultado de novo', async () => {
  const { resolve, asked } = dns({
    'evil.example': ['93.184.216.34'],
    'cdn.example.net': ['151.101.1.1']
  })
  let now = 0
  const guard = createLocalNetworkGuard(resolve, () => now)
  await guard.shouldBlock(request('https://cdn.example.net/a'))
  await guard.shouldBlock(request('https://cdn.example.net/b'))
  assert.equal(asked.filter(host => host === 'cdn.example.net').length, 1)
  now += 2500
  await guard.shouldBlock(request('https://cdn.example.net/c'))
  assert.equal(asked.filter(host => host === 'cdn.example.net').length, 2)
})

test('favicon: página pública não aponta o ícone para a rede local', () => {
  const candidates = [
    'https://example.com/favicon.ico',
    'http://127.0.0.1:8080/i.png',
    'http://192.168.0.1/favicon.ico',
    'http://impressora.local/f.ico',
    'data:image/png;base64,AAAA'
  ]
  assert.deepEqual(
    filterFaviconCandidates('https://example.com/', candidates),
    ['https://example.com/favicon.ico', 'data:image/png;base64,AAAA']
  )
  // página da rede local: o ícone pode estar onde quiser
  assert.deepEqual(
    filterFaviconCandidates('http://localhost:3000/', candidates),
    candidates
  )
})

test('toda sessão de espaço instala a guarda de rede local no webRequest', async () => {
  const registered: unknown[][] = []
  const ses = {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1 Safari/1',
    setUserAgent() {},
    setPermissionRequestHandler() {},
    setPermissionCheckHandler() {},
    setDevicePermissionHandler() {},
    setBluetoothPairingHandler() {},
    resolveHost: async (host: string) => ({
      endpoints: host === 'rebind.example' ? [{ address: '127.0.0.1' }] : []
    }),
    webRequest: {
      onBeforeRequest: (...args: unknown[]) => void registered.push(args)
    },
    on() {}
  }
  const original = session.fromPartition
  ;(session as any).fromPartition = () => ses as unknown as Session
  try {
    getSpaceSession('espaco-teste-guarda')
  } finally {
    ;(session as any).fromPartition = original
  }
  assert.equal(registered.length, 1)
  const [filter, listener] = registered[0] as [
    { urls: string[] },
    (details: unknown, callback: (r: { cancel: boolean }) => void) => void
  ]
  assert.deepEqual(filter.urls, [
    'http://*/*',
    'https://*/*',
    'ws://*/*',
    'wss://*/*'
  ])
  const decide = (details: Record<string, unknown>) =>
    new Promise<boolean>(resolve =>
      listener(
        { resourceType: 'xhr', ...details },
        (response: { cancel: boolean }) => resolve(response.cancel)
      )
    )
  assert.equal(
    await decide({
      url: 'http://127.0.0.1:9229/json',
      initiatorOrigin: 'https://evil.example'
    }),
    true
  )
  // nome público que a DNS do Chromium aponta para o loopback
  assert.equal(
    await decide({
      url: 'http://rebind.example/x',
      initiatorOrigin: 'https://evil.example'
    }),
    true
  )
  assert.equal(
    await decide({
      url: 'https://cdn.example.net/a.js',
      initiatorOrigin: 'https://evil.example'
    }),
    false
  )
  // pedido do próprio navegador (sem iniciador)
  assert.equal(await decide({ url: 'http://127.0.0.1:3000/' }), false)
})
