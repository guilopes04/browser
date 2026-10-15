// ICO e SVG que o nativeImage não lê no macOS: o tipo vem do cabeçalho, mas o servidor pode
// mentir ou omitir, então olha o conteúdo. Puro.
export function sniffRawImageType(
  contentType: string,
  buffer: Buffer
): 'image/svg+xml' | 'image/x-icon' | null {
  if (/image\/svg\+xml/i.test(contentType)) return 'image/svg+xml'
  if (/image\/(x-icon|vnd\.microsoft\.icon)/i.test(contentType))
    return 'image/x-icon'
  const isIco = buffer.length > 6 && buffer.readUInt32LE(0) === 0x00010000
  if (isIco) return 'image/x-icon'
  const head = buffer.subarray(0, 512).toString('utf8')
  return /<svg[\s>]/i.test(head) ? 'image/svg+xml' : null
}
