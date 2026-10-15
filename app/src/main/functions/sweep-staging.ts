// Pastas temporárias de download sem gesto (stage-download.ts) que sobraram: o app caiu, ou foi
// encerrado com a pergunta "Permitir?" na tela. O arquivo que o Chromium já gravou ficaria no
// temporário para sempre, sem quarentena. O nome da pasta leva o pid do processo que a criou, então
// a varredura da abertura só apaga a de quem já morreu (outra instância do app, com outro perfil,
// pode estar viva e esperando a resposta do usuário). As pastas do formato antigo (sem pid) saem
// quando passam de um dia.
import { lstatSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export const STAGING_PREFIX = 'gilas-download-'

// gilas-download-<pid>-<aleatório>
const WITH_PID = /^gilas-download-(\d+)-[A-Za-z0-9]{6}$/
// gilas-download-<aleatório> (versões antes de o pid entrar no nome)
const LEGACY = /^gilas-download-[A-Za-z0-9]{6}$/

const LEGACY_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface SweepOptions {
  // o processo existe? (padrão: sinal 0; EPERM quer dizer que existe e é de outro usuário)
  isAlive?: (pid: number) => boolean
  // as pastas deste processo também saem (ao encerrar o app)
  includeOwn?: boolean
  ownPid?: number
  now?: number
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// apaga as pastas órfãs de `root`; devolve quantas saíram. Nunca lança: é limpeza, não requisito
export function sweepStaging(root: string, options: SweepOptions = {}): number {
  const {
    isAlive = pidIsAlive,
    includeOwn = false,
    ownPid = process.pid,
    now = Date.now()
  } = options
  let names: string[]
  try {
    names = readdirSync(root).filter(name => name.startsWith(STAGING_PREFIX))
  } catch {
    return 0
  }
  const uid = process.getuid?.()
  let removed = 0
  for (const name of names) {
    const path = join(root, name)
    try {
      // só pasta de verdade e do próprio usuário: um link ou o arquivo de outro não é nosso
      const info = lstatSync(path)
      if (!info.isDirectory() || (uid !== undefined && info.uid !== uid))
        continue
      const withPid = WITH_PID.exec(name)
      if (withPid) {
        const pid = Number(withPid[1])
        const own = pid === ownPid
        if (own ? !includeOwn : isAlive(pid)) continue
      } else if (LEGACY.test(name)) {
        if (now - info.mtimeMs < LEGACY_MAX_AGE_MS) continue
      } else continue
      rmSync(path, { recursive: true, force: true })
      removed++
    } catch (error) {
      console.error('[Downloads][staging] falha ao varrer', name, error)
    }
  }
  return removed
}
