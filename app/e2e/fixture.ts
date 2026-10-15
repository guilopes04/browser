// Perfil de teste: dois espaços, abas nos dois, favoritos, e histórico no formato antigo
// (history-<espaço>.json) para exercitar a migração. As URLs são *.test: o servidor local responde.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MIN = 60000

interface Favorite {
  id: string
  title: string
  url: string
  favicon: null
  essential: boolean
  tile: string
}

export function writeFixture(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const now = Date.now()
  const favorite = (
    id: string,
    title: string,
    url: string,
    tile: string,
    essential: boolean
  ): Favorite => ({ id, title, url, favicon: null, essential, tile })
  const spaces = [
    {
      id: 'personal',
      name: 'Pessoal',
      color: 'indigo',
      favorites: [
        favorite('p1', 'Gmail', 'https://mail.google.com/', '#B03A63', true),
        favorite(
          'p2',
          'Calendário',
          'https://calendar.google.com/',
          '#4352C4',
          true
        ),
        favorite(
          'p5',
          'Roadmap no Linear',
          'http://linear.test/roadmap',
          '#6A4FB3',
          false
        )
      ]
    },
    {
      id: 'work',
      name: 'Trabalho',
      color: 'amber',
      favorites: [
        favorite(
          'w1',
          'AWS Console',
          'https://console.aws.amazon.com/',
          '#A35A06',
          true
        )
      ]
    }
  ]
  const tab = (
    id: string,
    spaceId: string,
    url: string,
    title: string,
    ago: number
  ) => ({
    id,
    spaceId,
    url,
    title,
    favicon: null,
    muted: false,
    lastActiveAt: now - ago * MIN
  })
  const tabs = [
    tab(
      'k1',
      'personal',
      'http://keylog.test/',
      'Página que registra teclas',
      0
    ),
    tab('a1', 'personal', 'http://alpha.test/one', 'Alpha Um', 5),
    tab('h1', 'personal', 'http://hist.test/doc', 'Documento Âncoras', 20),
    tab(
      'w1',
      'work',
      'http://linear.test/team/issues',
      'Minhas issues no Linear',
      60
    ),
    tab('w2', 'work', 'http://cloud.test/', 'CloudWatch, logs de produção', 10)
  ]
  writeFileSync(
    join(dir, 'session.json'),
    JSON.stringify({
      version: 1,
      spaces,
      window: {
        spaceId: 'personal',
        activeTabBySpace: { personal: 'k1', work: 'w2' },
        sidebar: 'open',
        bounds: { x: 0, y: 40, width: 1440, height: 860 }
      },
      settings: {
        suspendAfterSec: 1800,
        neverSuspendAudible: true,
        hiddenSidebarStyle: 'hidden',
        searchUrl: 'https://www.google.com/search?q=%s'
      },
      tabs,
      closed: []
    })
  )
  const legacy = (url: string, title: string, ago: number) =>
    JSON.stringify({
      version: 1,
      entries: [{ url, title, visitedAt: now - ago * MIN }]
    })
  writeFileSync(
    join(dir, 'history-personal.json'),
    legacy('http://linear.test/changelog', 'Changelog do Linear', 26 * 60)
  )
  writeFileSync(
    join(dir, 'history-work.json'),
    legacy('http://jira.test/board', 'Quadro antigo do Jira', 50 * 60)
  )
}
