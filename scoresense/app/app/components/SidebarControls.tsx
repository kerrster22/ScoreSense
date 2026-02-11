"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TransportControls } from "./TransportControls"
import { PracticeControls } from "./PracticeControls"
import { VisualAidsToggles } from "./VisualAidsToggles"
import { AudioControls } from "./AudioControls"
import { useState } from "react"
import {
  Play,
  Settings2,
  Eye,
  Volume2,
} from "lucide-react"
import type {
  LoopRange,
  LoopOption,
  HandOption,
  NamedLoop,
  HandAudioMode,
  HandVisualMode,
} from "./types"

interface SidebarControlsProps {
  // Transport
  isComplete: boolean
  isPlaying: boolean
  playbackTime: number
  playbackDuration: number
  tempo: number
  metronomeOn: boolean
  currentLoop: LoopRange | null
  onPlayPause: () => void
  onReset: () => void
  onMetronomeToggle: () => void
  onTempoChange: (value: number) => void
  onClearLoop: () => void
  onSeek: (seconds: number) => void
  onTestTone?: () => Promise<void>
  // Practice
  loopSelection: string
  handSelection: string
  loopOptions: LoopOption[]
  handOptions: HandOption[]
  onLoopChange: (value: string) => void
  onHandChange: (value: string) => void
  totalBars: number
  onSetBarLoop: (startBar: number, endBar: number) => void
  namedLoops: NamedLoop[]
  onSaveLoop: (name: string) => void
  onDeleteLoop: (loopId: string) => void
  onSelectNamedLoop: (loop: NamedLoop) => void
  handAudioMode: HandAudioMode
  handVisualMode: HandVisualMode
  onHandAudioModeChange: (mode: HandAudioMode) => void
  onHandVisualModeChange: (mode: HandVisualMode) => void
  // Visual aids
  showNoteNames: boolean
  showKeyLabels: boolean
  onShowNoteNamesChange: (value: boolean) => void
  onShowKeyLabelsChange: (value: boolean) => void
  // View controls
  keyboardMode: "fit" | "scroll"
  keyboardZoom: number
  onKeyboardModeChange: (mode: "fit" | "scroll") => void
  onKeyboardZoomChange: (zoom: number) => void
}

export function SidebarControls({
  isComplete,
  isPlaying,
  playbackTime,
  playbackDuration,
  tempo,
  metronomeOn,
  currentLoop,
  onPlayPause,
  onReset,
  onMetronomeToggle,
  onTempoChange,
  onClearLoop,
  onSeek,
  onTestTone,
  loopSelection,
  handSelection,
  loopOptions,
  handOptions,
  onLoopChange,
  onHandChange,
  totalBars,
  onSetBarLoop,
  namedLoops,
  onSaveLoop,
  onDeleteLoop,
  onSelectNamedLoop,
  handAudioMode,
  handVisualMode,
  onHandAudioModeChange,
  onHandVisualModeChange,
  showNoteNames,
  showKeyLabels,
  onShowNoteNamesChange,
  onShowKeyLabelsChange,
  keyboardMode,
  keyboardZoom,
  onKeyboardModeChange,
  onKeyboardZoomChange,
}: SidebarControlsProps) {
  const [volume, setVolume] = useState<number>(0.7)

  return (
    <div className="space-y-4">
      {/* Transport Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Play className="h-4 w-4 text-accent" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <TransportControls
            isComplete={isComplete}
            isPlaying={isPlaying}
            playbackTime={playbackTime}
            playbackDuration={playbackDuration}
            tempo={tempo}
            metronomeOn={metronomeOn}
            currentLoop={currentLoop}
            onPlayPause={onPlayPause}
            onReset={onReset}
            onMetronomeToggle={onMetronomeToggle}
            onTempoChange={onTempoChange}
            onClearLoop={onClearLoop}
            onSeek={onSeek}
            onTestTone={onTestTone}
          />
        </CardContent>
      </Card>

      {/* Practice Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Settings2 className="h-4 w-4 text-accent" />
            Practice
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <PracticeControls
            isComplete={isComplete}
            loopSelection={loopSelection}
            handSelection={handSelection}
            loopOptions={loopOptions}
            handOptions={handOptions}
            onLoopChange={onLoopChange}
            onHandChange={onHandChange}
            totalBars={totalBars}
            onSetBarLoop={onSetBarLoop}
            namedLoops={namedLoops}
            onSaveLoop={onSaveLoop}
            onDeleteLoop={onDeleteLoop}
            onSelectNamedLoop={onSelectNamedLoop}
            handAudioMode={handAudioMode}
            handVisualMode={handVisualMode}
            onHandAudioModeChange={onHandAudioModeChange}
            onHandVisualModeChange={onHandVisualModeChange}
          />
        </CardContent>
      </Card>

      {/* Visual Aids Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Eye className="h-4 w-4 text-accent" />
            Visual Aids
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <VisualAidsToggles
            showNoteNames={showNoteNames}
            showKeyLabels={showKeyLabels}
            onShowNoteNamesChange={onShowNoteNamesChange}
            onShowKeyLabelsChange={onShowKeyLabelsChange}
          />
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume</span>
            <AudioControls
              volume={volume}
              onVolumeChange={setVolume}
              disabled={!isComplete}
            />
          </div>
        </CardContent>
      </Card>

      {/* View Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Settings2 className="h-4 w-4 text-accent" />
            View
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Mode toggle: Fit / Scroll */}
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Keyboard Mode</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onKeyboardModeChange("fit")}
                className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  keyboardMode === "fit"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => onKeyboardModeChange("scroll")}
                className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  keyboardMode === "scroll"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Scroll
              </button>
            </div>
          </div>

          {/* Zoom slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Zoom</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {(keyboardZoom * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.8}
              max={2.0}
              step={0.05}
              value={keyboardZoom}
              onChange={(e) => onKeyboardZoomChange(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
