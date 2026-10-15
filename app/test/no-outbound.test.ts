import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nativeImage, session, type Session } from 'electron'
import { faviconToDataUrl } from '../src/main/functions/favicon-to-data-url'
import { startMetaFill } from '../src/main/services/fill-missing-meta'
import { createDefaultSpaces } from '../src/main/store/default-spaces'
import { fakeContext } from './fake-main'

test('primeira abertura: nenhum favorito nasce com favicon (ícone local: letra e cor)', () => {
  for (const space of createDefaultSpaces())
    for (const favorite of space.favorites) {
      assert.equal(favorite.favicon, null, favorite.title)
      assert.match(favorite.tile, /^#[0-9A-F]{6}$/i)
    }
})

test('sem --abas o preenchimento de título e favicon não existe: nenhuma sessão, nenhuma rede', async () => {
  const { ctx, store } = fakeContext()
  // sessão salva com uma aba sem título (suspensa) e favoritos sem favicon: nada é consultado
  store.addTab({
    ...store.getTabsOfSpace('personal')[0],
    id: 'sem-titulo',
    url: 'https://example.com/',
    title: '',
    dormant: true
  })
  const original = session.fromPartition
  let touched = 0
  ;(session as any).fromPartition = () => {
    touched++
    return {}
  }
  try {
    assert.equal(ctx.flags.tabsSource, null)
    await startMetaFill(ctx)
    assert.equal(touched, 0)
    assert.equal(store.getTab('sem-titulo')?.title, '')
  } finally {
    ;(session as any).fromPartition = original
  }
})

test('o favorito só ganha o favicon depois que o usuário visita o site', () => {
  const { store } = fakeContext()
  const github = store.state.spaces[0].favorites.find(f => f.id === 'p-github')
  assert.equal(github?.favicon, null)
  // um site diferente não mexe nele
  store.fillFavoriteFavicons(
    'https://example.com/',
    'data:image/png;base64,AAA'
  )
  assert.equal(github?.favicon, null)
  // a aba do mesmo site descobriu o ícone (page-favicon-updated)
  store.fillFavoriteFavicons(
    'https://github.com/x',
    'data:image/png;base64,BBB'
  )
  assert.equal(github?.favicon, 'data:image/png;base64,BBB')
})

function fakeFaviconSession() {
  const fetched: string[] = []
  const ses = {
    fetch: async (url: string) => {
      fetched.push(url)
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
      }
    }
  }
  return { ses: ses as unknown as Session, fetched }
}

test('o cache de favicons é por sessão: o ícone do Pessoal não responde no Trabalho', async () => {
  const original = nativeImage.createFromBuffer
  ;(nativeImage as any).createFromBuffer = () => ({
    isEmpty: () => false,
    getSize: () => ({ width: 16, height: 16 }),
    toDataURL: () => 'data:image/png;base64,ICON'
  })
  try {
    const personal = fakeFaviconSession()
    const work = fakeFaviconSession()
    const url = ['https://example.com/favicon.ico']

    assert.equal(
      await faviconToDataUrl(personal.ses, url),
      'data:image/png;base64,ICON'
    )
    // segunda vez na mesma sessão: do cache, sem rede
    assert.equal(
      await faviconToDataUrl(personal.ses, url),
      'data:image/png;base64,ICON'
    )
    assert.equal(personal.fetched.length, 1)

    // outra sessão: o cache dela está vazio e ela busca por conta própria
    assert.equal(
      await faviconToDataUrl(work.ses, url),
      'data:image/png;base64,ICON'
    )
    assert.equal(work.fetched.length, 1)
  } finally {
    ;(nativeImage as any).createFromBuffer = original
  }
})

test('favicon de página pública não é buscado na rede local', async () => {
  const original = nativeImage.createFromBuffer
  ;(nativeImage as any).createFromBuffer = () => ({
    isEmpty: () => false,
    getSize: () => ({ width: 16, height: 16 }),
    toDataURL: () => 'data:image/png;base64,ICON'
  })
  try {
    const { ses, fetched } = fakeFaviconSession()
    const result = await faviconToDataUrl(
      ses,
      ['http://127.0.0.1:8080/i.png', 'http://192.168.0.1/favicon.ico'],
      'https://example.com/'
    )
    assert.equal(result, null)
    assert.deepEqual(fetched, [])
    // a página da própria rede local pode
    const local = await faviconToDataUrl(
      ses,
      ['http://127.0.0.1:8080/i.png'],
      'http://localhost:3000/'
    )
    assert.equal(local, 'data:image/png;base64,ICON')
    assert.deepEqual(fetched, ['http://127.0.0.1:8080/i.png'])
  } finally {
    ;(nativeImage as any).createFromBuffer = original
  }
})
