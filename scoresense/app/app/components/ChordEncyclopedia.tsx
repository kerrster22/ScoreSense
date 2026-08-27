"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Target } from "lucide-react"
import { PianoKeyboard } from "./PianoKeyboard"
import {
  CHORD_QUALITIES,
  getAllChordDefinitions,
  type ChordDefinition,
  type ChordQuality,
} from "@/lib/chordLibrary"
import { countMastered, getChordMasteryEntry } from "../lib/chordMastery"
import { generateFullPianoKeys, midiToNoteName } from "../lib/piano"

const PIANO_KEYS = generateFullPianoKeys()

function qualityHeading(quality: ChordQuality): string {
  return quality.intervals.length === 3 ? `${quality.label} triads` : quality.label
}

interface ChordEncyclopediaProps {
  onStartTraining: (focusChordId: string | null) => void
}

export function ChordEncyclopedia({ onStartTraining }: ChordEncyclopediaProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedInversion, setSelectedInversion] = useState(0)
  // Bumped whenever a mastery-affecting action happens, so the badges/stats
  // re-read localStorage instead of going stale for the rest of the session.
  const [masteryVersion, setMasteryVersion] = useState(0)

  const allDefs = useMemo(() => getAllChordDefinitions(), [])
  const essentialIds = useMemo(
    () => allDefs.filter((d) => d.quality.essential).map((d) => d.id),
    [allDefs]
  )
  const masteredCount = useMemo(
    () => countMastered(essentialIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [essentialIds, masteryVersion]
  )

  const byQuality = useMemo(() => {
    const map = new Map<string, ChordDefinition[]>()
    for (const q of CHORD_QUALITIES) map.set(q.id, allDefs.filter((d) => d.quality.id === q.id))
    return map
  }, [allDefs])

  const selected = selectedId ? allDefs.find((d) => d.id === selectedId) ?? null : null

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSelectedInversion(0)
    setMasteryVersion((v) => v + 1)
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Chord Mastery</h2>
            <span className="text-sm font-semibold text-accent tabular-nums">
              {masteredCount} / {essentialIds.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${essentialIds.length > 0 ? (masteredCount / essentialIds.length) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Essential chords — 4 triad qualities + 3 seventh qualities, across all 12 roots.
          </p>
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => onStartTraining(null)}>
            <Target className="h-3.5 w-3.5" />
            Start Chord Training
          </Button>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-foreground">{selected.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.inversions[selectedInversion].notesMidi
                    .map((m) => midiToNoteName(m).replace(/-?\d+$/, ""))
                    .join(" – ")}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onStartTraining(selected.id)}>
                  <Target className="h-3.5 w-3.5" />
                  Practice this chord
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {selected.inversions.map((inv) => (
                <button
                  key={inv.inversion}
                  type="button"
                  onClick={() => setSelectedInversion(inv.inversion)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                    selectedInversion === inv.inversion
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {inv.label}
                </button>
              ))}
            </div>
            <PianoKeyboard
              pianoKeys={PIANO_KEYS}
              activeKeys={selected.inversions[selectedInversion].notesMidi.map((m) => midiToNoteName(m))}
              showKeyLabels={false}
              hideOverlayControls
            />
          </CardContent>
        </Card>
      )}

      {CHORD_QUALITIES.filter((q) => q.essential).map((quality) => (
        <ChordQualitySection
          key={quality.id}
          quality={quality}
          defs={byQuality.get(quality.id) ?? []}
          onSelect={handleSelect}
          selectedId={selectedId}
          masteryVersion={masteryVersion}
        />
      ))}

      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          More chords — sus2, sus4, diminished 7, minor-major 7
        </summary>
        <div className="mt-3 space-y-5">
          {CHORD_QUALITIES.filter((q) => !q.essential).map((quality) => (
            <ChordQualitySection
              key={quality.id}
              quality={quality}
              defs={byQuality.get(quality.id) ?? []}
              onSelect={handleSelect}
              selectedId={selectedId}
              masteryVersion={masteryVersion}
            />
          ))}
        </div>
      </details>
    </div>
  )
}

function ChordQualitySection({
  quality,
  defs,
  onSelect,
  selectedId,
  masteryVersion,
}: {
  quality: ChordQuality
  defs: ChordDefinition[]
  onSelect: (id: string) => void
  selectedId: string | null
  masteryVersion: number
}) {
  const masteredCount = useMemo(
    () => countMastered(defs.map((d) => d.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defs, masteryVersion]
  )
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">{qualityHeading(quality)}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {masteredCount}/{defs.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {defs.map((def) => {
          const mastered = !!getChordMasteryEntry(def.id)?.masteredAt
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onSelect(def.id)}
              className={`relative rounded-lg border px-2 py-2 text-left transition-colors ${
                selectedId === def.id
                  ? "border-accent bg-accent/10"
                  : "border-border/40 bg-card/40 hover:border-border hover:bg-card/70"
              }`}
            >
              <span className="text-sm font-semibold text-foreground">{def.symbol}</span>
              {mastered && (
                <CheckCircle2 className="absolute right-1.5 top-1.5 h-3 w-3 text-emerald-400" aria-label="Mastered" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
