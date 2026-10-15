// Permissões de página. O padrão do Electron concede tudo (câmera, microfone, localização,
// notificações, Bluetooth, USB...): aqui só passa o que não expõe nada do Mac. Pura.

// tela cheia (vídeo), copiar para a área de transferência e travar o ponteiro (jogos)
export const PAGE_PERMISSIONS: ReadonlySet<string> = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock'
])

// sessões que não são de página (a padrão, que só serve a shell) não concedem nada
export const NO_PERMISSIONS: ReadonlySet<string> = new Set()

export function isPermissionAllowed(
  permission: string,
  allowed: ReadonlySet<string> = PAGE_PERMISSIONS
): boolean {
  return allowed.has(permission)
}
