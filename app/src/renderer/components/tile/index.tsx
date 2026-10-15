// Tile de site: favicon real quando há; senão a letra sobre a cor.
import { useDarkGlyph } from '../../favicon-tone'

interface TileProps {
  size: 18 | 20 | 22 | 24 | 26 | 44
  letter: string
  color: string
  favicon: string | null
  // aba suspensa: 0.45 (sidebar) ou 0.4 (compacto)
  opacity?: number
}

export function Tile({ size, letter, color, favicon, opacity = 1 }: TileProps) {
  // glifo preto (GitHub) no tema escuro ganha um fundo claro (.tile-dark-glyph no CSS)
  const darkGlyph = useDarkGlyph(favicon)
  return (
    <span
      aria-hidden="true"
      class={`tile tile-${size}${darkGlyph ? ' tile-dark-glyph' : ''}`}
      style={{ background: favicon ? undefined : color, opacity }}
    >
      {favicon ? (
        <img class="tile-img" src={favicon} alt="" draggable={false} />
      ) : (
        letter
      )}
    </span>
  )
}
