// Rolagem real (CGEvent) num ponto da tela: o ponteiro vai até lá e a roda gira dy pontos
// (negativo rola o conteúdo para baixo).
import CoreGraphics
import Foundation
let a = CommandLine.arguments
let p = CGPoint(x: Double(a[1])!, y: Double(a[2])!)
let dy = Int32(a[3])!
let src = CGEventSource(stateID: .hidSystemState)
CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(120000)
for _ in 0..<4 {
  let e = CGEvent(scrollWheelEvent2Source: src, units: .pixel, wheelCount: 1, wheel1: dy / 4, wheel2: 0, wheel3: 0)
  e?.location = p
  e?.post(tap: .cghidEventTap)
  usleep(30000)
}
