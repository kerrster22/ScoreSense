'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, ArrowUpRight, Piano } from "lucide-react"
import type { PatternInsight } from "./types"

interface PatternInsightsProps {
  insights: PatternInsight[]
  isComplete: boolean
  onPracticeSection: (start: number, end: number) => void
}

const TYPE_ICONS = {
  exact: Copy,
  transposed: ArrowUpRight,
  "left-hand": Piano,
} as const

export function PatternInsights({
  insights,
  isComplete,
  onPracticeSection,
}: PatternInsightsProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Pattern Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => {
          const TypeIcon = TYPE_ICONS[insight.type]

          return (
            <div
              key={insight.id}
              className="flex items-start justify-between gap-4 p-3 bg-secondary/50 rounded-lg"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center">
                  <TypeIcon className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs font-medium px-2 py-0">
                      {insight.barRange}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground leading-snug">{insight.text}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!isComplete}
                onClick={() => onPracticeSection(insight.loopStart, insight.loopEnd)}
                className="flex-shrink-0 mt-0.5"
              >
                Practice
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
