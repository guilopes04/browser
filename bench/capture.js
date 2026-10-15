#!/usr/bin/env node
// Captura a maior janela de um dono (nome do app no CGWindowList), sem sombra.
// Uso: node bench/capture.js <nomeDoDono> <saida.png> [parteDoTitulo]
const path = require('path')
const sys = require('./lib/system')

async function main() {
  const [owner, output, titlePart] = process.argv.slice(2)
  if (!owner || !output) {
    console.error('uso: node bench/capture.js <nomeDoDono> <saida.png> [parteDoTitulo]')
    process.exit(2)
  }
  const windows = (await sys.listWindows())
    .filter(item => item.owner.toLowerCase() === owner.toLowerCase())
    .filter(item => !titlePart || item.title.toLowerCase().includes(titlePart.toLowerCase()))
    .sort((a, b) => b.width * b.height - a.width * a.height)
  if (windows.length === 0) {
    console.error(`nenhuma janela de "${owner}"${titlePart ? ` com "${titlePart}" no título` : ''}`)
    process.exit(1)
  }
  const main = windows[0]
  await sys.captureWindow(main.id, path.resolve(output))
  console.log(JSON.stringify({ id: main.id, dono: main.owner, titulo: main.title, x: main.x, y: main.y, largura: main.width, altura: main.height, arquivo: path.resolve(output) }))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
