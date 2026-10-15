// Nome de domínio internacional (IDN) como a pessoa o lê, sem abrir porta para o disfarce de
// endereço (apple.com escrito com um "а" cirílico). O URL do navegador já traz o host em punycode
// (xn--...). Cada rótulo só aparece em Unicode quando:
// - todas as letras são de um único script (o ASCII conta como latim; dígitos e hífen não contam),
//   com as misturas legítimas do japonês, do coreano e do chinês (han com kana, hangul, bopomofo);
// - não tem controle de direção, invisível nem caractere de formatação;
// - não é só de letras que se parecem com as latinas (cirílico ou grego que imita um nome em
//   latim, como "аррӏе").
// Do contrário, fica em punycode, que é o que o servidor também vê. Puro.
import { hasHiddenChars } from './display-url'
import { decodeIdnLabel } from './punycode'

const SCRIPTS = [
  'Latin',
  'Greek',
  'Cyrillic',
  'Armenian',
  'Hebrew',
  'Arabic',
  'Syriac',
  'Thaana',
  'Devanagari',
  'Bengali',
  'Gurmukhi',
  'Gujarati',
  'Oriya',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Sinhala',
  'Thai',
  'Lao',
  'Tibetan',
  'Myanmar',
  'Georgian',
  'Hangul',
  'Ethiopic',
  'Khmer',
  'Mongolian',
  'Hiragana',
  'Katakana',
  'Bopomofo',
  'Han'
] as const

const SCRIPT_TESTS = SCRIPTS.map(
  name => [name, new RegExp(`^\\p{Script=${name}}$`, 'u')] as const
)
// dígito, hífen, ponto e marcas combinantes não pertencem a um script só
const NEUTRAL = /^[\p{Script=Common}\p{Script=Inherited}]$/u

// combinações que um mesmo nome legítimo usa (UTS 39, "Moderately Restrictive")
const ALLOWED_MIXES: readonly (readonly string[])[] = [
  ['Han', 'Hiragana', 'Katakana'],
  ['Han', 'Hangul'],
  ['Han', 'Bopomofo']
]

// letras de outros scripts que se confundem com uma letra latina (em escapes para ficarem
// legíveis: a e i j o p c x y s d h q w l, no cirílico; a v o p e i k t u, no grego)
const LATIN_LOOKALIKES: Record<string, ReadonlySet<string>> = {
  Cyrillic: new Set(
    '\u0430\u0435\u0456\u0458\u043e\u0440\u0441\u0445\u0443\u0455\u0501\u04bb\u051b\u051d\u04cf'
  ),
  Greek: new Set('\u03b1\u03bd\u03bf\u03c1\u03b5\u03b9\u03ba\u03c4\u03c5')
}

function scriptOf(char: string): string | null {
  // ASCII é latim (a, z), exceto o que é neutro (dígito, hífen)
  for (const [name, test] of SCRIPT_TESTS) if (test.test(char)) return name
  return null
}

// true: o rótulo em Unicode não engana
export function isSafeIdnLabel(label: string): boolean {
  if (label === '' || hasHiddenChars(label)) return false
  const scripts = new Set<string>()
  const chars = [...label]
  for (const char of chars) {
    if (NEUTRAL.test(char)) continue
    const script = scriptOf(char)
    // script que a lista não conhece: na dúvida, punycode
    if (!script) return false
    scripts.add(script)
  }
  if (scripts.size > 1) {
    const ok = ALLOWED_MIXES.some(mix =>
      [...scripts].every(s => mix.includes(s))
    )
    if (!ok) return false
  }
  if (scripts.size === 1) {
    const [script] = [...scripts]
    const lookalikes = LATIN_LOOKALIKES[script]
    const letters = chars.filter(char => !NEUTRAL.test(char))
    if (lookalikes && letters.every(char => lookalikes.has(char))) return false
  }
  return true
}

// um rótulo de host: "xn--..." vira Unicode se for seguro; o resto fica como está
export function displayIdnLabel(label: string): string {
  const decoded = decodeIdnLabel(label)
  return decoded !== null && isSafeIdnLabel(decoded) ? decoded : label
}

// o host inteiro (rótulos separados por ponto)
export function displayHostname(hostname: string): string {
  return hostname.split('.').map(displayIdnLabel).join('.')
}
