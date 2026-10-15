// Estado da barra de busca na shell dela: o que o main manda (find:state). Sem lógica: o texto, o
// contador e o "Aa" são do main; aqui só o espelho e o que vai de volta.
import { signal } from '@preact/signals'
import type { FindViewState } from '@shared/find-state'
import { api } from './api'

// null até o main mandar o primeiro estado (a barra nasce invisível)
export const findView = signal<FindViewState | null>(null)

export function startFindSync(): void {
  api.on('find:state', next => {
    findView.value = next
  })
}

// a caixa já existe e tem o foco: o main deixa de repassar as teclas e manda o estado
export function sendFindReady(): void {
  api.send('find:ready', {})
}

export function sendFindText(text: string): void {
  api.send('find:text', { text })
}

export function stepFind(forward: boolean): void {
  api.send('find:step', { forward })
}

export function setFindCase(matchCase: boolean): void {
  api.send('find:case', { matchCase })
}

export function closeFind(): void {
  api.send('find:close', {})
}
