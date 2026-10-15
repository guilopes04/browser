// Gera app/build/icon.icns: quadrado arredondado #4352C4 com a letra G branca em SF.
// Roda dentro do Electron (precisa de canvas) e depois usa sips e iconutil, que vêm no macOS:
//   app/node_modules/.bin/electron scripts/gera-icone.js [saida.icns]
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')

const SAIDA = resolve(
  process.argv[2] || join(__dirname, '../app/build/icon.icns')
)

// desenho no molde de ícone do macOS: corpo de 824 px no canvas de 1024, raio de 185 px
const DESENHO = `(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  const corpo = { x: 100, y: 100, lado: 824, raio: 185 }
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#4352C4'
  ctx.beginPath()
  ctx.roundRect(corpo.x, corpo.y, corpo.lado, corpo.lado, corpo.raio)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 600px -apple-system, "SF Pro Display", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const m = ctx.measureText('G')
  const altura = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  const base = 512 + altura / 2 - m.actualBoundingBoxDescent
  ctx.fillText('G', 512 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, base)
  return canvas.toDataURL('image/png')
})()`

async function main() {
  const trabalho = mkdtempSync(join(tmpdir(), 'gilas-icone-'))
  app.setPath('userData', join(trabalho, 'ud'))
  await app.whenReady()
  const janela = new BrowserWindow({ show: false, width: 1024, height: 1024 })
  await janela.loadURL('data:text/html,<meta charset="utf-8">')
  const url = await janela.webContents.executeJavaScript(DESENHO)
  const base = join(trabalho, 'icon-1024.png')
  writeFileSync(base, Buffer.from(url.split(',')[1], 'base64'))

  const conjunto = join(trabalho, 'icon.iconset')
  mkdirSync(conjunto)
  // nomes do iconset: icon_16x16.png (16 px) e a versão retina, com sufixo de escala 2x (32 px)
  const retina = '@' + '2x'
  const nomes = []
  for (const lado of [16, 32, 128, 256, 512]) {
    nomes.push(['icon_' + lado + 'x' + lado + '.png', lado])
    nomes.push(['icon_' + lado + 'x' + lado + retina + '.png', lado * 2])
  }
  for (const [nome, lado] of nomes) {
    execFileSync(
      'sips',
      ['-z', String(lado), String(lado), base, '--out', join(conjunto, nome)],
      { stdio: 'ignore' }
    )
  }
  mkdirSync(join(SAIDA, '..'), { recursive: true })
  execFileSync('iconutil', ['-c', 'icns', conjunto, '-o', SAIDA])
  if (process.env.GILAS_ICONE_PNG)
    execFileSync('cp', [base, process.env.GILAS_ICONE_PNG])
  rmSync(trabalho, { recursive: true, force: true })
  console.log('ícone gerado em ' + SAIDA)
}

main().then(
  () => app.quit(),
  erro => {
    console.error(erro)
    app.exit(1)
  }
)
