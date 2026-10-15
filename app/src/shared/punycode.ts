// Punycode (RFC 3492), só a decodificação: o endereço mostra "xn--e1afmkfd" como a pessoa o lê,
// quando o nome é seguro (ver idn-host.ts). Pura.

const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const MAX_INT = 0x7fffffff

function adapt(delta: number, points: number, first: boolean): number {
  let value = first ? Math.floor(delta / DAMP) : delta >> 1
  value += Math.floor(value / points)
  let k = 0
  while (value > ((BASE - T_MIN) * T_MAX) >> 1) {
    value = Math.floor(value / (BASE - T_MIN))
    k += BASE
  }
  return k + Math.floor(((BASE - T_MIN + 1) * value) / (value + SKEW))
}

// 0 a 35 para a-z, A-Z e 0-9; BASE para o resto
function digitOf(code: number): number {
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 26
  if (code >= 0x41 && code <= 0x5a) return code - 0x41
  if (code >= 0x61 && code <= 0x7a) return code - 0x61
  return BASE
}

// null quando o texto não é punycode válido
export function decodePunycode(input: string): string | null {
  const output: number[] = []
  const basic = Math.max(0, input.lastIndexOf('-'))
  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j)
    if (code >= 0x80) return null
    output.push(code)
  }

  let n = INITIAL_N
  let i = 0
  let bias = INITIAL_BIAS
  let index = basic > 0 ? basic + 1 : 0
  while (index < input.length) {
    const previous = i
    for (let weight = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) return null
      const digit = digitOf(input.charCodeAt(index++))
      if (digit >= BASE) return null
      if (digit > Math.floor((MAX_INT - i) / weight)) return null
      i += digit * weight
      const threshold = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias
      if (digit < threshold) break
      if (weight > Math.floor(MAX_INT / (BASE - threshold))) return null
      weight *= BASE - threshold
    }
    const length = output.length + 1
    bias = adapt(i - previous, length, previous === 0)
    if (Math.floor(i / length) > MAX_INT - n) return null
    n += Math.floor(i / length)
    i %= length
    if (n > 0x10ffff) return null
    output.splice(i++, 0, n)
  }
  try {
    return String.fromCodePoint(...output)
  } catch {
    return null
  }
}

// "xn--..." -> texto; qualquer outra coisa (ou punycode inválido) -> null
export function decodeIdnLabel(label: string): string | null {
  if (!/^xn--/i.test(label) || label.length > 63) return null
  return decodePunycode(label.slice(4).toLowerCase())
}
