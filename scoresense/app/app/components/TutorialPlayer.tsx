"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Maximize2, Minimize2 } from "lucide-react"
import { VisualizerPanel } from "./VisualizerPanel"
import { PianoKeyboard } from "./PianoKeyboard"
import { TransportControls } from "./TransportControls"
import { PracticeControls } from "./PracticeControls"
import { VisualAidsToggles } from "./VisualAidsToggles"
import { AudioControls } from "./AudioControls"
import type { Note, PianoKey, LoopRange, LoopOption, HandOption, NamedLoop, HandAudioMode, HandVisualMode } from "./types"

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
  playbackDuration: number
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
  onSeek: (seconds: number) => void
  onShowNoteNamesChange: (value: boolean) => void
  onShowKeyLabelsChange: (value: boolean) => void
  onTestTone?: () => Promise<void>
  // Enhanced practice controls
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
}

export function TutorialPlayer({
  notes,
  pianoKeys,
  loopOptions,
  handOptions,
  isComplete,
  isPlaying,
  playbackTime,
  playbackDuration,
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
  onSeek,
  onShowNoteNamesChange,
  onShowKeyLabelsChange,
  onTestTone,
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
}: TutorialPlayerProps) {
  // ---------------------------------------------------------------------------
  // Keyboard "Fit vs Scroll" + Zoom + Scroll sync for visualiser alignment
  // ---------------------------------------------------------------------------
  const [keyboardMode, setKeyboardMode] = useState<"fit" | "scroll">("fit")
  const [keyboardZoom, setKeyboardZoom] = useState<number>(1.2)
  const [keyboardScrollLeft, setKeyboardScrollLeft] = useState<number>(0)
  const [keyboardViewportWidth, setKeyboardViewportWidth] = useState<number | undefined>(undefined)

  // Audio controls (local state)
  const [volume, setVolume] = useState<number>(0.7)

  const handleKeyboardScrollChange = useCallback((scrollLeft: number, viewportWidth: number) => {
    setKeyboardScrollLeft(scrollLeft)
    setKeyboardViewportWidth(viewportWidth)
  }, [])

  // ---------------------------------------------------------------------------
  // Fullscreen (lives HERE so it wraps both visualizer AND keyboard)
  // ---------------------------------------------------------------------------
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const toggleFullscreen = useCallback(() => {
    const el = fullscreenRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  return (
    <div className="space-y-6">
      {/* Visualizer & Piano -- FULLSCREEN CONTAINER wraps both */}
      <div
        ref={fullscreenRef}
        className={
          isFullscreen
            ? "relative flex flex-col bg-[#08080d]"
            : "relative"
        }
        style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
      >
        <Card className={isFullscreen ? "flex-1 flex flex-col overflow-hidden rounded-none border-0" : "overflow-hidden"}>
          <CardContent className={isFullscreen ? "flex-1 flex flex-col p-0 space-y-0" : "p-0 space-y-0"}>
            {/* Visualizer fills available space; keyboard is anchored at bottom */}
            <div className={isFullscreen ? "flex-1 min-h-0" : ""}>
              <VisualizerPanel
                notes={notes}
                pianoKeys={pianoKeys}
                isComplete={isComplete}
                playbackTime={playbackTime}
                handSelection={handSelection}
                showNoteNames={showNoteNames}
                currentLoop={currentLoop}
                tempo={tempo}
                isFullscreen={isFullscreen}
                keyboardMode={keyboardMode}
                keyboardZoom={keyboardZoom}
                keyboardScrollLeft={keyboardScrollLeft}
                keyboardViewportWidth={keyboardViewportWidth}
              />
            </div>

            <PianoKeyboard
              pianoKeys={pianoKeys}
              activeKeys={activeKeys}
              showKeyLabels={showKeyLabels}
              mode={keyboardMode}
              zoom={keyboardZoom}
              onModeChange={setKeyboardMode}
              onZoomChange={setKeyboardZoom}
              onScrollChange={handleKeyboardScrollChange}
            />
          </CardContent>
        </Card>

        {/* Fullscreen toggle button (overlaid top-left) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute top-2 left-2 z-20 flex items-center justify-center rounded-lg bg-background/50 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* ESC hint in fullscreen */}
        {isFullscreen && (
          <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2">
            <span className="rounded-md bg-background/40 px-3 py-1 text-xs text-foreground/50 backdrop-blur-sm">
              Press ESC to exit fullscreen
            </span>
          </div>
        )}
      </div>

      {/* Transport & Practice Controls */}
      <Card>
        <CardContent className="p-4 space-y-6">
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
