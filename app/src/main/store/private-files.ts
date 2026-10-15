// Dados do usuário no disco (sessão, histórico, log) são só dele: arquivos 0600 e a pasta 0700,
// mesmo os que versões anteriores criaram com a permissão padrão (0644).
import { appendFileSync, chmodSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const PRIVATE_FILE_MODE = 0o600
export const PRIVATE_DIR_MODE = 0o700

// arquivos que o app grava em userData (e em userData/logs)
const DATA_FILES = [
  'session.json',
  'history.jsonl',
  join('logs', 'main.log'),
  join('logs', 'main.old.log')
]

function tryChmod(path: string, mode: number): void {
  try {
    chmodSync(path, mode)
  } catch {
    // não existe ainda, ou não é do usuário: o que importa é o que nasce daqui em diante
  }
}

// chmod nos arquivos que já existem (históricos antigos incluídos)
export function protectDataFiles(userData: string): void {
  tryChmod(userData, PRIVATE_DIR_MODE)
  tryChmod(join(userData, 'logs'), PRIVATE_DIR_MODE)
  for (const file of DATA_FILES)
    tryChmod(join(userData, file), PRIVATE_FILE_MODE)
  try {
    for (const name of readdirSync(userData))
      if (/^history-.+\.json(\.migrado)?$/.test(name))
        tryChmod(join(userData, name), PRIVATE_FILE_MODE)
  } catch {
    // pasta ainda não existe
  }
}

const protectedAppends = new Set<string>()

// append em arquivo privado: nasce 0600 e, na primeira vez neste processo, um arquivo que já
// existia com outro modo é corrigido
export function appendPrivate(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: PRIVATE_DIR_MODE })
  appendFileSync(path, data, { mode: PRIVATE_FILE_MODE })
  if (protectedAppends.has(path)) return
  protectedAppends.add(path)
  tryChmod(path, PRIVATE_FILE_MODE)
}
