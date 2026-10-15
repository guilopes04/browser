// Geometria da janela em pt (docs/arquitetura.md, seção 1). Pura.
import {
  FULLSCREEN_NOTICE,
  NARROW_WINDOW,
  PANEL_INSET,
  PANEL_RADIUS,
  SIDEBAR_COMPACT_WIDTH,
  SIDEBAR_WIDTH
} from '@shared/tokens'
import type { Point, Rect, SidebarMode } from '@shared/types'

export interface LayoutInput {
  width: number
  height: number
  // o modo escolhido pelo usuário (gravado); a janela estreita pode mostrar outro
  sidebar: SidebarMode
  // tela cheia de vídeo: a página ocupa a janela inteira
  videoFullscreen?: boolean
  // sidebar oculta revelada pela borda: flutua sobre a página
  peek?: boolean
  // aviso de tela cheia: a shell vira só a faixa do aviso, sobre a página
  fullscreenNotice?: boolean
}

export interface Layout {
  // o que a janela mostra de fato (aberta vira compacta abaixo de NARROW_WINDOW)
  sidebar: SidebarMode
  // a shell cobre sempre a janela inteira, por baixo da página
  shell: Rect
  page: Rect
  pageRadius: number
  trafficLights: { visible: boolean; position: Point }
}

// "Esconder sozinha em janelas estreitas": só a aberta cede; a oculta continua oculta
export function getEffectiveSidebar(
  sidebar: SidebarMode,
  width: number
): SidebarMode {
  return sidebar === 'open' && width < NARROW_WINDOW ? 'compact' : sidebar
}

export function computeLayout({
  width,
  height,
  sidebar,
  videoFullscreen,
  peek,
  fullscreenNotice
}: LayoutInput): Layout {
  const shell: Rect = { x: 0, y: 0, width, height }
  const mode = getEffectiveSidebar(sidebar, width)

  if (videoFullscreen) {
    // com o aviso, a shell cobre só a faixa dele (o resto da página segue recebendo os cliques)
    const noticeWidth = Math.min(FULLSCREEN_NOTICE.width, width)
    return {
      sidebar: mode,
      shell: fullscreenNotice
        ? {
            x: Math.round((width - noticeWidth) / 2),
            y: FULLSCREEN_NOTICE.top,
            width: noticeWidth,
            height: FULLSCREEN_NOTICE.height
          }
        : shell,
      page: { x: 0, y: 0, width, height },
      pageRadius: 0,
      trafficLights: { visible: false, position: { x: 15, y: 21 } }
    }
  }

  if (mode === 'hidden') {
    return {
      sidebar: mode,
      shell,
      page: {
        x: PANEL_INSET,
        y: PANEL_INSET,
        width: width - PANEL_INSET * 2,
        height: height - PANEL_INSET * 2
      },
      pageRadius: PANEL_RADIUS,
      // revelada, a sidebar flutua em 8,8 e os semáforos vão para dentro dela
      trafficLights: peek
        ? { visible: true, position: { x: 23, y: 29 } }
        : { visible: false, position: { x: 15, y: 21 } }
    }
  }

  const sidebarWidth =
    mode === 'compact' ? SIDEBAR_COMPACT_WIDTH : SIDEBAR_WIDTH
  return {
    sidebar: mode,
    shell,
    page: {
      x: sidebarWidth,
      y: PANEL_INSET,
      width: width - sidebarWidth - PANEL_INSET,
      height: height - PANEL_INSET * 2
    },
    pageRadius: PANEL_RADIUS,
    trafficLights: {
      visible: true,
      position: mode === 'compact' ? { x: 8, y: 21 } : { x: 15, y: 21 }
    }
  }
}
