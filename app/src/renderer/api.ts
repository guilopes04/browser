// Wrapper tipado de window.api (o preload só repassa os canais de shared/ipc.ts).
import type { Commands, Events, Requests } from '@shared/ipc'

interface Api {
  send<K extends keyof Commands>(channel: K, payload: Commands[K]): void
  invoke<K extends keyof Requests>(
    channel: K,
    payload: Requests[K]['req']
  ): Promise<Requests[K]['res']>
  on<K extends keyof Events>(
    channel: K,
    callback: (payload: Events[K]) => void
  ): () => void
}

declare global {
  interface Window {
    api: Api
  }
}

export const api: Api = window.api
