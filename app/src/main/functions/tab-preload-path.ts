// Caminho do preload das abas (out/preload/tab-guard.js). Nos testes, que rodam o TypeScript sem
// empacotar, não há __dirname e o caminho é vazio.
import { join } from 'node:path'

export function getTabPreloadPath(): string {
  return typeof __dirname === 'string'
    ? join(__dirname, '../preload/tab-guard.js')
    : ''
}
