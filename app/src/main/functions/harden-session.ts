// Endurece uma sessão: permissões negadas (menos as de `allowed`) e nenhum dispositivo (HID, USB,
// porta serial, Bluetooth) escolhido ou lembrado. As escolhas de dispositivo são canceladas sem
// diálogo, para o pedido nunca chegar ao sistema (no macOS, Bluetooth abriria o pedido de
// permissão do TCC). Chamar de novo troca as permissões permitidas, sem repetir os ouvintes.
import type { Session } from 'electron'
import { isPermissionAllowed } from './permission-policy'

const listening = new WeakSet<Session>()

export function hardenSession(
  ses: Session,
  allowed: ReadonlySet<string>
): void {
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(isPermissionAllowed(permission, allowed))
  })
  ses.setPermissionCheckHandler((_contents, permission) =>
    isPermissionAllowed(permission, allowed)
  )
  ses.setDevicePermissionHandler(() => false)

  if (listening.has(ses)) return
  listening.add(ses)
  ses.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault()
    callback()
  })
  ses.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault()
    callback()
  })
  ses.on('select-serial-port', (event, _ports, _contents, callback) => {
    event.preventDefault()
    callback('')
  })
  ses.setBluetoothPairingHandler((_details, callback) => {
    callback({ confirmed: false })
  })
}
