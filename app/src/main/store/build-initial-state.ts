// Monta o estado inicial: --abas, sessão salva ou o padrão (Pessoal e Trabalho com uma Nova aba).
import type {
  AppSnapshot,
  Rect,
  SessionFile,
  Settings,
  Tab,
  Theme
} from '@shared/types'
import type { TabsFile } from '../functions/read-tabs-file'
import { createTabRecord } from './create-tab-record'
import { createDefaultSpaces, DEFAULT_SPACE_ID } from './default-spaces'
import { sanitizeSettings } from './defaults'
import { hydrateTab } from './hydrate-tab'

interface BuildInput {
  theme: Theme
  session: SessionFile | null
  tabsFile: TabsFile | null
  bounds: Rect
}

export function buildInitialState(input: BuildInput): {
  state: AppSnapshot
  closed: SessionFile['closed']
} {
  const { session, tabsFile } = input
  const useSession = session !== null && tabsFile === null

  const spaces = useSession ? session.spaces : createDefaultSpaces()
  // flags de execução (como --suspender-apos) não entram aqui: o que vai para o session.json
  // são só as configurações do usuário
  const settings: Settings = sanitizeSettings(
    useSession ? session.settings : undefined
  )

  let tabs: Tab[]
  if (useSession) {
    tabs = session.tabs.map(hydrateTab)
  } else if (tabsFile) {
    tabs = tabsFile.urls.map(url => createTabRecord(DEFAULT_SPACE_ID, url))
  } else {
    tabs = []
  }

  // todo espaço tem ao menos uma aba (Nova aba)
  for (const space of spaces) {
    if (!tabs.some(tab => tab.spaceId === space.id))
      tabs.push(createTabRecord(space.id, ''))
  }

  const savedActive = useSession ? session.window.activeTabBySpace : {}
  const activeTabBySpace: Record<string, string | null> = {}
  for (const space of spaces) {
    const own = tabs.filter(tab => tab.spaceId === space.id)
    const saved = savedActive[space.id]
    activeTabBySpace[space.id] =
      own.find(tab => tab.id === saved)?.id ?? own[0].id
  }

  const currentSpace =
    useSession && spaces.some(space => space.id === session.window.spaceId)
      ? session.window.spaceId
      : spaces[0].id

  const sidebar = useSession ? session.window.sidebar : 'open'
  const state: AppSnapshot = {
    theme: input.theme,
    spaces,
    tabs,
    window: {
      spaceId: currentSpace,
      activeTabBySpace,
      sidebar,
      bounds: input.bounds
    },
    effectiveSidebar: sidebar,
    settings,
    overlay: [],
    fullscreen: false
  }
  return { state, closed: useSession ? session.closed : [] }
}
