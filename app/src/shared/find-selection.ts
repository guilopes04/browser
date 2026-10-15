// O texto que o ⌘F pega da seleção da página: uma linha só, sem espaços sobrando e curto. Puro.
const MAX_LENGTH = 200

export function normalizeFindSelection(selection: string): string {
  return selection.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH)
}
