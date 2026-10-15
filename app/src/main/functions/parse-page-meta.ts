// Título e ícones de uma página lidos do HTML do <head>, sem carregar a página. Puro.
export interface PageMeta {
  title: string
  // <link rel="icon"> e "shortcut icon", na ordem do documento
  icons: string[]
  // <link rel="apple-touch-icon">: só entra se a página não declara outro ícone
  touchIcons: string[]
}

const MAX_TITLE_LENGTH = 200

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™'
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      try {
        return code > 0 ? String.fromCodePoint(code) : match
      } catch {
        return match
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>()
  const pattern =
    /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  // pula o nome da tag ("<link")
  const body = tag.replace(/^<[a-z]+/i, '')
  for (const match of body.matchAll(pattern)) {
    const name = match[1].toLowerCase()
    if (!attributes.has(name))
      attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function resolveHttp(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(decodeEntities(href.trim()), baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

function readTitle(head: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)
  if (!match) return ''
  const title = decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
  // páginas de bloqueio e de erro usam o próprio endereço como título: não serve de rótulo
  if (/^https?:\/\//i.test(title)) return ''
  return Array.from(title).slice(0, MAX_TITLE_LENGTH).join('')
}

export function parsePageMeta(html: string, baseUrl: string): PageMeta {
  const end = /<\/head\s*>|<body[\s>]/i.exec(html)
  const head = end ? html.slice(0, end.index) : html
  const icons: string[] = []
  const touchIcons: string[] = []

  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(tag)
    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/)
    const href = attributes.get('href')
    if (!href) continue
    const isTouch = rel.some(token => token.startsWith('apple-touch-icon'))
    // "mask-icon" e "fluid-icon" não são ícones de aba
    const isIcon = rel.includes('icon')
    if (!isTouch && !isIcon) continue
    const url = resolveHttp(href, baseUrl)
    const target = isTouch && !isIcon ? touchIcons : icons
    if (url && !target.includes(url)) target.push(url)
  }

  return { title: readTitle(head), icons, touchIcons }
}

// codificação do texto: cabeçalho Content-Type, depois <meta charset> nos primeiros bytes; utf-8
// quando nada diz (ou diz algo que o TextDecoder não conhece)
export function detectCharset(contentType: string, head: string): string {
  const candidates = [
    /charset\s*=\s*["']?([\w:.-]+)/i.exec(contentType)?.[1],
    /<meta[^>]+charset\s*=\s*["']?([\w:.-]+)/i.exec(head.slice(0, 2048))?.[1]
  ]
  for (const label of candidates) {
    if (!label) continue
    try {
      return new TextDecoder(label).encoding
    } catch {
      // rótulo desconhecido: tenta o próximo
    }
  }
  return 'utf-8'
}
