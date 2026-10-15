// beforeunload: sem ouvinte, o Electron cancela em silêncio o fechamento (⌘W), a navegação
// (⌘L ↵) e o recarregamento (⌘R) de uma página com rascunho. Aqui o usuário decide, mas só
// quando ele agiu: fechar, recarregar, voltar, ir a um endereço ou clicar na página da aba que
// está na frente. A página que tenta se segurar sozinha (um script em loop, uma aba em segundo
// plano) não ganha diálogo nem roubo de foco: a saída que ela impediu segue impedida, em silêncio.
// E é uma pergunta por ação: os quadros seguintes da mesma ação repetem a resposta.
import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'
import { activateTab } from '../actions/activate-tab'
import type { MainContext } from '../context'
import { confirmLeavePage } from './confirm-leave-page'
import { latestUserIntent } from './user-intent'

export function attachUnloadGuard(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  wc.on('will-prevent-unload', event => {
    const intent = latestUserIntent(ctx, tabId)
    // sem ação do usuário: nada de diálogo (o Electron mantém a página onde está)
    if (intent === null) return

    // outro quadro da mesma ação (iframe com beforeunload): a resposta já foi dada
    const answered = ctx.guard.unloadAnswers.get(tabId)
    if (answered && answered.intent === intent) {
      if (answered.leave) event.preventDefault()
      return
    }

    // a pergunta é de uma aba que o usuário pode não estar vendo (fechar pelo menu da sidebar)
    if (ctx.attached.tabId !== tabId && ctx.store.getTab(tabId))
      activateTab(ctx, tabId)

    const leave = confirmLeavePage(ctx)
    ctx.guard.unloadAnswers.set(tabId, { intent, leave })
    if (leave) {
      // Sair: ignora o beforeunload da página e segue o que estava em andamento
      event.preventDefault()
      return
    }

    // Ficar: o fechamento ou a navegação foi cancelado e a aba segue como estava
    ctx.closing.delete(tabId)
    ctx.httpFallbacks.delete(tabId)
    if (!wc.isDestroyed()) ctx.store.patchTab(tabId, { url: wc.getURL() })
  })
}
