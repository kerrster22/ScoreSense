"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DemoPieceOption } from "@/lib/demoPieces"
import type { PieceFile } from "@/types/pieces"

export function DemoPieceSwitcher({
  options,
  selectedPiece,
  onSelect,
}: {
  options: DemoPieceOption[]
  selectedPiece: PieceFile | null
  onSelect: (piece: PieceFile) => void
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-3">
      <div>
        <p className="text-xs font-medium text-foreground">Try a piece</p>
        <p className="text-[11px] text-muted-foreground">Three difficulty levels, picked for you.</p>
      </div>
      <div className="space-y-1.5">
        {options.map(({ level, piece }) => {
          const isActive = selectedPiece?.filePath === piece.filePath
          return (
            <button
              key={piece.filePath}
              type="button"
              onClick={() => onSelect(piece)}
              aria-pressed={isActive}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-accent/50 bg-accent/10"
                  : "border-border/40 bg-background/40 hover:border-accent/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{piece.title}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {level}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{piece.composer}</p>
            </button>
          )
        })}
      </div>
      <div className="rounded-lg border border-dashed border-border/50 px-3 py-2.5 text-center">
        <p className="text-xs text-muted-foreground">
          <Lock className="mr-1 -mt-0.5 inline h-3 w-3" />
          Sign up to unlock the full library and upload your own pieces.
        </p>
        <Button asChild size="sm" className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/signup?redirect=/app">Sign up free</Link>
        </Button>
      </div>
    </div>
  )
}
