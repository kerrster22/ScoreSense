"use client"

import React, { useMemo, useState } from "react"
import type { ComposerGroup, PieceFile } from "@/types/pieces"

type PieceLibraryProps = {
  pieces: ComposerGroup[]
  selectedPiece?: PieceFile | null
  onSelectPiece: (piece: PieceFile) => void
}

export const PieceLibrary: React.FC<PieceLibraryProps> = ({ pieces, selectedPiece, onSelectPiece }) => {
  const [expandedComposer, setExpandedComposer] = useState<Record<string, boolean>>({})

  const composerExpansion = useMemo(() => ({ ...expandedComposer }), [expandedComposer])

  const toggleComposer = (composer: string) => {
    setExpandedComposer((prev) => ({ ...prev, [composer]: !prev[composer] }))
  }

  return (
    <div className="bg-secondary/10 border border-border rounded-lg p-3 max-h-[470px] overflow-y-auto">
      <div className="mb-3 font-semibold text-foreground">Piece Library</div>
      {pieces.length === 0 ? (
        <div className="text-sm text-muted-foreground">No pieces found.</div>
      ) : (
        <ul className="space-y-2">
          {pieces.map((group) => {
            const isOpen = composerExpansion[group.composer]

            return (
              <li key={group.composer}>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-primary/20 font-medium"
                  onClick={() => toggleComposer(group.composer)}
                >
                  {isOpen ? "▼" : "▶"} {group.composer} ({group.pieces.length})
                </button>
                {isOpen && (
                  <ul className="mt-1 ml-4 border-l border-border/40 pl-2 space-y-1">
                    {group.pieces.map((piece) => (
                      <li key={piece.filePath}>
                        <button
                          type="button"
                          className={`w-full text-left px-2 py-1 rounded transition-colors ${
                            selectedPiece?.filePath === piece.filePath
                              ? "bg-primary/40 text-background"
                              : "hover:bg-primary/10"
                          }`}
                          onClick={() => onSelectPiece(piece)}
                        >
                          <div className="flex justify-between items-center">
                            <span>{piece.title}</span>
                            <span className="text-xs text-muted-foreground/70">
                              {piece.midiPath && piece.xmlPath
                                ? "MIDI+XML"
                                : piece.midiPath
                                ? "MIDI"
                                : piece.xmlPath
                                ? "XML"
                                : piece.extension.toUpperCase().replace(".", "")}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
