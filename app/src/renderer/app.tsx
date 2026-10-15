import { useEffect } from 'preact/hooks'
import {
  PANEL_INSET,
  SIDEBAR_COMPACT_WIDTH,
  SIDEBAR_WIDTH,
  SPACE_TOKENS,
  THEME_TOKENS
} from '@shared/tokens'
import { CompactSidebar } from './components/compact-sidebar'
import { Tooltip } from './components/compact-sidebar/tooltip'
import { ErrorPage } from './components/error-page'
import { FullscreenNotice } from './components/fullscreen-notice'
import { NewTab } from './components/new-tab'
import { Palette } from './components/palette'
import { PeekSidebar, PeekTrigger } from './components/peek'
import { Sidebar } from './components/sidebar'
import {
  activeTab,
  currentSpace,
  effectiveSidebar,
  overlay,
  snapshot
} from './state'

export function App() {
  const snap = snapshot.value
  const space = currentSpace.value
  const theme = snap?.theme ?? 'light'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  if (!snap || !space) return null
  // tela cheia: a shell é só a faixa do aviso (3 s), nada da interface
  if (snap.fullscreen && overlay.value.includes('notice'))
    return <FullscreenNotice />

  const tokens = THEME_TOKENS[theme]
  const spaceTokens = SPACE_TOKENS[space.color][theme]
  const mode = effectiveSidebar.value
  const peeking = mode === 'hidden' && overlay.value.includes('peek')
  const panelLeft =
    mode === 'open'
      ? SIDEBAR_WIDTH
      : mode === 'compact'
        ? SIDEBAR_COMPACT_WIDTH
        : PANEL_INSET
  const tab = activeTab.value
  const hasError = tab?.error != null
  // Nova aba com erro (file://): a página de erro toma o lugar dela
  const isNewTab = tab?.url === '' && !hasError

  const vars = {
    '--bg': spaceTokens.bg,
    '--accent': spaceTokens.accent,
    '--on-accent': theme === 'dark' ? '#17181C' : '#FFFFFF',
    '--text': tokens.text,
    '--sec': tokens.sec,
    '--icon': tokens.icon,
    '--icon-off': tokens.iconOff,
    '--fill': tokens.fill,
    '--hair': tokens.hair,
    '--active-bg': tokens.activeBg,
    '--active-shadow': tokens.activeShadow,
    '--hover-bg': tokens.hoverBg,
    '--panel-bg': tokens.panelBg,
    '--panel-shadow': tokens.panelShadow
  }

  return (
    <div class="root" data-theme={theme} style={vars}>
      {mode === 'open' && <Sidebar />}
      {mode === 'compact' && <CompactSidebar />}
      <div class="drag-strip" style={{ left: `${panelLeft}px` }} />
      {/* sombra e hairline do painel; a página (outra view) cobre o miolo */}
      <div
        class="page-panel"
        // com a shell por cima da página (peek, dica), o painel não pode cobri-la: só pinta o
        // fundo quando é ele o conteúdo (Nova aba, erro)
        data-through={!isNewTab && !hasError && overlay.value.length > 0}
        style={{ left: `${panelLeft}px` }}
      >
        {isNewTab && <NewTab />}
        {tab && hasError && <ErrorPage tab={tab} />}
      </div>
      {mode === 'hidden' && !peeking && <PeekTrigger />}
      {peeking && <PeekSidebar />}
      {mode === 'compact' && <Tooltip />}
      <Palette />
    </div>
  )
}
