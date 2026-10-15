import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createStaging } from '../src/main/functions/stage-download'
import { sweepStaging } from '../src/main/functions/sweep-staging'

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'varredura-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function makeStaging(root: string, name: string): string {
  const dir = join(root, name)
  mkdirSync(dir)
  writeFileSync(join(dir, 'drive-by.exe'), 'bytes')
  return dir
}

test('a pasta do download sem gesto leva o pid de quem a criou', () => {
  withRoot(root => {
    const staging = createStaging(root, 'a.txt')
    assert.match(
      staging.dir,
      new RegExp(`gilas-download-${process.pid}-[A-Za-z0-9]{6}$`)
    )
  })
})

test('varredura da abertura: apaga a pasta de quem morreu e preserva a de instância viva e a própria', () => {
  withRoot(root => {
    const dead = makeStaging(root, 'gilas-download-4242-abc123')
    const alive = makeStaging(root, 'gilas-download-4343-def456')
    const own = makeStaging(root, `gilas-download-${process.pid}-ghi789`)
    const removed = sweepStaging(root, { isAlive: pid => pid === 4343 })
    assert.equal(removed, 1)
    assert.equal(existsSync(dead), false)
    assert.equal(existsSync(alive), true)
    assert.equal(existsSync(own), true)
  })
})

test('ao encerrar, as pastas do próprio processo também saem; as de outro vivo, não', () => {
  withRoot(root => {
    const alive = makeStaging(root, 'gilas-download-4343-def456')
    const own = makeStaging(root, `gilas-download-${process.pid}-ghi789`)
    assert.equal(
      sweepStaging(root, { isAlive: () => true, includeOwn: true }),
      1
    )
    assert.equal(existsSync(own), false)
    assert.equal(existsSync(alive), true)
  })
})

test('formato antigo (sem pid): sai só depois de um dia', () => {
  withRoot(root => {
    const old = makeStaging(root, 'gilas-download-AbC123')
    const fresh = makeStaging(root, 'gilas-download-ZyX987')
    const now = Date.now()
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000)
    utimesSync(old, twoDaysAgo, twoDaysAgo)
    assert.equal(sweepStaging(root, { now }), 1)
    assert.equal(existsSync(old), false)
    assert.equal(existsSync(fresh), true)
  })
})

test('só apaga pasta de verdade com o nome do app: arquivo, link e outras pastas ficam', () => {
  withRoot(root => {
    const outside = mkdtempSync(join(tmpdir(), 'alvo-'))
    try {
      writeFileSync(join(outside, 'importante.txt'), 'não apagar')
      const file = join(root, 'gilas-download-4242-abc123')
      writeFileSync(file, 'arquivo, não pasta')
      const link = join(root, 'gilas-download-5252-abc123')
      symlinkSync(outside, link)
      const other = join(root, 'gilas-downloads-4242-abc123')
      mkdirSync(other)
      const similar = join(root, 'gilas-download-4242-abc12')
      mkdirSync(similar)
      const unrelated = join(root, 'outro-programa')
      mkdirSync(unrelated)
      assert.equal(sweepStaging(root, { isAlive: () => false }), 0)
      for (const path of [file, link, other, similar, unrelated])
        assert.equal(existsSync(path), true, path)
      assert.equal(existsSync(join(outside, 'importante.txt')), true)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})

test('pasta temporária que não existe não lança', () => {
  assert.equal(sweepStaging(join(tmpdir(), 'nao-existe-varredura')), 0)
})
