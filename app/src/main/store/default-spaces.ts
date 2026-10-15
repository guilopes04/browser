// Espaços e favoritos padrão (Sidebar.dc.html e NovaAba.dc.html).
import type { Favorite, Space } from '@shared/types'

function favorite(
  id: string,
  title: string,
  url: string,
  tile: string,
  essential: boolean,
  letter?: string
): Favorite {
  return { id, title, url, favicon: null, essential, tile, letter }
}

export const DEFAULT_SPACE_ID = 'personal'
export const WORK_SPACE_ID = 'work'

export function createDefaultSpaces(): Space[] {
  return [
    {
      id: DEFAULT_SPACE_ID,
      name: 'Pessoal',
      color: 'indigo',
      favorites: [
        favorite(
          'p-gmail',
          'Gmail',
          'https://mail.google.com/',
          '#B03A63',
          true,
          'M'
        ),
        favorite(
          'p-calendar',
          'Calendário',
          'https://calendar.google.com/',
          '#4352C4',
          true
        ),
        favorite('p-github', 'GitHub', 'https://github.com/', '#3D4452', true),
        favorite(
          'p-spotify',
          'Spotify',
          'https://open.spotify.com/',
          '#2F7D5B',
          true
        ),
        favorite(
          'p-youtube',
          'YouTube',
          'https://www.youtube.com/',
          '#B03A63',
          false
        ),
        favorite(
          'p-mdn',
          'MDN',
          'https://developer.mozilla.org/',
          '#6A4FB3',
          false
        ),
        favorite(
          'p-electron',
          'Electron',
          'https://www.electronjs.org/',
          '#4352C4',
          false
        ),
        favorite(
          'p-netflix',
          'Netflix',
          'https://www.netflix.com/',
          '#3D4452',
          false
        )
      ]
    },
    {
      id: WORK_SPACE_ID,
      name: 'Trabalho',
      color: 'amber',
      favorites: [
        favorite('w-linear', 'Linear', 'https://linear.app/', '#6A4FB3', true),
        favorite('w-github', 'GitHub', 'https://github.com/', '#3D4452', true),
        favorite(
          'w-aws',
          'AWS Console',
          'https://console.aws.amazon.com/',
          '#A35A06',
          true
        ),
        favorite(
          'w-calendar',
          'Calendário',
          'https://calendar.google.com/',
          '#4352C4',
          true
        )
      ]
    }
  ]
}
