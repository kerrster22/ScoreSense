"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { FlaskConical } from "lucide-react"

interface SettingsTabProps {
  playAlongEnabled: boolean
  onPlayAlongEnabledChange: (enabled: boolean) => void
  liveChordDisplayEnabled: boolean
  onLiveChordDisplayEnabledChange: (enabled: boolean) => void
}

export function SettingsTab({
  playAlongEnabled,
  onPlayAlongEnabledChange,
  liveChordDisplayEnabled,
  onLiveChordDisplayEnabledChange,
}: SettingsTabProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FlaskConical className="h-4 w-4 text-accent" />
          Beta Features
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Early, still-rough features you can opt into. Off by default.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Play-along input &amp; scoring</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Lets you play along on the on-screen keyboard, your computer keyboard, or a microphone,
              and scores each note in real time. Also adds "wait for correct note" practice mode and an
              accuracy summary when a piece finishes.
            </p>
          </div>
          <Switch checked={playAlongEnabled} onCheckedChange={onPlayAlongEnabledChange} className="mt-0.5 shrink-0" />
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Live chord labels</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Shows the chord currently sounding on the falling-notes view and the transport bar. Since a
              clean chord isn't detected on every beat, this can flicker on and off during a piece.
            </p>
          </div>
          <Switch
            checked={liveChordDisplayEnabled}
            onCheckedChange={onLiveChordDisplayEnabledChange}
            className="mt-0.5 shrink-0"
          />
        </CardContent>
      </Card>
    </div>
  )
}
