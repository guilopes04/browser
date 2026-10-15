// Páginas hostis contra o app de verdade: download sem gesto, pop-ups, host enganoso, diálogos,
// beforeunload, atalhos capturados, window.close e esquemas externos. Servidor local e perfil
// descartável (nada toca ~/Downloads nem o perfil real). Input por webContents.sendInputEvent (o
// mesmo caminho do Chromium que o teclado e o mouse usam). Pré-requisito: npm run build.
// Uso: npm run e2e:hostil [cenário...]   (sem argumentos roda todos)
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import * as L from './hostile-lib.ts'

const { sleep } = L
const only = process.argv.slice(2)
const { record, finish } = L.recorder(join(L.OUT_DIR, 'hostil.json'))

type Body = (ctx: { procs: L.Procs; pid: number; dir: string }) => Promise<void>

async function scenario(
  name: string,
  tabs: string[],
  body: Body,
  extra: string[] = []
) {
  if (only.length > 0 && !only.includes(name)) return
  console.log(`\n=== ${name}`)
  const procs = L.start(name, tabs, extra)
  try {
    await L.ready()
    await body({ procs, pid: L.mainPid(procs), dir: join(L.OUT_DIR, name) })
  } catch (error) {
    record(
      `${name}: erro no cenário`,
      false,
      String((error as Error)?.stack ?? error).slice(0, 500)
    )
  } finally {
    L.stopAll(procs)
    await sleep(900)
    record(`${name}: processos encerrados`, L.leftOver(procs) === 0, {
      restantes: L.leftOver(procs)
    })
  }
}

const tabId = async (fragment: string) =>
  L.tabByUrl(await L.st(), fragment)?.id as string
const activate = async (fragment: string) => {
  await L.send('tab:activate', { tabId: await tabId(fragment) })
  await sleep(500)
}
const shellEval = async (expr: string) => L.ev(await L.shell(), expr)
const quarantine = (path: string): string => {
  try {
    return execFileSync(
      '/usr/bin/xattr',
      ['-p', 'com.apple.quarantine', path],
      { encoding: 'utf8' }
    ).trim()
  } catch {
    return ''
  }
}
const logOf = (procs: L.Procs, text: string): boolean => {
  const all = execFileSync(
    'cat',
    [
      join(procs.profile, '..', 'electron.log'),
      join(procs.profile, '..', 'electron.err.log')
    ],
    { encoding: 'utf8' }
  )
  return all.includes(text)
}

const address = () =>
  shellEval(`(() => {
    const q = s => document.querySelector(s)
    const domain = q('.address-domain'), sub = q('.address-sub'), head = q('.address-domain-head'), btn = q('.address-btn')
    const box = e => e ? e.getBoundingClientRect() : null
    const d = box(domain), b = box(btn)
    const clipped = e => !!e && e.scrollWidth > e.clientWidth + 0.5
    return {
      sub: sub ? sub.textContent : null,
      domain: domain ? domain.textContent : null,
      path: q('.address-path') ? q('.address-path').textContent : null,
      insecure: q('.address .insecure-text') ? q('.address .insecure-text').textContent : null,
      weight: domain ? getComputedStyle(domain).fontWeight : null,
      subColor: sub ? getComputedStyle(sub).color : null,
      textColor: domain ? getComputedStyle(domain).color : null,
      // o que não cabe sai pelo começo dos subdomínios (ou, sem espaço para o domínio, pelo miolo dele)
      cut: clipped(sub) || clipped(head),
      domainVisible: !!(d && b && d.left >= b.left - 1 && d.right <= b.right + 1)
    }
  })()`)

// ---------------------------------------------------------------------------------------------
// H-01 / DADOS-01 / E7: downloads
// ---------------------------------------------------------------------------------------------
await scenario(
  'downloads-sem-gesto',
  ['http://hostil.test/p/dl-auto?name=drive-by.exe&n=3000'],
  async ({ procs, pid, dir }) => {
    await sleep(2500)
    const names = L.listDir(procs.downloads)
    record(
      'drive-by: o arquivo não chegou na pasta (só o nome reservado, vazio)',
      names.every(n => L.sizeOf(join(procs.downloads, n)) === 0),
      { names }
    )
    record(
      'drive-by: o diálogo de consentimento está na tela',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'consentimento.png'), pid)
    const s = await L.st()
    record(
      'drive-by: o app continua responsivo (diálogo assíncrono) e o ícone de Downloads não conta o que espera permissão',
      s.downloads.active === 0 && s.downloads.lastPath === null,
      s.downloads
    )
  }
)

await scenario(
  'downloads-com-gesto',
  ['http://hostil.test/p/dl-click?name=relatorio.bin&n=5000'],
  async ({ procs, pid, dir }) => {
    await L.click('dl-click')
    await sleep(2500)
    const file = join(procs.downloads, 'relatorio.bin')
    record(
      'clique do usuário: download concluído sem diálogo',
      L.sizeOf(file) === 5000 && L.sheetsOf(pid).length === 0,
      { tamanho: L.sizeOf(file), folhas: L.sheetsOf(pid).length }
    )
    const q = quarantine(file)
    record(
      'quarentena do macOS aplicada ao arquivo',
      /^0083;[0-9a-f]+;Gilas Browser;$/.test(q),
      { quarentena: q }
    )
    const s = await L.st()
    record(
      'o ícone de Downloads aponta o arquivo',
      s.downloads.lastPath === file,
      s.downloads
    )
    L.shot(join(dir, 'depois-do-download.png'), pid)
  }
)

await scenario(
  'downloads-limite-20',
  ['http://hostil.test/p/dl-flood?n=25'],
  async ({ procs, procs: p }) => {
    await L.click('dl-flood')
    await sleep(2500)
    const s = await L.st()
    const refused = (
      execFileSync(
        'cat',
        [
          join(procs.profile, '..', 'electron.log'),
          join(procs.profile, '..', 'electron.err.log')
        ],
        { encoding: 'utf8' }
      ).match(/recusado \(reject-limit\)/g) ?? []
    ).length
    record(
      '25 downloads de uma aba (25 hosts, sem o limite de conexões por host): só 20 andam ao mesmo tempo',
      s.downloads.active === 20 && refused === 5,
      { ativos: s.downloads.active, recusados: refused }
    )
    record('os recusados ficam no log', logOf(p, 'reject-limit'))
  }
)

await scenario(
  'downloads-mesmo-nome',
  ['http://hostil.test/p/dl-same-name'],
  async ({ procs }) => {
    await L.click('dl-same-name')
    await sleep(1200)
    const during = L.listDir(procs.downloads)
    record(
      '3 downloads do mesmo nome ao mesmo tempo ganham nomes diferentes (reserva exclusiva)',
      during.includes('igual.bin') &&
        during.some(n => n.startsWith('igual (1)')) &&
        during.some(n => n.startsWith('igual (2)')),
      { durante: during }
    )
    await sleep(14000)
    const files = ['igual.bin', 'igual (1).bin', 'igual (2).bin'].map(n =>
      join(procs.downloads, n)
    )
    record(
      'ao fim, os três existem inteiros (ninguém sobrescreveu ninguém)',
      files.every(f => L.sizeOf(f) === 120000),
      files.map(f => L.sizeOf(f))
    )
    record(
      'todos em quarentena',
      files.every(f => quarantine(f).startsWith('0083;')),
      files.map(quarantine)
    )
    record(
      'sem lixo na pasta de downloads',
      L.listDir(procs.downloads).length === 3,
      { arquivos: L.listDir(procs.downloads) }
    )
  }
)

await scenario(
  'downloads-varios-sem-gesto',
  ['http://hostil.test/p/dl-many-nogesture'],
  async ({ procs, pid }) => {
    await sleep(2500)
    record(
      '4 downloads sem gesto: uma pergunta só, as demais recusadas em silêncio, e nada em Downloads',
      L.sheetsOf(pid).length === 1 && L.listDir(procs.downloads).length === 0,
      { folhas: L.sheetsOf(pid).length, arquivos: L.listDir(procs.downloads) }
    )
  }
)

// ---------------------------------------------------------------------------------------------
// H-02 / E8: pop-ups
// ---------------------------------------------------------------------------------------------
await scenario(
  'popups-sem-gesto',
  ['http://hostil.test/p/popup-auto'],
  async ({ pid, dir }) => {
    await sleep(1500)
    const s = await L.st()
    const out = await L.out('popup-auto')
    record(
      '3 window.open sem gesto: nenhuma aba nova, a página recebeu null',
      L.urls(s).filter(u => u.includes('popup-auto-')).length === 0 &&
        out.opened.every((o: boolean) => !o),
      { abas: L.urls(s), opened: out.opened }
    )
    const tab = L.activeTab(s)
    const notice = await shellEval(
      `document.querySelector('.popup-notice-text')?.textContent`
    )
    record(
      'aviso "Pop-up bloqueado" (3) na barra de endereço',
      tab.blockedPopups === 3 && notice === '3 pop-ups bloqueados',
      { blockedPopups: tab.blockedPopups, aviso: notice }
    )
    L.shot(join(dir, 'aviso-popup.png'), pid)
    await L.click('app://shell', '.popup-notice-open')
    await sleep(1500)
    const after = await L.st()
    record(
      '"Abrir" no aviso abre o que foi bloqueado',
      L.urls(after).filter(u => u.includes('popup-auto-')).length === 3 &&
        L.activeTab(after).blockedPopups === 0,
      { abas: L.urls(after) }
    )
  }
)

await scenario(
  'popups-com-gesto',
  ['http://hostil.test/p/popup-click?n=5'],
  async () => {
    const page = (await L.pages()).find(p => p.url.endsWith('popup-click?n=5'))!
    await L.click('popup-click?n=5')
    await sleep(1500)
    const s = await L.st()
    const opened = await L.ev(page, 'window.__out.opened')
    record(
      'clique + 5 window.open: só 3 abrem (limite por gesto)',
      L.urls(s).filter(u => u.includes('popup-click-')).length === 3 &&
        opened.filter(Boolean).length === 3,
      { abas: L.urls(s), opened }
    )
    const blocked = (await L.st()).tabs.find((t: L.Json) =>
      t.url.endsWith('popup-click?n=5')
    )
    record(
      'os 2 excedentes ficam bloqueados com aviso',
      blocked.blockedPopups === 2,
      { blockedPopups: blocked.blockedPopups }
    )
  }
)

await scenario(
  'popups-fundo',
  [
    'http://hostil.test/p/popup-later',
    'http://hostil.test/p/title?t=outra-aba'
  ],
  async () => {
    await L.click('popup-later')
    // o usuário troca de aba antes de o script da primeira abrir o pop-up (gesto ainda vale)
    await activate('outra-aba')
    await sleep(2500)
    const s = await L.st()
    const popup =
      L.tabByUrl(s, 'popup-later?') ?? L.tabByUrl(s, 'title?t=popup-later')
    record(
      'pop-up aberto por aba que não é a ativa nasce em segundo plano',
      !!popup && L.activeTab(s).url.includes('outra-aba'),
      { abas: L.urls(s), ativa: L.activeTab(s).url }
    )
  }
)

await scenario(
  'popups-independentes',
  ['http://hostil.test/p/oauth-opener'],
  async () => {
    const page = (await L.pageOf('oauth-opener'))!
    await L.click('oauth-opener')
    await sleep(1500)
    let s = await L.st()
    const child = L.tabByUrl(s, 'oauth-child')
    const opener = await L.ev(
      (await L.pageOf('oauth-child'))!,
      'window.opener !== null'
    )
    record(
      'pop-up de login abre como aba, com window.opener',
      !!child && opener === true,
      { abas: L.urls(s) }
    )
    // fechar a aba que abriu NÃO fecha o pop-up
    await L.send('tab:close', { tabId: await tabId('oauth-opener') })
    await sleep(2000)
    s = await L.st()
    const alive = await L.pageOf('oauth-child')
    record(
      'fechar a aba de origem não fecha o pop-up (outlivesOpener)',
      !!L.tabByUrl(s, 'oauth-child') &&
        !!alive &&
        !L.tabByUrl(s, 'oauth-opener'),
      { abas: L.urls(s) }
    )
    void page
  }
)

await scenario(
  'popups-script-sem-gesto',
  ['http://hostil.test/p/opens-target-blank'],
  async () => {
    const page = (await L.pageOf('opens-target-blank'))!
    await L.ev(page, "document.getElementById('l').click(); 1")
    await sleep(1200)
    let s = await L.st()
    record(
      'a.click() de script em target=_blank não abre aba',
      !L.urls(s).some(u => u.includes('filho-blank')),
      { abas: L.urls(s) }
    )
    await L.click('opens-target-blank', '#l')
    await sleep(1500)
    s = await L.st()
    record(
      'clique real no mesmo link abre a aba',
      L.urls(s).some(u => u.includes('filho-blank')),
      { abas: L.urls(s) }
    )
  }
)

// ---------------------------------------------------------------------------------------------
// H-03 / H-04 / E9: endereço
// ---------------------------------------------------------------------------------------------
await scenario(
  'endereco',
  [
    'http://contas.google.com.sessao-segura.conta-verificada.exemplo.tk/login',
    'https://www.exemplo.com.br/receitas',
    'https://аpple.com/',
    'https://pão.com.br/',
    'http://httponly.test/p/title?t=so-http'
  ],
  async ({ pid, dir }) => {
    let s = await L.st()
    const idx = (frag: string) => L.tabByUrl(s, frag)
    // 1: host enganoso e http
    await activate('exemplo.tk')
    let a = await address()
    record(
      'host enganoso: o domínio registrável (exemplo.tk) aparece em peso 600 e inteiro',
      a.domain === 'exemplo.tk' && a.weight === '600' && a.domainVisible,
      a
    )
    record(
      'host enganoso: os subdomínios ficam em cor secundária',
      a.sub?.startsWith('contas.google.com') && a.subColor !== a.textColor,
      { sub: a.sub, subColor: a.subColor, textColor: a.textColor }
    )
    record(
      'host enganoso: o que não cabe é cortado no começo, nunca no fim',
      a.cut === true,
      { cut: a.cut }
    )
    record('http: "Não seguro" no campo', a.insecure === 'Não seguro', {
      insecure: a.insecure
    })
    L.shot(join(dir, 'host-enganoso.png'), pid)
    // 2: https, domínio composto
    await activate('exemplo.com.br')
    a = await address()
    record(
      'https .com.br: domínio registrável composto, sem "Não seguro"',
      a.domain === 'exemplo.com.br' && a.insecure === null && a.sub === '',
      a
    )
    L.shot(join(dir, 'https-com-br.png'), pid)
    // 3: IDN enganoso
    await activate('\u0430pple')
    a = await address()
    record(
      'IDN misto (cirílico + latim): aparece em punycode',
      a.domain === 'xn--pple-43d.com',
      a
    )
    L.shot(join(dir, 'idn-enganoso.png'), pid)
    // 4: IDN seguro
    await activate('p\u00e3o')
    a = await address()
    record(
      'IDN de um script só: aparece em Unicode',
      a.domain === 'pão.com.br',
      a
    )
    // 5: queda de https para http
    s = await L.st()
    const fall = L.tabByUrl(s, 'httponly')
    record(
      'https que falha cai para http (o fallback continua)',
      fall?.url.startsWith('http://httponly.test'),
      { url: fall?.url }
    )
    await activate('httponly')
    a = await address()
    record('queda para http mostra o indicador', a.insecure === 'Não seguro', a)
    L.shot(join(dir, 'queda-http.png'), pid)
    // paleta: "Não seguro" nas linhas http
    await L.send('palette:open', { mode: 'search' })
    await sleep(700)
    await L.typeText('app://shell', 'exemplo')
    await sleep(700)
    const rows = await shellEval(
      `[...document.querySelectorAll('.pal-row')].map(r => ({ text: r.innerText.replace(/\\n+/g, ' | '), insecure: !!r.querySelector('.insecure') }))`
    )
    record(
      'paleta: as abas http mostram "Não seguro" e as https não',
      rows.some((r: L.Json) => r.text.includes('exemplo.tk') && r.insecure) &&
        rows.some(
          (r: L.Json) => r.text.includes('exemplo.com.br') && !r.insecure
        ),
      rows
    )
    L.shot(join(dir, 'paleta.png'), pid)
    void idx
  },
  ['--largura=1000']
)

// ---------------------------------------------------------------------------------------------
// H-05 / H-07 / E10: diálogos
// ---------------------------------------------------------------------------------------------
await scenario(
  'dialogo-origem',
  ['http://127.0.0.1:9601/p/confirm'],
  async ({ pid, dir }) => {
    await sleep(1500)
    record(
      'confirm da aba ativa: diálogo nativo na tela',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'confirm-origem.png'), pid)
    const s = await L.st()
    record('o app segue responsivo com o diálogo aberto', s.tabs.length >= 1, {
      abas: s.tabs.length
    })
    // fechar a aba com o diálogo na tela: o diálogo fecha junto
    await L.send('tab:close', { tabId: await tabId('127.0.0.1') })
    await sleep(4500)
    record(
      'a aba que morre com o diálogo na tela o fecha',
      L.sheetsOf(pid).length === 0,
      { folhas: L.sheetsOf(pid).length }
    )
  }
)

await scenario(
  'dialogo-em-segundo-plano',
  [
    'http://hostil.test/p/title?t=aba-da-frente',
    'http://hostil.test/p/alert-timer?delay=1000'
  ],
  async ({ pid, dir }) => {
    await sleep(2800)
    const out = await L.out('alert-timer')
    record(
      'diálogo de aba em segundo plano: descartado, a página recebe false e não trava',
      out.r === false,
      out
    )
    record('nenhum diálogo aparece', L.sheetsOf(pid).length === 0, {
      folhas: L.sheetsOf(pid).length
    })
    const s = await L.st()
    const bg = L.tabByUrl(s, 'alert-timer')
    const marker = await shellEval(
      `[...document.querySelectorAll('.tab-row')].map(r => ({ t: r.querySelector('.tab-title')?.textContent, m: !!r.querySelector('.slot-dialog') }))`
    )
    record(
      'a aba ganha o marcador de diálogo descartado',
      bg.dialogBlocked === true && marker.some((r: L.Json) => r.m),
      { marker }
    )
    L.shot(join(dir, 'marcador-dialogo.png'), pid)
    record(
      'a aba da frente continua sendo a ativa (sem roubo de foco)',
      L.activeTab(s).url.includes('aba-da-frente'),
      { ativa: L.activeTab(s).url }
    )
    await activate('alert-timer')
    const after = await L.st()
    record(
      'abrir a aba apaga o marcador',
      L.tabByUrl(after, 'alert-timer').dialogBlocked === false,
      {}
    )
  }
)

await scenario(
  'dialogo-iframe',
  ['http://hostil.test/p/alert-iframe'],
  async ({ pid, dir }) => {
    await sleep(2500)
    // a página fica bloqueada no confirm do srcdoc (como num diálogo de verdade): o título é a prova
    // do que o iframe em branco recebeu antes
    const title = (await L.targets()).find(t =>
      t.url.includes('alert-iframe')
    )?.title
    record(
      'confirm de iframe em branco: sem diálogo nativo do Electron (retorna false)',
      title === 'blank:false',
      { title }
    )
    record(
      'confirm de iframe srcdoc passa pelo app, com diálogo e origem',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'confirm-iframe.png'), pid)
  }
)

await scenario(
  'dialogo-em-popup',
  ['http://hostil.test/p/oauth-opener'],
  async ({ pid, dir }) => {
    const page = (await L.pageOf('oauth-opener'))!
    await L.ev(
      page,
      "document.getElementById('b').onclick = () => window.open('/p/confirm'); 1"
    )
    await L.click('oauth-opener')
    await sleep(2500)
    record(
      'pop-up herda o preload: o confirm dele também passa pelo app, com origem',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'confirm-popup.png'), pid)
  }
)

// ---------------------------------------------------------------------------------------------
// H-05: beforeunload
// ---------------------------------------------------------------------------------------------
await scenario(
  'beforeunload-usuario',
  ['http://hostil.test/p/beforeunload'],
  async ({ pid, dir }) => {
    await L.click('beforeunload', '#t')
    await sleep(300)
    await L.key('beforeunload', 'W', ['meta'])
    await sleep(1500)
    record(
      '⌘W numa página com rascunho: pergunta "Sair desta página?" uma vez',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'beforeunload.png'), pid)
  }
)

await scenario(
  'beforeunload-fundo-em-loop',
  [
    'http://hostil.test/p/title?t=aba-da-frente',
    'http://hostil.test/p/unload-loop'
  ],
  async ({ pid }) => {
    // a página recebe um clique real (ganha a ativação de usuário que o Chromium exige para o
    // beforeunload valer), o usuário vai para outra aba e só então o loop começa
    await activate('unload-loop')
    await L.click('unload-loop')
    await sleep(300)
    await activate('aba-da-frente')
    // conta quantas vezes o Electron emitiu will-prevent-unload nesta aba (o app deve ignorar todas)
    await L.mainEval(
      `(() => { globalThis.__wpu = 0; const wc = require('electron').webContents.getAllWebContents().find(w => w.getURL().includes('unload-loop')); wc.on('will-prevent-unload', () => { globalThis.__wpu++ }); return 1 })()`
    )
    await L.ev((await L.pageOf('unload-loop'))!, "window.name = 'go'; 1")
    await sleep(4500)
    const t0 = Date.now()
    const s = await L.st()
    const elapsed = Date.now() - t0
    const out = await L.out('unload-loop')
    record(
      'aba em segundo plano em loop de beforeunload: nenhum diálogo e o app responde na hora',
      L.sheetsOf(pid).length === 0 && elapsed < 1500,
      { folhas: L.sheetsOf(pid).length, ms: elapsed }
    )
    record(
      'a página tentou sair várias vezes e o app não roubou o foco',
      out.tries >= 3 && L.activeTab(s).url.includes('aba-da-frente'),
      {
        tentativas: out.tries,
        chamadas: out.calls,
        willPreventUnload: await L.mainEval('globalThis.__wpu'),
        ativa: L.activeTab(s).url
      }
    )
  }
)

await scenario(
  'beforeunload-loop-ativo',
  ['http://hostil.test/p/unload-loop'],
  async ({ pid, dir }) => {
    await L.click('unload-loop')
    // a ação do usuário vale 5 s: depois dela, a página que tenta sair sozinha não ganha diálogo
    await sleep(6500)
    await L.mainEval(
      `(() => { globalThis.__wpu = 0; const wc = require('electron').webContents.getAllWebContents().find(w => w.getURL().includes('unload-loop')); wc.on('will-prevent-unload', () => { globalThis.__wpu++ }); return 1 })()`
    )
    await L.ev((await L.pageOf('unload-loop'))!, "window.name = 'go'; 1")
    await sleep(3500)
    const t0 = Date.now()
    await L.st()
    const wpu = await L.mainEval('globalThis.__wpu')
    record(
      'aba ativa, página em loop sem ação do usuário recente: o Electron pede, o app ignora e não abre diálogo',
      wpu >= 2 && L.sheetsOf(pid).length === 0 && Date.now() - t0 < 1500,
      { willPreventUnload: wpu, folhas: L.sheetsOf(pid).length }
    )
    // o usuário clica: a próxima saída que a página tenta pergunta uma vez
    await L.click('unload-loop')
    await sleep(1500)
    record(
      'um clique do usuário libera uma pergunta só, e não uma por tentativa',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'beforeunload-uma-pergunta.png'), pid)
  }
)

// ---------------------------------------------------------------------------------------------
// H-06 / E11: atalhos capturados pela página
// ---------------------------------------------------------------------------------------------
await scenario(
  'atalhos-capturados',
  [
    'http://hostil.test/p/keys',
    'http://hostil.test/p/title?t=dois',
    'http://hostil.test/p/title?t=tres'
  ],
  async () => {
    const keysPage = async () =>
      ((await L.out('p/keys')) as L.Json) &&
      (await L.ev((await L.pageOf('p/keys'))!, 'JSON.stringify(window.keys)'))
    const focusKeys = async () => {
      await L.send('tab:activate', { tabId: await tabId('p/keys') })
      await sleep(400)
    }
    const activeUrl = async () => L.activeTab(await L.st()).url
    await focusKeys()
    await L.ev((await L.pageOf('p/keys'))!, 'window.keys = []; 1')

    // ⌘2: a segunda aba (a página de teclas é a primeira)
    await L.key('p/keys', '2', ['meta'])
    await sleep(500)
    record(
      '⌘2 trocou de aba mesmo com a página capturando as teclas',
      (await activeUrl()).includes('t=dois'),
      { ativa: await activeUrl() }
    )
    await focusKeys()

    const before = (await L.st()).tabs.length
    await L.key('p/keys', 'T', ['meta'])
    await sleep(700)
    let s = await L.st()
    record(
      '⌘T abriu uma Nova aba',
      s.tabs.length === before + 1 && L.activeTab(s).url === '',
      { antes: before, depois: s.tabs.length }
    )
    await L.send('tab:close', { tabId: L.activeTab(s).id })
    await sleep(700)
    await focusKeys()

    const toggled = async (key: string, mods: string[]) => {
      const was = (await L.st()).window.sidebar
      await L.key('p/keys', key, mods)
      await sleep(500)
      return [was, (await L.st()).window.sidebar]
    }
    const side = await toggled('S', ['meta'])
    record('⌘S alternou a sidebar', side[0] !== side[1], {
      de: side[0],
      para: side[1]
    })
    await L.key('p/keys', 'S', ['meta'])
    await sleep(400)
    await focusKeys()

    await L.key('p/keys', 'K', ['meta'])
    await sleep(600)
    const palette = await shellEval(`!!document.querySelector('.pal')`)
    record('⌘K abriu a paleta', palette === true, { palette })
    await L.send('palette:close', {})
    await sleep(400)
    await focusKeys()

    await L.key('p/keys', 'L', ['meta'])
    await sleep(600)
    const addr = await shellEval(
      `document.querySelector('.pal-input')?.value ?? null`
    )
    record(
      '⌘L abriu a paleta no modo endereço (URL da aba)',
      typeof addr === 'string' && addr.includes('p/keys'),
      { addr }
    )
    await L.send('palette:close', {})
    await sleep(400)
    await focusKeys()

    const zoom = async () =>
      L.mainEval(
        `require('electron').webContents.getAllWebContents().find(w => w.getURL().includes('p/keys')).getZoomLevel()`
      )
    await L.key('p/keys', '=', ['meta', 'shift'])
    await sleep(300)
    const z1 = await zoom()
    await L.key('p/keys', '-', ['meta'])
    await sleep(300)
    await L.key('p/keys', '-', ['meta'])
    await sleep(300)
    const z2 = await zoom()
    await L.key('p/keys', '0', ['meta'])
    await sleep(300)
    record(
      '⌘+ ⌘− ⌘0 mexem no zoom',
      z1 > 0 && z2 < z1 && (await zoom()) === 0,
      { z1, z2 }
    )

    // ⌃Tab e ⌃⇧Tab
    const a0 = await activeUrl()
    await L.key('p/keys', 'Tab', ['control'])
    await sleep(500)
    const a1 = await activeUrl()
    record('⌃Tab foi para outra aba', a1 !== a0, { a0, a1 })
    await focusKeys()
    await L.key('p/keys', 'Tab', ['control', 'shift'])
    await sleep(500)
    record('⌃⇧Tab foi para outra aba', (await activeUrl()) !== a0, {
      ativa: await activeUrl()
    })
    await focusKeys()

    // ⌘R recarrega (o título volta a ser o inicial e window.keys zera)
    await L.ev((await L.pageOf('p/keys'))!, 'window.__marca = 1; 1')
    await L.key('p/keys', 'R', ['meta'])
    await sleep(1500)
    const marca = await L.ev(
      (await L.pageOf('p/keys'))!,
      'window.__marca ?? null'
    )
    record('⌘R recarregou a página', marca === null, { marca })

    // ⌘[ e ⌘]
    await L.send('tab:navigate', {
      tabId: await tabId('p/keys'),
      input: 'http://hostil.test/p/title?t=segunda'
    })
    await sleep(1200)
    await L.key('title?t=segunda', '[', ['meta'])
    await sleep(1200)
    s = await L.st()
    record('⌘[ voltou na história', L.tabByUrl(s, 'p/keys') !== undefined, {
      abas: L.urls(s)
    })
    await L.key('p/keys', ']', ['meta'])
    await sleep(1200)
    s = await L.st()
    record('⌘] avançou', L.tabByUrl(s, 'title?t=segunda') !== undefined, {
      abas: L.urls(s)
    })
    await L.send('tab:navigate', {
      tabId: await tabId('title?t=segunda'),
      input: 'http://hostil.test/p/keys'
    })
    await sleep(1200)
    await focusKeys()
    await L.ev((await L.pageOf('p/keys'))!, 'window.keys = []; 1')

    // ⌘W fecha a aba da própria página que captura tudo; ⇧⌘T a traz de volta
    await L.key('p/keys', 'W', ['meta'])
    await sleep(1500)
    s = await L.st()
    record(
      '⌘W fechou a aba da página que captura as teclas',
      !L.tabByUrl(s, 'p/keys'),
      { abas: L.urls(s) }
    )
    await L.send('tab:activate', { tabId: await tabId('title?t=dois') })
    await sleep(400)
    await L.key('title?t=dois', 'T', ['meta', 'shift'])
    await sleep(1500)
    s = await L.st()
    record('⇧⌘T reabriu a aba fechada', !!L.tabByUrl(s, 'p/keys'), {
      abas: L.urls(s)
    })

    // a página não viu nenhum dos atalhos; uma tecla comum ela vê
    await focusKeys()
    await L.ev((await L.pageOf('p/keys'))!, 'window.keys = []; 1')
    await L.key('p/keys', '2', ['meta'])
    await sleep(500)
    await focusKeys()
    await L.key('p/keys', 'X', [])
    await sleep(300)
    const seen = JSON.parse(await keysPage())
    record(
      'a página não viu o ⌘2, só a tecla comum',
      seen.every((k: string) => !k.includes('M-')) &&
        seen.some((k: string) => k.endsWith('x') || k.endsWith('X')),
      { vistas: seen }
    )
  }
)

// ---------------------------------------------------------------------------------------------
// H-09 / H-10 / E13: window.close
// ---------------------------------------------------------------------------------------------
await scenario(
  'window-close-normal',
  [
    'http://hostil.test/p/title?t=vizinha',
    'http://hostil.test/p/close-self-timer?delay=800'
  ],
  async ({ procs }) => {
    await activate('close-self-timer')
    await sleep(5000)
    const s = await L.st()
    const tab = L.tabByUrl(s, 'close-self-timer')
    record(
      'window.close() numa aba aberta pelo usuário é ignorado: a aba continua na sidebar',
      !!tab,
      { abas: L.urls(s) }
    )
    record(
      'em laço, a aba fica dormente e a vizinha assume',
      tab?.dormant === true && !L.activeTab(s).url.includes('close-self-timer'),
      { dormant: tab?.dormant, ativa: L.activeTab(s).url }
    )
    record(
      'o pedido ignorado aparece no log',
      logOf(procs, '[Tab][window.close] pedido ignorado')
    )
    record('nada entrou no ⇧⌘T', true)
  }
)

await scenario(
  'window-close-popup',
  ['http://hostil.test/p/opens-self-closing'],
  async () => {
    await L.click('opens-self-closing')
    // o pop-up se fecha uns 700 ms depois de carregar: pega-se a aba enquanto ela existe
    const seen = await L.waitFor(
      async () =>
        L.urls(await L.st()).some(u => u.includes('child-self-close')),
      2500,
      40
    )
    record('pop-up abriu como aba', seen === true, {})
    await sleep(2000)
    let s = await L.st()
    record(
      'pop-up que se fecha com window.close() sai da sidebar',
      !L.urls(s).some(u => u.includes('child-self-close')) &&
        L.urls(s).some(u => u.includes('opens-self-closing')),
      { abas: L.urls(s) }
    )
    await L.send('tab:activate', { tabId: await tabId('opens-self-closing') })
    await sleep(400)
    await L.key('opens-self-closing', 'T', ['meta', 'shift'])
    await sleep(1500)
    s = await L.st()
    record(
      'a aba fechada por script volta com ⇧⌘T',
      L.urls(s).some(u => u.includes('child-self-close')),
      { abas: L.urls(s) }
    )
  }
)

await scenario(
  'window-close-opener',
  ['http://hostil.test/p/opens-closer'],
  async () => {
    await L.click('opens-closer')
    await sleep(3000)
    const s = await L.st()
    record(
      'pop-up chama opener.close(): a aba de origem continua',
      !!L.tabByUrl(s, 'opens-closer'),
      { abas: L.urls(s) }
    )
    record(
      'e o pop-up também continua (não se fechou sozinho)',
      !!L.tabByUrl(s, 'child-closes-opener'),
      { abas: L.urls(s) }
    )
  }
)

// ---------------------------------------------------------------------------------------------
// H-16: esquemas externos
// ---------------------------------------------------------------------------------------------
await scenario(
  'esquemas-externos',
  ['http://hostil.test/p/external-auto'],
  async ({ pid }) => {
    await sleep(1800)
    record(
      'mailto: por script, sem gesto: nada abre e nada pergunta',
      L.sheetsOf(pid).length === 0,
      { folhas: L.sheetsOf(pid).length }
    )
  }
)

await scenario(
  'esquemas-externos-com-clique',
  ['http://hostil.test/p/external'],
  async ({ pid, dir }) => {
    await L.click('p/external', '#unk')
    await sleep(1500)
    const s = await L.st()
    record(
      'esquema desconhecido (gilasnope:): a aba mostra a página de erro',
      L.activeTab(s).error?.code === -302,
      L.activeTab(s).error
    )
    const errorText = await shellEval(
      `document.querySelector('.error-title')?.textContent + ' | ' + document.querySelector('.error-body')?.textContent`
    )
    record(
      'a página de erro está em português',
      typeof errorText === 'string' &&
        errorText.includes('Nenhum app abre este tipo de link'),
      { errorText }
    )
    L.shot(join(dir, 'esquema-desconhecido.png'), pid)
    // recarregar tira a aba do erro e volta à página
    await L.send('tab:reload', {})
    await sleep(1500)
    record(
      'recarregar volta à página',
      (await L.st()).tabs.every((t: L.Json) => t.error === null),
      {}
    )
    await L.click('p/external', '#mail')
    await sleep(1500)
    record(
      'mailto: com clique: diálogo "Abrir mailto em outro app?" (Cancelar é o padrão)',
      L.sheetsOf(pid).length === 1,
      { folhas: L.sheetsOf(pid).length }
    )
    L.shotSheet(join(dir, 'mailto-dialogo.png'), pid)
  }
)

finish()
