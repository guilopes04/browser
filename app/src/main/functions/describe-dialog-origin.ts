// "127.0.0.1:9601 diz:": a origem que o diálogo mostra, tirada do quadro que o chamou (dado do
// Chromium, não da página). Sem origem útil (quadro opaco, arquivo local), um texto genérico.
export interface FrameOrigin {
  origin: string
  url: string
}

function hostOf(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'file:') return 'Arquivo local'
    return parsed.host || null
  } catch {
    return null
  }
}

export function describeDialogOrigin(frame: FrameOrigin | null): string {
  if (!frame) return 'Este site'
  // origem opaca ("null"): sandbox, data:. O endereço do quadro ainda diz de onde veio
  return hostOf(frame.origin) ?? hostOf(frame.url) ?? 'Este site'
}
