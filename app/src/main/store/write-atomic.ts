// Grava um arquivo de forma atômica e privada: .tmp ao lado (modo 0600, com fsync) e rename por
// cima. Quem lê vê sempre o arquivo antigo inteiro ou o novo inteiro, nunca um pedaço.
import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  writeSync
} from 'node:fs'
import { dirname } from 'node:path'
import { PRIVATE_DIR_MODE, PRIVATE_FILE_MODE } from './private-files'

export function writeAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: PRIVATE_DIR_MODE })
  const temp = `${path}.tmp`
  const fd = openSync(temp, 'w', PRIVATE_FILE_MODE)
  try {
    writeSync(fd, data)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  // um .tmp antigo (versão anterior, umask diferente) mantém o modo que tinha
  chmodSync(temp, PRIVATE_FILE_MODE)
  renameSync(temp, path)
}
