import { tip } from '../../tip'

// dica do botão sob o ponteiro (ModoCompacto.dc.html)
export function Tooltip() {
  const current = tip.value
  if (!current) return null

  return (
    <div
      class="tooltip"
      role="tooltip"
      style={{ top: `${current.top}px`, left: `${current.left}px` }}
    >
      <span class="tooltip-label">{current.label}</span>
      {current.keys && <span class="tooltip-keys">{current.keys}</span>}
    </div>
  )
}
