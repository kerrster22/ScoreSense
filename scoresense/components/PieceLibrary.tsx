"use client"

import React, { useMemo, useRef, useState } from "react"
import { ChevronDown, Library, Search, Clock } from "lucide-react"
import type { ComposerGroup, PieceFile } from "@/types/pieces"
import { getDifficultyByPath, getLastPlayedByPath } from "@/lib/persistence"

type SortMode = "alpha" | "difficulty" | "recent"

type PieceLibraryProps = {
  pieces: ComposerGroup[]
  selectedPiece?: PieceFile | null
  onSelectPiece: (piece: PieceFile) => void
  /** When true, renders as a collapsed single-row toggle until the user opens it */
  defaultCollapsed?: boolean
  /** Per-piece progress keyed by filePath */
  pieceProgress?: Record<string, { completed: number; total: number }>
}

const STALE_DAYS_THRESHOLD = 14

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
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
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("alpha")
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  const toggleComposer = (composer: string) =>
    setExpandedComposer((prev) => ({ ...prev, [composer]: !prev[composer] }))

  // Arrow-key roving focus across whichever row buttons are currently in the
  // DOM (collapsed composers' children simply aren't there, so this naturally
  // skips them without needing a parallel "visible rows" data structure).
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    const container = listContainerRef.current
    if (!container) return
    e.preventDefault()
    const rows = Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-row-button]"))
    const idx = rows.indexOf(e.currentTarget)
    if (idx === -1) return
    const nextIdx = e.key === "ArrowDown" ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0)
    rows[nextIdx]?.focus()
  }

  const handleSelectPiece = (piece: PieceFile) => {
    onSelectPiece(piece)
    if (defaultCollapsed) setIsOpen(false)
  }

  // Filter by search (composer or title), then flatten + sort within each
  // composer group. Difficulty/recency come from localStorage (persisted the
  // first time a piece is actually opened) — pieces never played show no
  // badge and sort to the end under those modes rather than being hidden.
  const filteredGroups: ComposerGroup[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (group: ComposerGroup, piece: PieceFile) =>
      !q || group.composer.toLowerCase().includes(q) || piece.title.toLowerCase().includes(q)

    const sortPieces = (list: PieceFile[]): PieceFile[] => {
      if (sortMode === "alpha") return [...list].sort((a, b) => a.title.localeCompare(b.title))
      if (sortMode === "difficulty") {
        return [...list].sort((a, b) => {
          const da = getDifficultyByPath(a.filePath)
          const db = getDifficultyByPath(b.filePath)
          if (da == null && db == null) return a.title.localeCompare(b.title)
          if (da == null) return 1
          if (db == null) return -1
          return db - da
        })
      }
      // recent
      return [...list].sort((a, b) => {
        const ta = getLastPlayedByPath(a.filePath)
        const tb = getLastPlayedByPath(b.filePath)
        if (!ta && !tb) return a.title.localeCompare(b.title)
        if (!ta) return 1
        if (!tb) return -1
        return new Date(tb).getTime() - new Date(ta).getTime()
      })
    }

    return pieces
      .map((group) => ({
        composer: group.composer,
        pieces: sortPieces(group.pieces.filter((p) => matches(group, p))),
      }))
      .filter((group) => group.pieces.length > 0)
      .sort((a, b) => a.composer.localeCompare(b.composer))
  }, [pieces, search, sortMode])

  return (
    <div className="bg-secondary/10 border border-border rounded-lg overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        <div ref={listContainerRef} className="px-3 pb-3 max-h-[400px] overflow-y-auto border-t border-border/40">
          {pieces.length > 0 && (
            <div className="flex items-center gap-2 pt-2 pb-1 sticky top-0 bg-secondary/10 z-10">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search composer or title…"
                  className="w-full pl-6 pr-2 py-1 text-xs rounded border border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="text-xs rounded border border-border/40 bg-background/50 text-foreground px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
                aria-label="Sort pieces"
              >
                <option value="alpha">A–Z</option>
                <option value="difficulty">Difficulty</option>
                <option value="recent">Recently played</option>
              </select>
            </div>
          )}
          {filteredGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3">
              {pieces.length === 0 ? "No pieces found." : "No pieces match your search."}
            </div>
          ) : (
            <ul className="space-y-1 pt-2">
              {filteredGroups.map((group) => {
                const expanded = composerExpansion[group.composer] || search.trim().length > 0
                return (
                  <li key={group.composer}>
                    <button
                      type="button"
                      data-row-button
                      aria-expanded={expanded}
                      className="w-full text-left px-2 py-1 rounded hover:bg-primary/20 font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => toggleComposer(group.composer)}
                      onKeyDown={handleRowKeyDown}
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
                          const difficulty = getDifficultyByPath(piece.filePath)
                          const lastPlayed = getLastPlayedByPath(piece.filePath)
                          const isStale = lastPlayed && daysSince(lastPlayed) >= STALE_DAYS_THRESHOLD
                          return (
                          <li key={piece.filePath}>
                            <button
                              type="button"
                              data-row-button
                              className={`w-full text-left px-2 py-1 rounded transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                selectedPiece?.filePath === piece.filePath
                                  ? "bg-accent/20 text-accent"
                                  : "hover:bg-primary/10 text-foreground"
                              }`}
                              onClick={() => handleSelectPiece(piece)}
                              onKeyDown={handleRowKeyDown}
                            >
                              <div className="flex justify-between items-center gap-2">
                                <span className="truncate">{piece.title}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isStale && (
                                    <span
                                      className="flex items-center gap-0.5 text-[10px] text-amber-400/80"
                                      title={`Not played in ${daysSince(lastPlayed!)} days`}
                                    >
                                      <Clock className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                  {difficulty != null && (
                                    <span className="text-[10px] text-muted-foreground/70" title={`Difficulty ${difficulty}/5`}>
                                      {"●".repeat(difficulty)}
                                      <span className="opacity-30">{"●".repeat(5 - difficulty)}</span>
                                    </span>
                                  )}
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
