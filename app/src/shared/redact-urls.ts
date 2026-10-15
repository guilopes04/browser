// Texto de log sem URLs completas: de cada endereço http, https, ws ou wss só o host fica (caminho,
// consulta e fragmento costumam carregar ids e tokens). Puro.

// esquema, credenciais opcionais antes do @, host (IPv6 entre colchetes, porta junto) e o resto
const URL_IN_TEXT =
  /\b(https?|wss?):\/\/(?:[^\s/?#@'"<>]*@)?(\[[0-9a-f:.%]+\](?::\d+)?|[^\s/?#'"<>)\]}@[]+)[^\s'"<>)\]}]*/gi

export function redactUrls(text: string): string {
  return text.replace(
    URL_IN_TEXT,
    (_match, scheme: string, host: string) =>
      `${scheme.toLowerCase()}://${host}/…`
  )
}
