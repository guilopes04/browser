// Permite rodar os testes com node --experimental-strip-types: resolve o alias @shared
// e os imports relativos sem extensão (como o bundler faz).
import { register } from 'node:module'

register('./hooks.mjs', import.meta.url)
