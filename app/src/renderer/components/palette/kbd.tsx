export function Kbd({ keys }: { keys: string }) {
  return keys ? <span class="pal-kbd">{keys}</span> : null
}
