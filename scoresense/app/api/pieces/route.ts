import path from "path"
import { NextResponse } from "next/server"
import { scanPiecesDirectory } from "@/lib/scanPieceLibrary"
import { buildPieceLibrary } from "@/lib/buildPieceLibrary"

export async function GET() {
  try {
    const piecesPath = path.join(process.cwd(), "app", "Pieces")
    const filePaths = scanPiecesDirectory(piecesPath)
    const library = buildPieceLibrary(filePaths)
    const count = library.reduce((sum, group) => sum + group.pieces.length, 0)
    return NextResponse.json({ library, count })
  } catch (err) {
    return NextResponse.json({ error: "Failed to scan pieces", details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
