// Itens do menu de clique direito da página, em português. Pura: o main mapeia cada ação ao
// Electron (functions/show-page-menu.ts), e os testes conferem o que aparece em cada situação.

export type PageMenuAction =
  | 'open-link'
  | 'copy-link'
  | 'open-image'
  | 'copy-image'
  | 'save-image'
  | 'search-web'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'back'
  | 'forward'
  | 'reload'
  | 'inspect'

export type PageMenuEntry =
  | { kind: 'separator' }
  | { kind: 'item'; action: PageMenuAction; label: string; enabled: boolean }

export interface PageMenuInput {
  linkURL: string
  srcURL: string
  mediaType: string
  selectionText: string
  isEditable: boolean
  editFlags: {
    canCut: boolean
    canCopy: boolean
    canPaste: boolean
    canSelectAll: boolean
  }
  canGoBack: boolean
  canGoForward: boolean
  // --dev: só então aparece "Inspecionar elemento"
  dev: boolean
}

const MAX_SEARCH_LABEL = 28

export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

// "Salvar imagem como" baixa pelo main, que não tem a trava de arquivo local do renderer: só o que
// uma página pode mesmo carregar (nada de file://)
export function isSavableImage(url: string): boolean {
  return /^(https?:|data:image\/|blob:)/i.test(url)
}

// o texto selecionado no rótulo: uma linha só, curto, com reticências
export function shortenSelection(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_SEARCH_LABEL
    ? `${flat.slice(0, MAX_SEARCH_LABEL).trimEnd()}…`
    : flat
}

function item(
  action: PageMenuAction,
  label: string,
  enabled = true
): PageMenuEntry {
  return { kind: 'item', action, label, enabled }
}

export function describePageMenu(input: PageMenuInput): PageMenuEntry[] {
  const groups: PageMenuEntry[][] = []
  const selection = input.selectionText.trim()
  const onLink = input.linkURL !== ''
  const onImage = input.mediaType === 'image'

  if (onLink)
    groups.push([
      item('open-link', 'Abrir link em nova aba', isWebUrl(input.linkURL)),
      item('copy-link', 'Copiar link')
    ])

  if (onImage)
    groups.push([
      item('open-image', 'Abrir imagem em nova aba', isWebUrl(input.srcURL)),
      item('copy-image', 'Copiar imagem'),
      item('save-image', 'Salvar imagem como…', isSavableImage(input.srcURL))
    ])

  if (input.isEditable) {
    const { canCut, canCopy, canPaste, canSelectAll } = input.editFlags
    if (selection)
      groups.push([
        item('search-web', `Buscar "${shortenSelection(selection)}" na web`)
      ])
    groups.push([
      item('cut', 'Recortar', canCut),
      item('copy', 'Copiar', canCopy),
      item('paste', 'Colar', canPaste),
      item('select-all', 'Selecionar tudo', canSelectAll)
    ])
  } else if (selection && !onLink && !onImage) {
    // o botão direito no macOS já seleciona a palavra sob o ponteiro: num link ou numa imagem
    // isso não vira "Copiar" nem busca
    groups.push([
      item('copy', 'Copiar', input.editFlags.canCopy),
      item('search-web', `Buscar "${shortenSelection(selection)}" na web`)
    ])
  } else if (!onLink && !onImage) {
    groups.push([
      item('back', 'Voltar', input.canGoBack),
      item('forward', 'Avançar', input.canGoForward),
      item('reload', 'Recarregar')
    ])
  }

  if (input.dev) groups.push([item('inspect', 'Inspecionar elemento')])

  const entries: PageMenuEntry[] = []
  for (const group of groups) {
    if (entries.length > 0) entries.push({ kind: 'separator' })
    entries.push(...group)
  }
  return entries
}
