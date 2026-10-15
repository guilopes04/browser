// Lê o histórico do disco: history.jsonl e, enquanto existir, o formato antigo
// (history-<espaço>.json), que entra por baixo do novo. Vale mesmo com history.jsonl: uma versão
// anterior pode tê-lo criado, só com as primeiras visitas, antes de a migração rodar.
import type { SpaceId } from '@shared/types'
import { readLegacyHistory, type LegacyHistory } from './migrate-legacy-history'
import { readHistoryFile } from './read-history-file'
import {
  createSpaceHistory,
  mergeSpaceHistory,
  type SpaceHistory
} from './space-history'

export interface LoadedHistory {
  histories: Map<SpaceId, SpaceHistory>
  // linhas válidas do history.jsonl (com muito mais linhas que entradas, vale compactar)
  lines: number
  // os arquivos antigos que foram absorvidos: depois de gravar o novo, ganham o sufixo .migrado
  legacy: LegacyHistory | null
  // o history.jsonl tinha #fragmentos ou passava dos limites: reescrever limpa o arquivo
  needsRewrite: boolean
}

export function loadHistory(path: string, userData: string): LoadedHistory {
  const parsed = readHistoryFile(path)
  const histories = parsed?.histories ?? new Map<SpaceId, SpaceHistory>()
  const legacy = readLegacyHistory(userData)
  if (legacy)
    for (const [spaceId, history] of legacy.histories) {
      let target = histories.get(spaceId)
      if (!target) {
        target = createSpaceHistory()
        histories.set(spaceId, target)
      }
      mergeSpaceHistory(target, history)
    }
  return {
    histories,
    lines: parsed?.lines ?? 0,
    legacy,
    needsRewrite: parsed?.needsRewrite ?? false
  }
}
