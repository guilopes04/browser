// Cache de favicons já convertidos (url -> data URL), com limite de itens e de bytes: numa
// sessão longa, sem limite ele só cresceria. Sai quem foi usado há mais tempo. Puro.
export interface FaviconCache {
  get(url: string): string | undefined
  set(url: string, dataUrl: string): void
  readonly size: number
  readonly bytes: number
}

const MAX_ENTRIES = 200
const MAX_BYTES = 4 * 1024 * 1024

export function createFaviconCache(
  maxEntries = MAX_ENTRIES,
  maxBytes = MAX_BYTES
): FaviconCache {
  // a ordem de inserção do Map é a ordem de uso: o primeiro é o mais antigo
  const entries = new Map<string, string>()
  let bytes = 0

  const drop = (url: string) => {
    bytes -= entries.get(url)?.length ?? 0
    entries.delete(url)
  }

  return {
    get(url) {
      const value = entries.get(url)
      if (value === undefined) return undefined
      entries.delete(url)
      entries.set(url, value)
      return value
    },
    set(url, dataUrl) {
      if (dataUrl.length > maxBytes) return
      if (entries.has(url)) drop(url)
      entries.set(url, dataUrl)
      bytes += dataUrl.length
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries && bytes <= maxBytes) break
        drop(oldest)
      }
    },
    get size() {
      return entries.size
    },
    get bytes() {
      return bytes
    }
  }
}
