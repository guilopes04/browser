import { useEffect } from 'preact/hooks'
import { describeDownload } from '@shared/describe-download'
import { api } from '../../api'
import {
  closeExtensions,
  extensionsOpen,
  toggleExtensions
} from '../../extensions-popover'
import { snapshot } from '../../state'
import { DownloadIcon, ExtensionIcon, ShieldIcon } from '../icons'

// até o bloqueador existir, o total do dia é 0
const BLOCKED_TODAY = 0

// fecha o popover com esc ou com um clique fora dele (e fora do botão que o abre)
function useDismissOnOutside(open: boolean) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.popover, .footer-extensions')) return
      closeExtensions()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeExtensions()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
}

export function Footer() {
  const download = describeDownload(snapshot.value?.downloads)
  const cleared = snapshot.value?.clearedData ?? null
  const extensions = extensionsOpen.value
  useDismissOnOutside(extensions)

  return (
    <>
      <div class="hairline hairline-footer" />
      <div class="footer">
        <button
          type="button"
          class="footer-btn footer-downloads"
          data-tone={download.tone}
          aria-label={download.label}
          title={download.label}
          onClick={() => api.send('downloads:open', {})}
        >
          <DownloadIcon />
          {download.text && (
            <span class="footer-downloads-text">{download.text}</span>
          )}
        </button>
        <button
          type="button"
          class="footer-btn footer-extensions"
          aria-label="Extensões"
          aria-expanded={extensions}
          onClick={toggleExtensions}
        >
          <ExtensionIcon />
        </button>
        <div class="grow" />
        {cleared ? (
          <span
            class="blocked-today footer-notice"
            role="status"
            title="Cookies, cache, dados dos sites, histórico e abas fechadas deste espaço foram apagados"
          >
            <ShieldIcon size={12} />
            <span>Dados limpos</span>
          </span>
        ) : (
          <span
            class="blocked-today"
            title={`${BLOCKED_TODAY} anúncios e rastreadores bloqueados hoje`}
          >
            <ShieldIcon size={12} />
            <span>{BLOCKED_TODAY}</span>
            <span>bloqueados</span>
          </span>
        )}
      </div>
      {extensions && (
        <div class="popover" role="dialog" aria-label="Extensões">
          <span class="popover-caret" aria-hidden="true" />
          <div class="popover-title">Extensões</div>
          <div class="popover-body">Extensões chegam na próxima versão</div>
        </div>
      )}
    </>
  )
}
