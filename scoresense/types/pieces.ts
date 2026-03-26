export type PieceFile = {
  composer: string
  title: string
  fileName: string
  filePath: string
  extension: string
  midiPath?: string
  xmlPath?: string
}

export type ComposerGroup = {
  composer: string
  pieces: PieceFile[]
}
