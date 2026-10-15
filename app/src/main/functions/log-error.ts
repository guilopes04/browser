// console.error do main sem endereços completos: de cada URL no erro só o host aparece. Formato
// "[Módulo][Função] mensagem".
import { redactUrls } from '@shared/redact-urls'
import { describeError } from './format-error-log'

export function logError(tag: string, message: string, error?: unknown): void {
  if (error === undefined) console.error(`${tag} ${redactUrls(message)}`)
  else
    console.error(
      `${tag} ${redactUrls(message)}`,
      redactUrls(describeError(error))
    )
}
