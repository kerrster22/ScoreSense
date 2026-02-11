"use client"

import React from "react"
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
} from "lucide-react"
import type { PatternInsight } from "./types"

interface InsightsTabProps {
  insights: PatternInsight[]
  isComplete: boolean
  onPracticeSection: (start: number, end: number) => void
}

const TYPE_ICONS: Record<string, typeof Copy> = {
  exact: Copy,
  near: Copy,
  transposed: ArrowUpRight,
  "left-hand": Piano,
}

const TYPE_LABELS: Record<string, string> = {
  exact: "Exact Repeat",
  near: "Similar Pattern",
  transposed: "Transposed",
  "left-hand": "Left Hand Pattern",
}

const TYPE_COLORS: Record<string, string> = {
  exact: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  near: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  transposed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "left-hand": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
}

export function InsightsTab({
  insights,
  isComplete,
  onPracticeSection,
}: InsightsTabProps) {
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">No Insights Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Pattern insights will appear here after a piece is loaded and analyzed. Upload and convert a score to get started.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[500px] pr-3">
      <div className="space-y-3">
        {insights.map((insight) => {
          const TypeIcon = TYPE_ICONS[insight.type] || Lightbulb
          const typeLabel = TYPE_LABELS[insight.type] || insight.type
          const typeColor = TYPE_COLORS[insight.type] || ""

          return (
            <Card
              key={insight.id}
              className="border-border/40 bg-card/60 hover:bg-card/80 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <TypeIcon className="h-5 w-5 text-accent" />
                  </div>

                  {/* Content */}
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
                          +{insight.occurrences.length} more
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {insight.text}
                    </p>
                  </div>

                  {/* Action */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isComplete}
                    onClick={() => onPracticeSection(insight.loopStart, insight.loopEnd)}
                    className="flex-shrink-0 mt-0.5 gap-1.5"
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
    </ScrollArea>
  )
}
