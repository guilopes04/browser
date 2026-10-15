import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeEntities,
  detectCharset,
  parsePageMeta
} from '../src/main/functions/parse-page-meta'

const BASE = 'https://github.com/electron/electron/pulls'

test('título: tira atributos, espaços e entidades', () => {
  const html =
    '<html><head><title data-rh=true>\n  Pull requests &middot; electron/electron &amp; cia\n</title></head><body></body>'
  assert.equal(
    parsePageMeta(html, BASE).title,
    'Pull requests · electron/electron & cia'
  )
})

test('título que é o próprio endereço não serve; sem título dá vazio', () => {
  assert.equal(
    parsePageMeta('<title>https://www.google.com/search?q=a</title>', BASE)
      .title,
    ''
  )
  assert.equal(parsePageMeta('<head></head>', BASE).title, '')
})

test('ignora o que vem depois do </head>', () => {
  const html =
    '<head><title>A</title></head><body><title>B</title><link rel="icon" href="/x.png"></body>'
  const meta = parsePageMeta(html, BASE)
  assert.equal(meta.title, 'A')
  assert.deepEqual(meta.icons, [])
})

test('ícones: ordem do documento, URL absoluta, sem duplicar', () => {
  const html = `<head>
    <link rel="fluid-icon" href="/fluidicon.png">
    <link rel="mask-icon" href="/pinned.svg">
    <link rel="alternate icon" type="image/png" href="https://cdn.test/favicon.png">
    <link href='y18.svg' rel='icon'>
    <link rel="shortcut icon" href="/favicon.ico"/>
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
  </head>`
  const meta = parsePageMeta(html, 'https://news.test/a/b')
  assert.deepEqual(meta.icons, [
    'https://cdn.test/favicon.png',
    'https://news.test/a/y18.svg',
    'https://news.test/favicon.ico'
  ])
  assert.deepEqual(meta.touchIcons, ['https://news.test/touch.png'])
})

test('ícone data: e esquemas estranhos ficam de fora', () => {
  const html =
    '<head><link rel="icon" href="data:image/svg+xml,<svg/>"><link rel="icon" href="javascript:1"><link rel="icon"></head>'
  assert.deepEqual(parsePageMeta(html, BASE).icons, [])
})

test('entidades numéricas e nomeadas; desconhecida fica como veio', () => {
  assert.equal(decodeEntities('a&#39;b&#x41;&nbsp;c&foo;'), "a'bA c&foo;")
  assert.equal(decodeEntities('&#0;&#1114112;'), '&#0;&#1114112;')
})

test('codificação: cabeçalho, depois <meta>, depois utf-8', () => {
  assert.equal(
    detectCharset('text/html; charset=ISO-8859-1', ''),
    'windows-1252'
  )
  assert.equal(detectCharset('text/html', '<meta charset="utf-8">'), 'utf-8')
  assert.equal(
    detectCharset(
      'text/html',
      '<meta http-equiv="x" content="text/html; charset=windows-1252">'
    ),
    'windows-1252'
  )
  assert.equal(detectCharset('text/html; charset=nao-existe', ''), 'utf-8')
})
