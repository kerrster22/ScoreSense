"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Maximize2, Minimize2, MoreHorizontal } from "lucide-react"
import { VisualizerPanel } from "./VisualizerPanel"
import { PianoKeyboard } from "./PianoKeyboard"
import type { Note, PianoKey, LoopRange } from "@/types/practice"

interface PlayerStageCardProps {
  notes: Note[]
  pianoKeys: PianoKey[]
  isComplete: boolean
  playbackTime: number
  handSelection: string
  handVisualMode?: "both" | "right-only" | "left-only"
  showNoteNames: boolean
  showKeyLabels: boolean
  colorblindMode?: boolean
  currentLoop: LoopRange | null
  tempo: number
  activeKeys: string[]
  currentLessonTitle?: string | null
  loopEndTimeSec?: number
  onKeyPress?: (note: string, down: boolean) => void
  showChordLabel?: boolean
}

export function PlayerStageCard({
  notes,
  pianoKeys,
  isComplete,
  playbackTime,
  handSelection,
  handVisualMode,
  showNoteNames,
  showKeyLabels,
  colorblindMode = false,
  currentLoop,
  tempo,
  activeKeys,
  currentLessonTitle,
  loopEndTimeSec,
  onKeyPress,
  showChordLabel = false,
}: PlayerStageCardProps) {
  const [keyboardMode, setKeyboardMode] = useState<"fit" | "scroll">("fit")
  const [keyboardZoom, setKeyboardZoom] = useState<number>(1.2)
  const [keyboardScrollLeft, setKeyboardScrollLeft] = useState<number>(0)
  const [keyboardViewportWidth, setKeyboardViewportWidth] = useState<number | undefined>(undefined)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const handleKeyboardScrollChange = useCallback((scrollLeft: number, viewportWidth: number) => {
    setKeyboardScrollLeft(scrollLeft)
    setKeyboardViewportWidth(viewportWidth)
  }, [])

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
    <div
      ref={fullscreenRef}
      className={
        isFullscreen
          ? "relative flex flex-col bg-[#08080d]"
          : "relative"
      }
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      {/* "Now Learning" banner */}
      {currentLessonTitle && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-t-xl">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-medium text-accent">Now Learning:</span>
          <span className="text-sm text-foreground">{currentLessonTitle}</span>
        </div>
      )}

      <Card className={
        isFullscreen
          ? "flex-1 flex flex-col overflow-hidden rounded-none border-0"
          : `overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm ${currentLessonTitle ? "rounded-t-none" : ""}`
      }>
        <CardContent className={isFullscreen ? "flex-1 flex flex-col p-0 space-y-0" : "p-0 space-y-0"}>
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
              loopEndTimeSec={loopEndTimeSec}
              colorblindMode={colorblindMode}
              showChordLabel={showChordLabel}
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
            onKeyPress={onKeyPress}
            hideOverlayControls
            colorblindMode={colorblindMode}
          />
        </CardContent>
      </Card>

      {/* Fullscreen toggle */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute top-2 left-2 z-20 flex items-center justify-center rounded-lg bg-background/50 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Active hand badge */}
      {handVisualMode && handVisualMode !== "both" && (
        <div className="absolute bottom-16 right-2 z-20">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm border ${
            handVisualMode === "right-only"
              ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
              : "bg-purple-500/20 border-purple-500/40 text-purple-300"
          }`}>
            {handVisualMode === "right-only" ? "R" : "L"}
          </span>
        </div>
      )}

      {/* View settings ⋯ menu */}
      <div className="absolute top-2 right-2 z-20">
        <button
          type="button"
          onClick={() => setShowViewMenu((v) => !v)}
          className="flex items-center justify-center rounded-lg bg-background/50 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label="View settings"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showViewMenu && (
          <div className="absolute right-0 top-9 w-52 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg p-3 space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Keyboard Mode</span>
              <div className="flex gap-1">
                {(["fit", "scroll"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setKeyboardMode(m)}
                    className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors capitalize ${
                      keyboardMode === m
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Zoom</span>
                <span className="text-xs tabular-nums text-foreground">
                  {(keyboardZoom * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.8}
                max={2.0}
                step={0.05}
                value={keyboardZoom}
                onChange={(e) => setKeyboardZoom(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </div>
        )}
      </div>

      {isFullscreen && (
        <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2">
          <span className="rounded-md bg-background/40 px-3 py-1 text-xs text-foreground/50 backdrop-blur-sm">
            Press ESC to exit fullscreen
          </span>
        </div>
      )}
    </div>
  )
}
