"use client"

/**
 * Local-only persistence for per-piece practice data.
 * Keyed by a stable hash of piece content.
 * Stores: named loops, last playback position, cached analysis.
 */

import type {
  NamedLoop,
  PiecePersistence,
  Segment,
  Lesson,
  PatternInsight,
} from "../components/types"

const STORAGE_PREFIX = "scoresense_piece_"

// ---------------------------------------------------------------------------
// Piece hash: simple stable hash from events data
// ---------------------------------------------------------------------------

export function computePieceHash(events: { midi: number; startTime: number }[]): string {
  // Simple hash from first 200 note midis + times
  const subset = events.slice(0, 200)
  let hash = 0
  for (const e of subset) {
    hash = ((hash << 5) - hash + e.midi * 127 + Math.round(e.startTime * 1000)) | 0
  }
  return `piece_${Math.abs(hash).toString(36)}`
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

function storageKey(pieceHash: string): string {
  return `${STORAGE_PREFIX}${pieceHash}`
}

export function loadPieceData(pieceHash: string): PiecePersistence {
  if (typeof window === "undefined") {
    return { pieceHash, namedLoops: [], lastPositionSec: 0 }
  }

  try {
    const raw = localStorage.getItem(storageKey(pieceHash))
    if (!raw) return { pieceHash, namedLoops: [], lastPositionSec: 0 }
    const parsed = JSON.parse(raw) as PiecePersistence
    return { ...parsed, pieceHash }
  } catch {
    return { pieceHash, namedLoops: [], lastPositionSec: 0 }
  }
}

export function savePieceData(data: PiecePersistence): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(storageKey(data.pieceHash), JSON.stringify(data))
  } catch {
    console.warn("Failed to save piece data to localStorage")
  }
}

// ---------------------------------------------------------------------------
// Named loop helpers
// ---------------------------------------------------------------------------

export function addNamedLoop(pieceHash: string, loop: NamedLoop): PiecePersistence {
  const data = loadPieceData(pieceHash)
  data.namedLoops.push(loop)
  savePieceData(data)
  return data
}

export function renameLoop(pieceHash: string, loopId: string, newName: string): PiecePersistence {
  const data = loadPieceData(pieceHash)
  const loop = data.namedLoops.find((l) => l.id === loopId)
  if (loop) loop.name = newName
  savePieceData(data)
  return data
}

export function deleteNamedLoop(pieceHash: string, loopId: string): PiecePersistence {
  const data = loadPieceData(pieceHash)
  data.namedLoops = data.namedLoops.filter((l) => l.id !== loopId)
  savePieceData(data)
  return data
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export function saveLastPosition(pieceHash: string, sec: number): void {
  const data = loadPieceData(pieceHash)
  data.lastPositionSec = sec
  savePieceData(data)
}

// ---------------------------------------------------------------------------
// Cached analysis
// ---------------------------------------------------------------------------

export function getCachedAnalysis(
  pieceHash: string,
  algoVersion: string
): { segments: Segment[]; lessons: Lesson[]; insights: PatternInsight[] } | null {
  const data = loadPieceData(pieceHash)
  if (!data.cachedAnalysis) return null
  if (data.cachedAnalysis.algoVersion !== algoVersion) return null
  return {
    segments: data.cachedAnalysis.segments,
    lessons: data.cachedAnalysis.lessons,
    insights: data.cachedAnalysis.insights,
  }
}

export function cacheAnalysis(
  pieceHash: string,
  algoVersion: string,
  segments: Segment[],
  lessons: Lesson[],
  insights: PatternInsight[]
): void {
  const data = loadPieceData(pieceHash)
  data.cachedAnalysis = { algoVersion, segments, lessons, insights }
  savePieceData(data)
}
