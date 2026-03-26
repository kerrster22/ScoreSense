import type { ComposerGroup, PieceFile } from "@/types/pieces"
import { parsePieceFilename, PIECE_FILE_EXTENSIONS } from "@/lib/parsePieceFilename"

export const MOCK_PIECE_FILE_PATHS = [
  "/pieces/Chopin - Nocturne No. 2 in E-flat major.mxl",
  "/pieces/Liszt - Liebestraum No. 3.musicxml",
  "/pieces/Beethoven - Moonlight Sonata - 1st Movement.mid",
  "/pieces/unknown_piece.musicxml",
  "/pieces/Sergei_Rachmaninoff_Prelude_in_C-sharp_minor.mid",
]

export const EXAMPLE_PIECE_LIBRARY: ComposerGroup[] = [
  {
    composer: "Beethoven",
    pieces: [
      {
        composer: "Beethoven",
        title: "Moonlight Sonata - 1st Movement",
        fileName: "Beethoven - Moonlight Sonata - 1st Movement.mid",
        filePath: "/pieces/Beethoven - Moonlight Sonata - 1st Movement.mid",
        extension: ".mid",
      },
    ],
  },
  {
    composer: "Chopin",
    pieces: [
      {
        composer: "Chopin",
        title: "Nocturne No. 2 in E-flat major",
        fileName: "Chopin - Nocturne No. 2 in E-flat major.mxl",
        filePath: "/pieces/Chopin - Nocturne No. 2 in E-flat major.mxl",
        extension: ".mxl",
      },
    ],
  },
  {
    composer: "Liszt",
    pieces: [
      {
        composer: "Liszt",
        title: "Liebestraum No. 3",
        fileName: "Liszt - Liebestraum No. 3.musicxml",
        filePath: "/pieces/Liszt - Liebestraum No. 3.musicxml",
        extension: ".musicxml",
      },
    ],
  },
  {
    composer: "Unknown Composer",
    pieces: [
      {
        composer: "Unknown Composer",
        title: "unknown_piece",
        fileName: "unknown_piece.musicxml",
        filePath: "/pieces/unknown_piece.musicxml",
        extension: ".musicxml",
      },
    ],
  },
]

const getExtension = (filePath: string): string => {
  const index = filePath.lastIndexOf(".")
  if (index === -1 || index === filePath.length - 1) return ""
  return filePath.slice(index).toLowerCase()
}

export const buildPieceLibrary = (filePaths: string[]): ComposerGroup[] => {
  const knownPieces = filePaths
    .map((p) => {
      const extension = getExtension(p)
      if (!PIECE_FILE_EXTENSIONS.includes(extension as typeof PIECE_FILE_EXTENSIONS[number])) return null
      return parsePieceFilename(p)
    })
    .filter((p): p is PieceFile => p !== null)

  const composerGroups = new Map<string, Map<string, PieceFile>>()

  const normalizeKey = (input: string) =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()

  knownPieces.forEach((piece) => {
    const composerKey = piece.composer || "Unknown Composer"
    const pieceKey = `${composerKey}::${normalizeKey(piece.title)}`

    const composerBucket = composerGroups.get(composerKey) ?? new Map<string, PieceFile>()

    const existing = composerBucket.get(pieceKey)
    if (!existing) {
      const combined: PieceFile = {
        ...piece,
        midiPath: piece.extension === ".mid" || piece.extension === ".midi" ? piece.filePath : undefined,
        xmlPath: piece.extension !== ".mid" && piece.extension !== ".midi" ? piece.filePath : undefined,
      }
      composerBucket.set(pieceKey, combined)
    } else {
      // merge support for midi/xml dual registrations
      if (piece.extension === ".mid" || piece.extension === ".midi") {
        existing.midiPath = piece.filePath
        if (!existing.xmlPath) existing.filePath = piece.filePath
      } else {
        existing.xmlPath = piece.filePath
        existing.filePath = piece.filePath
      }
      composerBucket.set(pieceKey, existing)
    }

    composerGroups.set(composerKey, composerBucket)
  })

  const groups: ComposerGroup[] = Array.from(composerGroups.entries()).map(([composer, pieces]) => ({
    composer,
    pieces: Array.from(pieces.values()).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })),
  }))

  return groups.sort((a, b) => a.composer.localeCompare(b.composer, undefined, { sensitivity: "base" }))
}


