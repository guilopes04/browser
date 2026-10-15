// ⌘K e ⌘L: a shell sobe por cima da janela e desenha a paleta (docs/arquitetura.md, seção 1). O
// foco vai para a shell; ao fechar, volta para a página. A shell já recebe as seções do texto,
// então o primeiro quadro com a caixa não espera uma ida e volta de consulta.
import type { PaletteMode } from '@shared/types'
import type { MainContext } from '../context'
import { applyLayout } from '../functions/apply-layout'
import { isPaletteOpen } from '../functions/is-palette-open'
import { openKeyGate } from '../functions/key-gate'
import { queryPalette } from '../functions/query-palette'

// mode 'search' (⌘K): text é a consulta inicial. mode 'address' (⌘L): o texto é a URL da aba ativa
// (a shell a mostra selecionada) e as seções são as da consulta vazia, até a primeira edição.
// Com a paleta já aberta, só troca o modo e o texto
export function openPalette(
  ctx: MainContext,
  mode: PaletteMode = 'search',
  text = ''
): void {
  // com o vídeo em tela cheia a página ocupa a janela e a sidebar nem existe
  if (ctx.store.state.fullscreen) return
  if (!isPaletteOpen(ctx)) {
    if (!ctx.store.setOverlay('palette', true)) return
    applyLayout(ctx)
  }
  ctx.shell.webContents.focus()
  openKeyGate(ctx, { kind: 'palette' })
  const shown =
    mode === 'address' ? (ctx.store.getActiveTab()?.url ?? '') : text
  ctx.broadcaster.send('palette:show', {
    mode,
    text: shown,
    sections: queryPalette(ctx, mode === 'address' ? '' : shown, 'all')
  })
  // a primeira tecla vai pedir o histórico: prepara-o depois do primeiro quadro, não antes
  setImmediate(() => ctx.history.warm())
}
