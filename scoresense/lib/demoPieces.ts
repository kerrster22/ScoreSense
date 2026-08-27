import type { PieceFile } from "@/types/pieces"

export type DemoLevel = "Easy" | "Intermediate" | "Advanced"

export interface DemoPieceOption {
  level: DemoLevel
  piece: PieceFile
}

function demoPiece(
  composer: string,
  title: string,
  baseName: string
): PieceFile {
  return {
    composer,
    title,
    fileName: `${baseName}.mid`,
    filePath: `/pieces/${baseName}.mid`,
    extension: ".mid",
    midiPath: `/pieces/${baseName}.mid`,
    xmlPath: `/pieces/${baseName}.mxl`,
  }
}

/**
 * The unauthenticated /try experience is locked to exactly these 3 pieces —
 * one per difficulty tier, chosen by running the app's own computeDifficulty
 * heuristic (app/app/lib/difficulty.ts) over every piece in public/pieces and
 * picking a low/mid/high representative, rather than guessing by reputation.
 */
export const DEMO_PIECES: DemoPieceOption[] = [
  { level: "Easy", piece: demoPiece("Yiruma", "River Flows in You", "river-flows-in-you") },
  {
    level: "Intermediate",
    piece: demoPiece("Chopin", "Nocturne in F Minor, Op. 55 No. 1", "nocturne-in-f-minor-op-55-no-1"),
  },
  {
    level: "Advanced",
    piece: demoPiece("Liszt", "La Campanella (Étude S.141 No. 3)", "etude-s-1413-in-g-minor-la-campanella-liszt"),
  },
]
