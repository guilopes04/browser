// Limites do que vai para o disco e para a paleta: uma URL de megabytes (data: URI, formulário
// GET gigante) não pode inflar o session.json nem o history.jsonl. Puro.

export const MAX_STORED_URL = 2048
export const MAX_STORED_TITLE = 512

export function limitUrl(url: string): string {
  return url.length > MAX_STORED_URL ? url.slice(0, MAX_STORED_URL) : url
}

export function limitTitle(title: string): string {
  return title.length > MAX_STORED_TITLE
    ? title.slice(0, MAX_STORED_TITLE)
    : title
}
