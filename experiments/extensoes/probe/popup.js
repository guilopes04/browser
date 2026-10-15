const out = document.getElementById('out')
async function main() {
  const r = {}
  r.id = chrome.runtime && chrome.runtime.id
  try { r.sw = await chrome.runtime.sendMessage({ tipo: 'popup-ola' }) } catch (e) { r.swErro = String(e) }
  try { const t = await chrome.tabs.query({}); r.tabs = t.map(x => ({ id: x.id, url: x.url, active: x.active })) } catch (e) { r.tabsErro = String(e) }
  try { const t = await chrome.tabs.query({ active: true, currentWindow: true }); r.tabAtiva = t.map(x => x.url) } catch (e) { r.tabAtivaErro = String(e) }
  out.textContent = JSON.stringify(r, null, 2)
  console.log('SONDA popup ' + JSON.stringify(r))
}
main()
