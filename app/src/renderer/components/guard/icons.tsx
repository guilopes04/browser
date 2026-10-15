// Ícones pequenos dos avisos de segurança (traço de 1.6 como os demais).

// cadeado aberto: conexão sem criptografia
export function InsecureIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.75" />
      <path d="M5.25 7V5a2.75 2.75 0 0 1 5.4-.7" />
    </svg>
  )
}

// janelinha com um risco: pop-up bloqueado
export function PopupBlockedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M2 6.25h12" />
      <path d="m5 12 6-4" />
    </svg>
  )
}

// balão com ponto de exclamação: diálogo da página descartado
export function DialogBlockedIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3.5 3h9A1.5 1.5 0 0 1 14 4.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-3 2.5V11h-1.5A1.5 1.5 0 0 1 2 9.5v-5A1.5 1.5 0 0 1 3.5 3Z" />
      <path d="M8 5.5v2.25" />
    </svg>
  )
}
