"use client"

import { Button } from "@/components/ui/button"
import { Trophy, X as XIcon } from "lucide-react"
import type { SessionSummary, Verdict } from "../lib/scoringEngine"

interface SessionSummaryModalProps {
  summary: SessionSummary
  onClose: () => void
  onPracticeAgain: () => void
}

const VERDICT_ORDER: Verdict[] = ["perfect", "great", "good", "early", "late", "miss"]

const VERDICT_LABEL: Record<Verdict, string> = {
  perfect: "Perfect",
  great: "Great",
  good: "Good",
  early: "Early",
  late: "Late",
  miss: "Miss",
}

const VERDICT_STYLE: Record<Verdict, string> = {
  perfect: "text-emerald-400",
  great: "text-accent",
  good: "text-sky-400",
  early: "text-amber-400",
  late: "text-amber-400",
  miss: "text-destructive",
}

export function SessionSummaryModal({ summary, onClose, onPracticeAgain }: SessionSummaryModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-96 max-w-[90vw] rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Session Complete</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session summary"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 py-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground tabular-nums">{summary.accuracyPct}%</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Accuracy</div>
          </div>
          <div className="h-10 w-px bg-border/60" />
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground tabular-nums">{summary.score}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Score</div>
          </div>
          <div className="h-10 w-px bg-border/60" />
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground tabular-nums">{summary.maxCombo}x</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Max Combo</div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {VERDICT_ORDER.filter((v) => summary.verdictCounts[v] > 0).map((v) => (
            <div key={v} className="flex items-center justify-between text-xs">
              <span className={VERDICT_STYLE[v]}>{VERDICT_LABEL[v]}</span>
              <span className="text-foreground tabular-nums font-medium">{summary.verdictCounts[v]}</span>
            </div>
          ))}
          {summary.notesResolved === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No notes were played along with this session — click keys or use your computer keyboard
              while the piece plays to get scored next time.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" className="flex-1" onClick={onPracticeAgain}>
            Practice Again
          </Button>
        </div>
      </div>
    </div>
  )
}
