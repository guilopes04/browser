// Preenche em segundo plano o título e o favicon de abas suspensas e favoritos que nunca
// carregaram (sessão de --abas, favoritos padrão da primeira abertura): a sidebar, o compacto, a
// paleta e a Nova aba mostram o ícone e o título do site em vez de letra e endereço. Sem abrir
// página: só o começo do HTML pela rede do main, sem cookies. Espera a aba ativa terminar de
// carregar para não competir com ela. Cada endereço é consultado uma vez por execução.
import { getHostname } from '@shared/url-parts'
import type { Favorite, SpaceId, Tab } from '@shared/types'
import type { MainContext } from '../context'
import { fetchSiteMeta } from '../functions/fetch-page-meta'
import { getSpaceSession } from '../functions/get-space-session'

const CONCURRENCY = 3
// se a aba ativa demora, começa assim mesmo
const START_FALLBACK_MS = 4000

type Job = () => Promise<void>

const isHttp = (url: string) => /^https?:\/\//i.test(url)

function needsTabMeta(tab: Tab): boolean {
  return tab.dormant && tab.title === '' && isHttp(tab.url)
}

function needsFavorite(favorite: Favorite): boolean {
  return favorite.favicon === null && isHttp(favorite.url)
}

function waitForActiveTab(ctx: MainContext): Promise<void> {
  const { store } = ctx
  return new Promise(resolve => {
    const isDone = () => {
      const tab = store.getActiveTab()
      return !tab || tab.url === '' || (!tab.dormant && !tab.loading)
    }
    if (isDone()) return resolve()
    const finish = () => {
      unsubscribe()
      clearTimeout(timer)
      resolve()
    }
    const unsubscribe = store.subscribe(() => {
      if (isDone()) finish()
    })
    const timer = setTimeout(finish, START_FALLBACK_MS)
  })
}

function buildJobs(ctx: MainContext): Job[] {
  const { store } = ctx
  const currentSpace = store.state.window.spaceId
  // sessão do espaço atual para tudo: nenhum espaço ainda não usado ganha uma partição só por isso
  const ses = getSpaceSession(currentSpace)

  // favicons que já existem, por site: a aba e o favorito do mesmo site não buscam de novo
  const byHost = new Map<string, string>()
  const remember = (url: string, favicon: string | null) => {
    const host = getHostname(url)
    if (host && favicon && !byHost.has(host)) byHost.set(host, favicon)
  }
  for (const tab of store.state.tabs) remember(tab.url, tab.favicon)
  for (const space of store.state.spaces)
    for (const favorite of space.favorites)
      remember(favorite.url, favorite.favicon)

  const jobs: Job[] = []
  const bySpaceFirst = <T extends { spaceId: SpaceId }>(a: T, b: T) =>
    Number(b.spaceId === currentSpace) - Number(a.spaceId === currentSpace)

  const tabs = store.state.tabs.filter(needsTabMeta).sort(bySpaceFirst)
  for (const { id, url } of tabs) {
    jobs.push(async () => {
      const host = getHostname(url)
      const known = byHost.get(host) ?? null
      const meta = await fetchSiteMeta(ses, url, {
        title: true,
        favicon: !known
      })
      const favicon = known ?? meta.favicon
      remember(url, favicon)
      const tab = store.getTab(id)
      // a aba pode ter acordado, navegado ou fechado enquanto a rede respondia
      if (!tab || !needsTabMeta(tab) || tab.url !== url) return
      store.patchTab(id, {
        ...(meta.title ? { title: meta.title } : {}),
        ...(favicon && !tab.favicon ? { favicon } : {})
      })
    })
  }

  const favorites = store.state.spaces
    .flatMap(space =>
      space.favorites.filter(needsFavorite).map(favorite => ({
        spaceId: space.id,
        favorite
      }))
    )
    .sort(bySpaceFirst)
  for (const { spaceId, favorite } of favorites) {
    jobs.push(async () => {
      const host = getHostname(favorite.url)
      let favicon = byHost.get(host) ?? null
      if (!favicon) {
        favicon = (
          await fetchSiteMeta(ses, favorite.url, {
            title: false,
            favicon: true
          })
        ).favicon
        remember(favorite.url, favicon)
      }
      if (favicon) store.setFavoriteFavicon(spaceId, favorite.id, favicon)
    })
  }
  return jobs
}

// resolve quando a fila esvazia (a captura espera por isso, com limite)
export async function startMetaFill(ctx: MainContext): Promise<void> {
  await waitForActiveTab(ctx)
  if (ctx.quitting) return
  const queue = buildJobs(ctx)
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (ctx.quitting) return
      try {
        await job()
      } catch (error) {
        console.error('[Meta][startMetaFill] falha ao preencher', error)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}
