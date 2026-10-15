// Ações (comandos), "Abrir ... em nova aba" (⌘↵) e "Buscar ... na web" (⌥↵)
import { Kbd } from './kbd'
import { getCommandIcon, RowIcon } from './row-icon'
import type { PaletteRowProps } from './types'

export function ActionRow({ item, compact }: PaletteRowProps) {
  if (item.kind === 'action') {
    return (
      <>
        {!compact && <RowIcon name={getCommandIcon(item.command)} />}
        <span class={compact ? 'pal-title pal-title-indent' : 'pal-title'}>
          {item.label}
        </span>
        <Kbd keys={item.keys} />
      </>
    )
  }
  if (item.kind === 'open-url') {
    return (
      <>
        <RowIcon name="plus" />
        <span class="pal-title">Abrir {item.label} em nova aba</span>
        <Kbd keys="⌘↵" />
      </>
    )
  }
  if (item.kind === 'web-search') {
    return (
      <>
        <RowIcon name="search" />
        <span class="pal-title">Buscar “{item.text}” na web</span>
        <Kbd keys="⌥↵" />
      </>
    )
  }
  return null
}
