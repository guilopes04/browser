// Os quadros de uma aba (a página e os iframes), como o frame-activation.ts os entende. Os dados
// são do Chromium (origem e endereço do quadro), não da página.
import type { WebContents, WebFrameMain } from 'electron'
import type { FrameInfo } from './frame-activation'

type FrameLike = Pick<WebFrameMain, 'processId' | 'frameToken'>

export function frameKey(frame: FrameLike): string {
  return `${frame.processId}:${frame.frameToken}`
}

export function describeFrame(frame: WebFrameMain): FrameInfo {
  return {
    key: frameKey(frame),
    parentKey: frame.parent ? frameKey(frame.parent) : null,
    origin: frame.origin,
    url: frame.url
  }
}

// vazio se o webContents já morreu ou ainda não tem quadro
export function snapshotFrames(
  contents: Pick<WebContents, 'mainFrame'> | null | undefined
): FrameInfo[] {
  try {
    return (contents?.mainFrame?.framesInSubtree ?? []).map(describeFrame)
  } catch {
    return []
  }
}
