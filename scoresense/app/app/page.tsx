"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import * as Tone from "tone"

// Components
import { AppTopNav } from "./components/AppTopNav"
import { UploadCard } from "./components/UploadCard"
import { ConversionStatusCard } from "./components/ConversionStatusCard"
import { PlayerStageCard } from "./components/PlayerStageCard"
import { SidebarControls } from "./components/SidebarControls"
import { LessonsTab } from "./components/LessonsTab"
import { InsightsTab } from "./components/InsightsTab"

// UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// Icons
import {
  Music,
  Play,
  BookOpen,
  Lightbulb,
  Upload,
  Timer,
  Clock,
  Hand,
} from "lucide-react"

// Types
import type {
  UploadedFile,
  Note,
  PianoKey,
  ConversionStep,
  LoopOption,
  HandOption,
  PatternInsight,
  LoopRange,
  NamedLoop,
  Segment,
  Lesson,
  HandAudioMode,
  HandVisualMode,
} from "./components/types"

// Hooks / utils
import { useMidi } from "./lib/useMidi"
import { generateFullPianoKeys } from "./lib/piano"
import { useMusicXml } from "./hooks/useMusicXml"
import { useHybridScore } from "./hooks/useHybridScore"
import { getPianoAudioEngine, type PianoAudioEngineState } from "./lib/pianoAudioEngine"
import { analyzePiece, ALGO_VERSION } from "./lib/practiceAnalysis"
import {
  computePieceHash,
  loadPieceData,
  addNamedLoop,
  deleteNamedLoop,
  saveLastPosition,
  getCachedAnalysis,
  cacheAnalysis,
} from "./lib/persistence"
import { filterNotesByVisualHand, filterNotesByAudioHand, computeActiveKeys } from "./lib/handFilter"

// ============================================================================
// Constants / Mock Data
// ============================================================================

const MOCK_NOTES: Note[] = [
  { id: 1, note: "C4", hand: "right", startTime: 0, duration: 1 },
  { id: 2, note: "E4", hand: "right", startTime: 0.5, duration: 0.5 },
  { id: 3, note: "G4", hand: "right", startTime: 1, duration: 1 },
  { id: 4, note: "C3", hand: "left", startTime: 0, duration: 2 },
  { id: 5, note: "G3", hand: "left", startTime: 2, duration: 2 },
  { id: 6, note: "F4", hand: "right", startTime: 2, duration: 0.5 },
  { id: 7, note: "A4", hand: "right", startTime: 2.5, duration: 0.5 },
  { id: 8, note: "B4", hand: "right", startTime: 3, duration: 1 },
  { id: 9, note: "D4", hand: "right", startTime: 3.5, duration: 0.5 },
  { id: 10, note: "E3", hand: "left", startTime: 4, duration: 2 },
  { id: 11, note: "C5", hand: "right", startTime: 4, duration: 1 },
  { id: 12, note: "G4", hand: "right", startTime: 4.5, duration: 0.5 },
  { id: 13, note: "F#3", hand: "left", startTime: 5, duration: 1 },
  { id: 14, note: "A3", hand: "left", startTime: 5.5, duration: 0.5 },
  { id: 15, note: "D5", hand: "right", startTime: 5, duration: 0.75 },
  { id: 16, note: "B3", hand: "left", startTime: 6, duration: 1 },
]

const PIANO_KEYS: PianoKey[] = generateFullPianoKeys()

const CONVERSION_STEPS: ConversionStep[] = [
  { id: 1, label: "Rendering pages" },
  { id: 2, label: "Reading notes (OMR)" },
  { id: 3, label: "Building MIDI" },
  { id: 4, label: "Preparing tutorial" },
]

const LOOP_OPTIONS: LoopOption[] = [
  { value: "off", label: "Off" },
  { value: "1", label: "1 bar" },
  { value: "2", label: "2 bars" },
  { value: "4", label: "4 bars" },
]

const HAND_OPTIONS: HandOption[] = [
  { value: "both", label: "Both" },
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
]

const FALLBACK_PATTERN_INSIGHTS: PatternInsight[] = [
  {
    id: 1,
    text: "This section repeats exactly - master it once, play it twice",
    barRange: "Bars 9-16",
    type: "exact",
    loopStart: 9,
    loopEnd: 16,
  },
  {
    id: 2,
    text: "Left-hand pattern stays consistent here - great for building muscle memory",
    barRange: "Bars 1-8",
    type: "left-hand",
    loopStart: 1,
    loopEnd: 8,
  },
  {
    id: 3,
    text: "The main theme returns transposed higher - same fingering, new position",
    barRange: "Bars 33-40",
    type: "transposed",
    loopStart: 33,
    loopEnd: 40,
  },
]

// ============================================================================
// Helper: format seconds -> m:ss
// ============================================================================
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AppPage() {
  // ---------- Upload state ----------
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ---------- Conversion state ----------
  const [isConverting, setIsConverting] = useState(false)
  const [conversionStep, setConversionStep] = useState(0)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // ---------- MIDI / MusicXML state ----------
  const [midiUrl, setMidiUrl] = useState<string | null>(null)
  const midiState = useMidi(midiUrl)
  const [musicXmlUrl, setMusicXmlUrl] = useState<string | null>(null)
  const musicXmlState = useMusicXml(musicXmlUrl)

  // ---------- Player state ----------
  const [isPlaying, setIsPlaying] = useState(false)
  const [tempo, setTempo] = useState(75)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [loopSelection, setLoopSelection] = useState("off")
  const [handSelection, setHandSelection] = useState("both")
  const [currentLoop, setCurrentLoop] = useState<LoopRange | null>(null)

  // ---------- Visual aids ----------
  const [showNoteNames, setShowNoteNames] = useState(true)
  const [showKeyLabels, setShowKeyLabels] = useState(false)

  // ---------- Hand modes ----------
  const [handAudioMode, setHandAudioMode] = useState<HandAudioMode>("both")
  const [handVisualMode, setHandVisualMode] = useState<HandVisualMode>("both")

  // ---------- Analysis & lessons ----------
  const [segments, setSegments] = useState<Segment[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([])
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null)
  const [autoPlayOnSelect, setAutoPlayOnSelect] = useState(true)

  // ---------- Current lesson (for "Now Learning" banner) ----------
  const [currentLessonTitle, setCurrentLessonTitle] = useState<string | null>(null)

  // ---------- Named loops & persistence ----------
  const [namedLoops, setNamedLoops] = useState<NamedLoop[]>([])
  const [pieceHash, setPieceHash] = useState<string | null>(null)

  // ---------- Animation state ----------
  const [playbackTime, setPlaybackTime] = useState(0)
  const animationRef = useRef<number>(null)

  // ---------- Audio engine ----------
  const [audioEngineState, setAudioEngineState] = useState<PianoAudioEngineState>({
    status: "loading",
    error: null,
  })
  const audioEngineRef = useRef(getPianoAudioEngine())

  // ---------- Tab state ----------
  const [activeTab, setActiveTab] = useState("player")

  // ---------- View controls (lifted to page for sidebar) ----------
  const [keyboardMode, setKeyboardMode] = useState<"fit" | "scroll">("fit")
  const [keyboardZoom, setKeyboardZoom] = useState<number>(1.2)

  // =========================================================================
  // Derived: Notes for player
  // =========================================================================
  const hybrid = useHybridScore({ midiUrl, xmlUrl: musicXmlUrl })

  const notesForPlayer: Note[] = useMemo(() => {
    if (hybrid.status === "ready" || hybrid.status === "midi-only" || hybrid.status === "xml-only") {
      return hybrid.events.map((e) => ({
        id: e.id,
        note: e.noteName,
        midi: e.midi,
        hand: e.hand,
        startTime: e.startTime,
        duration: e.duration,
        velocity: e.velocity,
        staff: e.staff,
        voice: e.voice,
        measure: e.measure,
        source: e.source,
      }))
    }
    return MOCK_NOTES
  }, [hybrid])

  const playbackDuration = useMemo(() => {
    if (midiState.status === "ready") return midiState.duration
    if (musicXmlState.status === "ready") return musicXmlState.duration
    return 8
  }, [midiState, musicXmlState])

  // =========================================================================
  // Consistent hand filtering using shared helper
  // =========================================================================
  const visuallyFilteredNotes = useMemo(
    () => filterNotesByVisualHand(notesForPlayer, handVisualMode),
    [notesForPlayer, handVisualMode]
  )

  // The handSelection prop for the visualizer: derive from handVisualMode
  const handSelectionForVisualizer = useMemo(() => {
    switch (handVisualMode) {
      case "right-only": return "right"
      case "left-only": return "left"
      default: return "both"
    }
  }, [handVisualMode])

  // Active keys: computed from visually filtered notes only
  const activeKeys = useMemo(
    () => computeActiveKeys(visuallyFilteredNotes, playbackTime),
    [visuallyFilteredNotes, playbackTime]
  )

  // =========================================================================
  // Metadata for header
  // =========================================================================
  const pieceName = isComplete ? "Demo Piece" : "No piece loaded"
  const composerName = isComplete ? "Unknown Composer" : ""
  const bpm = midiState.status === "ready" && midiState.bpm ? Math.round(midiState.bpm) : null

  // =========================================================================
  // Audio engine init
  // =========================================================================
  useEffect(() => {
    const engine = audioEngineRef.current
    const initEngine = async () => {
      try {
        await engine.load()
        setAudioEngineState({ status: "ready", error: null })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error"
        setAudioEngineState({ status: "error", error: errMsg })
        console.error("Audio engine failed to load:", errMsg)
      }
    }

    initEngine()
  }, [])

  // =========================================================================
  // File Upload Handlers
  // =========================================================================
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && /\.(pdf|jpg|jpeg|png)$/i.test(droppedFile.name)) {
      setFile({ name: droppedFile.name, size: droppedFile.size })
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile({ name: selectedFile.name, size: selectedFile.size })
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileRemove = useCallback(() => {
    setFile(null)
  }, [])

  // =========================================================================
  // Conversion Handlers
  // =========================================================================
  const startConversion = useCallback(() => {
    if (!file) return
    setIsConverting(true)
    setConversionStep(1)
    setConversionProgress(0)
    setIsComplete(false)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
  }, [file])

  const cancelConversion = useCallback(() => {
    setIsConverting(false)
    setConversionStep(0)
    setConversionProgress(0)
    setIsComplete(false)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
  }, [])

  useEffect(() => {
    if (!isConverting) return
    const interval = setInterval(() => {
      setConversionProgress((prev) => {
        const newProgress = prev + 2
        if (newProgress >= 100) {
          setIsConverting(false)
          setIsComplete(true)

          // ✅ For now, “conversion” just loads demo files from /public
          // Make sure these files exist:
          // /public/demo3.mid
          // /public/demo3.musicxml  (or .xml)
          setMidiUrl("/demo3.mid")
          setMusicXmlUrl("/demo9.mxl")

          clearInterval(interval)
          return 100
        }
        if (newProgress >= 75) setConversionStep(4)
        else if (newProgress >= 50) setConversionStep(3)
        else if (newProgress >= 25) setConversionStep(2)
        return newProgress
      })
    }, 160)
    return () => clearInterval(interval)
  }, [isConverting])

  // =========================================================================
  // Player Handlers
  // =========================================================================
  const handlePlayPause = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") return
    try {
      if (isPlaying) {
        engine.pause()
        setIsPlaying(false)
      } else {
        await engine.play()
        setIsPlaying(true)
      }
    } catch (err) {
      console.error("Play/pause error:", err)
      setIsPlaying(false)
    }
  }, [isPlaying])

  const handleReset = useCallback(() => {
    const engine = audioEngineRef.current
    try {
      engine.stop()
      setPlaybackTime(0)
      setIsPlaying(false)
    } catch (err) {
      console.error("Reset error:", err)
    }
  }, [])

  const handleMetronomeToggle = useCallback(() => setMetronomeOn((p) => !p), [])

  const handleTempoChange = useCallback((value: number) => {
    setTempo(value)
    audioEngineRef.current.setTempo(value)
  }, [])

  const handleTestTone = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") return
    try {
      await Tone.start()
      const sampler = (engine as any).sampler
      if (sampler) sampler.triggerAttackRelease("C4", 1)
    } catch (err) {
      console.error("Test tone error:", err)
    }
  }, [])

  const handleLoopChange = useCallback((value: string) => {
    setLoopSelection(value)
    if (value === "off") {
      setCurrentLoop(null)
      audioEngineRef.current.setLoop({ enabled: false })
    }
  }, [])

  const handleHandChange = useCallback((value: string) => setHandSelection(value), [])

  const handleClearLoop = useCallback(() => {
    setCurrentLoop(null)
    setLoopSelection("off")
    audioEngineRef.current.setLoop({ enabled: false })
  }, [])

  const handlePracticeSection = useCallback((start: number, end: number) => {
    setCurrentLoop({ start, end })
    setLoopSelection("custom")
    audioEngineRef.current.setLoop({ enabled: true, startSec: start, endSec: end })
    setActiveTab("player") // switch to player tab
  }, [])

  const handleSeek = useCallback((seconds: number) => {
    audioEngineRef.current.seek(seconds, { resume: isPlaying })
    setPlaybackTime(seconds)
  }, [isPlaying])

  // Set notes to audio engine based on handAudioMode
  useEffect(() => {
    const engine = audioEngineRef.current
    const filtered = filterNotesByAudioHand(notesForPlayer, handAudioMode)
      .map((note) => ({
        ...note,
        id: typeof note.id === "string" ? parseInt(note.id, 10) : note.id,
      }))
    
    // Extract pedal events from hybrid state if available
    let pedalEvents = undefined
    if (hybrid.status === "ready" || hybrid.status === "midi-only") {
      pedalEvents = hybrid.pedalEvents
    }
    
    engine.setNotes(filteredNotes, pedalEvents)
  }, [notesForPlayer, handAudioMode, hybrid])

  // Playback animation
  useEffect(() => {
    if (!isPlaying || !isComplete) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }
    const animate = () => {
      try {
        const engine = audioEngineRef.current
        engine.tickLoop()
        const currentTime = engine.getTime()

        // Update playbackTime from audio engine (single source of truth)
        setPlaybackTime(currentTime)
        if (!engine.isLooping() && currentTime >= playbackDuration) {
          engine.stop()
          setPlaybackTime(0)
          setIsPlaying(false)
          return
        }
        animationRef.current = requestAnimationFrame(animate)
      } catch (err) {
        console.error("Animation frame error:", err)
        setIsPlaying(false)
      }
    }
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, isComplete, playbackDuration])

  // =========================================================================
  // Analysis + Persistence
  // =========================================================================
  useEffect(() => {
    if (notesForPlayer.length === 0 || notesForPlayer === MOCK_NOTES) return
    const hash = computePieceHash(
      notesForPlayer.map((n) => ({ midi: 0, startTime: n.startTime }))
    )
    setPieceHash(hash)
    const persisted = loadPieceData(hash)
    setNamedLoops(persisted.namedLoops)
    if (persisted.lastPositionSec > 0 && !isPlaying) {
      setPlaybackTime(persisted.lastPositionSec)
    }
  }, [notesForPlayer])

  useEffect(() => {
    if (musicXmlState.status !== "ready" || !pieceHash) return
    const cached = getCachedAnalysis(pieceHash, ALGO_VERSION)
    if (cached) {
      setSegments(cached.segments)
      setLessons(cached.lessons)
      setPatternInsights(cached.insights)
      return
    }
    const result = analyzePiece(musicXmlState.events as any, musicXmlState.measureMap)
    setSegments(result.segments)
    setLessons(result.lessons)
    setPatternInsights(result.insights)
    cacheAnalysis(pieceHash, ALGO_VERSION, result.segments, result.lessons, result.insights)
  }, [musicXmlState, pieceHash])

  useEffect(() => {
    if (!pieceHash || !isPlaying) return
    const interval = setInterval(() => saveLastPosition(pieceHash, playbackTime), 2000)
    return () => clearInterval(interval)
  }, [pieceHash, isPlaying, playbackTime])

  // =========================================================================
  // Measure map helpers
  // =========================================================================
  const measureMap = musicXmlState.status === "ready" ? musicXmlState.measureMap : []
  const totalBars = measureMap.length

  const barsToSeconds = useCallback(
    (startBar: number, endBar: number): { startSec: number; endSec: number } | null => {
      const startEntry = measureMap.find((m) => m.measure === startBar)
      const endEntry = measureMap.find((m) => m.measure === endBar)
      if (!startEntry || !endEntry) return null
      return { startSec: startEntry.startSec, endSec: endEntry.endSec }
    },
    [measureMap]
  )

  // =========================================================================
  // Named loop handlers
  // =========================================================================
  const handleSetBarLoop = useCallback(
    (startBar: number, endBar: number) => {
      const range = barsToSeconds(startBar, endBar)
      if (!range) return
      setCurrentLoop({ start: startBar, end: endBar })
      setLoopSelection("custom")
      audioEngineRef.current.setLoop({ enabled: true, startSec: range.startSec, endSec: range.endSec })
    },
    [barsToSeconds]
  )

  const handleSaveNamedLoop = useCallback(
    (name: string) => {
      if (!pieceHash || !currentLoop) return
      const range = barsToSeconds(currentLoop.start, currentLoop.end)
      if (!range) return
      const loop: NamedLoop = {
        id: `loop-${Date.now()}`,
        name,
        startBar: currentLoop.start,
        endBar: currentLoop.end,
        startSec: range.startSec,
        endSec: range.endSec,
      }
      const updated = addNamedLoop(pieceHash, loop)
      setNamedLoops(updated.namedLoops)
    },
    [pieceHash, currentLoop, barsToSeconds]
  )

  const handleDeleteNamedLoop = useCallback(
    (loopId: string) => {
      if (!pieceHash) return
      const updated = deleteNamedLoop(pieceHash, loopId)
      setNamedLoops(updated.namedLoops)
    },
    [pieceHash]
  )

  const handleSelectNamedLoop = useCallback(
    (loop: NamedLoop) => {
      setCurrentLoop({ start: loop.startBar, end: loop.endBar })
      setLoopSelection("custom")
      audioEngineRef.current.setLoop({ enabled: true, startSec: loop.startSec, endSec: loop.endSec })
    },
    []
  )

  // =========================================================================
  // Segment / Lesson navigation
  // =========================================================================
  const handleSelectSegment = useCallback(
    (segment: Segment) => {
      setCurrentSegmentId(segment.id)
      const engine = audioEngineRef.current
      engine.seek(segment.startSec, { resume: autoPlayOnSelect && isPlaying })
      engine.setLoop({ enabled: true, startSec: segment.startSec, endSec: segment.endSec })
      setCurrentLoop({ start: segment.startBar, end: segment.endBar })
      setLoopSelection("custom")
      setPlaybackTime(segment.startSec)
      if (autoPlayOnSelect && !isPlaying) handlePlayPause()
    },
    [autoPlayOnSelect, isPlaying, handlePlayPause]
  )

  const handleStartLesson = useCallback(
    (lesson: Lesson | null, segment?: Segment) => {
      if (segment) {
        setCurrentLessonTitle(segment.title)
        handleSelectSegment(segment)
      } else {
        setCurrentLessonTitle(null)
      }
      setActiveTab("player")
    },
    [handleSelectSegment]
  )

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="min-h-screen bg-background">
      <AppTopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* =============================================================== */}
        {/* TOP HEADER */}
        {/* =============================================================== */}
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Piano Tutorial
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{pieceName}</span>
                {composerName && (
                  <>
                    <span className="text-muted-foreground/40">{"/"}</span>
                    <span className="text-sm text-muted-foreground">{composerName}</span>
                  </>
                )}
              </div>
              {/* Metadata badges */}
              {isComplete && (
                <div className="flex items-center gap-2 mt-2.5">
                  {bpm && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Timer className="h-3 w-3" />
                      {bpm} BPM
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDuration(playbackDuration)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Hand className="h-3 w-3" />
                    {handVisualMode === "both" ? "Both Hands" : handVisualMode === "right-only" ? "Right Hand" : "Left Hand"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Music className="h-3 w-3" />
                    {notesForPlayer.length} notes
                  </Badge>
                </div>
              )}
            </div>

            {/* Right side: primary actions */}
            <div className="flex items-center gap-2">
              {!isComplete && !isConverting && (
                <label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                    </span>
                  </Button>
                </label>
              )}
              {isComplete && (
                <Button
                  size="sm"
                  onClick={handlePlayPause}
                  className="gap-1.5"
                >
                  {isPlaying ? "Pause" : "Play"}
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* =============================================================== */}
        {/* PRE-CONVERSION: Upload + Conversion Status */}
        {/* =============================================================== */}
        {!isComplete && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <UploadCard
              file={file}
              isDragging={isDragging}
              isConverting={isConverting}
              isComplete={isComplete}
              onFileSelect={handleFileSelect}
              onFileDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileRemove={handleFileRemove}
              onStartConversion={startConversion}
            />
            <ConversionStatusCard
              steps={CONVERSION_STEPS}
              currentStep={conversionStep}
              progress={conversionProgress}
              isConverting={isConverting}
              isComplete={isComplete}
              onCancel={cancelConversion}
            />
          </div>

          {/* Right Column - Tutorial Player */}
          <div className="lg:col-span-8 space-y-3">
            {/* Audio Engine Debug Panel */}
            {isComplete && (
              <div className="text-xs bg-secondary/40 border border-border/50 rounded p-3 space-y-1">
                <div className="font-semibold text-foreground">🎹 Audio Engine</div>
                <div className="text-muted-foreground space-y-0.5">
                  <div>Status: {audioEngineState.status} {audioEngineState.status === "ready" && "✅"}</div>
                  {audioEngineState.error && <div className="text-red-400">Error: {audioEngineState.error}</div>}
                  <div>Playback rate: {((tempo / 100) * 0.75).toFixed(3)}x (tempo {tempo})</div>
                  <div>Sustain Pedal: {(hybrid.status === "ready" || hybrid.status === "midi-only") && hybrid.pedalEvents && hybrid.pedalEvents.length > 0 ? "Supported 🎵" : "N/A"}</div>
                  <div>Time: {playbackTime.toFixed(2)}s / {playbackDuration.toFixed(2)}s</div>
                  <div>Notes: {notesForPlayer.length} total • First: {notesForPlayer[0]?.note} @ {notesForPlayer[0]?.startTime}s</div>
                </div>
              </div>
            )}
            <div/>

        {/* =============================================================== */}
        {/* MAIN TABS */}
        {/* =============================================================== */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-secondary/60 border border-border/40">
            <TabsTrigger value="player" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Play className="h-3.5 w-3.5" />
              Player
            </TabsTrigger>
            <TabsTrigger value="lessons" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              Lessons
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* --------------------------------------------------------------- */}
          {/* PLAYER TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="player">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main: Stage */}
              <div className="flex-1 min-w-0">
                <PlayerStageCard
                  notes={notesForPlayer}
                  pianoKeys={PIANO_KEYS}
                  isComplete={isComplete}
                  playbackTime={playbackTime}
                  handSelection={handSelectionForVisualizer}
                  showNoteNames={showNoteNames}
                  showKeyLabels={showKeyLabels}
                  currentLoop={currentLoop}
                  tempo={tempo}
                  activeKeys={activeKeys}
                  currentLessonTitle={currentLessonTitle}
                />
              </div>

              {/* Sidebar: Controls */}
              <div className="lg:w-80 flex-shrink-0">
                <SidebarControls
                  isComplete={isComplete}
                  isPlaying={isPlaying}
                  playbackTime={playbackTime}
                  playbackDuration={playbackDuration}
                  tempo={tempo}
                  metronomeOn={metronomeOn}
                  currentLoop={currentLoop}
                  onPlayPause={handlePlayPause}
                  onReset={handleReset}
                  onMetronomeToggle={handleMetronomeToggle}
                  onTempoChange={handleTempoChange}
                  onClearLoop={handleClearLoop}
                  onSeek={handleSeek}
                  onTestTone={handleTestTone}
                  loopSelection={loopSelection}
                  handSelection={handSelection}
                  loopOptions={LOOP_OPTIONS}
                  handOptions={HAND_OPTIONS}
                  onLoopChange={handleLoopChange}
                  onHandChange={handleHandChange}
                  totalBars={totalBars}
                  onSetBarLoop={handleSetBarLoop}
                  namedLoops={namedLoops}
                  onSaveLoop={handleSaveNamedLoop}
                  onDeleteLoop={handleDeleteNamedLoop}
                  onSelectNamedLoop={handleSelectNamedLoop}
                  handAudioMode={handAudioMode}
                  handVisualMode={handVisualMode}
                  onHandAudioModeChange={setHandAudioMode}
                  onHandVisualModeChange={setHandVisualMode}
                  showNoteNames={showNoteNames}
                  showKeyLabels={showKeyLabels}
                  onShowNoteNamesChange={setShowNoteNames}
                  onShowKeyLabelsChange={setShowKeyLabels}
                  keyboardMode={keyboardMode}
                  keyboardZoom={keyboardZoom}
                  onKeyboardModeChange={setKeyboardMode}
                  onKeyboardZoomChange={setKeyboardZoom}
                />
              </div>
            </div>
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* LESSONS TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="lessons">
            <LessonsTab
              lessons={lessons}
              segments={segments}
              isComplete={isComplete}
              onStartLesson={handleStartLesson}
            />
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* INSIGHTS TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="insights">
            <InsightsTab
              insights={patternInsights.length > 0 ? patternInsights : FALLBACK_PATTERN_INSIGHTS}
              isComplete={isComplete}
              onPracticeSection={handlePracticeSection}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
