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
// Tutorial completion
// ---------------------------------------------------------------------------

export function saveCompletedSegments(pieceHash: string, ids: string[], totalCount?: number): void {
  const data = loadPieceData(pieceHash)
  data.completedSegmentIds = ids
  if (totalCount !== undefined) data.totalSegmentCount = totalCount
  savePieceData(data)
}

export function loadCompletedSegments(pieceHash: string): string[] {
  return loadPieceData(pieceHash).completedSegmentIds ?? []
}

// Lookup table: filePath → pieceHash (so PieceLibrary can read progress without loading notes)
const PATH_HASH_KEY = "ss_path_to_hash"

export function recordPiecePathHash(filePath: string, pieceHash: string): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(PATH_HASH_KEY)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    map[filePath] = pieceHash
    localStorage.setItem(PATH_HASH_KEY, JSON.stringify(map))
  } catch {}
}

export function getPieceProgressByPath(filePath: string): { completed: number; total: number } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PATH_HASH_KEY)
    if (!raw) return null
    const map: Record<string, string> = JSON.parse(raw)
    const hash = map[filePath]
    if (!hash) return null
    const data = loadPieceData(hash)
    if (!data.totalSegmentCount) return null
    return { completed: (data.completedSegmentIds ?? []).length, total: data.totalSegmentCount }
  } catch {
    return null
  }
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
