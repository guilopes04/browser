// Barra de busca na página (Busca.dc.html): 397×44 no canto do painel, com a sombra do design. O
// texto, o contador e o "Aa" são do main; o teclado (↵ ⇧↵ esc) é desta view, que está com o foco.
// ⌘F, ⌘G e ⇧⌘G o main trata na entrada da tecla.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'
import {
  FIND_BAR_HEIGHT,
  FIND_BAR_MARGIN,
  FIND_BAR_WIDTH,
  THEME_TOKENS
} from '@shared/tokens'
import {
  closeFind,
  findView,
  sendFindReady,
  sendFindText,
  setFindCase,
  stepFind
} from '../../find-state'
import { CloseSearchIcon, NextIcon, PreviousIcon } from './icons'

// clicar nos botões não tira o foco da caixa: só o próprio campo recebe o clique de verdade
function keepFocus(event: MouseEvent): void {
  event.preventDefault()
}

function handleKey(event: KeyboardEvent): void {
  // o IME ainda está compondo: ↵ e esc são dele
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeFind()
    return
  }
  // ↵ num botão focado (pelo ⇥) aciona o botão
  if (event.key === 'Enter' && !event.metaKey) {
    if (event.target instanceof HTMLButtonElement) return
    event.preventDefault()
    stepFind(!event.shiftKey)
  }
}

export function FindBar() {
  const view = findView.value
  const inputRef = useRef<HTMLInputElement>(null)
  // as revisões já aplicadas: o texto trocado pelo main só entra na caixa uma vez, e a caixa
  // seleciona o texto quando o main pede foco
  const applied = useRef({ text: -1, focus: 0 })

  // a caixa nasce com o foco, na mesma tarefa em que aparece, e avisa o main: ele deixa de repassar
  // as teclas e manda o estado
  useLayoutEffect(() => {
    inputRef.current?.focus()
    sendFindReady()
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input || !view) return
    if (applied.current.text !== view.textRevision) {
      applied.current.text = view.textRevision
      input.value = view.text
      input.setSelectionRange(view.text.length, view.text.length)
    }
    if (applied.current.focus !== view.focusRevision) {
      applied.current.focus = view.focusRevision
      input.select()
    }
    input.focus()
  }, [view?.textRevision, view?.focusRevision])

  const theme = view?.theme ?? 'light'
  const tokens = THEME_TOKENS[theme]
  const vars = {
    '--accent': view?.accent ?? '#4352C4',
    '--text': tokens.text,
    '--sec': tokens.sec,
    '--icon': tokens.icon,
    '--hover-bg': tokens.hoverBg,
    '--find-width': `${FIND_BAR_WIDTH}px`,
    '--find-height': `${FIND_BAR_HEIGHT}px`,
    '--find-left': `${FIND_BAR_MARGIN.left}px`,
    '--find-top': `${FIND_BAR_MARGIN.top}px`
  }

  return (
    <div class="root" data-theme={theme} style={vars}>
      {/* invisível até o primeiro estado (o tema ainda não chegou), mas já com o foco */}
      <div
        class="find-bar"
        role="search"
        aria-label="Buscar na página"
        data-ready={view !== null}
      >
        <label class="sr-only" for="find-input">
          Buscar na página
        </label>
        <input
          ref={inputRef}
          id="find-input"
          class="find-input"
          type="text"
          spellcheck={false}
          autocomplete="off"
          autocapitalize="off"
          onInput={event => sendFindText(event.currentTarget.value)}
        />
        <span class="find-count" aria-live="polite">
          {view?.count ?? ''}
        </span>
        <button
          type="button"
          class="find-button"
          aria-label="Anterior (⇧⌘G)"
          onMouseDown={keepFocus}
          onClick={() => stepFind(false)}
        >
          <PreviousIcon />
        </button>
        <button
          type="button"
          class="find-button"
          aria-label="Próximo (⌘G)"
          onMouseDown={keepFocus}
          onClick={() => stepFind(true)}
        >
          <NextIcon />
        </button>
        <button
          type="button"
          class="find-case"
          aria-label="Diferenciar maiúsculas"
          aria-pressed={view?.matchCase ?? false}
          onMouseDown={keepFocus}
          onClick={() => setFindCase(!(view?.matchCase ?? false))}
        >
          Aa
        </button>
        <div class="find-separator" />
        <button
          type="button"
          class="find-button find-close"
          aria-label="Fechar busca (esc)"
          onMouseDown={keepFocus}
          onClick={closeFind}
        >
          <CloseSearchIcon />
        </button>
      </div>
    </div>
  )
}
