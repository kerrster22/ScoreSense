'use client';

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Repeat, Hand } from "lucide-react"
import type { LoopOption, HandOption } from "./types"

interface PracticeControlsProps {
  isComplete: boolean
  loopSelection: string
  handSelection: string
  loopOptions: LoopOption[]
  handOptions: HandOption[]
  onLoopChange: (value: string) => void
  onHandChange: (value: string) => void
}

export function PracticeControls({
  isComplete,
  loopSelection,
  handSelection,
  loopOptions,
  handOptions,
  onLoopChange,
  onHandChange,
}: PracticeControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Loop
        </Label>
        <div className="flex flex-wrap gap-1">
          {loopOptions.map((option) => (
            <Button
              key={option.value}
              variant={loopSelection === option.value ? "default" : "outline"}
              size="sm"
              disabled={!isComplete}
              onClick={() => onLoopChange(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <Hand className="h-4 w-4" />
          Hand
        </Label>
        <div className="flex flex-wrap gap-1">
          {handOptions.map((option) => (
            <Button
              key={option.value}
              variant={handSelection === option.value ? "default" : "outline"}
              size="sm"
              disabled={!isComplete}
              onClick={() => onHandChange(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
