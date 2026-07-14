import type { UnifiedNoteEvent } from "./hybrid/types"

export type Verdict = "perfect" | "great" | "good" | "early" | "late" | "miss"

export interface ScoringWindows {
  perfectMs: number
  greatMs: number
  goodMs: number
  /** Beyond goodMs but inside missMs -> early/late. Beyond missMs -> miss / not a candidate. */
  missMs: number
}

export const DEFAULT_SCORING_WINDOWS: ScoringWindows = {
  perfectMs: 40,
  greatMs: 80,
  goodMs: 150,
  missMs: 400,
}

/** velocity is expected 0..1, matching UnifiedNoteEvent.velocity's normalized scale. */
export interface UserNoteEvent {
  midi: number
  time: number
  velocity?: number
}

export interface NoteResult {
  refNoteId: string
  midi: number
  verdict: Verdict
  /** Signed seconds; negative = early. Null for notes resolved by tick() as a miss. */
  timingDeltaSec: number | null
}

export interface SessionSummary {
  score: number
  maxScore: number
  /** 0-100, weighted by verdict quality (not just hit-vs-miss). */
  accuracyPct: number
  verdictCounts: Record<Verdict, number>
  combo: number
  maxCombo: number
  totalNotes: number
  notesResolved: number
}

const VERDICT_POINTS: Record<Verdict, number> = {
  perfect: 100,
  great: 75,
  good: 50,
  early: 25,
  late: 25,
  miss: 0,
}

interface PendingNote {
  ref: UnifiedNoteEvent
}

/**
 * Scores a live stream of user-played notes against a reference performance.
 * Pure TypeScript, no React/Tone dependency — any future input source (Web
 * MIDI, a clickable on-screen keyboard, a computer-keyboard mapping, etc.)
 * only has to call noteOn()/tick() with timestamps in the same "piece time"
 * seconds the reference notes use (UnifiedNoteEvent.startTime).
 */
export class ScoringEngine {
  private readonly windows: ScoringWindows
  private readonly referenceNotes: UnifiedNoteEvent[]
  private unmatchedByPitch: Map<number, PendingNote[]> = new Map()
  private results: Map<string, NoteResult> = new Map()
  private totalScore = 0
  private combo = 0
  private maxCombo = 0

  constructor(referenceNotes: UnifiedNoteEvent[], windows?: Partial<ScoringWindows>) {
    this.windows = { ...DEFAULT_SCORING_WINDOWS, ...windows }
    this.referenceNotes = referenceNotes
    this.reset()
  }

  reset(): void {
    const byPitch = new Map<number, PendingNote[]>()
    for (const ref of this.referenceNotes) {
      if (!byPitch.has(ref.midi)) byPitch.set(ref.midi, [])
      byPitch.get(ref.midi)!.push({ ref })
    }
    for (const list of byPitch.values()) list.sort((a, b) => a.ref.startTime - b.ref.startTime)
    this.unmatchedByPitch = byPitch
    this.results = new Map()
    this.totalScore = 0
    this.combo = 0
    this.maxCombo = 0
  }

  /**
   * Record a user-played note. Returns the verdict for whichever unmatched
   * reference note of the same pitch it matched, or null if none falls
   * within the miss window (the input is simply not counted — e.g. a wrong
   * note, or a duplicate press of an already-matched note).
   */
  noteOn(evt: UserNoteEvent): NoteResult | null {
    const candidates = this.unmatchedByPitch.get(evt.midi)
    if (!candidates || candidates.length === 0) return null

    const missWindowSec = this.windows.missMs / 1000
    const match = this.findNearestWithinWindow(candidates, evt.time, missWindowSec)
    if (match === null) return null

    candidates.splice(match.arrayIndex, 1)

    const deltaSec = evt.time - match.pending.ref.startTime
    const verdict = this.classify(deltaSec)
    const points = VERDICT_POINTS[verdict] * this.velocityFactor(match.pending.ref, evt.velocity)
    const result: NoteResult = {
      refNoteId: match.pending.ref.id,
      midi: match.pending.ref.midi,
      verdict,
      timingDeltaSec: deltaSec,
    }
    this.applyResult(result, points)
    return result
  }

  /**
   * Resolve any reference notes whose miss window has fully elapsed without
   * a match into an explicit "miss". Call once per frame (or on a coarser
   * interval) with the current piece-time position.
   */
  tick(nowSec: number): NoteResult[] {
    const missWindowSec = this.windows.missMs / 1000
    const resolved: NoteResult[] = []
    for (const candidates of this.unmatchedByPitch.values()) {
      // Sorted by startTime — once the earliest unmatched note is still
      // in-window, every later one is too, so we can stop early per pitch.
      while (candidates.length > 0 && nowSec - candidates[0].ref.startTime > missWindowSec) {
        const { ref } = candidates.shift()!
        const result: NoteResult = {
          refNoteId: ref.id,
          midi: ref.midi,
          verdict: "miss",
          timingDeltaSec: null,
        }
        this.applyResult(result, 0)
        resolved.push(result)
      }
    }
    return resolved
  }

  /**
   * True if some reference note that should already be sounding by `nowSec`
   * (within `toleranceSec`) hasn't been matched yet. Used by "wait for
   * note" practice mode to decide whether to hold playback at the current
   * position — deliberately separate from tick()'s miss-resolution, which
   * callers should skip while waiting so a held note is never scored a
   * miss out from under the player.
   */
  hasPendingNoteAt(nowSec: number, toleranceSec = 0.03): boolean {
    for (const candidates of this.unmatchedByPitch.values()) {
      if (candidates.length > 0 && candidates[0].ref.startTime <= nowSec + toleranceSec) return true
    }
    return false
  }

  getSummary(): SessionSummary {
    const verdictCounts: Record<Verdict, number> = {
      perfect: 0, great: 0, good: 0, early: 0, late: 0, miss: 0,
    }
    for (const result of this.results.values()) verdictCounts[result.verdict]++

    const notesResolved = this.results.size
    const maxScore = this.referenceNotes.length * VERDICT_POINTS.perfect
    const accuracyPct =
      notesResolved > 0
        ? Math.round((this.totalScore / (notesResolved * VERDICT_POINTS.perfect)) * 1000) / 10
        : 0

    return {
      score: Math.round(this.totalScore),
      maxScore,
      accuracyPct,
      verdictCounts,
      combo: this.combo,
      maxCombo: this.maxCombo,
      totalNotes: this.referenceNotes.length,
      notesResolved,
    }
  }

  // ---------------------------------------------------------------------------

  private classify(deltaSec: number): Verdict {
    const absMs = Math.abs(deltaSec) * 1000
    if (absMs <= this.windows.perfectMs) return "perfect"
    if (absMs <= this.windows.greatMs) return "great"
    if (absMs <= this.windows.goodMs) return "good"
    return deltaSec < 0 ? "early" : "late"
  }

  /** Scales points down (never below 0.7x) when user velocity diverges from the reference. */
  private velocityFactor(ref: UnifiedNoteEvent, userVelocity?: number): number {
    if (ref.velocity === undefined || userVelocity === undefined) return 1
    const diff = Math.abs(ref.velocity - userVelocity)
    return Math.max(0.7, 1 - diff)
  }

  // Combo increments on any real hit (perfect/great/good/early/late) and only
  // breaks on a true miss — an early/late note was still played, just mistimed.
  private applyResult(result: NoteResult, points: number): void {
    this.results.set(result.refNoteId, result)
    this.totalScore += points
    if (result.verdict === "miss") {
      this.combo = 0
    } else {
      this.combo++
      if (this.combo > this.maxCombo) this.maxCombo = this.combo
    }
  }

  /** Binary search for the unmatched candidate whose startTime is closest to targetTime. */
  private findNearestWithinWindow(
    candidates: PendingNote[],
    targetTime: number,
    windowSec: number
  ): { pending: PendingNote; arrayIndex: number } | null {
    let lo = 0
    let hi = candidates.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (candidates[mid].ref.startTime < targetTime) lo = mid + 1
      else hi = mid
    }
    // lo is the first index with startTime >= targetTime; the nearest match
    // within the window is either it or its immediate predecessor.
    let bestIndex = -1
    let bestDelta = Infinity
    for (const idx of [lo - 1, lo]) {
      if (idx < 0 || idx >= candidates.length) continue
      const delta = Math.abs(candidates[idx].ref.startTime - targetTime)
      if (delta <= windowSec && delta < bestDelta) {
        bestDelta = delta
        bestIndex = idx
      }
    }
    return bestIndex === -1 ? null : { pending: candidates[bestIndex], arrayIndex: bestIndex }
  }
}
