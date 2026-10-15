// Onde fica a sessão do usuário.
import { join } from 'node:path'

export function getSessionPath(userData: string): string {
  return join(userData, 'session.json')
}
