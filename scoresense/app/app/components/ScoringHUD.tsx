"use client"

import { useEffect, useState } from "react"
import type { Verdict } from "../lib/scoringEngine"

interface ScoringHUDProps {
  combo: number
  /** Increment this any time a new verdict should flash, even if the verdict text repeats. */
  flashToken: number
  lastVerdict: Verdict | null
  /** Note name of the note that produced lastVerdict, e.g. "C4". */
  lastNoteName?: string | null
  /** True while playback is held, waiting for the next correct note (practice "wait" mode). */
  isWaitingForNote?: boolean
}

const VERDICT_STYLE: Record<Verdict, string> = {
  perfect: "text-emerald-400",
  great: "text-accent",
  good: "text-sky-400",
  early: "text-amber-400",
  late: "text-amber-400",
  miss: "text-destructive",
}

const VERDICT_LABEL: Record<Verdict, string> = {
  perfect: "Perfect!",
  great: "Great",
  good: "Good",
  early: "Early",
  late: "Late",
  miss: "Miss",
}

/**
 * Live scoring feedback shown inline in the transport bar — deliberately not
 * overlaid on the visualizer canvas, so per-note correctness feedback lives
 * in one clear place instead of decorating the falling notes themselves.
 */
export function ScoringHUD({ combo, flashToken, lastVerdict, lastNoteName, isWaitingForNote = false }: ScoringHUDProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (flashToken === 0 || lastVerdict === null) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(timer)
  }, [flashToken, lastVerdict])

  if (isWaitingForNote) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        Waiting for note…
      </span>
    )
  }

  if (!visible && combo < 2) return null

  return (
    <div className="inline-flex shrink-0 items-center gap-2">
      {visible && lastVerdict && (
        <span
          key={flashToken}
          className={`text-xs font-bold tracking-wide animate-in fade-in zoom-in-95 duration-150 ${VERDICT_STYLE[lastVerdict]}`}
        >
          {lastNoteName ? `${lastNoteName} — ${VERDICT_LABEL[lastVerdict]}` : VERDICT_LABEL[lastVerdict]}
        </span>
      )}
      {combo >= 2 && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
          {combo}x combo
        </span>
      )}
    </div>
  )
}
