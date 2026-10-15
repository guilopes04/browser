// Serve a shell por app://shell/ lendo só de out/renderer (bloqueia "..").
import { app, net, protocol } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveShellUrl, SHELL_URL } from '../functions/resolve-shell-url'

export { SHELL_URL }
export const FIND_URL = 'app://shell/find.html'

// no desenvolvimento (electron-vite dev) a shell vem do servidor do Vite (http://localhost:<porta>);
// empacotado é sempre app://shell, seja qual for o ambiente
export function getShellUrl(): string {
  return resolveShellUrl(process.env['ELECTRON_RENDERER_URL'], app.isPackaged)
}

// a barra de busca é a segunda página do renderer (find.html), numa view própria; parte do
// endereço já validado da shell, então empacotado a variável ELECTRON_RENDERER_URL não vale
export function getFindUrl(): string {
  const shell = getShellUrl()
  return shell === SHELL_URL ? FIND_URL : new URL('find.html', shell).href
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
