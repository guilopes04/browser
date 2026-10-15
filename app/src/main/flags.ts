// Flags de linha de comando (docs/arquitetura.md, seção 3 e 6).
import type { Rect } from '@shared/types'

// o que --captura* fotografa: a janela como está, a paleta aberta, uma Nova aba ativa ou a barra de
// busca aberta com uma consulta
export type CaptureScene = 'window' | 'palette' | 'new-tab' | 'find'

export interface Flags {
  // caminho de um JSON no formato de bench/tabs.json (ou o próprio JSON inline)
  tabsSource: string | null
  loadAll: boolean
  // vale só nesta execução e nunca vai para o session.json. null = usa as configurações; 0 = nunca
  suspendAfterMs: number | null
  // null = segue o macOS (exceto com --captura, que fixa o claro para a imagem ser comparável)
  theme: 'light' | 'dark' | 'system' | null
  window: Partial<Rect>
  capturePath: string | null
  captureScene: CaptureScene
  captureDelayMs: number
  // texto que a paleta mostra ao abrir na captura (padrão: vazio)
  paletteQuery: string
  // texto que a barra de busca procura na captura (padrão: "a")
  findQuery: string
  dev: boolean
  // pasta de downloads trocada (testes: nunca escrever em ~/Downloads). null = a do sistema
  downloadsDir: string | null
}

const DEFAULT_FIND_QUERY = 'a'

// aceita "--nome=valor" e "--nome valor"
function readValue(argv: string[], name: string): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3)
    if (arg === `--${name}`) {
      const next = argv[i + 1]
      return next !== undefined && !next.startsWith('--') ? next : ''
    }
  }
  return null
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.some(arg => arg === `--${name}` || arg.startsWith(`--${name}=`))
}

function readNumber(argv: string[], name: string): number | undefined {
  const value = readValue(argv, name)
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

// número puro = segundos (docs/arquitetura.md: --suspender-apos=<segundos>); "5s" = segundos;
// "500ms" = milissegundos; "2min" = minutos. Devolve milissegundos
export function parseDuration(text: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|min)?$/i.exec(text.trim())
  if (!match) return null
  const value = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()
  if (unit === 'ms') return value
  if (unit === 'min') return value * 60_000
  return value * 1000
}

function parseTheme(value: string | null, capturing: boolean): Flags['theme'] {
  if (value === 'claro') return 'light'
  if (value === 'escuro') return 'dark'
  if (value === 'sistema') return 'system'
  return capturing ? 'light' : null
}

function readWindow(argv: string[]): Partial<Rect> {
  const result: Partial<Rect> = {}
  const combined = readValue(argv, 'janela')
  if (combined) {
    const [x, y, width, height] = combined.split(',').map(Number)
    if ([x, y, width, height].every(Number.isFinite))
      Object.assign(result, { x, y, width, height })
  }
  const width = readNumber(argv, 'largura')
  const height = readNumber(argv, 'altura')
  const x = readNumber(argv, 'x')
  const y = readNumber(argv, 'y')
  if (width !== undefined) result.width = width
  if (height !== undefined) result.height = height
  if (x !== undefined) result.x = x
  if (y !== undefined) result.y = y
  return result
}

export function parseFlags(argv: string[]): Flags {
  const suspend = readValue(argv, 'suspender-apos')
  const delay = readNumber(argv, 'captura-atraso')
  const windowCapture = readValue(argv, 'captura') || null
  const paletteCapture = readValue(argv, 'captura-paleta') || null
  const newTabCapture = readValue(argv, 'captura-nova-aba') || null
  const findCapture = readValue(argv, 'captura-busca') || null
  const capturePath =
    paletteCapture ?? newTabCapture ?? findCapture ?? windowCapture
  const captureScene: CaptureScene = paletteCapture
    ? 'palette'
    : newTabCapture
      ? 'new-tab'
      : findCapture
        ? 'find'
        : 'window'
  return {
    tabsSource: readValue(argv, 'abas') || null,
    loadAll: hasFlag(argv, 'carregar-todas'),
    suspendAfterMs: suspend ? parseDuration(suspend) : null,
    theme: parseTheme(readValue(argv, 'tema'), capturePath !== null),
    window: readWindow(argv),
    capturePath,
    captureScene,
    captureDelayMs: delay ?? 1500,
    paletteQuery: readValue(argv, 'paleta-consulta') ?? '',
    findQuery: readValue(argv, 'busca-consulta') || DEFAULT_FIND_QUERY,
    dev: hasFlag(argv, 'dev'),
    downloadsDir: readValue(argv, 'pasta-downloads') || null
  }
}
