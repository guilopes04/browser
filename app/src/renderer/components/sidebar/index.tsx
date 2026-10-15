import { AddressField } from './address-field'
import { EssentialsGrid } from './essentials-grid'
import { Footer } from './footer'
import { SpaceSwitcher } from './space-switcher'
import { TabList } from './tab-list'
import { TopBar } from './top-bar'

export function Sidebar() {
  return (
    <nav class="sidebar" aria-label="Abas e navegação">
      <TopBar />
      <SpaceSwitcher />
      <AddressField />
      <EssentialsGrid />
      <div class="hairline" />
      <TabList />
      <Footer />
    </nav>
  )
}
