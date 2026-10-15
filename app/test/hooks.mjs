import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SHARED = resolvePath(
  dirname(fileURLToPath(import.meta.url)),
  '../src/shared'
)

function tryFile(base) {
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href
  }
  return null
}

const ELECTRON_STUB = pathToFileURL(
  resolvePath(dirname(fileURLToPath(import.meta.url)), 'electron-stub.mjs')
).href

export async function resolve(specifier, context, nextResolve) {
  // só os testes do main importam o Electron de verdade, e rodam sem ele
  if (specifier === 'electron')
    return { url: ELECTRON_STUB, shortCircuit: true }
  if (specifier.startsWith('@shared/')) {
    const url = tryFile(resolvePath(SHARED, specifier.slice('@shared/'.length)))
    if (url) return nextResolve(url, context)
  }
  if (
    specifier.startsWith('.') &&
    !/\.[cm]?[jt]s$/.test(specifier) &&
    context.parentURL
  ) {
    const url = tryFile(
      resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
    )
    if (url) return nextResolve(url, context)
  }
  return nextResolve(specifier, context)
}
