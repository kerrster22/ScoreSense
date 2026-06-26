"use client"

import React, { useMemo, useState } from "react"
import { ChevronDown, Library } from "lucide-react"
import type { ComposerGroup, PieceFile } from "@/types/pieces"

type PieceLibraryProps = {
  pieces: ComposerGroup[]
  selectedPiece?: PieceFile | null
  onSelectPiece: (piece: PieceFile) => void
  /** When true, renders as a collapsed single-row toggle until the user opens it */
  defaultCollapsed?: boolean
  /** Per-piece progress keyed by filePath */
  pieceProgress?: Record<string, { completed: number; total: number }>
}

export const PieceLibrary: React.FC<PieceLibraryProps> = ({
  pieces,
  selectedPiece,
  onSelectPiece,
  defaultCollapsed = false,
  pieceProgress = {},
}) => {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed)
  const [expandedComposer, setExpandedComposer] = useState<Record<string, boolean>>({})
  const composerExpansion = useMemo(() => ({ ...expandedComposer }), [expandedComposer])

  const toggleComposer = (composer: string) =>
    setExpandedComposer((prev) => ({ ...prev, [composer]: !prev[composer] }))

  const handleSelectPiece = (piece: PieceFile) => {
    onSelectPiece(piece)
    if (defaultCollapsed) setIsOpen(false)
  }

  return (
    <div className="bg-secondary/10 border border-border rounded-lg overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Library className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">Piece Library</span>
          {selectedPiece && !isOpen && (
            <span className="text-xs text-muted-foreground truncate">
              — {selectedPiece.title}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable list */}
      {isOpen && (
        <div className="px-3 pb-3 max-h-[400px] overflow-y-auto border-t border-border/40">
          {pieces.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3">No pieces found.</div>
          ) : (
            <ul className="space-y-1 pt-2">
              {pieces.map((group) => {
                const expanded = composerExpansion[group.composer]
                return (
                  <li key={group.composer}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1 rounded hover:bg-primary/20 font-medium text-sm"
                      onClick={() => toggleComposer(group.composer)}
                    >
                      {expanded ? "▼" : "▶"} {group.composer}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({group.pieces.length})
                      </span>
                    </button>
                    {expanded && (
                      <ul className="mt-1 ml-4 border-l border-border/40 pl-2 space-y-0.5">
                        {group.pieces.map((piece) => {
                          const prog = pieceProgress[piece.filePath]
                          const isDone = prog && prog.completed >= prog.total && prog.total > 0
                          const pct = prog && prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0
                          return (
                          <li key={piece.filePath}>
                            <button
                              type="button"
                              className={`w-full text-left px-2 py-1 rounded transition-colors text-sm ${
                                selectedPiece?.filePath === piece.filePath
                                  ? "bg-accent/20 text-accent"
                                  : "hover:bg-primary/10 text-foreground"
                              }`}
                              onClick={() => handleSelectPiece(piece)}
                            >
                              <div className="flex justify-between items-center gap-2">
                                <span className="truncate">{piece.title}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isDone ? (
                                    <span className="text-[10px] text-green-400 font-semibold">✓</span>
                                  ) : prog ? (
                                    <span className="text-[10px] text-muted-foreground/70">{pct}%</span>
                                  ) : null}
                                  <span className="text-[10px] text-muted-foreground/70">
                                    {piece.midiPath && piece.xmlPath
                                      ? "MIDI+XML"
                                      : piece.midiPath
                                      ? "MIDI"
                                      : piece.xmlPath
                                      ? "XML"
                                      : piece.extension.toUpperCase().replace(".", "")}
                                  </span>
                                </div>
                              </div>
                            </button>
                          </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
