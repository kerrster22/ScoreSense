"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { X as XIcon, CheckCircle2, Clock } from "lucide-react"
import { detectChord } from "../lib/chordDetection"
import { getAllChordDefinitions, getEssentialChordDefinitions, type ChordDefinition } from "../lib/chordLibrary"
import { recordChordTrainingResult } from "../lib/chordMastery"
import { noteNameToMidi } from "../lib/piano"

const TIMEOUT_MS = 8000
const ADVANCE_DELAY_CORRECT_MS = 700
const ADVANCE_DELAY_TIMEOUT_MS = 1200

interface ChordTrainingSessionProps {
  /** Currently-held note names (from the clickable keyboard / QWERTY), refreshed live. */
  heldNotes: string[]
  /** When set, the session repeats just this one chord instead of drawing from the essential set. */
  focusChordId?: string | null
  onClose: () => void
}

interface AttemptResult {
  correct: boolean
  reactionMs: number
}

function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length)
}

export function ChordTrainingSession({ heldNotes, focusChordId, onClose }: ChordTrainingSessionProps) {
  const pool = useMemo<ChordDefinition[]>(() => {
    if (focusChordId) {
      const def = getAllChordDefinitions().find((d) => d.id === focusChordId)
      return def ? [def] : getEssentialChordDefinitions()
    }
    return getEssentialChordDefinitions()
  }, [focusChordId])

  const [currentIdx, setCurrentIdx] = useState(() => pickRandomIndex(pool.length))
  const [promptStartedAt, setPromptStartedAt] = useState(() => Date.now())
  const [outcome, setOutcome] = useState<"correct" | "timeout" | null>(null)
  const [results, setResults] = useState<AttemptResult[]>([])
  const [sessionEnded, setSessionEnded] = useState(false)

  const current = pool[currentIdx]

  // Watch held notes for a live match against the current prompt.
  useEffect(() => {
    if (outcome !== null || sessionEnded) return
    if (heldNotes.length < 3) return
    const midis = heldNotes.map((n) => noteNameToMidi(n)).filter((m): m is number => m != null)
    const detected = detectChord(midis)
    if (detected && detected.symbol === current.symbol) {
      const reactionMs = Date.now() - promptStartedAt
      recordChordTrainingResult(current.id, true, reactionMs)
      setResults((r) => [...r, { correct: true, reactionMs }])
      setOutcome("correct")
    }
  }, [heldNotes, outcome, sessionEnded, current, promptStartedAt])

  // Timeout the current prompt if nothing matches in time.
  useEffect(() => {
    if (sessionEnded) return
    const timer = setTimeout(() => {
      recordChordTrainingResult(current.id, false, TIMEOUT_MS)
      setResults((r) => [...r, { correct: false, reactionMs: TIMEOUT_MS }])
      setOutcome("timeout")
    }, TIMEOUT_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, sessionEnded])

  // Advance to the next prompt after a short pause to show the outcome.
  useEffect(() => {
    if (outcome === null) return
    const delay = outcome === "correct" ? ADVANCE_DELAY_CORRECT_MS : ADVANCE_DELAY_TIMEOUT_MS
    const t = setTimeout(() => {
      setOutcome(null)
      setCurrentIdx(pickRandomIndex(pool.length))
      setPromptStartedAt(Date.now())
    }, delay)
    return () => clearTimeout(t)
  }, [outcome, pool.length])

  const correctCount = results.filter((r) => r.correct).length
  const avgReactionMs =
    results.length > 0 ? Math.round(results.reduce((s, r) => s + r.reactionMs, 0) / results.length) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-96 max-w-[92vw] rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {focusChordId ? "Focused Chord Drill" : "Chord Training"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chord training"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {sessionEnded ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-6 py-2 text-center">
              <div>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {correctCount}/{results.length}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Correct</div>
              </div>
              <div className="h-10 w-px bg-border/60" />
              <div>
                <div className="text-2xl font-bold tabular-nums text-foreground">{avgReactionMs}ms</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg reaction</div>
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-6 text-center">
              {outcome === "correct" ? (
                <div className="flex flex-col items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="text-sm font-semibold">Correct!</span>
                </div>
              ) : outcome === "timeout" ? (
                <div className="flex flex-col items-center gap-1 text-amber-400">
                  <Clock className="h-6 w-6" />
                  <span className="text-sm font-semibold">Time&apos;s up — it was {current.symbol}</span>
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">Play</div>
                  <div className="text-3xl font-bold text-foreground">{current.symbol}</div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {correctCount}/{results.length} correct this session
              </span>
              <button
                type="button"
                onClick={() => setSessionEnded(true)}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                End session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
