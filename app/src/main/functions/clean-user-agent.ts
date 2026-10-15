// User agent sem os tokens do Electron e do app: alguns sites degradam ou bloqueiam com eles.
// Pura. Exemplo de entrada do Electron:
//   Mozilla/5.0 (...) AppleWebKit/537.36 (KHTML, like Gecko) GilasBrowser/0.1.0 Chrome/152.0.0.0
//   Electron/44.7.2 Safari/537.36
// O token do app é o nome do produto sem espaços, então não dá para casar por nome fixo: ele é
// sempre o que vem entre "Gecko)" e "Chrome/".
export function cleanUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\sElectron\/\S+/g, '')
    .replace(/(\(KHTML, like Gecko\))\s+\S+\/\S+(?=\s+Chrome\/)/, '$1')
}
