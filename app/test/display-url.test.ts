import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayUrl } from '../src/shared/display-url'
import { splitUrl } from '../src/shared/url-parts'
import { normalizeForMatch } from '../src/shared/match-palette'

test('acentos codificados aparecem decodificados', () => {
  assert.equal(
    displayUrl(
      'https://pt.wikipedia.org/wiki/Wikip%C3%A9dia:P%C3%A1gina_principal'
    ),
    'https://pt.wikipedia.org/wiki/Wikipédia:Página_principal'
  )
  assert.equal(
    displayUrl('https://www.google.com/search?q=a%C3%A7%C3%A3o'),
    'https://www.google.com/search?q=ação'
  )
  assert.equal(
    displayUrl('https://x.com/%E6%97%A5%E6%9C%AC'),
    'https://x.com/日本'
  )
})

test('o que não é letra fora do ASCII continua codificado', () => {
  // espaço, barra, interrogação e porcento decodificados mudariam o endereço
  const url = 'https://x.com/a%20b%2Fc%3Fd%2541?q=%26'
  assert.equal(displayUrl(url), url)
})

test('bytes que não formam UTF-8 ficam codificados', () => {
  assert.equal(displayUrl('https://x.com/%C3'), 'https://x.com/%C3')
  assert.equal(displayUrl('https://x.com/%FF%FE'), 'https://x.com/%FF%FE')
  // o trecho válido ao lado de um inválido ainda é decodificado
  assert.equal(displayUrl('https://x.com/%C3%A3/%C3'), 'https://x.com/ã/%C3')
})

test('caracteres de controle e de direção de texto não são revelados', () => {
  // U+202E (inverte a direção do texto) e U+0085
  const rtl = 'https://x.com/%E2%80%AEtxt.exe'
  assert.equal(displayUrl(rtl), rtl)
  const nel = 'https://x.com/%C2%85'
  assert.equal(displayUrl(nel), nel)
})

test('host em punycode não é alterado e a URL sem % passa direto', () => {
  assert.equal(
    displayUrl('https://xn--mnchen-3ya.de/a'),
    'https://xn--mnchen-3ya.de/a'
  )
  assert.equal(displayUrl('https://example.com/'), 'https://example.com/')
})

test('splitUrl mostra o caminho decodificado e a busca da paleta acha pelo acento', () => {
  const { domain, path } = splitUrl(
    'https://pt.wikipedia.org/wiki/Wikip%C3%A9dia:P%C3%A1gina_principal'
  )
  assert.equal(domain, 'pt.wikipedia.org')
  assert.equal(path, '/wiki/Wikipédia:Página_principal')
  const normalized = normalizeForMatch(
    'Wikipédia',
    'https://pt.wikipedia.org/wiki/Wikip%C3%A9dia:P%C3%A1gina_principal'
  )
  assert.ok(normalized.url.includes('pagina_principal'))
})
