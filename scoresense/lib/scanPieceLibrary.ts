import fs from "fs"
import path from "path"
import { PIECE_FILE_EXTENSIONS } from "@/lib/parsePieceFilename"

/**
 * Recursively scan a directory for supported piece files.
 * Use from server-only code (Next.js route or backend helper).
 */
export const scanPiecesDirectory = (rootDir: string): string[] => {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return []

  const result: string[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry).toLowerCase()
        if (PIECE_FILE_EXTENSIONS.includes(ext as typeof PIECE_FILE_EXTENSIONS[number])) {
          result.push(path.relative(process.cwd(), fullPath).replace(/\\/g, "/"))
        }
      }
    }
  }

  walk(rootDir)
  return result
}
