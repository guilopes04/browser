// Códigos de rede do Chromium (net_error_list.h) com que um servidor só-HTTP responde ao TLS que o
// https:// pede: o app tenta http uma vez, e só quando o endereço foi digitado sem esquema.
const HTTP_FALLBACK_ERRORS = new Set([
  // ERR_FAILED: o que o neverssl.com e roteadores simples devolvem em alguns casos
  -2,
  // ERR_CONNECTION_CLOSED, ERR_CONNECTION_RESET, ERR_CONNECTION_REFUSED
  -100, -101, -102,
  // ERR_SSL_PROTOCOL_ERROR
  -107,
  // ERR_SSL_VERSION_OR_CIPHER_MISMATCH
  -113,
  // ERR_EMPTY_RESPONSE
  -324
])

export function shouldFallbackToHttp(errorCode: number): boolean {
  return HTTP_FALLBACK_ERRORS.has(errorCode)
}
