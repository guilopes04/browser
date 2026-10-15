// Tile de site: favicon real quando há; senão a letra sobre a cor.
interface TileProps {
  size: 18 | 20 | 22 | 24 | 26 | 44
  letter: string
  color: string
  favicon: string | null
  // aba suspensa: 0.45 (sidebar) ou 0.4 (compacto)
  opacity?: number
}

export function Tile({ size, letter, color, favicon, opacity = 1 }: TileProps) {
  return (
    <span
      aria-hidden="true"
      class={`tile tile-${size}`}
      style={{ background: favicon ? 'transparent' : color, opacity }}
    >
      {favicon ? (
        <img class="tile-img" src={favicon} alt="" draggable={false} />
      ) : (
        letter
      )}
    </span>
  )
}
