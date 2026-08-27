"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy,
  ArrowUpRight,
  Piano,
  Lightbulb,
  Target,
  Waves,
  UploadCloud,
  AlertTriangle,
  History,
  Music2,
  Sparkles,
} from "lucide-react"
import type { PatternInsight } from "@/types/practice"
import type { Recommendation } from "../lib/practiceCoach"

export interface WeakSpot {
  bar: number
  count: number
  startSec: number
  endSec: number
}

export interface PracticeHistory {
  sessions: { date: string; minutes: number }[]
  lastPlayedAt?: string
}

interface InsightsTabProps {
  insights: PatternInsight[]
  isComplete: boolean
  pieceLoaded: boolean
  onPracticeSection: (start: number, end: number) => void
  weakSpots?: WeakSpot[]
  practiceHistory?: PracticeHistory | null
  recommendations?: Recommendation[]
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function formatLastPlayed(iso: string): string {
  const days = daysSince(iso)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

type FilterType = "all" | "exact" | "near" | "transposed" | "left-hand"

const TYPE_ICONS: Record<string, React.ElementType> = {
  exact: Copy,
  near: Waves,
  transposed: ArrowUpRight,
  "left-hand": Piano,
}

const TYPE_LABELS: Record<string, string> = {
  exact: "Exact Repeat",
  near: "Similar",
  transposed: "Transposed",
  "left-hand": "Left Hand",
}

const TYPE_COLORS: Record<string, string> = {
  exact: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  near: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  transposed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "left-hand": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
}

const FILTER_TABS: { value: FilterType; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "exact",      label: "Repeats" },
  { value: "near",       label: "Similar" },
  { value: "transposed", label: "Transposed" },
  { value: "left-hand",  label: "Left Hand" },
]

/** Collapses consecutive repeats (a chord held across several bars) into one entry for display. */
function collapseProgression(progression: string[]): string[] {
  const collapsed: string[] = []
  for (const chord of progression) {
    if (collapsed[collapsed.length - 1] !== chord) collapsed.push(chord)
  }
  return collapsed
}

function ScorePip({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.95 ? "bg-emerald-500" :
    score >= 0.85 ? "bg-sky-500" :
    score >= 0.72 ? "bg-amber-500" : "bg-muted-foreground"
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {pct}% match
    </span>
  )
}

export function InsightsTab({
  insights,
  isComplete,
  pieceLoaded,
  onPracticeSection,
  weakSpots = [],
  practiceHistory = null,
  recommendations = [],
}: InsightsTabProps) {
  const [filter, setFilter] = useState<FilterType>("all")

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!pieceLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <UploadCloud className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">No Piece Loaded</h3>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Upload and convert a score to discover repeating patterns and practice insights.
        </p>
      </div>
    )
  }

  const hasHistory = !!practiceHistory && practiceHistory.sessions.length > 0
  if (insights.length === 0 && weakSpots.length === 0 && !hasHistory && recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">No Patterns Found</h3>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          This piece doesn&apos;t appear to have detectable repeating patterns, or the score is too short.
        </p>
      </div>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const counts: Record<string, number> = {}
  for (const ins of insights) counts[ins.type] = (counts[ins.type] ?? 0) + 1

  const filtered =
    filter === "all" ? insights : insights.filter((i) => i.type === filter)

  return (
    <div className="space-y-4">
      {/* Recommended for you — from the Adaptive Practice Coach */}
      {recommendations.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Recommended for you</h3>
            </div>
            <div className="space-y-2.5">
              {recommendations.map((rec, i) => (
                <div key={i}>
                  <div className="text-sm font-medium text-foreground">{rec.label}</div>
                  <p className="text-xs text-muted-foreground">{rec.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Practice history — per-piece session log */}
      {hasHistory && practiceHistory && (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Practice history</h3>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-foreground">
                <span className="font-semibold">
                  {Math.round(practiceHistory.sessions.reduce((sum, s) => sum + s.minutes, 0))}
                </span>{" "}
                <span className="text-muted-foreground">min practiced</span>
              </span>
              <span className="text-foreground">
                <span className="font-semibold">{practiceHistory.sessions.length}</span>{" "}
                <span className="text-muted-foreground">
                  session{practiceHistory.sessions.length !== 1 ? "s" : ""}
                </span>
              </span>
              {practiceHistory.lastPlayedAt && (
                <span className="text-muted-foreground">
                  Last played {formatLastPlayed(practiceHistory.lastPlayedAt)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weak spots — bars with the most recorded misses from live-scored play-alongs */}
      {weakSpots.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Bars you keep missing</h3>
            </div>
            <div className="space-y-2">
              {weakSpots.map((w) => (
                <div key={w.bar} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">
                    Bar {w.bar}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {w.count} miss{w.count !== 1 ? "es" : ""}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isComplete}
                    onClick={() => onPracticeSection(w.startSec, w.endSec)}
                    className="shrink-0 gap-1.5"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Practice
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats header */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-sm text-muted-foreground">
          {insights.length} pattern{insights.length !== 1 ? "s" : ""} found
        </span>
        <span className="text-muted-foreground/30">·</span>
        {Object.entries(counts).map(([type, n]) => (
          <span key={type} className="text-[11px] text-muted-foreground">
            {n} {TYPE_LABELS[type] ?? type}
          </span>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.filter((t) => t.value === "all" || (counts[t.value] ?? 0) > 0).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              filter === tab.value
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            {tab.label}
            {tab.value !== "all" && (counts[tab.value] ?? 0) > 0 && (
              <span className="ml-1 opacity-60">{counts[tab.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Insight cards */}
      <ScrollArea className="h-120 pr-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            No {TYPE_LABELS[filter] ?? filter} patterns detected.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((insight) => {
              const TypeIcon = TYPE_ICONS[insight.type] ?? Lightbulb
              const typeLabel = TYPE_LABELS[insight.type] ?? insight.type
              const typeColor = TYPE_COLORS[insight.type] ?? ""

              return (
                <Card
                  key={insight.id}
                  className="border-border/40 bg-card/60 hover:bg-card/80 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <TypeIcon className="h-5 w-5 text-accent" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${typeColor}`}
                          >
                            {typeLabel}
                          </Badge>
                          <Badge variant="secondary" className="text-xs font-medium px-2 py-0">
                            {insight.barRange}
                          </Badge>
                          {insight.occurrences && insight.occurrences.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              also at {insight.occurrences.join(", ")}
                            </span>
                          )}
                          {insight.score != null && insight.type !== "exact" && (
                            <ScorePip score={insight.score} />
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {insight.text}
                        </p>
                        {insight.chordProgression && insight.chordProgression.length > 0 && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Music2 className="h-3 w-3 shrink-0 text-accent/70" />
                            {collapseProgression(insight.chordProgression).join(" · ")}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isComplete}
                        onClick={() => onPracticeSection(insight.loopStart, insight.loopEnd)}
                        className="shrink-0 mt-0.5 gap-1.5"
                        title={!isComplete ? "Convert the score first to enable practice loops" : undefined}
                      >
                        <Target className="h-3.5 w-3.5" />
                        Practice
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
