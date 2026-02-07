"use client"

import React, { useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Volume2, VolumeX } from "lucide-react"

interface AudioControlsProps {
  volume: number // 0 to 1
  onVolumeChange: (value: number) => void
  disabled?: boolean
}

export function AudioControls({
  volume,
  onVolumeChange,
  disabled = false,
}: AudioControlsProps) {
  const handleVolumeChange = useCallback(
    (values: number[]) => {
      onVolumeChange(values[0])
    },
    [onVolumeChange]
  )

  const volumePercent = Math.round(volume * 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <VolumeX className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[volume]}
          onValueChange={handleVolumeChange}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          className="w-32"
        />
        <Volume2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-sm text-muted-foreground w-12 text-right">
        {volumePercent}%
      </span>
    </div>
  )
}
