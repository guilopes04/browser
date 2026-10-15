// Utilidades de sistema da bancada: processos (ps), memória (footprint), janelas (winlist), portas e tempo.
const { execFile, spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')

const BENCH = path.resolve(__dirname, '..')
const ROOT = path.resolve(BENCH, '..')
const WINLIST = path.join(BENCH, 'winlist')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function run(file, args, options = {}) {
  return new Promise(resolve => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

// "129:22.55" | "1:02:03.45" -> segundos de CPU
function parseCpuTime(text) {
  const parts = text.split(':').map(Number)
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

// Foto de todos os processos: { pid, ppid, pcpu, rssKB, cpuSeconds, command }
async function snapshotProcesses() {
  const { stdout } = await run('ps', ['-axo', 'pid=,ppid=,pcpu=,rss=,time=,command='])
  const list = []
  for (const line of stdout.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.*)$/)
    if (!match) continue
    list.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pcpu: Number(match[3]),
      rssKB: Number(match[4]),
      cpuSeconds: parseCpuTime(match[5]),
      command: match[6]
    })
  }
  return list
}

// Árvore do navegador: raiz + descendentes (ppid recursivo) + processos cujo comando contém o marcador (perfil).
function collectTree(procs, rootPid, marker) {
  const children = new Map()
  for (const proc of procs) {
    if (!children.has(proc.ppid)) children.set(proc.ppid, [])
    children.get(proc.ppid).push(proc)
  }
  const byPid = new Map(procs.map(proc => [proc.pid, proc]))
  const selected = new Map()
  const visit = proc => {
    if (selected.has(proc.pid) || proc.pid === process.pid) return
    selected.set(proc.pid, proc)
    for (const child of children.get(proc.pid) || []) visit(child)
  }
  if (rootPid && byPid.has(rootPid)) visit(byPid.get(rootPid))
  if (marker) {
    for (const proc of procs) {
      if (proc.pid !== process.pid && proc.command.includes(marker)) visit(proc)
    }
  }
  return [...selected.values()]
}

// Memória física (phys_footprint) somada de uma lista de pids, via /usr/bin/footprint.
async function measureFootprint(pids, scratchDir) {
  if (!fs.existsSync('/usr/bin/footprint') || pids.length === 0) return { totalMB: null, erro: 'footprint indisponível' }
  const jsonFile = path.join(scratchDir, `footprint-${process.pid}-${Date.now()}.json`)
  const args = ['-j', jsonFile, '--noCategories', '-f', 'bytes']
  for (const pid of pids) args.push('-p', String(pid))
  const { error } = await run('/usr/bin/footprint', args)
  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
    fs.unlinkSync(jsonFile)
    const processos = (data.processes || []).map(item => ({ pid: item.pid, name: item.name, bytes: item.footprint }))
    const total = processos.reduce((sum, item) => sum + (item.bytes || 0), 0)
    return {
      totalMB: total / 1048576,
      medidos: processos.length,
      pedidos: pids.length,
      erros: (data.errors || []).length,
      processos
    }
  } catch (e) {
    return { totalMB: null, erro: `footprint falhou: ${error ? error.message : e.message}` }
  }
}

// Janelas na tela (camada 0) usando o binário compilado. Colunas: id, dono, título, bounds, pid
async function listWindows() {
  const { stdout } = await run(WINLIST, [])
  const list = []
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const [id, owner, title, bounds, pid] = line.split('\t')
    const read = key => {
      const match = (bounds || '').match(new RegExp(`"${key}": (-?\\d+)`))
      return match ? Number(match[1]) : 0
    }
    list.push({
      id: Number(id),
      owner,
      title,
      pid: Number(pid),
      x: read('X'),
      y: read('Y'),
      width: read('Width'),
      height: read('Height')
    })
  }
  return list
}

const watchers = new Set()
function stopAllWatchers() {
  for (const child of watchers) child.kill('SIGKILL')
  watchers.clear()
}

// Vigia de janelas (winlist --seguir): chama onWindow({ at, id, owner, pid, x, y, width, height, title }).
function watchWindows(onWindow, intervalMs = 25) {
  const child = spawn(WINLIST, ['--seguir', String(intervalMs)], { stdio: ['ignore', 'pipe', 'ignore'] })
  watchers.add(child)
  let buffer = ''
  child.stdout.on('data', chunk => {
    buffer += chunk.toString()
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      const [at, id, owner, pid, x, y, width, height, ...title] = line.split('\t')
      if (!id) continue
      onWindow({
        at: Number(at),
        id: Number(id),
        owner,
        pid: Number(pid),
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
        title: title.join('\t')
      })
    }
  })
  return {
    stop: () => {
      watchers.delete(child)
      child.kill('SIGKILL')
    }
  }
}

async function captureWindow(windowId, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  const { error, stderr } = await run('screencapture', ['-x', '-o', '-l', String(windowId), outFile])
  if (error || !fs.existsSync(outFile)) throw new Error(`screencapture falhou: ${stderr || (error && error.message)}`)
}

// Traz o processo para a frente (a janela precisa estar visível, senão o navegador trata como oculta).
async function bringToFront(pid) {
  const script = `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`
  return run('osascript', ['-e', script])
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}

async function findByMarker(marker) {
  const procs = await snapshotProcesses()
  return procs.filter(proc => proc.pid !== process.pid && proc.command.includes(marker))
}

// Encerra (SIGTERM na raiz, depois pkill -f no marcador, depois SIGKILL) e confirma que não sobrou nada.
async function shutdown(rootPid, marker) {
  if (rootPid && isAlive(rootPid)) {
    try {
      process.kill(rootPid, 'SIGTERM')
    } catch (e) {}
  }
  const deadline = Date.now() + 15000
  while (Date.now() < deadline && rootPid && isAlive(rootPid)) await sleep(200)
  await run('pkill', ['-f', marker])
  await sleep(1500)
  let left = await findByMarker(marker)
  if (left.length > 0) {
    await run('pkill', ['-9', '-f', marker])
    await sleep(1500)
    left = await findByMarker(marker)
  }
  return { sobraram: left.length, restantes: left.map(proc => `${proc.pid} ${proc.command.slice(0, 120)}`) }
}

function median(values) {
  const list = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
  if (list.length === 0) return null
  const middle = Math.floor(list.length / 2)
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2
}

module.exports = {
  BENCH,
  ROOT,
  WINLIST,
  sleep,
  run,
  freePort,
  snapshotProcesses,
  collectTree,
  measureFootprint,
  listWindows,
  watchWindows,
  stopAllWatchers,
  captureWindow,
  bringToFront,
  isAlive,
  findByMarker,
  shutdown,
  median
}
