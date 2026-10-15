// A mudança do store altera algo que vai para o session.json? Pura.
import type { Tab } from '@shared/types'
import type { StoreChange } from './app-store'

// campos da aba que o arquivo guarda (id, espaço e lastActiveAt mudam por 'structure' e 'dirty')
const PERSISTED_TAB_KEYS: readonly (keyof Tab)[] = [
  'url',
  'title',
  'favicon',
  'muted'
]

export function isPersistedChange(change: StoreChange): boolean {
  switch (change.kind) {
    case 'structure':
    case 'dirty':
      return true
    case 'tab':
      return PERSISTED_TAB_KEYS.some(key => key in change.patch)
    case 'view':
      return false
  }
}
