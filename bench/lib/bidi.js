// Cliente mínimo de WebDriver BiDi (Firefox/Zen) usando o WebSocket global do Node 22.

function connect(port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/session`)
    const pending = new Map()
    let nextId = 1
    const timer = setTimeout(() => {
      try {
        socket.close()
      } catch (e) {}
      reject(new Error('BiDi: timeout ao conectar'))
    }, timeoutMs)

    function send(method, params = {}, commandTimeoutMs = 8000) {
      const id = nextId++
      return new Promise((ok, fail) => {
        const commandTimer = setTimeout(() => {
          pending.delete(id)
          fail(new Error(`BiDi ${method}: timeout`))
        }, commandTimeoutMs)
        pending.set(id, { ok, fail, commandTimer })
        socket.send(JSON.stringify({ id, method, params }))
      })
    }

    socket.onopen = async () => {
      clearTimeout(timer)
      try {
        await send('session.new', { capabilities: {} })
        resolve({
          send,
          close: () => {
            try {
              socket.close()
            } catch (e) {}
          },
          isOpen: () => socket.readyState === WebSocket.OPEN
        })
      } catch (error) {
        reject(error)
      }
    }
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.commandTimer)
      if (message.type === 'error') entry.fail(new Error(`${message.error}: ${message.message}`))
      else entry.ok(message.result)
    }
    socket.onerror = () => {
      clearTimeout(timer)
      reject(new Error('BiDi: falha ao conectar'))
    }
    socket.onclose = () => {
      for (const entry of pending.values()) {
        clearTimeout(entry.commandTimer)
        entry.fail(new Error('BiDi: conexão fechada'))
      }
      pending.clear()
    }
  })
}

// Sessão sobre uma conexão BiDi: lista abas de topo e consulta o estado de cada documento.
function createSession(connection) {
  async function topContexts() {
    const tree = await connection.send('browsingContext.getTree', {})
    return tree.contexts || []
  }

  async function evaluate(context, expression) {
    const result = await connection.send('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: false,
      resultOwnership: 'none'
    })
    if (result.type !== 'success') return undefined
    return result.result.value
  }

  async function activate(context) {
    await connection.send('browsingContext.activate', { context })
  }

  return { topContexts, evaluate, activate, close: () => connection.close() }
}

module.exports = { connect, createSession }
