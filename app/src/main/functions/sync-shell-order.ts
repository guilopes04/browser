// A shell fica sob a página; sobe por cima só enquanto há um motivo de overlay (revelação da
// sidebar oculta, dicas do compacto) e desce quando o último motivo sai (docs/arquitetura.md, seção 1).
import type { MainContext } from '../context'

export function syncShellOrder(ctx: MainContext): void {
  if (ctx.win.isDestroyed()) return
  const raised = ctx.store.state.overlay.length > 0
  if (raised === ctx.shellRaised) return
  ctx.shellRaised = raised
  // reinserir uma view filha a move: sem índice vai para o topo, com 0 vai para o fundo
  if (raised) ctx.win.contentView.addChildView(ctx.shell)
  else ctx.win.contentView.addChildView(ctx.shell, 0)
}
