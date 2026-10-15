// Contrato IPC: único ponto de contato entre a shell (renderer) e o main.
import type { EarlyKey, KeyGateTarget } from './early-key'
import type { FindViewState } from './find-state'
import type {
  AppSnapshot,
  CommandId,
  OverlayReason,
  PaletteMode,
  PaletteScope,
  PaletteSection,
  SpaceId,
  Tab,
  TabId
} from './types'

// shell -> main: ipcRenderer.send / ipcMain.on
export interface Commands {
  // acorda se dormente; troca de espaço se preciso
  'tab:activate': { tabId: TabId }
  // sem url = Nova aba, no topo da lista do espaço
  'tab:create': { spaceId?: SpaceId; url?: string; background?: boolean }
  'tab:close': { tabId: TabId }
  'tab:reopen': Record<string, never>
  // texto cru; o main resolve URL ou busca
  'tab:navigate': { tabId: TabId; input: string }
  'tab:back': Record<string, never>
  'tab:forward': Record<string, never>
  // sempre na aba ativa
  'tab:reload': Record<string, never>
  'tab:set-muted': { tabId: TabId; muted: boolean }
  'tab:suspend': { tabId: TabId }
  'tab:move': { tabId: TabId; toIndex: number }
  // recria na partição nova e recarrega
  'tab:move-to-space': { tabId: TabId; spaceId: SpaceId }
  // menu nativo nesta fase
  'tab:context-menu': { tabId: TabId }
  'space:switch': { spaceId: SpaceId }
  'sidebar:toggle': Record<string, never>
  // sobe (on) ou desce a shell por cima da página: revelação da sidebar oculta e dicas do compacto
  'shell:raise': { reason: Exclude<OverlayReason, 'palette'>; on: boolean }
  // 'address' = o campo de endereço da sidebar (mesma paleta do ⌘L)
  'palette:open': { mode: PaletteMode }
  'palette:close': Record<string, never>
  // o campo da paleta (ou o da Nova aba) já está na tela e com o foco: o main deixa de repassar as
  // teclas por ele
  'keys:ready': { target: KeyGateTarget }
  'command:run': { command: CommandId }
  // botão "Abrir ajustes de rede do Mac" da página de erro
  'system:open-network-settings': Record<string, never>
  // ícone de Downloads do rodapé: abre o último arquivo baixado no Finder, ou a pasta Downloads
  'downloads:open': Record<string, never>
  // barra de busca na página (view própria; só ela manda estes). ready: a caixa já está na tela e
  // com o foco, e o main deixa de repassar as teclas e manda o estado
  'find:ready': Record<string, never>
  // o que o usuário digitou na caixa
  'find:text': { text: string }
  // ↵, ⇧↵ e os botões: próximo (forward) ou anterior
  'find:step': { forward: boolean }
  // "Aa"
  'find:case': { matchCase: boolean }
  'find:close': Record<string, never>
}

// shell -> main com resposta: invoke / handle
export interface Requests {
  'state:get': { req: Record<string, never>; res: AppSnapshot }
  'palette:query': {
    req: { text: string; scope: PaletteScope }
    res: PaletteSection[]
  }
}

// main -> shell: webContents.send / ipcRenderer.on
export interface Events {
  // estrutura, tema, espaço, sidebar, overlay
  'state:snapshot': AppSnapshot
  // título, favicon, url, áudio, loading, navegação
  'state:tab': { tabId: TabId; patch: Partial<Tab> }
  // ⌘L numa Nova aba: a página tem o campo de busca, e a shell o foca
  'address:focus': Record<string, never>
  // a paleta apareceu, já com as seções do texto (a primeira pintura não espera um invoke). No
  // modo endereço, text é a URL da aba (selecionada) e as seções são as da consulta vazia
  'palette:show': {
    mode: PaletteMode
    text: string
    sections: PaletteSection[]
  }
  'palette:hide': Record<string, never>
  // tecla digitada enquanto a paleta ou a Nova aba abria (ver shared/early-key.ts). Chega depois
  // de palette:show e pode chegar antes do snapshot que traz a Nova aba: por isso leva o tabId
  'keys:early': { target: KeyGateTarget; key: EarlyKey }
  // main -> barra de busca: texto, contador, "Aa" e cores
  'find:state': FindViewState
}

export const COMMAND_CHANNELS = [
  'tab:activate',
  'tab:create',
  'tab:close',
  'tab:reopen',
  'tab:navigate',
  'tab:back',
  'tab:forward',
  'tab:reload',
  'tab:set-muted',
  'tab:suspend',
  'tab:move',
  'tab:move-to-space',
  'tab:context-menu',
  'space:switch',
  'sidebar:toggle',
  'shell:raise',
  'palette:open',
  'palette:close',
  'keys:ready',
  'command:run',
  'system:open-network-settings',
  'downloads:open',
  'find:ready',
  'find:text',
  'find:step',
  'find:case',
  'find:close'
] as const satisfies readonly (keyof Commands)[]

export const REQUEST_CHANNELS = [
  'state:get',
  'palette:query'
] as const satisfies readonly (keyof Requests)[]

export const EVENT_CHANNELS = [
  'state:snapshot',
  'state:tab',
  'address:focus',
  'palette:show',
  'palette:hide',
  'keys:early',
  'find:state'
] as const satisfies readonly (keyof Events)[]
