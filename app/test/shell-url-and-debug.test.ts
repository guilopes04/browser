import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findDebugFlags,
  findRefusedDebugFlags
} from '../src/main/functions/find-debug-flags'
import { isShellUrl } from '../src/main/functions/is-shell-url'
import {
  resolveShellUrl,
  SHELL_URL
} from '../src/main/functions/resolve-shell-url'

test('empacotado, a shell é sempre app://shell, com ou sem ELECTRON_RENDERER_URL', () => {
  assert.equal(SHELL_URL, 'app://shell/index.html')
  for (const env of [
    undefined,
    '',
    'http://localhost:5173',
    'http://127.0.0.1:9655/',
    'https://evil.example/',
    'file:///tmp/x.html'
  ])
    assert.equal(resolveShellUrl(env, true), SHELL_URL, String(env))
})

test('no desenvolvimento a variável vale só como http://localhost:<porta>', () => {
  assert.equal(
    resolveShellUrl('http://localhost:5173', false),
    'http://localhost:5173'
  )
  assert.equal(
    resolveShellUrl('http://localhost:5173/', false),
    'http://localhost:5173/'
  )
  for (const env of [
    undefined,
    '',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://localhost',
    'http://localhost:0',
    'http://localhost:99999',
    'http://localhost.evil.example:5173',
    'http://user:senha@localhost:5173',
    'https://localhost:5173',
    'http://evil.example:5173',
    'file:///etc/senhas-do-sistema',
    'app://shell',
    'não é url'
  ])
    assert.equal(resolveShellUrl(env, false), SHELL_URL, String(env))
})

test('o remetente do IPC é conferido contra a constante quando empacotado', () => {
  // o servidor remoto de um atacante em localhost não vira "a shell" no app empacotado
  const packaged = resolveShellUrl('http://localhost:5173', true)
  assert.equal(isShellUrl('app://shell/index.html', packaged), true)
  assert.equal(isShellUrl('http://localhost:5173/', packaged), false)
  assert.equal(isShellUrl('app://outro/index.html', packaged), false)
  assert.equal(isShellUrl('https://shell/', packaged), false)
})

test('depuração remota e inspetor: encontrados na linha de comando e no NODE_OPTIONS', () => {
  assert.deepEqual(findDebugFlags(['electron', '.']), [])
  assert.deepEqual(
    findDebugFlags([
      'app',
      '--remote-debugging-port=9222',
      '--inspect=9229',
      '--inspect-brk',
      '--remote-debugging-pipe'
    ]).sort(),
    [
      '--inspect',
      '--inspect-brk',
      '--remote-debugging-pipe',
      '--remote-debugging-port'
    ]
  )
  assert.deepEqual(
    findDebugFlags(['app'], '--max-old-space-size=100 --inspect=0.0.0.0:9229'),
    ['--inspect']
  )
  // outro argumento que só começa igual não conta
  assert.deepEqual(
    findDebugFlags(['--inspector-theme=dark', '--remote-debugging-ports']),
    []
  )
})

test('o app empacotado recusa depuração sem --dev; em desenvolvimento ou com --dev, aceita', () => {
  const argv = ['Gilas Browser', '--remote-debugging-port=9222']
  assert.deepEqual(findRefusedDebugFlags(argv, true), [
    '--remote-debugging-port'
  ])
  assert.deepEqual(findRefusedDebugFlags([...argv, '--dev'], true), [])
  assert.deepEqual(findRefusedDebugFlags(argv, false), [])
  assert.deepEqual(findRefusedDebugFlags(['app', '--inspect'], true), [
    '--inspect'
  ])
  assert.deepEqual(findRefusedDebugFlags(['app'], true, '--inspect-brk=9229'), [
    '--inspect-brk'
  ])
  assert.deepEqual(findRefusedDebugFlags(['app', '--abas=x.json'], true), [])
})

test('o Chromium também lê a opção com um hífen só: "-remote-debugging-port" não escapa', () => {
  const argv = ['Gilas Browser', '-remote-debugging-port=9412']
  assert.deepEqual(findRefusedDebugFlags(argv, true), [
    '--remote-debugging-port'
  ])
  assert.deepEqual(
    findDebugFlags([
      'app',
      '-remote-debugging-pipe',
      '-remote-allow-origins=*',
      '-inspect=9229',
      '-inspect-brk',
      '-debug-port=5858'
    ]).sort(),
    [
      '--debug-port',
      '--inspect',
      '--inspect-brk',
      '--remote-allow-origins',
      '--remote-debugging-pipe'
    ]
  )
  assert.deepEqual(findDebugFlags(['app'], '-inspect=0.0.0.0:9229'), [
    '--inspect'
  ])
  // seguem sem valer: nome que só começa igual, argumento que não é opção
  assert.deepEqual(
    findDebugFlags([
      '-inspector-theme=dark',
      '-remote-debugging-ports',
      'inspect'
    ]),
    []
  )
  // o --dev é só o de dois hífens (o mesmo do flags.ts): "-dev" não libera a depuração
  assert.deepEqual(findRefusedDebugFlags([...argv, '-dev'], true), [
    '--remote-debugging-port'
  ])
  assert.deepEqual(findRefusedDebugFlags([...argv, '--dev'], true), [])
})

test('a opção que o Chromium reconhece e a linha de comando não mostra também é recusada', () => {
  // hasSwitch é a fonte da verdade do Chromium (app.commandLine.hasSwitch)
  const has = (present: string[]) => (name: string) => present.includes(name)
  assert.deepEqual(
    findRefusedDebugFlags(
      ['Gilas Browser'],
      true,
      '',
      has(['remote-debugging-port', 'user-data-dir'])
    ),
    ['--remote-debugging-port']
  )
  assert.deepEqual(
    findRefusedDebugFlags(
      ['Gilas Browser', '--dev'],
      true,
      '',
      has(['remote-debugging-port'])
    ),
    []
  )
  assert.deepEqual(
    findRefusedDebugFlags(['Gilas Browser'], false, '', has(['inspect'])),
    []
  )
  assert.deepEqual(
    findRefusedDebugFlags(['Gilas Browser'], true, '', has(['user-data-dir'])),
    []
  )
})
