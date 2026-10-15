// Tokens do design (Sidebar.dc.html, renderVals) e medidas da janela.
import type { SpaceColor, Theme } from './types'

export const SIDEBAR_WIDTH = 260
export const SIDEBAR_COMPACT_WIDTH = 76
export const PANEL_INSET = 8
export const PANEL_RADIUS = 10
// janela mais estreita que isto: a sidebar aberta vira compacta, sem gravar
export const NARROW_WINDOW = 900
// fundo padrão do documento de uma aba: branco nos dois temas, como o Chrome. Quem quer escuro
// declara color-scheme ou prefers-color-scheme (o Chromium já segue o tema do macOS)
export const PAGE_CANVAS = '#FFFFFF'
// aviso de tela cheia: a shell encolhe para este retângulo no topo, no centro da janela
export const FULLSCREEN_NOTICE = { width: 320, height: 44, top: 20 } as const
export const FULLSCREEN_NOTICE_TEXT = 'Site em tela cheia. Esc para sair'
// quanto tempo o aviso fica na tela
export const FULLSCREEN_NOTICE_MS = 3000

export interface SpaceTokens {
  accent: string
  bg: string
}

export const SPACE_TOKENS: Record<SpaceColor, Record<Theme, SpaceTokens>> = {
  indigo: {
    light: { accent: '#4352C4', bg: '#E8E9F0' },
    dark: { accent: '#8E9BF2', bg: '#1A1B22' }
  },
  amber: {
    light: { accent: '#A35A06', bg: '#EFEAE1' },
    dark: { accent: '#E0A04E', bg: '#1F1C17' }
  }
}

// selo do espaço na paleta (Paleta.dc.html mostra o do Trabalho; o do Pessoal segue o mesmo
// critério: fundo claro do tom, texto escuro do tom e o ponto no destaque)
export interface SpaceChipTokens {
  bg: string
  text: string
  dot: string
}

export const SPACE_CHIP: Record<SpaceColor, Record<Theme, SpaceChipTokens>> = {
  indigo: {
    light: { bg: '#DFE3F7', text: '#2F3C9A', dot: '#4352C4' },
    dark: { bg: 'rgba(142,155,242,0.18)', text: '#B6BFF7', dot: '#8E9BF2' }
  },
  amber: {
    light: { bg: '#F4E8D6', text: '#7A4405', dot: '#A35A06' },
    dark: { bg: 'rgba(224,160,78,0.18)', text: '#EDC083', dot: '#E0A04E' }
  }
}

export interface ThemeTokens {
  text: string
  sec: string
  icon: string
  iconOff: string
  fill: string
  hair: string
  activeBg: string
  activeShadow: string
  hoverBg: string
  panelBg: string
  panelShadow: string
}

export const THEME_TOKENS: Record<Theme, ThemeTokens> = {
  light: {
    text: '#17181C',
    sec: '#565863',
    icon: '#3A3B42',
    iconOff: '#9A9BA3',
    fill: 'rgba(23,24,28,0.06)',
    hair: 'rgba(23,24,28,0.08)',
    activeBg: '#FFFFFF',
    activeShadow: '0 1px 2px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
    hoverBg: 'rgba(23,24,28,0.06)',
    panelBg: '#FFFFFF',
    panelShadow: '0 0 0 0.5px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)'
  },
  dark: {
    text: '#F1F1F4',
    sec: '#A3A4AD',
    icon: '#C9CAD2',
    iconOff: '#6B6C75',
    fill: 'rgba(255,255,255,0.07)',
    hair: 'rgba(255,255,255,0.09)',
    activeBg: 'rgba(255,255,255,0.11)',
    activeShadow: '0 0 0 0.5px rgba(255,255,255,0.08)',
    hoverBg: 'rgba(255,255,255,0.06)',
    panelBg: '#212126',
    panelShadow: '0 0 0 0.5px rgba(255,255,255,0.08)'
  }
}

// cores de tile quando não há favicon (hash do hostname)
export const TILE_COLORS = [
  '#4352C4',
  '#3D4452',
  '#B03A63',
  '#6A4FB3',
  '#A35A06',
  '#2F7D5B'
]
export const NEW_TAB_TILE = '#6E7079'

export function getSpaceBackground(color: SpaceColor, theme: Theme): string {
  return SPACE_TOKENS[color][theme].bg
}
