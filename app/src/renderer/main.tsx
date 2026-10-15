import { render } from 'preact'
import { App } from './app'
import { startSync } from './state'
import './styles/base.css'
import './styles/sidebar.css'
import './styles/compact.css'
import './styles/peek.css'
import './styles/error-page.css'
import './styles/new-tab.css'
import './styles/palette.css'

startSync()
render(<App />, document.getElementById('app') as HTMLElement)
