// Reserva o nome do arquivo na pasta de downloads com abertura exclusiva ('wx'): se dois downloads
// do mesmo nome começam juntos, ou se outro processo cria o arquivo no meio, cada um fica com um
// nome só seu. O arquivo vazio reservado é sobrescrito pelo download quando ele termina.
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { join } from 'node:path'
import { fileNameCandidates } from './pick-file-name'

export interface ReserveDeps {
  open: (path: string, flags: string) => number
  close: (fd: number) => void
}

const REAL: ReserveDeps = {
  open: (path, flags) => openSync(path, flags),
  close: fd => closeSync(fd)
}

// devolve o caminho reservado. Lança se a pasta não aceita criar o arquivo
export function reserveDownloadPath(
  dir: string,
  name: string,
  deps: ReserveDeps = REAL
): string {
  mkdirSync(dir, { recursive: true })
  for (const candidate of fileNameCandidates(name)) {
    const path = join(dir, candidate)
    try {
      deps.close(deps.open(path, 'wx'))
      return path
    } catch (error) {
      // o nome já existe (ou foi reservado agora há pouco): o próximo
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw error
    }
  }
  throw new Error('não há nome livre para o download')
}
