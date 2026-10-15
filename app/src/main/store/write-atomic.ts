// Grava um arquivo de forma atômica: .tmp ao lado e rename por cima.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function writeAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, data)
  renameSync(temp, path)
}
