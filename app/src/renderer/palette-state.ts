// Estado local da paleta na shell: texto, escopo, resultados e seleção. Quem abre e fecha é o
// main (palette:show / palette:hide); aqui só o que é digitado e escolhido.
import { computed, signal } from '@preact/signals'
import type {
  PaletteItem,
  PaletteMode,
  PaletteScope,
  PaletteSection
} from '@shared/types'
import { api } from './api'

export const paletteVisible = signal(false)
export const paletteMode = signal<PaletteMode>('search')
export const paletteText = signal('')
// no modo endereço o texto é a URL da aba até a primeira edição: ela não vira consulta
export const paletteTouched = signal(true)
export const paletteScope = signal<PaletteScope>('all')
// null até a primeira resposta do main
export const paletteSections = signal<PaletteSection[] | null>(null)
// o texto a que os resultados em tela respondem (a digitação pode estar à frente)
export const paletteResultText = signal('')
// -1 = nenhuma linha escolhida: no modo endereço, ↵ navega o texto digitado
export const paletteSelected = signal(0)
// sobe a cada abertura: o campo seleciona o texto de novo (⌘L com a paleta já aberta)
export const paletteShowCount = signal(0)

export const paletteItems = computed<PaletteItem[]>(
  () => paletteSections.value?.flatMap(section => section.items) ?? []
)

// o que vira consulta ao main
function queryText(): string {
  return paletteMode.value === 'address' && !paletteTouched.value
    ? ''
    : paletteText.value
}

// respostas fora de ordem (digitação rápida) não podem sobrescrever a mais nova
let requestId = 0
// a consulta cujos resultados estão em tela
let shownId = 0
// ação (↵) que chegou com resultados velhos: roda quando os do texto atual chegarem
let waiting: ((items: PaletteItem[]) => void) | null = null

export function queryPalette(): void {
  const id = ++requestId
  const text = queryText()
  void api
    .invoke('palette:query', { text, scope: paletteScope.value })
    .then(sections => {
      if (id !== requestId || !paletteVisible.value) return
      shownId = id
      paletteSections.value = sections
      paletteResultText.value = text
      const last =
        sections.reduce((sum, item) => sum + item.items.length, 0) - 1
      paletteSelected.value = Math.min(paletteSelected.value, Math.max(last, 0))
      const run = waiting
      waiting = null
      run?.(paletteItems.value)
    })
    .catch(() => {
      if (id === requestId) waiting = null
    })
}

interface ShowPayload {
  mode: PaletteMode
  text: string
  // ausente quando a shell abre a paleta por conta própria (recarregada com ela aberta)
  sections?: PaletteSection[]
}

export function showPalette({ mode, text, sections }: ShowPayload): void {
  paletteVisible.value = true
  paletteMode.value = mode
  paletteText.value = text
  paletteTouched.value = mode === 'search'
  paletteScope.value = 'all'
  paletteSelected.value = mode === 'address' ? -1 : 0
  paletteShowCount.value += 1
  waiting = null
  if (sections) {
    shownId = ++requestId
    paletteSections.value = sections
    paletteResultText.value = queryText()
  } else {
    paletteSections.value = null
    queryPalette()
  }
}

export function hidePalette(): void {
  requestId++
  waiting = null
  paletteVisible.value = false
  paletteSections.value = null
}

export function closePalette(): void {
  api.send('palette:close', {})
}

export function setPaletteText(text: string): void {
  paletteText.value = text
  paletteTouched.value = true
  paletteSelected.value = paletteMode.value === 'address' ? -1 : 0
  waiting = null
  queryPalette()
}

// ⇥: só o espaço atual, ou todos
export function togglePaletteScope(): void {
  paletteScope.value = paletteScope.value === 'all' ? 'current' : 'all'
  paletteSelected.value = paletteMode.value === 'address' ? -1 : 0
  queryPalette()
}

// ↑↓ dão a volta; sem linha escolhida, ↓ vai para a primeira e ↑ para a última
export function movePaletteSelection(delta: number): void {
  const total = paletteItems.value.length
  if (total === 0) return
  const current = paletteSelected.value
  if (current < 0) paletteSelected.value = delta > 0 ? 0 : total - 1
  else paletteSelected.value = (current + delta + total) % total
}

// roda com os itens do texto que está no campo: se a consulta dele ainda não voltou, espera
export function whenResultsReady(run: (items: PaletteItem[]) => void): void {
  if (shownId === requestId) run(paletteItems.value)
  else waiting = run
}
