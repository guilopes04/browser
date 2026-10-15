// Diálogo de confirmação de "Limpar dados de navegação…". Apagar não tem volta, então "Cancelar"
// é o botão padrão (Esc e ↵ não apagam nada). Pura.
export interface ClearDataDialog {
  type: 'warning'
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
}

export const CLEAR_DATA_CONFIRM = 0

export function describeClearData(spaceName: string): ClearDataDialog {
  return {
    type: 'warning',
    message: `Limpar os dados de navegação de ${spaceName}?`,
    detail:
      'Apaga os cookies, o cache, os dados dos sites e os service workers, o histórico e as abas fechadas recentemente deste espaço. ' +
      'As abas abertas, os favoritos e os outros espaços não mudam. Não dá para desfazer.',
    buttons: ['Limpar dados', 'Cancelar'],
    defaultId: 1,
    cancelId: 1
  }
}
