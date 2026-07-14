export type PieceFile = {
  composer: string
  title: string
  fileName: string
  filePath: string
  extension: string
  midiPath?: string
  xmlPath?: string
  /** Set for pieces stored in the local "My Uploads" IndexedDB library instead of the server file tree. */
  uploadId?: string
}

export type ComposerGroup = {
  composer: string
  pieces: PieceFile[]
}
