// Ícones de 24 px das linhas da paleta (Paleta.dc.html: relógio, mais e lupa; os demais seguem o
// mesmo traço de 1.6).
import type { ComponentChildren } from 'preact'
import type { CommandId } from '@shared/types'

export type RowIconName =
  | 'clock'
  | 'plus'
  | 'search'
  | 'close'
  | 'reopen'
  | 'reload'
  | 'sidebar'
  | 'moon'
  | 'space'

const SHAPES: Record<RowIconName, ComponentChildren> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  plus: <path d="M12 6v12M6 12h12" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  close: <path d="m7.5 7.5 9 9M16.5 7.5l-9 9" />,
  reopen: <path d="M9 6 5.5 9.5 9 13M5.5 9.5H13a5 5 0 0 1 0 10h-4" />,
  reload: <path d="M18 12a6 6 0 1 1-1.8-4.3M18 5.5V9h-3.5" />,
  sidebar: (
    <>
      <rect x="4" y="5.5" width="16" height="13" rx="2.5" />
      <path d="M9.5 5.5v13" />
    </>
  ),
  moon: (
    <path d="M19.5 14.25A8.25 8.25 0 1 1 9.75 4.5a6.75 6.75 0 0 0 9.75 9.75Z" />
  ),
  space: <path d="M7 9h10l-3-3M17 15H7l3 3" />
}

export function getCommandIcon(command: CommandId): RowIconName {
  if (command === 'new-tab') return 'plus'
  if (command === 'close-tab') return 'close'
  if (command === 'reopen-tab') return 'reopen'
  if (command === 'reload') return 'reload'
  if (command === 'toggle-sidebar') return 'sidebar'
  if (command === 'suspend-tab') return 'moon'
  return 'space'
}

export function RowIcon({ name }: { name: RowIconName }) {
  return (
    <svg
      aria-hidden="true"
      class="pal-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {SHAPES[name]}
    </svg>
  )
}
