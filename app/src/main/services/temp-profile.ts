// Perfil temporário para a sessão de uso único (--abas sem --user-data-dir): cookies, cache e
// permissões dos espaços não vão para o perfil real do usuário.
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PREFIX = 'gilas-browser-abas-'
const STALE_AFTER_MS = 10 * 60 * 1000

// sobras de execuções que saíram sem limpar (app.exit não passa pelos eventos de saída)
function sweepStaleProfiles(): void {
  try {
    for (const name of readdirSync(tmpdir())) {
      if (!name.startsWith(PREFIX)) continue
      const path = join(tmpdir(), name)
      if (Date.now() - statSync(path).mtimeMs > STALE_AFTER_MS)
        rmSync(path, { recursive: true, force: true })
    }
  } catch {
    // limpeza é só higiene: falhar aqui não pode derrubar o app
  }
}

let tempDir: string | null = null

// apaga o perfil temporário (se este processo criou um). Quem sai com app.exit() não passa
// pelos eventos de saída e chama isto antes
export function removeTempProfile(): void {
  if (!tempDir) return
  const dir = tempDir
  tempDir = null
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // o próximo início varre o que sobrar
  }
  // o próprio processo e os filhos ainda gravam arquivos na saída (Local State, cache): uma
  // segunda limpeza, destacada, apaga o que eles recriarem. O caminho vem do mkdtemp acima
  try {
    spawn('/bin/sh', ['-c', 'sleep 3; rm -rf "$1"', 'sh', dir], {
      detached: true,
      stdio: 'ignore'
    }).unref()
  } catch {
    // sem a segunda limpeza, o próximo início varre
  }
}

// antes de app.ready: aponta userData e sessionData para uma pasta nova e a apaga ao sair
export function useTempProfile(): string {
  sweepStaleProfiles()
  const dir = mkdtempSync(join(tmpdir(), PREFIX))
  tempDir = dir
  app.setPath('userData', dir)
  app.setPath('sessionData', dir)
  process.on('exit', removeTempProfile)
  return dir
}
