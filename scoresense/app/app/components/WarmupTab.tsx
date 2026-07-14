"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, HeartPulse, Sparkles } from "lucide-react"
import { getExerciseLibrary, MOBILITY_TIPS } from "@/lib/exerciseLibrary"
import type { ExerciseCategory, ExerciseDefinition } from "@/types/exercises"
import type { Recommendation } from "../lib/practiceCoach"

interface WarmupTabProps {
  onSelectExercise: (exercise: ExerciseDefinition) => void
  activeExerciseId?: string | null
  recommendations?: Recommendation[]
}

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  "finger-warmup": "Finger Warm-ups",
  scale: "Scales",
  arpeggio: "Arpeggios",
  rhythm: "Rhythm Training",
  "hand-independence": "Hand Independence",
}

const CATEGORY_ORDER: ExerciseCategory[] = [
  "finger-warmup",
  "scale",
  "arpeggio",
  "hand-independence",
  "rhythm",
]

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: "Easy", 2: "Medium", 3: "Hard" }
const DIFFICULTY_STYLE: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  2: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  3: "bg-rose-500/15 text-rose-400 border-rose-500/30",
}

export function WarmupTab({ onSelectExercise, activeExerciseId, recommendations = [] }: WarmupTabProps) {
  const library = useMemo(() => {
    const raw = getExerciseLibrary()
    const sorted = {} as ReturnType<typeof getExerciseLibrary>
    for (const category of CATEGORY_ORDER) {
      sorted[category] = [...raw[category]].sort((a, b) => a.difficulty - b.difficulty)
    }
    return sorted
  }, [])
  const warmupRecs = recommendations.filter((r) => r.type === "warmup")

  return (
    <div className="space-y-6">
      {warmupRecs.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Recommended warm-up today</h2>
            </div>
            {warmupRecs.map((rec, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {rec.detail}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Before you start</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {MOBILITY_TIPS.map((tip) => (
              <div key={tip.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="text-xs font-semibold text-foreground">{tip.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tip.tip}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {CATEGORY_ORDER.map((category) => (
        <div key={category}>
          <h3 className="mb-2 px-1 text-sm font-semibold text-foreground">{CATEGORY_LABELS[category]}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {library[category].map((exercise) => (
              <Card
                key={exercise.id}
                className={`border-border/40 bg-card/60 transition-colors ${
                  activeExerciseId === exercise.id ? "border-accent/50 bg-accent/5" : ""
                }`}
              >
                <CardContent className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{exercise.title}</span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {exercise.bpm} BPM
                      </Badge>
                      <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${DIFFICULTY_STYLE[exercise.difficulty]}`}>
                        {DIFFICULTY_LABEL[exercise.difficulty]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{exercise.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => onSelectExercise(exercise)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Practice
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
