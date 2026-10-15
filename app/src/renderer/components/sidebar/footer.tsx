import { DownloadIcon, ExtensionIcon, ShieldIcon } from '../icons'

// até o bloqueador existir, o total do dia é 0
const BLOCKED_TODAY = 0

export function Footer() {
  return (
    <>
      <div class="hairline hairline-footer" />
      <div class="footer">
        <button
          type="button"
          class="footer-btn footer-downloads"
          aria-label="Downloads"
        >
          <DownloadIcon />
        </button>
        <button
          type="button"
          class="footer-btn footer-extensions"
          aria-label="Extensões"
        >
          <ExtensionIcon />
        </button>
        <div class="grow" />
        <span
          class="blocked-today"
          title={`${BLOCKED_TODAY} anúncios e rastreadores bloqueados hoje`}
        >
          <ShieldIcon size={12} />
          <span>{BLOCKED_TODAY}</span>
          <span>bloqueados</span>
        </span>
      </div>
    </>
  )
}
