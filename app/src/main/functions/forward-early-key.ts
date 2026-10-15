// Com a paleta ou a Nova aba abrindo, repassa a tecla à shell (keys:early) em vez de deixá-la ir
// para a página ou para a shell antes de o campo existir. Os eventos do main para a shell chegam
// em ordem, e a tecla vem depois de palette:show (ou do snapshot que traz a aba).
import type { Input } from 'electron'
import { classifyEarlyKey } from '@shared/early-key'
import type { MainContext } from '../context'
import { closeKeyGate, getOpenKeyGate } from './key-gate'

export function forwardEarlyKey(
  ctx: MainContext,
  event: { preventDefault(): void },
  input: Input
): void {
  const target = getOpenKeyGate(ctx)
  if (!target) return
  const action = classifyEarlyKey(input)
  switch (action.kind) {
    case 'forward':
      event.preventDefault()
      ctx.broadcaster.send('keys:early', { target, key: action.key })
      break
    case 'swallow':
      event.preventDefault()
      break
    case 'compose':
      // o repasse de "~" e depois "a" chegaria como "a": o resto é do campo
      closeKeyGate(ctx)
      break
  }
}
