// Download sem gesto fica numa pasta temporária (fora de ~/Downloads) até o usuário permitir: o
// Chromium grava os primeiros bytes antes de a pausa valer, e nada vindo de uma página que o
// usuário não pediu pode aparecer na pasta dele sem ele saber. Permitido, o arquivo concluído vai
// para o nome reservado em Downloads; recusado, a pasta temporária some.
import { copyFileSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { sanitizeFileName } from './pick-file-name'
import { reserveDownloadPath } from './reserve-download-path'

export interface Staging {
  dir: string
  // onde o Chromium grava enquanto o usuário decide
  path: string
}

// root: a pasta temporária do app (app.getPath('temp')); o nome da subpasta é aleatório
export function createStaging(root: string, fileName: string): Staging {
  const dir = mkdtempSync(join(root, 'gilas-download-'))
  return { dir, path: join(dir, sanitizeFileName(fileName)) }
}

export function dropStaging(staging: Staging): void {
  try {
    rmSync(staging.dir, { recursive: true, force: true })
  } catch (error) {
    console.error(
      '[Downloads][staging] falha ao limpar a pasta temporária',
      error
    )
  }
}

// leva o arquivo concluído para o nome reservado em `downloads`; devolve o caminho final
export function commitStaging(
  staging: Staging,
  downloads: string,
  fileName: string
): string {
  const target = reserveDownloadPath(downloads, fileName)
  try {
    // o arquivo vazio reservado é sobrescrito pelo rename
    renameSync(staging.path, target)
  } catch (error) {
    // outro volume (EXDEV): copia por cima do reservado
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    copyFileSync(staging.path, target)
  }
  dropStaging(staging)
  return target
}
