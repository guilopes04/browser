// Aviso de tela cheia. A shell encolhe para a faixa dele (main/functions/compute-layout.ts), então
// este componente é tudo o que ela desenha enquanto o aviso está na tela.
import { FULLSCREEN_NOTICE_TEXT } from '@shared/tokens'

export function FullscreenNotice() {
  return (
    <div class="fullscreen-notice" role="status">
      {FULLSCREEN_NOTICE_TEXT}
    </div>
  )
}
