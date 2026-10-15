// Código de erro de rede do Chromium -> texto da página de erro (em português). Puro.

export type ErrorKind = 'network' | 'problem'

export interface LoadErrorText {
  kind: ErrorKind
  title: string
  body: string
  // Mac sem internet: a página recarrega sozinha quando a conexão volta e oferece os ajustes de rede
  offline?: boolean
}

// net_error_list.h do Chromium
const OFFLINE = new Set([-106])
const NOT_FOUND = new Set([-105])
const TIMEOUT = new Set([-7, -118])
const REFUSED = new Set([-102, -104, -109, -111])
const INTERRUPTED = new Set([-100, -101, -103, -324])
const INSECURE = new Set([-107, -110, -113, -501])
const UNSAFE_PORT = new Set([-312])

export function describeLoadError(
  errorCode: number,
  site: string
): LoadErrorText {
  if (OFFLINE.has(errorCode))
    return {
      kind: 'network',
      title: 'Sem conexão com a internet',
      body: `Não deu para abrir ${site} porque o Mac está desconectado. A página recarrega sozinha quando a conexão voltar.`,
      offline: true
    }
  if (NOT_FOUND.has(errorCode))
    return {
      kind: 'network',
      title: 'Endereço não encontrado',
      body: `Não achamos o servidor de ${site}. Confira se o endereço está certo e se a conexão está funcionando.`
    }
  if (TIMEOUT.has(errorCode))
    return {
      kind: 'network',
      title: 'O site demorou demais para responder',
      body: `${site} não respondeu a tempo. Tente de novo em instantes.`
    }
  if (REFUSED.has(errorCode))
    return {
      kind: 'network',
      title: 'O site recusou a conexão',
      body: `${site} não aceitou a conexão. O servidor pode estar fora do ar ou o endereço pode estar errado.`
    }
  if (INTERRUPTED.has(errorCode))
    return {
      kind: 'network',
      title: 'A conexão foi interrompida',
      body: `A conexão com ${site} caiu antes de a página chegar. Tente de novo.`
    }
  if (INSECURE.has(errorCode) || (errorCode <= -200 && errorCode >= -299))
    return {
      kind: 'problem',
      title: 'Não foi possível confirmar que a conexão é segura',
      body: `O navegador não conseguiu validar a conexão segura com ${site}, então a página não foi aberta.`
    }
  if (UNSAFE_PORT.has(errorCode))
    return {
      kind: 'problem',
      title: 'Porta bloqueada por segurança',
      body: `O navegador não abre a porta indicada em ${site}, porque ela costuma ser usada por serviços que não são páginas.`
    }
  if (errorCode === -6)
    return {
      kind: 'problem',
      title: 'Arquivo não encontrado',
      body: `Não existe nada em ${site}.`
    }
  return {
    kind: 'problem',
    title: 'Não foi possível abrir a página',
    body: `Ocorreu um erro ao carregar ${site}.`
  }
}
