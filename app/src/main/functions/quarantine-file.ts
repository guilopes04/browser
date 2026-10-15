// Quarentena do macOS: o arquivo baixado ganha o atributo com.apple.quarantine, e o Gatekeeper
// pergunta antes de abrir um programa que veio da internet. O Chromium do Electron não o aplica.
import { execFile } from 'node:child_process'

export const QUARANTINE_ATTRIBUTE = 'com.apple.quarantine'
const XATTR = '/usr/bin/xattr'
const AGENT = 'Gilas Browser'

// "flags;hora em hexadecimal (segundos);agente;" (0083 = baixado de um app, aberto por duplo clique)
export function quarantineValue(now = Date.now()): string {
  return `0083;${Math.floor(now / 1000).toString(16)};${AGENT};`
}

export type RunXattr = (args: string[]) => Promise<string>

const runXattr: RunXattr = args =>
  new Promise((resolve, reject) => {
    execFile(XATTR, args, { timeout: 10_000 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  })

// grava o atributo e o lê de volta. true = o arquivo está em quarentena
export async function quarantineFile(
  path: string,
  now = Date.now(),
  run: RunXattr = runXattr
): Promise<boolean> {
  const value = quarantineValue(now)
  try {
    await run(['-w', QUARANTINE_ATTRIBUTE, value, path])
    const written = await run(['-p', QUARANTINE_ATTRIBUTE, path])
    return written.trim() === value
  } catch (error) {
    console.error('[Downloads][quarantine] falha ao pôr em quarentena', error)
    return false
  }
}
