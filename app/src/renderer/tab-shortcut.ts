// Atalho ⌘n da aba na posição `index` da lista do espaço: ⌘1…⌘8 são as oito primeiras e ⌘9 é
// sempre a última. Sem atalho, devolve undefined.
export function getTabShortcutLabel(
  index: number,
  total: number
): string | undefined {
  if (index < 8) return `⌘${index + 1}`
  return index === total - 1 ? '⌘9' : undefined
}
