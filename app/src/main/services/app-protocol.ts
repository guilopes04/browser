// Serve a shell por app://shell/ lendo só de out/renderer (bloqueia "..").
import { net, protocol } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SHELL_URL = 'app://shell/index.html'
export const FIND_URL = 'app://shell/find.html'

// no desenvolvimento (electron-vite dev) a shell vem do servidor do Vite
export function getShellUrl(): string {
  return process.env['ELECTRON_RENDERER_URL'] ?? SHELL_URL
}

// a barra de busca é a segunda página do renderer (find.html), numa view própria
export function getFindUrl(): string {
  const dev = process.env['ELECTRON_RENDERER_URL']
  return dev ? new URL('find.html', `${dev}/`).href : FIND_URL
}

// antes de app.ready
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

// depois de app.ready; rendererRoot = pasta out/renderer
export function handleAppProtocol(rendererRoot: string): void {
  const root = normalize(rendererRoot)
  protocol.handle('app', request => {
    const url = new URL(request.url)
    if (url.host !== 'shell')
      return new Response('não encontrado', { status: 404 })
    const relative = decodeURIComponent(
      url.pathname === '/' ? '/index.html' : url.pathname
    )
    const file = normalize(join(root, relative))
    if (file !== root && !file.startsWith(root + sep)) {
      return new Response('acesso negado', { status: 403 })
    }
    return net.fetch(pathToFileURL(file).toString())
  })
}
