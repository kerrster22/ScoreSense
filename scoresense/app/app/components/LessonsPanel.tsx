"use client"

import React, { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  Play,
  BookOpen,
  Repeat,
} from "lucide-react"
import type { Segment, Lesson } from "./types"

interface LessonsPanelProps {
  lessons: Lesson[]
  segments: Segment[]
  currentSegmentId: string | null
  isComplete: boolean
  autoPlayOnSelect: boolean
  onSelectSegment: (segment: Segment) => void
  onNextSegment: () => void
  onPrevSegment: () => void
  onAutoPlayToggle: () => void
}

/** Format seconds as m:ss */
function fmtTime(sec: number): string {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, "0")}`
}

export function LessonsPanel({
  lessons,
  segments,
  currentSegmentId,
  isComplete,
  autoPlayOnSelect,
  onSelectSegment,
  onNextSegment,
  onPrevSegment,
  onAutoPlayToggle,
}: LessonsPanelProps) {
  if (segments.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Chapters & Lessons
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!isComplete}
              onClick={onPrevSegment}
              aria-label="Previous segment"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!isComplete}
              onClick={onNextSegment}
              aria-label="Next segment"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={autoPlayOnSelect ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={onAutoPlayToggle}
            >
              <Play className="h-3 w-3 mr-1" />
              Auto-play
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {segments.map((segment) => {
          const isActive = segment.id === currentSegmentId
          const dur = segment.endSec - segment.startSec

          return (
            <button
              key={segment.id}
              type="button"
              disabled={!isComplete}
              onClick={() => onSelectSegment(segment)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-accent/15 border border-accent/40 text-foreground"
                  : "bg-secondary/50 hover:bg-secondary/80 border border-transparent text-foreground"
              }`}
              title={
                segment.occurrences.length > 1
                  ? `Also occurs at bars ${segment.occurrences.slice(1).join(", ")}`
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">
                      {segment.title}
                    </span>
                    {segment.repeatCount > 1 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0 flex items-center gap-0.5 flex-shrink-0"
                      >
                        <Repeat className="h-2.5 w-2.5" />
                        {segment.repeatCount}x
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtTime(dur)}
                    {segment.occurrences.length > 1 && (
                      <span className="ml-2">
                        {'Also at bars '}{segment.occurrences.slice(1).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <Play
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    isActive ? "text-accent" : "text-muted-foreground"
                  }`}
                />
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
