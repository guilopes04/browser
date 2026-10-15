// Endereço como a pessoa lê: as sequências %XX que formam letras fora do ASCII (acentos, cedilha,
// ideogramas) aparecem decodificadas; a URL real da aba não muda. Pura.
//
// Só decodifica o que o Chrome também decodifica: os bytes altos de UTF-8. %20, %25, %2F e afins
// ficam como estão, porque decodificá-los mudaria o endereço que se lê de volta (%2541 virar
// %41, por exemplo). A sequência que não forma UTF-8 válido, ou que decodifica para um caractere
// de controle ou de direção de texto (que serviria para disfarçar o endereço), fica codificada.

const HIGH_BYTES = /(?:%[89a-f][0-9a-f])+/gi

// faixas de code points que nunca aparecem decodificadas: controles C0 e C1, hífen suave, marca de
// letra árabe, separador mongol, espaços de largura zero e marcas de direção, separadores de
// linha e de parágrafo, controles de direção, formatação invisível, BOM e anotações
const HIDDEN_RANGES: [number, number][] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x061c, 0x061c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffd]
]

function hasHidden(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to))
      return true
  }
  return false
}

export function displayUrl(url: string): string {
  if (!url.includes('%')) return url
  return url.replace(HIGH_BYTES, run => {
    try {
      const decoded = decodeURIComponent(run)
      return hasHidden(decoded) ? run : decoded
    } catch {
      // bytes que não formam UTF-8 válido
      return run
    }
  })
}
