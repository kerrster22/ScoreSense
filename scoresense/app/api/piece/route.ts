import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { PIECE_FILE_EXTENSIONS } from "@/lib/parsePieceFilename"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const pathParam = url.searchParams.get("path")
    if (!pathParam) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 })
    }

    const decodedPath = decodeURIComponent(pathParam)
    const safePath = path.normalize(decodedPath)
    if (safePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const absolutePath = path.join(process.cwd(), safePath)
    if (!absolutePath.startsWith(path.join(process.cwd(), "app", "Pieces"))) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 })
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const ext = path.extname(absolutePath).toLowerCase()
    if (!PIECE_FILE_EXTENSIONS.includes(ext as typeof PIECE_FILE_EXTENSIONS[number])) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 })
    }

    const fileBuffer = fs.readFileSync(absolutePath)

    const contentType = ext === ".mid" || ext === ".midi" ? "audio/midi" : "application/xml"
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Piece load failed", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
