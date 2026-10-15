import { normalizeText } from '@shared/normalize-text'
import { getSiteName } from '@shared/url-parts'

// letra do tile de um favorito sem letra definida: a 1ª do título. Se o título cita o site sem
// começar por ele ("Roadmap no Linear"), a inicial é a do site, como no design
export function getFavoriteLetter(title: string, url = ''): string {
  const site = getSiteName(url)
  const startsWithSite =
    site !== '' && normalizeText(title.trim()).startsWith(normalizeText(site))
  const mentionsSite =
    site !== '' && normalizeText(title).includes(normalizeText(site))
  const source = mentionsSite && !startsWithSite ? site : title.trim()
  const first = Array.from(source)[0]
  return first ? first.toLocaleUpperCase('pt-BR') : '?'
}
