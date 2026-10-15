// Endereço sem o #fragmento. Antes de gravar em disco: o fragmento carrega tokens (retorno de
// login OAuth implícito) e posições que não precisam sobreviver ao app. Puro.

export function stripFragment(url: string): string {
  const index = url.indexOf('#')
  return index === -1 ? url : url.slice(0, index)
}

// Página sem <title>: o Chromium usa o próprio endereço (sem o esquema) como título, #fragmento
// incluído. O título de uma página também não leva o fragmento para o disco. Puro.
export function stripFragmentFromTitle(title: string, url: string): string {
  const hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''
  if (hash.length <= 1) return title
  // título derivado do endereço: "host/caminho#fragmento"
  const bare = stripFragment(url).replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  if (bare !== '' && title.startsWith(`${bare}#`)) return bare
  // o fragmento aparece inteiro em outro lugar do título
  return title.includes(hash) ? title.split(hash).join('') : title
}
