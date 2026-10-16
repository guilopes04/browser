// Quem pediu o download, para o diálogo "Permitir?". Pura. O iniciador (item.getInitiatorOrigin,
// dado do Chromium) é o quadro que pediu: pode ser o anúncio de outra origem num iframe, e não a
// página que o usuário vê nem o servidor do arquivo. Os três aparecem quando diferem.
import { parseUrl } from '@shared/url-parts'

export interface DownloadRequestFacts {
  // origem do quadro que iniciou o download (vazia ou "null" quando é opaca)
  initiator: string
  // endereço da página da aba
  pageUrl: string
  // endereço do arquivo
  fileUrl: string
}

export interface DownloadRequestText {
  // quem aparece na pergunta: o iniciador; sem ele, a página; sem ela, "Este site"
  subject: string
  detail: string
}

// host com porta (um site local em :9601 não se confunde com outro); vazio quando não há como mostrar
function hostOf(value: string): string {
  const parsed = parseUrl(value)
  if (!parsed) return ''
  if (parsed.protocol === 'file:') return 'arquivo local'
  return parsed.host.replace(/^www\./, '')
}

export function describeDownloadRequest(
  facts: DownloadRequestFacts
): DownloadRequestText {
  const requester = hostOf(facts.initiator)
  const page = hostOf(facts.pageUrl)
  const file = hostOf(facts.fileUrl)
  const lines: string[] = []
  if (requester) lines.push(`Quem pediu: ${requester}`)
  if (page && page !== requester) lines.push(`Página aberta: ${page}`)
  if (file && file !== requester) lines.push(`Arquivo de: ${file}`)
  // vale tanto sem nenhum clique quanto com o clique dado em outro quadro da página
  lines.push('Nenhum clique ou toque seu ativou quem pediu este download.')
  return { subject: requester || page || 'Este site', detail: lines.join('\n') }
}
