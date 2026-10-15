import type { PaletteItem } from '@shared/types'

export interface PaletteRowProps {
  item: PaletteItem
  index: number
  selected: boolean
  // consulta vazia: abas recentes (uma linha, com o nome do espaço) e ações sem ícone
  compact: boolean
}
