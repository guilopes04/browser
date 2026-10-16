import Cocoa

// Uso:
//   winlist                lista as janelas na tela (camada 0): id, dono, título, bounds, pid (separados por TAB)
//   winlist --modais       também lista as janelas em camada 8 (painel modal): com um diálogo síncrono na tela
//                          (showMessageBoxSync) o macOS novo move a janela e a folha para essa camada
//   winlist --seguir [ms]  vigia as janelas a cada ms (padrão 25) e imprime uma linha sempre que uma
//                          janela aparece ou muda de posição/tamanho:
//                          epochMs, id, dono, pid, x, y, largura, altura, título (separados por TAB)
setvbuf(stdout, nil, _IOLBF, 0)

let includeModal = CommandLine.arguments.contains("--modais")
let MODAL_PANEL_LAYER = 8

func windows() -> [[String: Any]] {
  let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
  let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] ?? []
  return list.filter {
    let layer = $0[kCGWindowLayer as String] as? Int ?? 0
    return layer == 0 || (includeModal && layer == MODAL_PANEL_LAYER)
  }
}

func num(_ b: [String: Any], _ key: String) -> Int {
  if let n = b[key] as? NSNumber { return n.intValue }
  return 0
}

let args = CommandLine.arguments
if args.count > 1 && args[1] == "--seguir" {
  let interval = args.count > 2 ? (Double(args[2]) ?? 25) : 25
  var seen: [Int: String] = [:]
  while true {
    for w in windows() {
      let id = w[kCGWindowNumber as String] as? Int ?? 0
      let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
      let name = w[kCGWindowName as String] as? String ?? ""
      let pid = w[kCGWindowOwnerPID as String] as? Int ?? 0
      let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
      let geo = "\(num(b, "X"))\t\(num(b, "Y"))\t\(num(b, "Width"))\t\(num(b, "Height"))"
      if seen[id] != geo {
        seen[id] = geo
        let now = Int(Date().timeIntervalSince1970 * 1000)
        print("\(now)\t\(id)\t\(owner)\t\(pid)\t\(geo)\t\(name)")
      }
    }
    Thread.sleep(forTimeInterval: interval / 1000)
  }
} else {
  for w in windows() {
    let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
    let name = w[kCGWindowName as String] as? String ?? ""
    let num = w[kCGWindowNumber as String] as? Int ?? 0
    let pid = w[kCGWindowOwnerPID as String] as? Int ?? 0
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    print("\(num)\t\(owner)\t\(name)\t\(b)\t\(pid)")
  }
}
