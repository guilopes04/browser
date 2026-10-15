// Um favicon de glifo escuro (o gato preto do GitHub) some sobre a sidebar escura. Esta é a conta
// que decide se o ícone precisa de um fundo claro: a luminância média dos pixels visíveis. Pura.

// abaixo disto o pixel é quase transparente e não conta
const MIN_ALPHA = 0.4
// um ícone com menos de 4% de pixels visíveis é quase vazio: nada a decidir
const MIN_COVERAGE = 0.04
// luminância média (0 a 1) abaixo da qual o glifo some em fundo escuro: o preto do GitHub fica
// perto de 0,16; o vermelho do YouTube e do Netflix (cerca de 0,22) se vê bem e não ganha fundo
const DARK_LIMIT = 0.2

// rgba: pixels de um ImageData (4 valores por pixel, de 0 a 255)
export function isDarkGlyph(rgba: ArrayLike<number>): boolean {
  const pixels = Math.floor(rgba.length / 4)
  if (pixels === 0) return false
  let visible = 0
  let sum = 0
  for (let i = 0; i < pixels; i++) {
    const alpha = rgba[i * 4 + 3] / 255
    if (alpha < MIN_ALPHA) continue
    const luminance =
      (0.2126 * rgba[i * 4] +
        0.7152 * rgba[i * 4 + 1] +
        0.0722 * rgba[i * 4 + 2]) /
      255
    visible++
    sum += luminance
  }
  if (visible / pixels < MIN_COVERAGE) return false
  return sum / visible < DARK_LIMIT
}
