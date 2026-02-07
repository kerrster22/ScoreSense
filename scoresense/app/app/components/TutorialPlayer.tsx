"use client"

import React, { useCallback, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { VisualizerPanel } from "./VisualizerPanel"
import { PianoKeyboard } from "./PianoKeyboard"
import { TransportControls } from "./TransportControls"
import { PracticeControls } from "./PracticeControls"
import { VisualAidsToggles } from "./VisualAidsToggles"
import { AudioControls } from "./AudioControls"
import { PianoSoundProvider } from "./PianoSoundProvider"
import { useSampledPiano } from "../hooks/useSampledPiano"
import type { Note, PianoKey, LoopRange, LoopOption, HandOption } from "./types"

interface TutorialPlayerProps {
  // Data
  notes: Note[]
  pianoKeys: PianoKey[]
  loopOptions: LoopOption[]
  handOptions: HandOption[]
  // State
  isComplete: boolean
  isPlaying: boolean
  playbackTime: number
  activeKeys: string[]
  tempo: number
  metronomeOn: boolean
  loopSelection: string
  handSelection: string
  currentLoop: LoopRange | null
  showNoteNames: boolean
  showKeyLabels: boolean
  // Callbacks
  onPlayPause: () => void
  onReset: () => void
  onMetronomeToggle: () => void
  onTempoChange: (value: number) => void
  onLoopChange: (value: string) => void
  onHandChange: (value: string) => void
  onClearLoop: () => void
  onShowNoteNamesChange: (value: boolean) => void
  onShowKeyLabelsChange: (value: boolean) => void
}

export function TutorialPlayer({
  notes,
  pianoKeys,
  loopOptions,
  handOptions,
  isComplete,
  isPlaying,
  playbackTime,
  activeKeys,
  tempo,
  metronomeOn,
  loopSelection,
  handSelection,
  currentLoop,
  showNoteNames,
  showKeyLabels,
  onPlayPause,
  onReset,
  onMetronomeToggle,
  onTempoChange,
  onLoopChange,
  onHandChange,
  onClearLoop,
  onShowNoteNamesChange,
  onShowKeyLabelsChange,
}: TutorialPlayerProps) {
  // ---------------------------------------------------------------------------
  // Keyboard "Fit vs Scroll" + Zoom + Scroll sync for visualiser alignment
  // ---------------------------------------------------------------------------
  const [keyboardMode, setKeyboardMode] = useState<"fit" | "scroll">("fit")
  const [keyboardZoom, setKeyboardZoom] = useState<number>(1.2)

  // For aligning falling notes with the scrollable keyboard
  const [keyboardScrollLeft, setKeyboardScrollLeft] = useState<number>(0)
  const [keyboardViewportWidth, setKeyboardViewportWidth] = useState<number | undefined>(undefined)

  // Audio controls
  const { volume, setVolume } = useSampledPiano()

  const handleKeyboardScrollChange = useCallback((scrollLeft: number, viewportWidth: number) => {
    setKeyboardScrollLeft(scrollLeft)
    setKeyboardViewportWidth(viewportWidth)
  }, [])

  return (
    <div className="space-y-6">
      {/* Piano Sound Provider - Handles audio synthesis */}
      <PianoSoundProvider
        notes={notes}
        playbackTime={playbackTime}
        isPlaying={isPlaying}
        tempo={tempo}
        handSelection={handSelection as "both" | "left" | "right"}
      />

      {/* Visualizer & Piano */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 space-y-0">
          <VisualizerPanel
            notes={notes}
            pianoKeys={pianoKeys}
            isComplete={isComplete}
            playbackTime={playbackTime}
            handSelection={handSelection}
            showNoteNames={showNoteNames}
            currentLoop={currentLoop}
            tempo={tempo}
            // NEW: keep visualiser aligned with scroll/zoom keyboard
            keyboardMode={keyboardMode}
            keyboardZoom={keyboardZoom}
            keyboardScrollLeft={keyboardScrollLeft}
            keyboardViewportWidth={keyboardViewportWidth}
          />

          <PianoKeyboard
            pianoKeys={pianoKeys}
            activeKeys={activeKeys}
            showKeyLabels={showKeyLabels}
            // NEW: enable scroll/zoom + emit scroll position
            mode={keyboardMode}
            zoom={keyboardZoom}
            onModeChange={setKeyboardMode}
            onZoomChange={setKeyboardZoom}
            onScrollChange={handleKeyboardScrollChange}
          />
        </CardContent>
      </Card>

      {/* Transport & Practice Controls */}
      <Card>
        <CardContent className="p-4 space-y-6">
          <TransportControls
            isComplete={isComplete}
            isPlaying={isPlaying}
            tempo={tempo}
            metronomeOn={metronomeOn}
            currentLoop={currentLoop}
            onPlayPause={onPlayPause}
            onReset={onReset}
            onMetronomeToggle={onMetronomeToggle}
            onTempoChange={onTempoChange}
            onClearLoop={onClearLoop}
          />

          <PracticeControls
            isComplete={isComplete}
            loopSelection={loopSelection}
            handSelection={handSelection}
            loopOptions={loopOptions}
            handOptions={handOptions}
            onLoopChange={onLoopChange}
            onHandChange={onHandChange}
          />

          <VisualAidsToggles
            showNoteNames={showNoteNames}
            showKeyLabels={showKeyLabels}
            onShowNoteNamesChange={onShowNoteNamesChange}
            onShowKeyLabelsChange={onShowKeyLabelsChange}
          />

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Audio Volume</span>
              <AudioControls
                volume={volume}
                onVolumeChange={setVolume}
                disabled={!isComplete}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
