"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  Clock,
  Music,
  BookOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import type { Segment, Lesson } from "./types"

// Mock lessons data for when no analysis is available
const MOCK_LESSONS: MockLesson[] = [
  {
    id: "lesson-1",
    title: "Introduction - Right Hand Melody",
    description: "Learn the main melody with your right hand. Focus on smooth finger transitions.",
    durationMin: 3,
    difficulty: "Beginner",
    progress: 0,
  },
  {
    id: "lesson-2",
    title: "Left Hand Accompaniment",
    description: "Master the left hand chord pattern that supports the melody throughout.",
    durationMin: 4,
    difficulty: "Beginner",
    progress: 0,
  },
  {
    id: "lesson-3",
    title: "Hands Together - Bars 1-8",
    description: "Combine both hands for the opening section at a slow tempo.",
    durationMin: 5,
    difficulty: "Intermediate",
    progress: 0,
  },
  {
    id: "lesson-4",
    title: "Development Section",
    description: "Tackle the more complex middle section with new patterns.",
    durationMin: 6,
    difficulty: "Intermediate",
    progress: 0,
  },
  {
    id: "lesson-5",
    title: "Full Performance",
    description: "Put it all together and play the complete piece at performance tempo.",
    durationMin: 4,
    difficulty: "Advanced",
    progress: 0,
  },
]

interface MockLesson {
  id: string
  title: string
  description: string
  durationMin: number
  difficulty: string
  progress: number
}

interface LessonsTabProps {
  lessons: Lesson[]
  segments: Segment[]
  isComplete: boolean
  onStartLesson: (lesson: Lesson | null, segment?: Segment) => void
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const ss = Math.floor(sec % 60)
  return `${m}:${ss.toString().padStart(2, "0")}`
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Advanced: "bg-rose-500/15 text-rose-400 border-rose-500/30",
}

export function LessonsTab({
  lessons,
  segments,
  isComplete,
  onStartLesson,
}: LessonsTabProps) {
  const [selectedMockId, setSelectedMockId] = useState<string | null>("lesson-1")
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)

  // If we have real segments from analysis, use those; else show mocks
  const hasRealData = segments.length > 0

  const selectedMock = MOCK_LESSONS.find((l) => l.id === selectedMockId)
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId)

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Lesson List */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-[500px] pr-3">
          <div className="space-y-3">
            {hasRealData ? (
              segments.map((segment, idx) => {
                const isSelected = segment.id === selectedSegmentId
                const dur = segment.endSec - segment.startSec
                const difficulty =
                  dur < 15 ? "Beginner" : dur < 30 ? "Intermediate" : "Advanced"

                return (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => setSelectedSegmentId(segment.id)}
                    className={`w-full text-left rounded-xl p-4 transition-all border ${
                      isSelected
                        ? "bg-accent/10 border-accent/40 shadow-[0_0_20px_rgba(var(--accent),0.08)]"
                        : "bg-card/60 border-border/40 hover:bg-card/80 hover:border-border/60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail placeholder */}
                      <div className="flex-shrink-0 h-16 w-16 rounded-lg bg-secondary/60 flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground/50" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {segment.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtTime(dur)}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_COLORS[difficulty] || ""}`}
                          >
                            {difficulty}
                          </Badge>
                          {segment.repeatCount > 1 && (
                            <span className="text-accent/80">
                              {segment.repeatCount}x repeats
                            </span>
                          )}
                        </div>
                        {/* Progress bar stub */}
                        <Progress value={0} className="h-1 mt-2" />
                      </div>

                      <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 transition-colors ${
                        isSelected ? "text-accent" : "text-muted-foreground/30"
                      }`} />
                    </div>
                  </button>
                )
              })
            ) : (
              MOCK_LESSONS.map((lesson) => {
                const isSelected = lesson.id === selectedMockId
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedMockId(lesson.id)}
                    className={`w-full text-left rounded-xl p-4 transition-all border ${
                      isSelected
                        ? "bg-accent/10 border-accent/40 shadow-[0_0_20px_rgba(var(--accent),0.08)]"
                        : "bg-card/60 border-border/40 hover:bg-card/80 hover:border-border/60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 h-16 w-16 rounded-lg bg-secondary/60 flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground/50" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {lesson.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                          {lesson.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lesson.durationMin} min
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_COLORS[lesson.difficulty] || ""}`}
                          >
                            {lesson.difficulty}
                          </Badge>
                        </div>
                        <Progress value={lesson.progress} className="h-1 mt-2" />
                      </div>

                      <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 transition-colors ${
                        isSelected ? "text-accent" : "text-muted-foreground/30"
                      }`} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Preview Panel */}
      <div className="lg:w-80 flex-shrink-0">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Lesson Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasRealData && selectedSegment ? (
              <>
                {/* Large cover */}
                <div className="h-32 rounded-lg bg-secondary/40 flex items-center justify-center border border-border/30">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1 text-balance">
                    {selectedSegment.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Bars {selectedSegment.startBar}-{selectedSegment.endBar}
                    {selectedSegment.repeatCount > 1 && (
                      <span> (repeats {selectedSegment.repeatCount}x)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtTime(selectedSegment.endSec - selectedSegment.startSec)}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!isComplete}
                  onClick={() => onStartLesson(null, selectedSegment)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Lesson
                </Button>
              </>
            ) : selectedMock ? (
              <>
                <div className="h-32 rounded-lg bg-secondary/40 flex items-center justify-center border border-border/30">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1 text-balance">
                    {selectedMock.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedMock.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedMock.durationMin} min
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_COLORS[selectedMock.difficulty] || ""}`}
                    >
                      {selectedMock.difficulty}
                    </Badge>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!isComplete}
                  onClick={() => onStartLesson(null)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Lesson
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a lesson to preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
