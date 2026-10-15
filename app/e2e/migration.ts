// Migração do histórico antigo (history-<espaço>.json) no uso normal, sem abrir a paleta: o app
// abre, a aba ativa navega e o primeiro append do debounce (2 s) ocorre antes da leitura adiada
// (3 s). O histórico antigo precisa acabar no history.jsonl, com os arquivos antigos renomeados.
// Pré-requisito: npm run build. Uso: npm run e2e:migration
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as L from './lib.ts'

const titles = (sections: L.Json[]) =>
  sections.flatMap(section =>
    section.items.map(
      (item: L.Json) => `${section.id}:${item.title || item.label || item.text}`
    )
  )

await L.runSuite(
  'migration',
  async (record, profile) => {
    // sem consulta nenhuma por 7 s: só a navegação da aba ativa dispara a gravação
    await L.sleep(7000)
    const jsonl = join(profile, 'history.jsonl')
    const files = () =>
      readdirSync(profile).filter(name => name.startsWith('history'))
    const lines = existsSync(jsonl)
      ? readFileSync(jsonl, 'utf8').trim().split('\n')
      : []
    record(
      'M1 sem abrir a paleta, o histórico antigo já está no history.jsonl e os arquivos antigos foram renomeados',
      lines.some(line => line.includes('Changelog do Linear')) &&
        lines.some(line => line.includes('Quadro antigo do Jira')) &&
        files().includes('history-personal.json.migrado') &&
        files().includes('history-work.json.migrado'),
      { arquivos: files(), linhas: lines }
    )
    const changelog = titles(await L.query('changelog'))
    const jira = titles(await L.query('jira'))
    record(
      'M2 a paleta acha as páginas do formato antigo',
      changelog.some(t => t.includes('Changelog do Linear')) &&
        jira.some(t => t.includes('Quadro antigo do Jira')),
      { changelog, jira }
    )
  },
  {}
)
