// O texto selecionado na página (ou dentro de um campo dela), para o ⌘F pré-preencher a busca.
// Roda num mundo isolado: a página não enxerga nem altera o script. Vazio se nada está
// selecionado, se a página não responde ou se ela já foi embora.
import type { WebContents } from 'electron'
import { normalizeFindSelection } from '@shared/find-selection'

const WORLD_ID = 999

const SCRIPT = `(() => {
  try {
    const el = document.activeElement
    if (el && typeof el.selectionStart === 'number' && el.selectionStart !== el.selectionEnd)
      return String(el.value).slice(el.selectionStart, el.selectionEnd)
  } catch {}
  return String(window.getSelection() ?? '')
})()`

export async function readPageSelection(wc: WebContents): Promise<string> {
  try {
    const result: unknown = await wc.executeJavaScriptInIsolatedWorld(
      WORLD_ID,
      [{ code: SCRIPT }]
    )
    return typeof result === 'string' ? normalizeFindSelection(result) : ''
  } catch {
    return ''
  }
}
