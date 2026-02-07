"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import * as Tone from "tone"

// Components
import { AppTopNav } from "./components/AppTopNav"
import { UploadCard } from "./components/UploadCard"
import { ConversionStatusCard } from "./components/ConversionStatusCard"
import { TutorialPlayer } from "./components/TutorialPlayer"
import { PatternInsights } from "./components/PatternInsights"

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
} from "./components/types"

// Hooks / utils
import { useMidi } from "./lib/useMidi"
import { generateFullPianoKeys } from "./lib/piano"
import { useMusicXml } from "./hooks/useMusicXml"
import { getPianoAudioEngine, type PianoAudioEngineState } from "./lib/pianoAudioEngine"

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

const PATTERN_INSIGHTS: PatternInsight[] = [
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
// Main Page Component
// ============================================================================

export default function AppPage() {
  // Upload state
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Conversion state
  const [isConverting, setIsConverting] = useState(false)
  const [conversionStep, setConversionStep] = useState(0)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // MIDI state
  const [midiUrl, setMidiUrl] = useState<string | null>(null)
  const midiState = useMidi(midiUrl)

  // MusicXML state (NEW) – used for correct hand assignment via staff
  const [musicXmlUrl, setMusicXmlUrl] = useState<string | null>(null)
  const musicXmlState = useMusicXml(musicXmlUrl)

  // Player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [tempo, setTempo] = useState(75)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [loopSelection, setLoopSelection] = useState("off")
  const [handSelection, setHandSelection] = useState("both")
  const [currentLoop, setCurrentLoop] = useState<LoopRange | null>(null)

  // Visual aids
  const [showNoteNames, setShowNoteNames] = useState(true)
  const [showKeyLabels, setShowKeyLabels] = useState(false)

  // Animation state
  const [playbackTime, setPlaybackTime] = useState(0)
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const animationRef = useRef<number>(null)
  const lastTimeRef = useRef<number>(0)

  // Audio engine state
  const [audioEngineState, setAudioEngineState] = useState<PianoAudioEngineState>({
    status: "loading",
    error: null,
  })
  const audioEngineRef = useRef(getPianoAudioEngine())

  // -------------------------------------------------------------------------
  // Derived: Notes for player
  // Priority:
  // 1) MusicXML (hands are correct: staff -> hand)
  // 2) MIDI (fallback, but hands are NOT reliable)
  // 3) Mock
  // -------------------------------------------------------------------------

  const notesForPlayer: Note[] = React.useMemo(() => {
    // ✅ Best: MusicXML gives correct staff-based hands
    if (musicXmlState.status === "ready") {
      return musicXmlState.events.map((e: any, idx: number) => ({
        id: idx + 1,
        note: e.note, // assumes your MusicXML parser returns { note: "C#4" }
        hand: e.hand, // "left" | "right" derived from staff
        startTime: e.startTime,
        duration: e.duration,
      }))
    }

    // Fallback: MIDI timing, but hands are guessed (not ideal)
    if (midiState.status === "ready") {
      return midiState.events.map((e: any, idx: number) => ({
        id: idx + 1,
        note: e.name,
        // ⚠️ MIDI does not know “hand”. This is only a fallback.
        hand: e.midi <= 60 ? "left" : "right",
        startTime: e.time,
        duration: e.duration,
      }))
    }

    return MOCK_NOTES
  }, [musicXmlState, midiState])

  // Determine playback length (prefer MIDI duration, else MusicXML duration)
  const playbackDuration = React.useMemo(() => {
    if (midiState.status === "ready") return midiState.duration
    if (musicXmlState.status === "ready") return musicXmlState.duration
    return 8
  }, [midiState, musicXmlState])

  // -------------------------------------------------------------------------
  // File Upload Handlers
  // -------------------------------------------------------------------------

  // Initialize audio engine on mount
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

    return () => {
      // Keep engine alive on unmount (don't dispose)
    }
  }, [])

  // -------------------------------------------------------------------------
  // File Upload Handlers
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Conversion Handlers
  // -------------------------------------------------------------------------

  const startConversion = useCallback(() => {
    if (!file) return
    setIsConverting(true)
    setConversionStep(1)
    setConversionProgress(0)
    setIsComplete(false)

    // reset sources until “conversion” completes
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

  // Conversion animation effect
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
          setMusicXmlUrl("/demo4.mxl")

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

  // -------------------------------------------------------------------------
  // Player Handlers
  // -------------------------------------------------------------------------

  const handlePlayPause = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") {
      console.warn("Cannot play: audio engine not ready")
      return
    }

    try {
      if (isPlaying) {
        // Pause
        engine.pause()
        setIsPlaying(false)
        console.log("Playback paused")
      } else {
        // Play—must be inside the click handler to satisfy browser autoplay policy
        console.log("Starting playback...")
        await engine.play()
        setIsPlaying(true)
        console.log("Playback started")
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
      console.log("Playback reset")
    } catch (err) {
      console.error("Reset error:", err)
    }
  }, [])

  const handleMetronomeToggle = useCallback(() => {
    setMetronomeOn((prev) => !prev)
  }, [])

  const handleTempoChange = useCallback((value: number) => {
    setTempo(value)
    // Apply tempo to audio engine immediately
    const engine = audioEngineRef.current
    engine.setTempo(value)
    console.log(`Tempo changed to ${value}%`)
  }, [])

  const handleTestTone = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") {
      console.warn("Audio engine not ready for test tone")
      return
    }

    try {
      console.log("Testing audio: playing C4 for 1 second...")
      // Ensure audio context is initialized
      await Tone.start()
      // Get the sampler and play a note
      const sampler = (engine as any).sampler
      if (!sampler) {
        console.error("Sampler not available")
        return
      }
      sampler.triggerAttackRelease("C4", 1)
      console.log("Test tone played successfully")
    } catch (err) {
      console.error("Test tone error:", err)
    }
  }, [])

  const handleLoopChange = useCallback((value: string) => {
    setLoopSelection(value)
    if (value === "off") setCurrentLoop(null)
  }, [])

  const handleHandChange = useCallback((value: string) => {
    setHandSelection(value)
  }, [])

  const handleClearLoop = useCallback(() => {
    setCurrentLoop(null)
    setLoopSelection("off")
  }, [])

  const handlePracticeSection = useCallback((start: number, end: number) => {
    setCurrentLoop({ start, end })
    setLoopSelection("custom")
  }, [])

  // Set notes to audio engine when they change
  useEffect(() => {
    const engine = audioEngineRef.current
    const filteredNotes = notesForPlayer.filter((note) => {
      if (handSelection === "right" && note.hand === "left") return false
      if (handSelection === "left" && note.hand === "right") return false
      return true
    })
    engine.setNotes(filteredNotes)
  }, [notesForPlayer, handSelection])

  // Playback animation effect: sync playbackTime with audio engine
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
        const currentTime = engine.getTime()
        
        // Update playbackTime from audio engine (single source of truth)
        setPlaybackTime(currentTime)

        // Stop if we've reached the end
        if (currentTime >= playbackDuration) {
          engine.stop()
          setPlaybackTime(0)
          setIsPlaying(false)
          console.log("Playback finished")
          return
        }

        // Continue animation
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

  // Update active keys based on playback time
  useEffect(() => {
    const filteredNotes = notesForPlayer.filter((note) => {
      if (handSelection === "right" && note.hand === "left") return false
      if (handSelection === "left" && note.hand === "right") return false
      return true
    })

    const active = filteredNotes
      .filter((note) => playbackTime >= note.startTime && playbackTime < note.startTime + note.duration)
      .map((note) => note.note)

    setActiveKeys(active)
  }, [playbackTime, handSelection, notesForPlayer])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Workflow */}
          <div className="lg:col-span-4 space-y-6">
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
                  <div>Time: {playbackTime.toFixed(2)}s / {playbackDuration.toFixed(2)}s</div>
                  <div>Notes: {notesForPlayer.length} total • First: {notesForPlayer[0]?.note} @ {notesForPlayer[0]?.startTime}s</div>
                </div>
              </div>
            )}

            {/* Debug readout */}
            {(midiUrl || musicXmlUrl) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {musicXmlUrl && musicXmlState.status === "loading" && <div>Loading MusicXML…</div>}
                {musicXmlUrl && musicXmlState.status === "error" && (
                  <div className="text-red-400">MusicXML error: {musicXmlState.error}</div>
                )}
                {musicXmlUrl && musicXmlState.status === "ready" && (
                  <div>
                    MusicXML: Loaded {musicXmlState.events.length} notes • Duration{" "}
                    {musicXmlState.duration.toFixed(1)}s • Hands from staff ✅
                  </div>
                )}

                {midiUrl && midiState.status === "loading" && <div>Loading MIDI…</div>}
                {midiUrl && midiState.status === "error" && (
                  <div className="text-red-400">MIDI error: {midiState.error}</div>
                )}
                {midiUrl && midiState.status === "ready" && (
                  <div>
                    MIDI: Loaded {midiState.events.length} notes • Duration {midiState.duration.toFixed(1)}s
                    {midiState.bpm ? ` • BPM ~${Math.round(midiState.bpm)}` : ""}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
              <TutorialPlayer
                notes={notesForPlayer}
                pianoKeys={PIANO_KEYS}
                loopOptions={LOOP_OPTIONS}
                handOptions={HAND_OPTIONS}
                isComplete={isComplete}
                isPlaying={isPlaying}
                playbackTime={playbackTime}
                activeKeys={activeKeys}
                tempo={tempo}
                metronomeOn={metronomeOn}
                loopSelection={loopSelection}
                handSelection={handSelection}
                currentLoop={currentLoop}
                showNoteNames={showNoteNames}
                showKeyLabels={showKeyLabels}
                onPlayPause={handlePlayPause}
                onReset={handleReset}
                onMetronomeToggle={handleMetronomeToggle}
                onTempoChange={handleTempoChange}
                onLoopChange={handleLoopChange}
                onHandChange={handleHandChange}
                onClearLoop={handleClearLoop}
                onShowNoteNamesChange={setShowNoteNames}
                onShowKeyLabelsChange={setShowKeyLabels}
                onTestTone={handleTestTone}
              />

              <PatternInsights
                insights={PATTERN_INSIGHTS}
                isComplete={isComplete}
                onPracticeSection={handlePracticeSection}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
