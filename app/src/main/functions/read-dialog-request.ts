// A mensagem do preload das abas (guard:dialog) chega do renderer da página: nada dela é de
// confiança. Valida o tipo e limita o tamanho dos textos.
export type DialogKind = 'alert' | 'confirm' | 'prompt'

export interface DialogRequest {
  kind: DialogKind
  message: string
  fallback: string
}

// uma mensagem de 10 MB não vira um diálogo de 10 MB
const MAX_MESSAGE = 2000

export function readDialogRequest(payload: unknown): DialogRequest | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { kind, message, fallback } = payload as Record<string, unknown>
  if (kind !== 'alert' && kind !== 'confirm' && kind !== 'prompt') return null
  return {
    kind,
    message: typeof message === 'string' ? message.slice(0, MAX_MESSAGE) : '',
    fallback: typeof fallback === 'string' ? fallback.slice(0, MAX_MESSAGE) : ''
  }
}

// o retorno que o preload entrega à página quando não há resposta do usuário
export function defaultAnswer(kind: DialogKind): boolean | null {
  return kind === 'confirm' ? false : null
}
