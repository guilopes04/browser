// Sidebar oculta (⌘S): um gatilho de 8 px na borda esquerda a revela flutuando sobre a página
// (SidebarOculta.dc.html). Ela sai quando o ponteiro se afasta, com esc ou com um clique fora.
import { useEffect, useRef } from 'preact/hooks'
import { api } from '../../api'
import { Sidebar } from '../sidebar'

// o ponteiro precisa ficar a mais de 16 px da sidebar por 250 ms para ela sair
const FAR_PX = 16
const LEAVE_DELAY_MS = 250

function raise(on: boolean) {
  api.send('shell:raise', { reason: 'peek', on })
}

// abre num movimento do ponteiro dentro da faixa, não na entrada: ao fechar com o ponteiro parado
// na borda, o gatilho reaparece sob ele e o Chromium dispara uma "entrada" sintética, que
// reabriria a sidebar na hora
export function PeekTrigger() {
  return <div class="peek-trigger" onMouseMove={() => raise(true)} />
}

export function PeekSidebar() {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
    }
    const close = () => {
      cancel()
      raise(false)
    }
    const onMove = (event: MouseEvent) => {
      const rect = panel.current?.getBoundingClientRect()
      if (!rect) return
      const far =
        event.clientX > rect.right + FAR_PX ||
        event.clientY < rect.top - FAR_PX ||
        event.clientY > rect.bottom + FAR_PX
      if (!far) cancel()
      else timer ??= setTimeout(close, LEAVE_DELAY_MS)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousemove', onMove)
    // o ponteiro saiu da janela ou o foco foi para outro lugar (a página, outro app)
    document.documentElement.addEventListener('mouseleave', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      cancel()
      document.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [])

  return (
    <>
      <div class="peek-scrim" onMouseDown={() => raise(false)} />
      <div class="peek" ref={panel}>
        <Sidebar />
      </div>
    </>
  )
}
