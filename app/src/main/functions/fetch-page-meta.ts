// Descobre o título e o favicon de uma página sem abri-la: baixa só o começo do HTML (até o fim
// do <head>) pela rede do main, sem cookies, e lê o <title> e os <link rel="icon">. Serve para
// abas e favoritos que chegam sem título nem ícone (sessão aberta com --abas, favoritos novos).
import { app, net, type Session } from 'electron'
import { getHostname } from '@shared/url-parts'
import { faviconToDataUrl } from './favicon-to-data-url'
import { detectCharset, parsePageMeta, type PageMeta } from './parse-page-meta'

const TIMEOUT_MS = 8000
// o <title> do YouTube vem depois de 700 KB de scripts no <head>; para antes disso se o <head> acabar
const MAX_BYTES = 1024 * 1024

export interface SiteMeta {
  title: string
  favicon: string | null
}

const MAX_REDIRECTS = 5
const HEAD_END = /<\/head\s*>|<body[\s>]/i

interface HeadText {
  text: string
  finalUrl: string
}

// Baixa o começo do HTML pela rede do main (net.request: dá controle de cada redirecionamento,
// que o fetch não dá) e para no fim do <head>. Um redirecionamento para outro site (tela de
// login, aviso de consentimento) não diz nada sobre a página pedida: aí não há resultado
function downloadHead(ses: Session, url: string): Promise<HeadText | null> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    let total = 0
    let tail = ''
    let finalUrl = url
    let redirects = 0
    let settled = false
    const probe = new TextDecoder('latin1')

    const request = net.request({
      url,
      session: ses,
      redirect: 'manual',
      credentials: 'omit',
      useSessionCookies: false
    })
    request.setHeader('accept', 'text/html,application/xhtml+xml')
    request.setHeader('accept-language', `${app.getLocale()},en;q=0.8`)

    const finish = (result: HeadText | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        request.abort()
      } catch {
        // já terminou
      }
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), TIMEOUT_MS)
    const done = () => {
      const bytes = Buffer.concat(chunks)
      const charset = detectCharset(
        contentType,
        bytes.subarray(0, 2048).toString('latin1')
      )
      finish({ text: new TextDecoder(charset).decode(bytes), finalUrl })
    }
    let contentType = ''

    request.on('redirect', (_status, _method, redirectUrl) => {
      redirects++
      if (
        redirects > MAX_REDIRECTS ||
        getHostname(redirectUrl) !== getHostname(url)
      )
        return finish(null)
      finalUrl = redirectUrl
      request.followRedirect()
    })
    request.on('response', response => {
      const type = response.headers['content-type']
      contentType = Array.isArray(type) ? type[0] : (type ?? '')
      if (
        response.statusCode >= 400 ||
        !/text\/html|application\/xhtml/i.test(contentType)
      )
        return finish(null)
      response.on('data', chunk => {
        chunks.push(chunk)
        total += chunk.length
        const text = tail + probe.decode(chunk)
        if (HEAD_END.test(text) || total >= MAX_BYTES) return done()
        tail = text.slice(-16)
      })
      response.on('end', done)
      response.on('error', () => finish(null))
    })
    request.on('error', () => finish(null))
    request.end()
  })
}

export async function fetchPageMeta(
  ses: Session,
  url: string
): Promise<PageMeta | null> {
  const head = await downloadHead(ses, url)
  return head ? parsePageMeta(head.text, head.finalUrl) : null
}

// título e favicon de um endereço. Favicon: os ícones que a página declara; sem eles, o
// /favicon.ico do site; e só por último o apple-touch-icon
export async function fetchSiteMeta(
  ses: Session,
  url: string,
  want: { title: boolean; favicon: boolean }
): Promise<SiteMeta> {
  const meta = await fetchPageMeta(ses, url)
  const title = want.title ? (meta?.title ?? '') : ''
  if (!want.favicon) return { title, favicon: null }

  const declared = meta
    ? meta.icons.length > 0
      ? meta.icons
      : meta.touchIcons
    : []
  let favicon =
    declared.length > 0 ? await faviconToDataUrl(ses, declared) : null
  favicon ??= await faviconToDataUrl(ses, [new URL('/favicon.ico', url).href])
  if (!favicon && meta && meta.icons.length > 0 && meta.touchIcons.length > 0)
    favicon = await faviconToDataUrl(ses, meta.touchIcons)
  return { title, favicon }
}
