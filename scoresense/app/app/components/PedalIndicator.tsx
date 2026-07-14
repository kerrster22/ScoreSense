"use client"

interface PedalIndicatorProps {
  active: boolean
}

/**
 * Small real-time indicator reflecting the sustain pedal automation authored
 * in the loaded MIDI file (CC64), not a user-controllable toggle.
 */
export function PedalIndicator({ active }: PedalIndicatorProps) {
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors",
        active
          ? "bg-accent/15 border-accent/30 text-accent"
          : "bg-muted/40 border-border/50 text-muted-foreground",
      ].join(" ")}
      aria-label={active ? "Sustain pedal engaged" : "Sustain pedal off"}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full bg-current transition-opacity",
          active ? "opacity-100" : "opacity-40",
        ].join(" ")}
      />
      Pedal {active ? "On" : "Off"}
    </div>
  )
}
