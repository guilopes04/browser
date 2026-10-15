// select-client-certificate: o app não entrega certificado nenhum sem o usuário escolher. Pedidos
// do mesmo site enquanto o diálogo está aberto esperam a mesma resposta (um site pode pedir o
// certificado em dezenas de requisições ao mesmo tempo).
import { app, dialog, type BaseWindow, type Certificate } from 'electron'
import { getHostname } from '@shared/url-parts'
import {
  describeCertificates,
  pickCertificate
} from '../functions/describe-certificates'

const pending = new Map<string, Promise<Certificate | undefined>>()

async function ask(
  parent: BaseWindow | null,
  url: string,
  list: Certificate[]
): Promise<Certificate | undefined> {
  const options = describeCertificates(url, list)
  const box = {
    type: 'question' as const,
    message: options.message,
    detail: options.detail,
    buttons: options.buttons,
    defaultId: options.defaultId,
    cancelId: options.cancelId,
    noLink: true
  }
  const { response } = parent
    ? await dialog.showMessageBox(parent, box)
    : await dialog.showMessageBox(box)
  return pickCertificate(list, response, options.listed)
}

export function chooseClientCertificate(
  parent: BaseWindow | null,
  url: string,
  list: Certificate[]
): Promise<Certificate | undefined> {
  if (list.length === 0) return Promise.resolve(undefined)
  const site = getHostname(url) || url
  let request = pending.get(site)
  if (!request) {
    request = ask(parent, url, list).finally(() => pending.delete(site))
    pending.set(site, request)
  }
  return request
}

export function installClientCertificateDialog(
  getParent: () => BaseWindow | null
): void {
  app.on(
    'select-client-certificate',
    (event, _contents, url, list, callback) => {
      // sem isto o Electron entrega o primeiro certificado da keychain sem perguntar
      event.preventDefault()
      chooseClientCertificate(getParent(), url, list).then(
        certificate => (certificate ? callback(certificate) : callback()),
        () => callback()
      )
    }
  )
}
