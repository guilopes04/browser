import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { app, dialog } from 'electron'
import { formatBytes } from '../src/shared/format-bytes'
import {
  DOWNLOAD_COOLDOWN_MS,
  MAX_DOWNLOADS_PER_TAB,
  decideDownload
} from '../src/main/functions/decide-download'
import { sanitizeFileName } from '../src/main/functions/pick-file-name'
import {
  quarantineFile,
  quarantineValue
} from '../src/main/functions/quarantine-file'
import { reserveDownloadPath } from '../src/main/functions/reserve-download-path'
import { markFrameGesture } from '../src/main/functions/frame-gesture'
import { markGesture } from '../src/main/functions/user-gesture'
import { watchDownloads } from '../src/main/services/downloads'
import { fakeContext } from './fake-main'

const base = {
  userInitiated: false,
  hasGesture: false,
  running: 0,
  prompt: undefined,
  now: 1000
}

test('download com gesto segue; sem gesto, o usuário decide', () => {
  assert.equal(decideDownload({ ...base, hasGesture: true }), 'allow')
  assert.equal(decideDownload({ ...base, userInitiated: true }), 'allow')
  assert.equal(decideDownload(base), 'ask')
})

test('um diálogo de consentimento por vez e intervalo depois de uma recusa', () => {
  assert.equal(
    decideDownload({ ...base, prompt: { pending: true, deniedUntil: 0 } }),
    'reject-busy'
  )
  const denied = { pending: false, deniedUntil: 1000 + DOWNLOAD_COOLDOWN_MS }
  assert.equal(decideDownload({ ...base, prompt: denied }), 'reject-cooldown')
  assert.equal(
    decideDownload({ ...base, prompt: denied, now: denied.deniedUntil }),
    'ask'
  )
  // com gesto, o intervalo não vale: o usuário acabou de agir
  assert.equal(
    decideDownload({ ...base, prompt: denied, hasGesture: true }),
    'allow'
  )
})

test('no máximo 20 downloads simultâneos por aba, até com gesto', () => {
  assert.equal(
    decideDownload({
      ...base,
      hasGesture: true,
      running: MAX_DOWNLOADS_PER_TAB - 1
    }),
    'allow'
  )
  assert.equal(
    decideDownload({
      ...base,
      hasGesture: true,
      running: MAX_DOWNLOADS_PER_TAB
    }),
    'reject-limit'
  )
  assert.equal(
    decideDownload({ ...base, userInitiated: true, running: 25 }),
    'reject-limit'
  )
})

test('tamanho em português, na base do Finder', () => {
  assert.equal(formatBytes(0), 'tamanho desconhecido')
  assert.equal(formatBytes(-1), 'tamanho desconhecido')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1500), '1,5 KB')
  assert.equal(formatBytes(2_000_000), '2 MB')
  assert.equal(formatBytes(25_400_000), '25 MB')
  assert.equal(formatBytes(3_210_000_000), '3,2 GB')
})

test('nome do servidor sem controles de direção de texto (disfarce de extensão)', () => {
  assert.equal(sanitizeFileName('relatorio‮fdp.exe'), 'relatoriofdp.exe')
  assert.equal(sanitizeFileName('a⁦b⁩.txt'), 'ab.txt')
  assert.equal(sanitizeFileName('‏x'), 'x')
})

test('reserva de nome: abertura exclusiva, "EEXIST" passa para o próximo nome', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gilas-dl-'))
  try {
    const first = reserveDownloadPath(dir, 'a.zip')
    const second = reserveDownloadPath(dir, 'a.zip')
    const third = reserveDownloadPath(dir, 'a.zip')
    assert.equal(first, join(dir, 'a.zip'))
    assert.equal(second, join(dir, 'a (1).zip'))
    assert.equal(third, join(dir, 'a (2).zip'))
    assert.deepEqual(readdirSync(dir).sort(), [
      'a (1).zip',
      'a (2).zip',
      'a.zip'
    ])
    // arquivo que já existia (de outro processo) também é pulado
    writeFileSync(join(dir, 'b.txt'), 'x')
    assert.equal(reserveDownloadPath(dir, 'b.txt'), join(dir, 'b (1).txt'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('reserva de nome: nome que outro processo cria no meio da corrida', () => {
  // o 'wx' falha com EEXIST depois de o nome parecer livre: a reserva anda para o próximo
  const opened: string[] = []
  const path = reserveDownloadPath('/tmp', 'x.bin', {
    open: (target, flags) => {
      assert.equal(flags, 'wx')
      opened.push(target)
      if (target === '/tmp/x.bin') {
        const error = new Error('exists') as NodeJS.ErrnoException
        error.code = 'EEXIST'
        throw error
      }
      return 7
    },
    close: () => {}
  })
  assert.equal(path, '/tmp/x (1).bin')
  assert.deepEqual(opened, ['/tmp/x.bin', '/tmp/x (1).bin'])
  // erro que não é de nome ocupado sobe (pasta sem permissão)
  assert.throws(
    () =>
      reserveDownloadPath('/tmp', 'y.bin', {
        open: () => {
          const error = new Error('denied') as NodeJS.ErrnoException
          error.code = 'EACCES'
          throw error
        },
        close: () => {}
      }),
    /denied/
  )
})

test('valor da quarentena: 0083, hora em hexadecimal, agente e ponto e vírgula final', () => {
  assert.equal(
    quarantineValue(1_792_000_000_123),
    `0083;${(1_792_000_000).toString(16)};Gilas Browser;`
  )
})

test('quarentena: grava com xattr -w e confere lendo de volta com -p', async () => {
  const calls: string[][] = []
  const value = quarantineValue(5000)
  const ok = await quarantineFile('/d/a.zip', 5000, async args => {
    calls.push(args)
    return args[0] === '-p' ? `${value}\n` : ''
  })
  assert.equal(ok, true)
  assert.deepEqual(calls, [
    ['-w', 'com.apple.quarantine', value, '/d/a.zip'],
    ['-p', 'com.apple.quarantine', '/d/a.zip']
  ])
  // o atributo lido não é o gravado: não está em quarentena
  assert.equal(
    await quarantineFile('/d/a.zip', 5000, async () => 'outro'),
    false
  )
  // xattr falhou
  assert.equal(
    await quarantineFile('/d/a.zip', 5000, async () => {
      throw new Error('sem permissão')
    }),
    false
  )
})

test(
  'quarentena de verdade: o xattr do sistema grava e confere',
  { skip: process.platform !== 'darwin' },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gilas-q-'))
    try {
      const file = join(dir, 'a.bin')
      writeFileSync(file, 'x')
      assert.equal(await quarantineFile(file), true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
)

// ---- o serviço, com sessão e item de mentira ----

class FakeItem extends EventEmitter {
  paused = false
  cancelled = false
  savePath = ''
  dialogOptions: unknown = null
  url: string
  filename: string
  bytes: number
  // a origem do quadro que iniciou (vazia quando não foi uma página)
  initiator = ''
  constructor(url: string, filename: string, bytes: number) {
    super()
    this.url = url
    this.filename = filename
    this.bytes = bytes
  }
  getURL = () => this.url
  getInitiatorOrigin = () => this.initiator
  getFilename = () => this.filename
  getTotalBytes = () => this.bytes
  getReceivedBytes = () => 0
  getSavePath = () => this.savePath
  setSavePath = (path: string) => void (this.savePath = path)
  setSaveDialogOptions = (options: unknown) =>
    void (this.dialogOptions = options)
  pause = () => void (this.paused = true)
  resume = () => void (this.paused = false)
  isPaused = () => this.paused
  cancel = () => {
    this.cancelled = true
    queueMicrotask(() => this.emit('done', {}, 'cancelled'))
  }
}

function setupDownloads() {
  const env = fakeContext(['https://site.test/'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const session = new EventEmitter()
  const dir = mkdtempSync(join(tmpdir(), 'gilas-svc-'))
  // a pasta temporária do app é outra: o que espera permissão nunca passa por Downloads
  const temp = mkdtempSync(join(tmpdir(), 'gilas-tmp-'))
  const stub = app as unknown as { getPath: (name: string) => string }
  stub.getPath = name => (name === 'temp' ? temp : dir)
  watchDownloads(env.ctx, session as never)
  const start = (item: FakeItem) => {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true
      }
    }
    session.emit('will-download', event, item, live.wc)
    return event
  }
  const finish = (item: FakeItem, state = 'completed') =>
    item.emit('done', {}, state)
  const tick = () => new Promise(done => setTimeout(done, 20))
  const clean = () => {
    rmSync(dir, { recursive: true, force: true })
    rmSync(temp, { recursive: true, force: true })
  }
  return { ...env, tab, wc: live.wc, dir, temp, start, finish, tick, clean }
}

function answerDialog(response: number) {
  const calls: { message: string; buttons: string[]; defaultId: number }[] = []
  const stub = dialog as unknown as {
    showMessageBox: (...args: unknown[]) => Promise<unknown>
  }
  stub.showMessageBox = async (...args: unknown[]) => {
    const options = args[args.length - 1] as (typeof calls)[number]
    calls.push(options)
    return { response, checkboxChecked: false }
  }
  return calls
}

test('com gesto: o download segue na hora, sem diálogo, com o nome reservado', async () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(0)
    markGesture(env.ctx.guard, env.tab.id)
    const item = new FakeItem('https://site.test/a.zip', 'a.zip', 1000)
    const event = env.start(item)
    assert.equal(event.prevented, false)
    assert.equal(item.paused, false)
    assert.equal(calls.length, 0)
    assert.equal(item.savePath, join(env.dir, 'a.zip'))
    assert.ok(existsSync(item.savePath))
    assert.equal(env.ctx.guard.downloadsRunning.get(env.tab.id), 1)
    assert.equal(env.store.state.downloads.active, 1)
  } finally {
    env.clean()
  }
})

test('sem gesto: pausa, pergunta com Cancelar como padrão e só segue se permitir', async () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(1)
    const item = new FakeItem(
      'https://site.test/x.zip',
      'relatorio.zip',
      2_500_000
    )
    const event = env.start(item)
    assert.equal(event.prevented, false)
    assert.equal(item.paused, true)
    await env.tick()
    assert.equal(calls.length, 1)
    assert.equal(
      calls[0].message,
      'site.test quer baixar relatorio.zip (2,5 MB). Permitir?'
    )
    assert.deepEqual(calls[0].buttons, ['Cancelar', 'Baixar'])
    // o botão padrão e o de Esc são o Cancelar
    assert.equal(calls[0].defaultId, 0)
    assert.equal((calls[0] as { cancelId?: number }).cancelId, 0)
    assert.equal(item.paused, false)
    assert.equal(item.cancelled, false)
  } finally {
    env.clean()
  }
})

test('sem gesto: nenhum byte vai para Downloads antes de o usuário permitir; permitido, o arquivo vai quando conclui', async () => {
  const env = setupDownloads()
  try {
    let release: (value: unknown) => void = () => {}
    ;(
      dialog as unknown as { showMessageBox: () => Promise<unknown> }
    ).showMessageBox = () =>
      new Promise(done => {
        release = done
      })
    const item = new FakeItem('https://site.test/x.bin', 'x.bin', 5)
    env.start(item)
    // o Chromium grava onde o app mandou: numa pasta temporária, fora de Downloads
    assert.ok(item.savePath.startsWith(env.temp), item.savePath)
    writeFileSync(item.savePath, 'ola!!')
    assert.deepEqual(readdirSync(env.dir), [])
    // o ícone de Downloads não conta o que espera permissão
    assert.equal(env.store.state.downloads.active, 0)
    // termina antes de o usuário responder: nada aparece em Downloads ainda
    env.finish(item)
    await env.tick()
    assert.deepEqual(readdirSync(env.dir), [])
    release({ response: 1, checkboxChecked: false })
    await new Promise(done => setTimeout(done, 400))
    assert.deepEqual(readdirSync(env.dir), ['x.bin'])
    assert.equal(env.store.state.downloads.lastPath, join(env.dir, 'x.bin'))
    // a pasta temporária foi embora
    assert.deepEqual(readdirSync(env.temp), [])
  } finally {
    env.clean()
  }
})

test('sem gesto e recusado: cancela, apaga o arquivo reservado e cala a aba por um tempo', async () => {
  const env = setupDownloads()
  try {
    answerDialog(0)
    const item = new FakeItem('https://site.test/x.zip', 'x.zip', 10)
    env.start(item)
    await env.tick()
    assert.equal(item.cancelled, true)
    await env.tick()
    assert.deepEqual(readdirSync(env.dir), [])
    assert.deepEqual(readdirSync(env.temp), [])
    assert.equal(env.ctx.guard.downloadsRunning.has(env.tab.id), false)
    assert.equal(env.store.state.downloads.lastFailed, false)

    // a página insiste: nem pergunta de novo, o download é recusado em silêncio
    const calls = answerDialog(1)
    const again = new FakeItem('https://site.test/y.zip', 'y.zip', 10)
    const event = env.start(again)
    assert.equal(event.prevented, true)
    assert.equal(calls.length, 0)
    assert.deepEqual(readdirSync(env.dir), [])
  } finally {
    env.clean()
  }
})

test('sem gesto, com o diálogo ainda aberto: o segundo download é recusado', async () => {
  const env = setupDownloads()
  try {
    const stub = dialog as unknown as {
      showMessageBox: () => Promise<unknown>
    }
    let release: (value: unknown) => void = () => {}
    stub.showMessageBox = () =>
      new Promise(done => {
        release = done
      })
    const first = new FakeItem('https://site.test/1.zip', '1.zip', 10)
    const second = new FakeItem('https://site.test/2.zip', '2.zip', 10)
    assert.equal(env.start(first).prevented, false)
    assert.equal(env.start(second).prevented, true)
    release({ response: 1, checkboxChecked: false })
    await env.tick()
    assert.equal(first.paused, false)
  } finally {
    env.clean()
  }
})

test('o 21º download simultâneo da aba é recusado', () => {
  const env = setupDownloads()
  try {
    answerDialog(0)
    markGesture(env.ctx.guard, env.tab.id)
    for (let n = 0; n < MAX_DOWNLOADS_PER_TAB; n++) {
      const item = new FakeItem(`https://site.test/${n}`, `f${n}.bin`, 10)
      assert.equal(env.start(item).prevented, false, `download ${n + 1}`)
    }
    const extra = new FakeItem('https://site.test/extra', 'extra.bin', 10)
    assert.equal(env.start(extra).prevented, true)
    assert.equal(readdirSync(env.dir).length, MAX_DOWNLOADS_PER_TAB)
  } finally {
    env.clean()
  }
})

test('downloads simultâneos do mesmo nome não se sobrescrevem', () => {
  const env = setupDownloads()
  try {
    markGesture(env.ctx.guard, env.tab.id)
    const items = [0, 1, 2].map(
      n => new FakeItem(`https://site.test/${n}`, 'dados.csv', 10)
    )
    for (const item of items) env.start(item)
    const paths = items.map(item => item.savePath)
    assert.equal(new Set(paths).size, 3)
    assert.deepEqual(paths, [
      join(env.dir, 'dados.csv'),
      join(env.dir, 'dados (1).csv'),
      join(env.dir, 'dados (2).csv')
    ])
  } finally {
    env.clean()
  }
})

test(
  'download concluído recebe a quarentena do macOS e vira o último arquivo',
  { skip: process.platform !== 'darwin' },
  async () => {
    const env = setupDownloads()
    try {
      markGesture(env.ctx.guard, env.tab.id)
      const item = new FakeItem('https://site.test/a.txt', 'a.txt', 5)
      env.start(item)
      // o Chromium escreve o conteúdo por cima do arquivo reservado
      writeFileSync(item.savePath, 'ola!!')
      env.finish(item)
      await new Promise(done => setTimeout(done, 400))
      const { downloads } = env.store.state
      assert.equal(downloads.lastPath, item.savePath)
      assert.equal(downloads.lastFailed, false)
      assert.equal(await quarantineFile(item.savePath), true)
    } finally {
      env.clean()
    }
  }
)

test('download que falha deixa o aviso de falha e não deixa o arquivo vazio', async () => {
  const env = setupDownloads()
  try {
    markGesture(env.ctx.guard, env.tab.id)
    const item = new FakeItem('https://site.test/a.bin', 'a.bin', 5)
    env.start(item)
    env.finish(item, 'interrupted')
    await env.tick()
    assert.equal(env.store.state.downloads.lastFailed, true)
    assert.deepEqual(readdirSync(env.dir), [])
  } finally {
    env.clean()
  }
})

test('"Salvar imagem como" (pedido do app) segue sem gesto e mostra o diálogo do sistema', () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(0)
    env.ctx.saveAs.add('https://site.test/foto.png')
    const item = new FakeItem('https://site.test/foto.png', 'foto.png', 10)
    const event = env.start(item)
    assert.equal(event.prevented, false)
    assert.equal(item.paused, false)
    assert.equal(calls.length, 0)
    assert.equal(item.savePath, '')
    assert.ok(item.dialogOptions)
    assert.equal(env.ctx.saveAs.has('https://site.test/foto.png'), false)
    assert.deepEqual(readdirSync(env.dir), [])
  } finally {
    env.clean()
  }
})

// ---- o gesto tem de ser de quem iniciou o download ----

function withAd(env: ReturnType<typeof setupDownloads>) {
  const page = {
    processId: 1,
    frameToken: 'page',
    origin: 'https://site.test',
    url: 'https://site.test/',
    parent: null
  }
  const ad = {
    processId: 2,
    frameToken: 'ad',
    origin: 'https://ads.test',
    url: 'https://ads.test/banner',
    parent: page
  }
  Object.assign(env.wc, { mainFrame: { framesInSubtree: [page, ad] } })
  const clickIn = (frame: {
    processId: number
    frameToken: string
    origin: string
  }) =>
    markFrameGesture(env.ctx.guard, env.tab.id, {
      key: `${frame.processId}:${frame.frameToken}`,
      origin: frame.origin
    })
  return { page, ad, clickIn }
}

test('clique na página: o download do iframe de outra origem pergunta; o da página baixa', async () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(0)
    const { page, clickIn } = withAd(env)
    clickIn(page)

    // o anúncio baixa sozinho depois do clique do usuário na página
    const fromAd = new FakeItem('https://ads.test/ad.bin', 'ad.bin', 1000)
    fromAd.initiator = 'https://ads.test'
    assert.equal(env.start(fromAd).prevented, false)
    assert.equal(fromAd.paused, true, 'pausado até o usuário permitir')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].defaultId, 0, 'Cancelar é o padrão')
    await env.tick()
    assert.equal(fromAd.cancelled, true)
    assert.equal(existsSync(join(env.dir, 'ad.bin')), false)

    // a página, com o mesmo clique, baixa na hora
    const fromPage = new FakeItem('https://site.test/a.zip', 'a.zip', 1000)
    fromPage.initiator = 'https://site.test'
    env.start(fromPage)
    assert.equal(fromPage.paused, false)
    assert.equal(fromPage.savePath, join(env.dir, 'a.zip'))
    assert.equal(calls.length, 1)
  } finally {
    env.clean()
  }
})

test('clique dentro do anúncio: o download dele segue na hora', () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(0)
    const { ad, clickIn } = withAd(env)
    clickIn(ad)
    const item = new FakeItem('https://ads.test/oferta.pdf', 'oferta.pdf', 1000)
    item.initiator = 'https://ads.test'
    env.start(item)
    assert.equal(item.paused, false)
    assert.equal(calls.length, 0)
  } finally {
    env.clean()
  }
})

test('download que o app pediu ("Salvar imagem como") não depende de quadro', () => {
  const env = setupDownloads()
  try {
    const calls = answerDialog(0)
    const { page, clickIn } = withAd(env)
    clickIn(page)
    env.ctx.saveAs.add('https://ads.test/img.png')
    const item = new FakeItem('https://ads.test/img.png', 'img.png', 1000)
    item.initiator = 'https://ads.test'
    env.start(item)
    assert.equal(item.paused, false)
    assert.equal(calls.length, 0)
  } finally {
    env.clean()
  }
})
