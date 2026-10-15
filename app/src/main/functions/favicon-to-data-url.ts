// Baixa o favicon pela sessão do espaço e devolve um data URL: PNG/JPEG/WebP/GIF viram PNG de
// 32 px; ICO e SVG (que o nativeImage não lê no macOS) passam como vieram, se forem pequenos,
// porque a <img> da shell sabe desenhar os dois.
import { nativeImage, type Session } from 'electron'
import { createFaviconCache } from './favicon-cache'
import { sniffRawImageType } from './sniff-raw-image'

const SIZE = 32
const TIMEOUT_MS = 5000
const MAX_BYTES = 512 * 1024
// ICO e SVG vão para o session.json sem reduzir, então o limite é bem menor
const MAX_RAW_BYTES = 48 * 1024

const cache = createFaviconCache()

function sizeHint(url: string): number {
  const match = /(\d{2,3})x\1/.exec(url) ?? /-(\d{2,3})\./.exec(url)
  return match ? Number(match[1]) : 0
}

function isSupported(url: string): boolean {
  return /^https?:|^data:image\/(png|jpeg)/.test(url)
}

async function download(ses: Session, url: string): Promise<string | null> {
  const cached = cache.get(url)
  if (cached) return cached
  try {
    // favicon não precisa de cookie: sem eles, nada do espaço vaza para o site do ícone
    const response = await ses.fetch(url, {
      credentials: 'omit',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? ''
    const isRaster = /image\/(png|jpe?g|webp|gif)/i.test(type)
    const isRawCandidate =
      /image\/(svg\+xml|x-icon|vnd\.microsoft\.icon)|octet-stream|text\/(plain|xml)/i.test(
        type
      )
    if (!isRaster && !isRawCandidate) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null
    const image = nativeImage.createFromBuffer(buffer)
    if (image.isEmpty()) {
      const rawType = sniffRawImageType(type, buffer)
      if (!rawType || buffer.length > MAX_RAW_BYTES) return null
      const raw = `data:${rawType};base64,${buffer.toString('base64')}`
      cache.set(url, raw)
      return raw
    }
    const { width, height } = image.getSize()
    const scaled =
      width > SIZE || height > SIZE
        ? image.resize({ width: SIZE, height: SIZE, quality: 'best' })
        : image
    const dataUrl = scaled.toDataURL()
    cache.set(url, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

export async function faviconToDataUrl(
  ses: Session,
  candidates: string[]
): Promise<string | null> {
  // maiores primeiro (apple-touch, 180x180); a ordem original desempata
  const ordered = candidates
    .filter(isSupported)
    .map((url, index) => ({ url, index, hint: sizeHint(url) }))
    .sort((a, b) => b.hint - a.hint || a.index - b.index)
    .slice(0, 3)
  for (const { url } of ordered) {
    const result = await download(ses, url)
    if (result) return result
  }
  return null
}
