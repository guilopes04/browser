// O que o ícone de Downloads da sidebar mostra, em português. Puro.
import type { DownloadStatus } from './types'

export type DownloadTone = 'idle' | 'progress' | 'done' | 'failed'

export interface DownloadLabel {
  tone: DownloadTone
  // ao lado do ícone; null = só o ícone
  text: string | null
  // rótulo de acessibilidade e dica do botão
  label: string
}

export function describeDownload(
  status: DownloadStatus | null | undefined
): DownloadLabel {
  if (!status) return { tone: 'idle', text: null, label: 'Downloads' }

  if (status.active > 0) {
    const percent = status.percent
    return {
      tone: 'progress',
      text: percent === null ? '…' : `${percent}%`,
      label:
        percent === null
          ? 'Baixando arquivo'
          : `Baixando arquivo: ${percent}% concluído`
    }
  }
  if (status.lastFailed)
    return {
      tone: 'failed',
      text: 'Falhou',
      label: 'O download falhou. Abrir a pasta Downloads'
    }
  if (status.lastPath)
    return {
      tone: 'done',
      text: 'Concluído',
      label: `Download concluído${status.lastName ? `: ${status.lastName}` : ''}. Mostrar no Finder`
    }
  return { tone: 'idle', text: null, label: 'Downloads' }
}
