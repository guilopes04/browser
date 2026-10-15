// window.api e document de mentira para rodar os módulos da shell no Node. Importe este arquivo
// antes de qualquer módulo de src/renderer (eles leem window.api ao carregar).
import type { Requests } from '@shared/ipc'

type Query = Requests['palette:query']

export interface Fake {
  sent: { channel: string; payload: unknown }[]
  // consultas da paleta em aberto: o teste decide quando e com o que cada uma responde
  queries: {
    req: Query['req']
    resolve(res: Query['res']): void
  }[]
  // o campo da paleta, se houver um
  input: { focus(): void } | null
  focused: number
  reset(): void
}

const fake: Fake = {
  sent: [],
  queries: [],
  input: null,
  focused: 0,
  reset() {
    this.sent = []
    this.queries = []
    this.input = null
    this.focused = 0
  }
}

const g = globalThis as any
g.window = {
  api: {
    send(channel: string, payload: unknown) {
      fake.sent.push({ channel, payload })
    },
    invoke(channel: string, payload: Query['req']) {
      return new Promise(resolve => {
        if (channel === 'palette:query')
          fake.queries.push({ req: payload, resolve })
        else resolve(undefined)
      })
    },
    on() {
      return () => {}
    }
  }
}
g.document = {
  activeElement: null,
  getElementById: () => fake.input
}

export { fake }
