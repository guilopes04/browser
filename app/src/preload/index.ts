// Só expõe send, invoke e on com os canais da lista. Sem lógica.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { COMMAND_CHANNELS, EVENT_CHANNELS, REQUEST_CHANNELS } from '@shared/ipc'

const commands: readonly string[] = COMMAND_CHANNELS
const requests: readonly string[] = REQUEST_CHANNELS
const events: readonly string[] = EVENT_CHANNELS

contextBridge.exposeInMainWorld('api', {
  send(channel: string, payload: unknown): void {
    if (!commands.includes(channel))
      throw new Error(`canal de comando inválido: ${channel}`)
    ipcRenderer.send(channel, payload)
  },
  invoke(channel: string, payload: unknown): Promise<unknown> {
    if (!requests.includes(channel))
      throw new Error(`canal de consulta inválido: ${channel}`)
    return ipcRenderer.invoke(channel, payload)
  },
  on(channel: string, callback: (payload: unknown) => void): () => void {
    if (!events.includes(channel))
      throw new Error(`canal de evento inválido: ${channel}`)
    const listener = (_event: IpcRendererEvent, payload: unknown) =>
      callback(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
})
