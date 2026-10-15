// Cliente mínimo do Chrome DevTools Protocol (Chrome e Electron) usando o WebSocket global do Node 22.

async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  return response.json()
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const pending = new Map()
    let nextId = 1
    socket.onopen = () => {
      resolve({
        send(method, params = {}, timeoutMs = 5000) {
          const id = nextId++
          return new Promise((ok, fail) => {
            const timer = setTimeout(() => {
              pending.delete(id)
              fail(new Error(`CDP ${method}: timeout`))
            }, timeoutMs)
            pending.set(id, { ok, fail, timer })
            socket.send(JSON.stringify({ id, method, params }))
          })
        },
        close: () => socket.close(),
        isOpen: () => socket.readyState === WebSocket.OPEN
      })
    }
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error) entry.fail(new Error(message.error.message))
      else entry.ok(message.result)
    }
    socket.onerror = () => reject(new Error('CDP: falha ao conectar'))
    socket.onclose = () => {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.fail(new Error('CDP: conexão fechada'))
      }
      pending.clear()
    }
  })
}

// Mantém uma conexão por alvo e reaproveita nas rodadas de consulta.
function createSession(port) {
  const sockets = new Map()

  async function socketFor(target) {
    let socket = sockets.get(target.id)
    if (socket && socket.isOpen()) return socket
    socket = await openSocket(target.webSocketDebuggerUrl)
    sockets.set(target.id, socket)
    return socket
  }

  async function evaluate(target, expression) {
    const socket = await socketFor(target)
    const result = await socket.send('Runtime.evaluate', { expression, returnByValue: true })
    return result.result ? result.result.value : undefined
  }

  async function activate(target) {
    const response = await fetch(`http://127.0.0.1:${port}/json/activate/${target.id}`)
    return response.ok
  }

  function close() {
    for (const socket of sockets.values()) {
      try {
        socket.close()
      } catch (e) {}
    }
    sockets.clear()
  }

  return { listTargets: () => listTargets(port), evaluate, activate, close }
}

module.exports = { listTargets, createSession }
