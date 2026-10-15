// SVGs copiados do design (Sidebar.dc.html e NovaAba.dc.html).

export function SidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M6 3v10" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10 3 5 8l5 5" />
    </svg>
  )
}

export function ForwardIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  )
}

export function ReloadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.55" />
      <path d="M13 2.5V5h-2.5" />
    </svg>
  )
}

export function ChevronDownIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  )
}

export function ShieldIcon({
  size,
  strokeWidth = 1.7
}: {
  size: number
  strokeWidth?: number
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linejoin="round"
    >
      <path d="M8 1.75 2.75 3.75v4c0 3 2.25 5.25 5.25 6.5 3-1.25 5.25-3.5 5.25-6.5v-4Z" />
    </svg>
  )
}

export function SpeakerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 6h2.5L8.5 3v10L5 10H2.5Z" />
      <path d="M11 5.5a3.5 3.5 0 0 1 0 5" />
      <path d="M12.75 3.75a6 6 0 0 1 0 8.5" />
    </svg>
  )
}

// alto-falante cortado (aba silenciada)
export function SpeakerMutedIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 6h2.5L8.5 3v10L5 10H2.5Z" />
      <path d="m11.25 6 3 4m0-4-3 4" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg
      role="img"
      aria-label="Suspensa"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    >
      <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5Z" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    >
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M8 2.5V10M4.75 7 8 10.25 11.25 7" />
      <path d="M3 13h10" />
    </svg>
  )
}

export function ExtensionIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <path d="M3 4.5h3v-.75a1.5 1.5 0 0 1 3 0v.75h3v3h-.75a1.5 1.5 0 0 0 0 3H12v3H3v-3h.75a1.5 1.5 0 0 0 0-3H3Z" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}

// ícones da página de erro (Erro.dc.html): 40 px, traço 1.5
export function NetworkOffIcon() {
  return (
    <svg
      role="img"
      aria-label="Sem conexão"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 9a14 14 0 0 1 19 0" />
      <path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" />
      <path d="M9 16a4.5 4.5 0 0 1 6 0" />
      <circle cx="12" cy="19.25" r="0.75" fill="currentColor" />
      <path d="m3 3 18 18" />
    </svg>
  )
}

export function ProblemIcon() {
  return (
    <svg
      role="img"
      aria-label="Problema"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.25" />
      <circle cx="12" cy="16.25" r="0.75" fill="currentColor" />
    </svg>
  )
}
