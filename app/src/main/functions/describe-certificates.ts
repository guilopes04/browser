// Diálogo "escolha um certificado": o Electron entregaria o primeiro certificado da keychain a
// qualquer site que pedisse um (identidade do usuário a quem controla o servidor). Aqui o usuário
// vê nome e emissor de cada um e só envia o que escolher; "Cancelar" é o padrão. Pura.
import type { Certificate } from 'electron'
import { getHostname } from '@shared/url-parts'

// o diálogo nativo empilha um botão por certificado: acima disto não cabe
export const MAX_LISTED_CERTIFICATES = 6

export interface CertificateDialog {
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
  // quantos certificados aparecem como botão (os primeiros da lista)
  listed: number
}

type CertificateLike = Pick<
  Certificate,
  'subjectName' | 'issuerName' | 'subject' | 'issuer'
>

function describeCertificate(cert: CertificateLike): string {
  const name = cert.subjectName || cert.subject?.commonName || 'Sem nome'
  const issuer =
    cert.issuerName || cert.issuer?.commonName || 'emissor desconhecido'
  return `${name} (emitido por ${issuer})`
}

export function describeCertificates(
  url: string,
  list: CertificateLike[]
): CertificateDialog {
  const listed = Math.min(list.length, MAX_LISTED_CERTIFICATES)
  const site = getHostname(url) || url
  const hidden = list.length - listed
  const buttons = [
    ...list.slice(0, listed).map(describeCertificate),
    'Cancelar'
  ]
  return {
    message: `${site} pede um certificado para identificar você`,
    detail:
      'Escolha o certificado que será enviado ao site. Ele pode identificar você. ' +
      'Cancelar não envia nenhum.' +
      (hidden > 0 ? ` (${hidden} certificados não aparecem aqui.)` : ''),
    buttons,
    defaultId: buttons.length - 1,
    cancelId: buttons.length - 1,
    listed
  }
}

// a resposta do diálogo vira o certificado escolhido; Cancelar (ou fechar) não escolhe nenhum
export function pickCertificate<T>(
  list: T[],
  response: number,
  listed: number
): T | undefined {
  return response >= 0 && response < listed ? list[response] : undefined
}
