// Estado da busca na página (⌘F). Puro: sem Electron e sem DOM. O main é o dono do estado e a
// barra (outra view) só o mostra; aqui ficam as transições e o texto do contador.
import type { Theme } from './types'

// idle = sem texto; pending = pedido enviado, sem resposta; done = o Chromium respondeu
export type FindStatus = 'idle' | 'pending' | 'done'

export interface FindState {
  text: string
  // "Aa": diferenciar maiúsculas de minúsculas (a busca começa sem diferenciar)
  matchCase: boolean
  status: FindStatus
  // o resultado mais recente do Chromium
  matches: number
  // posição do destaque ativo, de 1 a matches (0 = nenhum)
  active: number
  // id do pedido em andamento (o retorno de findInPage); resposta de outro id é velha
  requestId: number | null
  // o Chromium tem uma sessão de busca com este texto: só então "seguir" (↵, ⌘G) tem o que seguir.
  // Falso antes da primeira busca, com texto novo e numa página nova
  live: boolean
  // sobe quando o main troca o texto por conta própria (teclas repassadas, seleção da página):
  // a caixa da barra adota o novo texto. O que o usuário digita na caixa não mexe nisto
  textRevision: number
  // sobe a cada ⌘F com a barra já aberta: a caixa foca e seleciona o texto
  focusRevision: number
  // o texto está selecionado na caixa (⌘F de novo, seleção da página): a próxima tecla de texto o
  // substitui. A caixa faz isso sozinha; o main precisa saber para as teclas que ele recebe antes
  // de a caixa existir
  selected: boolean
}

// o que o Chromium devolve em found-in-page
export interface FindResult {
  requestId: number
  activeMatchOrdinal: number
  matches: number
  finalUpdate: boolean
}

// o que a barra recebe (find:state): texto, contador já formatado e as cores do tema e do espaço
export interface FindViewState {
  text: string
  textRevision: number
  focusRevision: number
  matchCase: boolean
  count: string
  theme: Theme
  accent: string
}

export function createFindState(matchCase = false): FindState {
  return {
    text: '',
    matchCase,
    status: 'idle',
    matches: 0,
    active: 0,
    requestId: null,
    live: false,
    textRevision: 0,
    focusRevision: 0,
    selected: false
  }
}

// texto novo: sem texto não há busca; com texto, a resposta anterior segue à mostra até a nova
// chegar (o contador não pisca a cada tecla)
function withText(state: FindState, text: string): FindState {
  if (text === '')
    return {
      ...state,
      text,
      status: 'idle',
      matches: 0,
      active: 0,
      requestId: null,
      live: false
    }
  return { ...state, text, status: 'pending', live: false }
}

// o usuário digitou na caixa: ela já tem o texto
export function typeFindText(state: FindState, text: string): FindState {
  return { ...withText(state, text), selected: false }
}

// o main trocou o texto: a caixa precisa adotá-lo
export function replaceFindText(state: FindState, text: string): FindState {
  return {
    ...withText(state, text),
    textRevision: state.textRevision + 1,
    selected: false
  }
}

export function setFindMatchCase(
  state: FindState,
  matchCase: boolean
): FindState {
  if (state.matchCase === matchCase) return state
  return {
    ...state,
    matchCase,
    status: state.text === '' ? 'idle' : 'pending',
    live: false
  }
}

// a caixa foca e seleciona o texto
export function focusFind(state: FindState): FindState {
  return { ...state, focusRevision: state.focusRevision + 1, selected: true }
}

export function beginFindRequest(
  state: FindState,
  requestId: number
): FindState {
  return { ...state, status: 'pending', requestId, live: true }
}

// a página mudou (navegação): o que se sabia dela não vale mais
export function resetFindResults(state: FindState): FindState {
  return {
    ...state,
    status: state.text === '' ? 'idle' : 'pending',
    matches: 0,
    active: 0,
    requestId: null,
    live: false
  }
}

// devolve o próprio estado quando a resposta é velha (outro pedido) ou não muda nada
export function applyFindResult(
  state: FindState,
  result: FindResult
): FindState {
  if (state.text === '' || result.requestId !== state.requestId) return state
  const matches = Math.max(0, result.matches)
  // resposta parcial pode vir sem posição ativa: fica a anterior, dentro do total
  const active =
    matches === 0
      ? 0
      : result.activeMatchOrdinal > 0
        ? Math.min(result.activeMatchOrdinal, matches)
        : Math.min(Math.max(state.active, 1), matches)
  const status: FindStatus = result.finalUpdate ? 'done' : state.status
  if (
    matches === state.matches &&
    active === state.active &&
    status === state.status
  )
    return state
  return { ...state, matches, active, status }
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

// "1 de 3", "Nenhum resultado", ou vazio (sem texto, ou ainda sem resposta)
export function formatFindCount(state: FindState): string {
  if (state.text === '') return ''
  if (state.matches > 0)
    return `${formatNumber(state.active)} de ${formatNumber(state.matches)}`
  return state.status === 'done' ? 'Nenhum resultado' : ''
}

export function toFindViewState(
  state: FindState,
  theme: Theme,
  accent: string
): FindViewState {
  return {
    text: state.text,
    textRevision: state.textRevision,
    focusRevision: state.focusRevision,
    matchCase: state.matchCase,
    count: formatFindCount(state),
    theme,
    accent
  }
}
