// Lê o formato de bench/tabs.json: { janela?: {...}, abas: string[] }.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Rect } from '@shared/types'

export interface TabsFile {
  urls: string[]
  window: Partial<Rect>
}

interface RawTabsFile {
  janela?: { largura?: number; altura?: number; x?: number; y?: number }
  abas?: unknown
}

export function readTabsFile(source: string): TabsFile | null {
  try {
    const text = /^\s*[{[]/.test(source)
      ? source
      : readFileSync(resolve(source), 'utf8')
    const parsed = JSON.parse(text) as RawTabsFile | unknown[]
    const raw: RawTabsFile = Array.isArray(parsed) ? { abas: parsed } : parsed
    const urls = Array.isArray(raw.abas)
      ? raw.abas.filter(
          (url): url is string => typeof url === 'string' && url !== ''
        )
      : []
    const win: Partial<Rect> = {}
    if (raw.janela) {
      if (typeof raw.janela.largura === 'number') win.width = raw.janela.largura
      if (typeof raw.janela.altura === 'number') win.height = raw.janela.altura
      if (typeof raw.janela.x === 'number') win.x = raw.janela.x
      if (typeof raw.janela.y === 'number') win.y = raw.janela.y
    }
    return { urls, window: win }
  } catch (error) {
    console.error('[Flags][readTabsFile] não foi possível ler --abas', error)
    return null
  }
}
