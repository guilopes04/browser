// Dica ao passar o mouse nos botões do modo compacto. A dica invade o painel da página, então
// a shell sobe por cima dele enquanto ela aparece (shell:raise, motivo 'tooltip').
import { signal } from '@preact/signals'
import { api } from './api'

export interface Tip {
  label: string
  keys?: string
  // centro vertical e borda esquerda, em px da shell
  top: number
  left: number
}

const SHOW_DELAY_MS = 350
// ao passar de um botão para outro, o mouseleave de um vem antes do mouseenter do outro: a
// saída espera um instante para a dica trocar de texto sem sumir e voltar
const HIDE_DELAY_MS = 80
const GAP_PX = 12

export const tip = signal<Tip | null>(null)
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

export function showTip(target: HTMLElement, label: string, keys?: string) {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  const place = () => {
    const rect = target.getBoundingClientRect()
    const wasShown = tip.value !== null
    tip.value = {
      label,
      keys,
      top: rect.top + rect.height / 2,
      left: rect.right + GAP_PX
    }
    if (!wasShown) api.send('shell:raise', { reason: 'tooltip', on: true })
  }
  // já existe uma dica na tela: a troca é imediata
  if (tip.value) place()
  else showTimer = setTimeout(place, SHOW_DELAY_MS)
}

function hideNow() {
  if (!tip.value) return
  tip.value = null
  api.send('shell:raise', { reason: 'tooltip', on: false })
}

export function hideTip() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hideNow, HIDE_DELAY_MS)
}

// ao sair do modo compacto: some na hora
export function resetTip() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideNow()
}
