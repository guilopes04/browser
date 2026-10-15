// Marca que o content script rodou e tenta falar com o service worker
document.documentElement.setAttribute('data-sonda-content', '1')
try {
  chrome.runtime.sendMessage({ tipo: 'content-ola', url: location.href }).then(
    r => console.log('SONDA content recebeu resposta', JSON.stringify(r)),
    e => console.log('SONDA content erro sendMessage', String(e))
  )
} catch (e) {
  console.log('SONDA content excecao', String(e))
}

try {
  chrome.runtime.onMessage.addListener((m, s, send) => { send({ contentRecebeu: m }); return false })
} catch (e) {
  console.log('SONDA content onMessage excecao', String(e))
}
