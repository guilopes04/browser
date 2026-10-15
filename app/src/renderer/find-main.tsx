// Entrada da barra de busca na página (find.html): a view pequena que o main põe sobre a página
// da aba ao abrir o ⌘F.
import { render } from 'preact'
import { FindBar } from './components/find-bar'
import { startFindSync } from './find-state'
import './styles/base.css'
import './styles/find-bar.css'

startFindSync()
render(<FindBar />, document.getElementById('app') as HTMLElement)
