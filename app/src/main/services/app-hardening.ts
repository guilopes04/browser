// Endurecimento do processo main que vale para o app inteiro, de qualquer sessão ou página:
// sandbox em todo renderer, nenhuma permissão nem dispositivo concedido sem a política, nada de
// <webview>. As sessões dos espaços reconfiguram as permissões de página em get-space-session.
import { app, session } from 'electron'
import { hardenSession } from '../functions/harden-session'
import { NO_PERMISSIONS } from '../functions/permission-policy'

// antes de app.ready: todo renderer nasce com sandbox, mesmo sem `sandbox: true` nas preferências
export function enableAppSandbox(): void {
  app.enableSandbox()
}

// sessão nova (o Electron cria a padrão e uma por partição) nasce sem permissão nenhuma
export function installAppHardening(): void {
  app.on('session-created', ses => hardenSession(ses, NO_PERMISSIONS))
  app.on('web-contents-created', (_event, contents) => {
    // Web Bluetooth: cancela a escolha antes de o pedido chegar ao sistema (no macOS, ao TCC)
    contents.on('select-bluetooth-device', (event, _devices, callback) => {
      event.preventDefault()
      callback('')
    })
    contents.on('will-attach-webview', event => event.preventDefault())
  })
}

// depois de app.ready: a sessão padrão (que só serve a shell) também não concede nada
export function hardenDefaultSession(): void {
  hardenSession(session.defaultSession, NO_PERMISSIONS)
}
