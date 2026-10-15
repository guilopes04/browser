// Título de página para exibir: controles C0/C1 e marcas bidi (sobreposição, isolamento e as marcas
// invisíveis LRM, RLM e ALM) viram espaço. Uma página não pode inverter o texto da sidebar (RLO)
// nem esconder o domínio com quebras de linha e caracteres invisíveis. Puro.

// C0 (inclui tab e quebras de linha), DEL e C1; as marcas de direção invisíveis U+200E (LRM),
// U+200F (RLM) e U+061C (ALM); U+2028 e U+2029 (separadores de linha e parágrafo); U+202A-202E
// (LRE RLE PDF LRO RLO) e U+2066-2069 (LRI RLI FSI PDI)
// com os espaços comuns em volta, para "a \n b" virar "a b" e não "a   b"
const UNSAFE =
  / *[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]+ */g

export function sanitizeTitle(title: string): string {
  return title.replace(UNSAFE, ' ').trim()
}
