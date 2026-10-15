// Lê o favicon (data URL) num canvas pequeno e diz se o glifo é escuro (shared/favicon-tone.ts).
// O resultado fica em cache por endereço: cada favicon é analisado uma vez.
import { useEffect, useState } from 'preact/hooks'
import { isDarkGlyph } from '@shared/favicon-tone'

const SAMPLE = 16
const MAX_CACHED = 300
const cache = new Map<string, boolean>()

function remember(dataUrl: string, dark: boolean): void {
  if (cache.size >= MAX_CACHED)
    cache.delete(cache.keys().next().value as string)
  cache.set(dataUrl, dark)
}

function analyze(dataUrl: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE
        canvas.height = SAMPLE
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(false)
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE)
        resolve(isDarkGlyph(context.getImageData(0, 0, SAMPLE, SAMPLE).data))
      } catch {
        resolve(false)
      }
    }
    image.onerror = () => resolve(false)
    image.src = dataUrl
  })
}

export function useDarkGlyph(favicon: string | null): boolean {
  const [dark, setDark] = useState(() =>
    favicon ? (cache.get(favicon) ?? false) : false
  )
  useEffect(() => {
    if (!favicon) return setDark(false)
    const known = cache.get(favicon)
    if (known !== undefined) return setDark(known)
    let current = true
    void analyze(favicon).then(result => {
      remember(favicon, result)
      if (current) setDark(result)
    })
    return () => {
      current = false
    }
  }, [favicon])
  return dark
}
