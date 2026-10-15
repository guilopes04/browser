// Popover do botão Extensões do rodapé (a lista de extensões chega numa versão futura).
import { signal } from '@preact/signals'

export const extensionsOpen = signal(false)

export function toggleExtensions(): void {
  extensionsOpen.value = !extensionsOpen.value
}

export function closeExtensions(): void {
  extensionsOpen.value = false
}
