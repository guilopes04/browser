import { api } from '../../api'
import { activeTab, currentTabs } from '../../state'
import { PlusIcon } from '../icons'
import { TabRow } from './tab-row'

export function TabList() {
  const tabs = currentTabs.value
  const activeId = activeTab.value?.id

  return (
    <div class="tabs-scroll">
      <div class="tab-list">
        {tabs.map(tab => (
          <TabRow key={tab.id} tab={tab} active={tab.id === activeId} />
        ))}
      </div>
      <button
        type="button"
        class="new-tab-btn"
        onClick={() => api.send('tab:create', {})}
      >
        <PlusIcon />
        <span class="new-tab-label">Nova aba</span>
        <span class="new-tab-keys">⌘T</span>
      </button>
    </div>
  )
}
