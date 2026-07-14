"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Loader2, AlertTriangle } from "lucide-react"
import type { MicPitchReading, MicPitchState } from "../lib/micPitchEngine"

interface MicInputPanelProps {
  state: MicPitchState
  reading: MicPitchReading | null
  level: number
  onStart: () => void
  onStop: () => void
}

export function MicInputPanel({ state, reading, level, onStart, onStop }: MicInputPanelProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {state.status === "listening" ? (
            <Mic className="h-3.5 w-3.5 text-accent" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          Microphone input
        </div>
        {state.status === "listening" ? (
          <Button size="sm" variant="outline" onClick={onStop} className="h-7 text-xs">
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onStart}
            disabled={state.status === "requesting"}
            className="h-7 gap-1.5 text-xs"
          >
            {state.status === "requesting" && <Loader2 className="h-3 w-3 animate-spin" />}
            {state.status === "requesting" ? "Requesting…" : "Enable microphone"}
          </Button>
        )}
      </div>

      {state.status === "error" && (
        <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {state.message}
        </div>
      )}

      {state.status === "listening" && (
        <div className="space-y-2">
          {/* Level meter */}
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-75"
              style={{ width: `${Math.min(100, Math.round(level * 400))}%` }}
            />
          </div>
          {/* Detected note + tuning offset */}
          <div className="flex items-center justify-between">
            {reading ? (
              <>
                <span className="text-lg font-bold text-foreground">{reading.noteName}</span>
                <span
                  className={`text-xs tabular-nums ${
                    Math.abs(reading.cents) <= 10 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {reading.cents > 0 ? "+" : ""}
                  {reading.cents}¢
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Listening…</span>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Best for single-note practice. Chords, sustain resonance, and noisy rooms may reduce accuracy.
      </p>
    </div>
  )
}
