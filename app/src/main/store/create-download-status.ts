// Estado inicial dos downloads: nada baixando, nada concluído.
import type { DownloadStatus } from '@shared/types'

export function createDownloadStatus(): DownloadStatus {
  return {
    active: 0,
    percent: null,
    lastPath: null,
    lastName: null,
    lastFailed: false
  }
}
