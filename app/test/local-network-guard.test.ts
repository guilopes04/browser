import assert from 'node:assert/strict'
import { test } from 'node:test'
import { session, type Session } from 'electron'
import { getSpaceSession } from '../src/main/functions/get-space-session'
import { filterFaviconCandidates } from '../src/main/functions/filter-favicon-candidates'
import {
  createLocalNetworkGuard,
  isDirectProxy,
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
  let proxyFor = (): string => 'DIRECT'
  const registered: unknown[][] = []
  const responses: unknown[][] = []
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
    resolveProxy: async () => proxyFor(),
    webRequest: {
      onBeforeRequest: (...args: unknown[]) => void registered.push(args),
      onHeadersReceived: (...args: unknown[]) => void responses.push(args)
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
  assert.equal(responses.length, 1)
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

  // o IP real do documento chega pelo onResponseStarted: o Chromium conectou num IP público num
  // nome que a nossa consulta tinha dado como local, e a origem passa a ser pública
  const [responseFilter, headersListener] = responses[0] as [
    { urls: string[] },
    (
      details: Record<string, unknown>,
      callback: (response: object) => void
    ) => void
  ]
  // a resposta segue sempre sem alteração, com ou sem IP
  const answered: object[] = []
  const responseListener = (details: Record<string, unknown>) =>
    headersListener(details, response => answered.push(response))
  assert.deepEqual(responseFilter.urls, ['http://*/*', 'https://*/*'])
  await decide({
    url: 'http://rebind.example/',
    resourceType: 'mainFrame'
  })
  assert.equal(
    await decide({
      url: 'http://127.0.0.1:9229/json',
      initiatorOrigin: 'http://rebind.example'
    }),
    false,
    'o nome resolveu para o loopback: página local até o IP real dizer outra coisa'
  )
  responseListener({
    url: 'http://rebind.example/',
    resourceType: 'mainFrame',
    ip: '93.184.216.34'
  })
  assert.equal(
    await decide({
      url: 'http://127.0.0.1:9229/json',
      initiatorOrigin: 'http://rebind.example'
    }),
    true
  )
  responseListener({
    url: 'https://cdn.example.net/a.css',
    resourceType: 'stylesheet'
  })
  assert.deepEqual(answered, [{}, {}])

  // a resposta de um IP de rede local para um iniciador público é cancelada (conexão direta),
  // inclusive de um nome que a nossa consulta de DNS viu como público
  const reply = (details: Record<string, unknown>) =>
    new Promise<object>(resolve =>
      headersListener({ resourceType: 'xhr', ...details }, resolve)
    )
  const stolen = {
    url: 'https://cdn.example.net/admin',
    initiatorOrigin: 'https://evil.example',
    ip: '127.0.0.1'
  }
  assert.deepEqual(await reply(stolen), { cancel: true })
  assert.deepEqual(await reply({ ...stolen, ip: '::1' }), { cancel: true })
  assert.deepEqual(await reply({ ...stolen, resourceType: 'subFrame' }), {
    cancel: true
  })
  // IP público, resposta do cache, pedido do próprio navegador, página da rede local: segue
  assert.deepEqual(await reply({ ...stolen, ip: '151.101.1.1' }), {})
  assert.deepEqual(await reply({ ...stolen, ip: undefined }), {})
  assert.deepEqual(await reply({ ...stolen, initiatorOrigin: undefined }), {})
  assert.deepEqual(
    await reply({ ...stolen, initiatorOrigin: 'http://localhost:3000' }),
    {}
  )
  // atrás de um proxy o IP é o do proxy: não vale como prova
  proxyFor = () => 'PROXY 10.0.0.1:3128; DIRECT'
  assert.deepEqual(await reply(stolen), {})
  proxyFor = () => {
    throw new Error('sem resposta do resolvedor de proxy')
  }
  assert.deepEqual(await reply(stolen), {})
})

test('rebinding com iframe da própria origem: o atacante não vira "página da rede local"', async () => {
  // o PoC da revisão, passo a passo
  let address = '93.184.216.34'
  let now = 1_000
  const guard = createLocalNetworkGuard(
    async host => {
      if (host === 'evil.example') return [address]
      throw new Error('NXDOMAIN')
    },
    () => now
  )
  const xhr = (url: string) => request(url, { resourceType: 'xhr' })
  // 1. o documento carrega de IP público
  assert.equal(
    await guard.shouldBlock({
      url: 'https://evil.example/',
      resourceType: 'mainFrame'
    }),
    false
  )
  // 2. a DNS vira para o loopback: o fetch ao próprio nome é cancelado
  address = '127.0.0.1'
  now += 10_000
  assert.equal(await guard.shouldBlock(xhr('https://evil.example/admin')), true)
  // 3. a página cria um iframe da própria origem: cancelado também (o destino é local)
  assert.equal(
    await guard.shouldBlock(
      request('https://evil.example/admin', { resourceType: 'subFrame' })
    ),
    true
  )
  // 4 e 5. e nada mudou: nem o nome, nem o literal do loopback, nem um navegador novo no iframe
  now += 10_000
  assert.equal(await guard.shouldBlock(xhr('https://evil.example/admin')), true)
  assert.equal(await guard.shouldBlock(xhr('http://127.0.0.1:9229/json')), true)
  assert.equal(
    await guard.shouldBlock(
      request('https://evil.example/', { resourceType: 'subFrame' })
    ),
    true
  )
})

test('o iframe da própria origem que carrega de IP público segue a zona pública', async () => {
  const guard = createLocalNetworkGuard(
    dns({ 'evil.example': ['93.184.216.34'] }).resolve
  )
  await guard.shouldBlock({
    url: 'https://evil.example/',
    resourceType: 'mainFrame'
  })
  assert.equal(
    await guard.shouldBlock(
      request('https://evil.example/ads', { resourceType: 'subFrame' })
    ),
    false
  )
  assert.equal(
    await guard.shouldBlock(request('http://127.0.0.1:9229/json')),
    true
  )
})

test('origem pública não volta a ser privada, nem navegando de novo ou com a DNS de volta', async () => {
  let address = '93.184.216.34'
  let now = 0
  const guard = createLocalNetworkGuard(
    async () => [address],
    () => now
  )
  const load = () =>
    guard.shouldBlock({
      url: 'https://evil.example/',
      resourceType: 'mainFrame'
    })
  await load()
  address = '10.0.0.9'
  now += 10_000
  // outro documento da origem (aba nova, endereço digitado) com a DNS já local
  assert.equal(await load(), false)
  assert.equal(
    await guard.shouldBlock(
      request('http://192.168.0.1/', {
        initiatorOrigin: 'https://evil.example'
      })
    ),
    true
  )
})

test('origem sem registro conta como pública: lotar a lista não devolve a zona privada', async () => {
  let address = '93.184.216.34'
  let now = 0
  const guard = createLocalNetworkGuard(
    async host => (host === 'evil.example' ? [address] : ['151.101.1.1']),
    () => now
  )
  await guard.shouldBlock({
    url: 'https://evil.example/',
    resourceType: 'mainFrame'
  })
  // a página carrega 600 origens para empurrar a dela para fora da lista (limite de 500)
  for (let i = 0; i < 600; i++)
    await guard.shouldBlock(
      request(`https://s${i}.example/`, { resourceType: 'subFrame' })
    )
  address = '127.0.0.1'
  now += 10_000
  assert.equal(
    await guard.shouldBlock(request('https://evil.example/admin')),
    true
  )
  assert.equal(
    await guard.shouldBlock(
      request('https://evil.example/', { resourceType: 'subFrame' })
    ),
    true
  )
  assert.equal(await guard.shouldBlock(request('http://127.0.0.1:9229/')), true)
})

test('o intranet que está sendo usado fica na lista; nomes locais valem sem registro', async () => {
  const guard = createLocalNetworkGuard(async host =>
    host === 'jira.corp.example' ? ['10.0.1.5'] : ['151.101.1.1']
  )
  await guard.shouldBlock({
    url: 'https://jira.corp.example/',
    resourceType: 'mainFrame'
  })
  const fromJira = request('http://10.0.1.9/', {
    initiatorOrigin: 'https://jira.corp.example'
  })
  for (let i = 0; i < 600; i++) {
    await guard.shouldBlock(
      request(`https://s${i}.example/`, { resourceType: 'subFrame' })
    )
    // o pedido da própria página mantém a zona dela viva
    if (i % 100 === 0) assert.equal(await guard.shouldBlock(fromJira), false)
  }
  assert.equal(await guard.shouldBlock(fromJira), false)
  // localhost e IP privado nunca precisam de registro
  assert.equal(
    await guard.shouldBlock(
      request('http://192.168.0.1/', {
        initiatorOrigin: 'http://localhost:3000'
      })
    ),
    false
  )
})

test('o IP que respondeu de verdade rebaixa a origem a pública, nunca a promove', async () => {
  // a nossa consulta pegou o loopback e o Chromium conectou no IP do atacante (TTL 0)
  const guard = createLocalNetworkGuard(async () => ['127.0.0.1'])
  await guard.shouldBlock({
    url: 'https://evil.example/',
    resourceType: 'mainFrame'
  })
  const toLocal = request('http://127.0.0.1:9229/json')
  assert.equal(await guard.shouldBlock(toLocal), false, 'antes do IP real')
  guard.observeResponse({
    url: 'https://evil.example/',
    resourceType: 'mainFrame',
    ip: '93.184.216.34'
  })
  assert.equal(await guard.shouldBlock(toLocal), true)

  // IP privado (proxy local, corporativo): não promove uma origem pública
  const viaProxy = createLocalNetworkGuard(async () => ['93.184.216.34'])
  await viaProxy.shouldBlock({
    url: 'https://site.example/',
    resourceType: 'mainFrame'
  })
  viaProxy.observeResponse({
    url: 'https://site.example/',
    resourceType: 'mainFrame',
    ip: '127.0.0.1'
  })
  assert.equal(
    await viaProxy.shouldBlock(
      request('http://127.0.0.1:9229/json', {
        initiatorOrigin: 'https://site.example'
      })
    ),
    true
  )

  // sem IP (resposta do cache), subrecurso, localhost e literais: nada muda
  const quiet = createLocalNetworkGuard(async () => ['10.0.1.5'])
  await quiet.shouldBlock({
    url: 'https://jira.corp.example/',
    resourceType: 'mainFrame'
  })
  for (const response of [
    { url: 'https://jira.corp.example/', resourceType: 'mainFrame' },
    {
      url: 'https://jira.corp.example/a.js',
      resourceType: 'script',
      ip: '93.184.216.34'
    },
    {
      url: 'http://localhost:3000/',
      resourceType: 'mainFrame',
      ip: '93.184.216.34'
    }
  ])
    quiet.observeResponse(response)
  assert.equal(
    await quiet.shouldBlock(
      request('http://10.0.1.9/', {
        initiatorOrigin: 'https://jira.corp.example'
      })
    ),
    false
  )
  assert.equal(
    await quiet.shouldBlock(
      request('http://10.0.1.9/', { initiatorOrigin: 'http://localhost:3000' })
    ),
    false
  )
})

test('nome que não resolve não grava zona: a VPN que conecta depois dá a zona da intranet', async () => {
  let vpn = false
  let now = 0
  const guard = createLocalNetworkGuard(
    async () => {
      if (!vpn) throw new Error('NXDOMAIN')
      return ['10.0.1.5']
    },
    () => now
  )
  const load = () =>
    guard.shouldBlock({
      url: 'https://jira.corp.example/',
      resourceType: 'mainFrame'
    })
  const fromJira = request('http://10.0.1.9/', {
    initiatorOrigin: 'https://jira.corp.example'
  })
  // sem VPN o nome não resolve: nada fica gravado e a página, se existisse, seria pública
  await load()
  assert.equal(await guard.shouldBlock(fromJira), true)
  // a VPN conecta e a página recarrega: agora é da intranet
  vpn = true
  now += 10_000
  await load()
  assert.equal(await guard.shouldBlock(fromJira), false)
})

test('rebinding com respostas diferentes: o IP da conexão corta o que a consulta de DNS deixou passar', async () => {
  // um servidor de DNS (TTL 0) que responde um endereço público à nossa consulta e o loopback à
  // da conexão: o pedido passa por shouldBlock, e a resposta chega do 127.0.0.1
  const answers = ['93.184.216.34', '127.0.0.1']
  let asked = 0
  const guard = createLocalNetworkGuard(async host => {
    if (host !== 'evil.example') throw new Error('NXDOMAIN')
    return [answers[Math.min(asked++, answers.length - 1)]]
  })
  await guard.shouldBlock({
    url: 'https://evil.example/',
    resourceType: 'mainFrame'
  })
  const fetchAdmin = request('https://evil.example/admin')
  asked = 0
  assert.equal(
    await guard.shouldBlock(fetchAdmin),
    false,
    'a consulta viu o IP público'
  )
  assert.equal(
    guard.shouldBlockResponse({ ...fetchAdmin, ip: '127.0.0.1' }),
    true,
    'a conexão foi para o loopback'
  )
})

test('shouldBlockResponse só corta iniciador público com resposta de IP de rede local', () => {
  const guard = createLocalNetworkGuard(async () => [])
  const response = (extra: object) => ({
    url: 'https://cdn.example.net/a',
    resourceType: 'xhr',
    initiatorOrigin: PUBLIC_PAGE,
    ip: '127.0.0.1',
    ...extra
  })
  for (const ip of [
    '127.0.0.1',
    '::1',
    '[::1]',
    '10.0.0.5',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::ffff:127.0.0.1',
    'fd00::1',
    '0.0.0.0'
  ])
    assert.equal(guard.shouldBlockResponse(response({ ip })), true, ip)
  for (const ip of ['93.184.216.34', '151.101.1.1', '2606:4700::1111'])
    assert.equal(guard.shouldBlockResponse(response({ ip })), false, ip)
  assert.equal(guard.shouldBlockResponse(response({ ip: undefined })), false)
  assert.equal(
    guard.shouldBlockResponse(response({ initiatorOrigin: undefined })),
    false
  )
  // página da rede local e origem opaca sem página de topo (não dá para saber): segue
  assert.equal(
    guard.shouldBlockResponse(
      response({ initiatorOrigin: 'http://localhost:3000' })
    ),
    false
  )
  assert.equal(
    guard.shouldBlockResponse(response({ initiatorOrigin: 'null' })),
    false
  )
  assert.equal(
    guard.shouldBlockResponse(
      response({ initiatorOrigin: 'null', topUrl: 'https://evil.example/p' })
    ),
    true
  )
  // esquema que não é de rede
  assert.equal(
    guard.shouldBlockResponse(response({ url: 'data:text/html,oi' })),
    false
  )
})

test('isDirectProxy: só "DIRECT" sozinho prova que não há proxy', () => {
  assert.equal(isDirectProxy('DIRECT'), true)
  assert.equal(isDirectProxy(' direct '), true)
  for (const value of ['', 'PROXY a:1', 'PROXY a:1; DIRECT', 'SOCKS5 a:1'])
    assert.equal(isDirectProxy(value), false, value)
})
