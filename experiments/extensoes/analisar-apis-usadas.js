// Extrai de forma estática os caminhos chrome.ns.membro usados pelos arquivos .js de uma extensão
// Uso: node analisar-apis-usadas.js <pasta-da-extensao> <saida.json>
const fs = require('fs')
const path = require('path')
const dir = path.resolve(process.argv[2])
const saida = process.argv[3]
const usados = {}
function varrer(d) {
  for (const nome of fs.readdirSync(d)) {
    const p = path.join(d, nome)
    const st = fs.statSync(p)
    if (st.isDirectory()) { varrer(p); continue }
    if (!/\.(js|mjs)$/.test(nome)) continue
    const rel = path.relative(dir, p)
    const txt = fs.readFileSync(p, 'utf8')
    const re = /\bchrome\.([a-zA-Z]+)\.([a-zA-Z_]+)(?:\.([a-zA-Z_]+))?/g
    let m
    while ((m = re.exec(txt))) {
      const caminho = m[3] ? `${m[1]}.${m[2]}.${m[3]}` : `${m[1]}.${m[2]}`
      if (m[2] === 'lastError') continue
      ;(usados[caminho] = usados[caminho] || new Set()).add(rel)
    }
  }
}
varrer(dir)
const out = Object.fromEntries(Object.entries(usados).sort().map(([k, v]) => [k, [...v]]))
fs.writeFileSync(saida, JSON.stringify(out, null, 1))
console.log(Object.keys(out).length, 'caminhos únicos em', saida)
