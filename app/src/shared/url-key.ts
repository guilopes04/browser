// Chave de endereço para achar a mesma página em abas, favoritos e histórico. Puro.

const SCHEME_AND_WWW = /^[a-z][a-z0-9+.-]*:\/\/(www\.)?/i
// âncora comum (#secao) é a mesma página; #/rota e #!/rota são páginas diferentes (apps de página
// única que roteiam pelo fragmento)
const PLAIN_ANCHOR = /#(?![/!]).*$/

// o endereço sem a âncora comum (#secao, #access_token=...), que é a mesma página e não precisa ficar
// guardada; #/rota e #!/rota ficam, porque identificam a página nos apps que roteiam pelo fragmento
export function stripPlainAnchor(url: string): string {
  return url.replace(PLAIN_ANCHOR, '')
}

// endereço como a pessoa o lê: sem esquema e sem www
export function stripScheme(url: string): string {
  return url.replace(SCHEME_AND_WWW, '')
}

// o host termina na primeira barra, interrogação ou cerquilha
const AUTHORITY_END = /[/?#]/

// sem esquema, www, âncora comum nem barra final. Só o host perde a caixa: no caminho e na
// consulta ela muda a página (bit.ly/AbC e bit.ly/abc, ids do YouTube, Google Docs)
export function toUrlKey(url: string): string {
  const bare = stripScheme(url).replace(PLAIN_ANCHOR, '').replace(/\/+$/, '')
  const end = bare.search(AUTHORITY_END)
  if (end === -1) return bare.toLowerCase()
  return bare.slice(0, end).toLowerCase() + bare.slice(end)
}
