// Abre o painel de rede dos Ajustes do Sistema (botão da página de erro sem conexão).
import { shell } from 'electron'

const NETWORK_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.Network-Settings.extension'

export function openNetworkSettings(): void {
  void shell.openExternal(NETWORK_SETTINGS_URL).catch(() => {})
}
