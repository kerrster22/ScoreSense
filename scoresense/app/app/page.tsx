"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import * as Tone from "tone"

// Components
import { AppTopNav } from "./components/AppTopNav"
import { UploadCard } from "./components/UploadCard"
import { ConversionStatusCard } from "./components/ConversionStatusCard"
import { PlayerStageCard } from "./components/PlayerStageCard"
import { PieceTimeline } from "./components/PieceTimeline"
import { SidebarControls } from "./components/SidebarControls"
import { TutorialPlayerCard } from "./components/TutorialPlayerCard"
import { InsightsTab } from "./components/InsightsTab"

// UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Piece library feature
import { PieceLibrary } from "@/components/PieceLibrary"
import { buildPieceLibrary, MOCK_PIECE_FILE_PATHS } from "@/lib/buildPieceLibrary"
import type { ComposerGroup, PieceFile } from "@/types/pieces"

// Tutorial segment feature
import { TutorialPanel } from "@/components/TutorialPanel"
import { generateTutorialSegments } from "@/lib/tutorialSegments"
import { useTutorialMode } from "@/hooks/useTutorialMode"
import type { TutorialSegment } from "@/types/tutorial"

// Engagement / gamification
import { ProgressHUD } from "./components/ProgressHUD"
import { AchievementToast } from "./components/AchievementToast"
import {
  loadProgress,
  recordPracticeSession,
  awardXp,
  checkAndUnlockAchievements,
  unlockFirstNoteAchievement,
  type UserProgress,
  type Achievement,
} from "./lib/userProgress"
import {
  saveCompletedSegments,
  loadCompletedSegments,
  recordPiecePathHash,
  getPieceProgressByPath,
} from "./lib/persistence"

// Icons
import {
  Music,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  Upload,
  Timer,
  Clock,
  Hand,
  Repeat,
  X as XIcon,
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
  HandAudioMode,
  HandVisualMode,
} from "./components/types"

// Hooks / utils
import { useMidi } from "./lib/useMidi"
import { generateFullPianoKeys } from "./lib/piano"
import { useMusicXml } from "./hooks/useMusicXml"
import { useHybridScore } from "./hooks/useHybridScore"
import { getPianoAudioEngine } from "./lib/pianoAudioEngine"
import { analyzePiece, analyzeFromNotes, ALGO_VERSION } from "./lib/practiceAnalysis"
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
// Practice section timing constants — tweak here to adjust the feel
// ============================================================================

const PRACTICE_PREROLL_SEC  = 2.0  // how many seconds of "run-up" before the first note
const PRACTICE_POSTROLL_SEC = 2.0  // how many seconds to linger after the last note

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
  { id: 1, label: "Reading file" },
  { id: 2, label: "Parsing notes" },
  { id: 3, label: "Building score" },
  { id: 4, label: "Ready to play" },
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
  const blobUrlRef = useRef<string | null>(null)

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
  const [tempo, setTempo] = useState(100)
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
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([])

  // ---------- Named loops & persistence ----------
  const [namedLoops, setNamedLoops] = useState<NamedLoop[]>([])
  const [pieceHash, setPieceHash] = useState<string | null>(null)

  // ---------- Animation state ----------
  const [playbackTime, setPlaybackTime] = useState(0)
  const animationRef = useRef<number>(null)

  // ---------- Audio engine ----------
  const audioEngineRef = useRef(getPianoAudioEngine())

  // Tracks whether markComplete has already fired for the current segment playthrough.
  // Reset whenever a new segment starts or the section loops back.
  const postRollFiredRef = useRef(false)

  // Practice lead-in: virtual visual clock that counts up to seg.startTime before audio fires.
  // All four refs are set together whenever a lead-in begins.
  const isPracticeLeadInRef = useRef(false)
  const leadInWallStartMsRef = useRef(0)      // performance.now() when lead-in began
  const leadInVisualStartSecRef = useRef(0)   // visual playbackTime at lead-in start (may be < 0)
  const leadInTargetSecRef = useRef(0)        // seg.startTime — when audio fires

  // Practice post-roll: audio is already paused; visual clock keeps ticking via wall clock.
  const isPracticePostRollRef = useRef(false)
  const postRollWallStartMsRef = useRef(0)    // performance.now() when post-roll began
  const postRollVisualStartSecRef = useRef(0) // engine time at moment audio was cut

  // ---------- Tab state ----------
  const [activeTab, setActiveTab] = useState("player")

  // ---------- Shortcuts overlay ----------
  const [showShortcuts, setShowShortcuts] = useState(false)

  // ---------- Session timer ----------
  const [sessionMinutes, setSessionMinutes] = useState(0)
  const sessionStartRef = useRef<number>(Date.now())
  useEffect(() => {
    const today = new Date().toDateString()
    const stored = typeof window !== "undefined" ? localStorage.getItem("ss_session_mins") : null
    const parsed = stored ? JSON.parse(stored) : { date: today, mins: 0 }
    const base = parsed.date === today ? parsed.mins : 0
    setSessionMinutes(base)
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 60000)
      const total = base + elapsed
      setSessionMinutes(total)
      localStorage.setItem("ss_session_mins", JSON.stringify({ date: new Date().toDateString(), mins: total }))
    }, 30000) // update every 30 s
    return () => clearInterval(interval)
  }, [])

  // ---------- Engagement / gamification ----------
  const [progress, setProgress] = useState<UserProgress>(() => {
    if (typeof window === "undefined") return { totalXp: 0, streak: 0, lastPracticeDate: "", unlockedAchievements: [] }
    return loadProgress()
  })
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([])
  const hasRecordedSessionRef = useRef(false)

  const pushAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length > 0) setAchievementQueue((prev) => [...prev, ...achievements])
  }, [])

  const dismissAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1))
  }, [])

  // ---------- Piece library ----------
  const [pieceLibrary, setPieceLibrary] = useState<ComposerGroup[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PieceFile | null>(null)
  const [pieceProgress, setPieceProgress] = useState<Record<string, { completed: number; total: number }>>(() => {
    if (typeof window === "undefined") return {}
    // Pre-populate from known saved paths on first render
    const out: Record<string, { completed: number; total: number }> = {}
    try {
      const raw = localStorage.getItem("ss_path_to_hash")
      if (raw) {
        const map: Record<string, string> = JSON.parse(raw)
        for (const fp of Object.keys(map)) {
          const p = getPieceProgressByPath(fp)
          if (p) out[fp] = p
        }
      }
    } catch {}
    return out
  })

  // ---------- Tutorial mode ----------
  const measureMap = musicXmlState.status === "ready" ? musicXmlState.measureMap : []

  const tutorialSegments: TutorialSegment[] = useMemo(() => {
    const xmlBased = generateTutorialSegments(
      segments,
      measureMap,
      musicXmlState.status === "ready" ? (musicXmlState.events as any) : null
    )
    if (xmlBased.length > 0) return xmlBased

    // MIDI-only fallback: slice the piece into time-based chunks.
    // Use BPM to size each chunk at 4 bars; default to 8 s if BPM unknown.
    const duration = midiState.status === "ready" ? midiState.duration : 0
    if (duration <= 0) return []

    const rawBpm = midiState.status === "ready" ? (midiState.bpm ?? 120) : 120
    const secPerBeat = 60 / rawBpm
    const chunkSec = Math.max(4, secPerBeat * 4 * 4) // 4 bars × 4 beats

    const segs: TutorialSegment[] = []
    let barCounter = 1
    for (let start = 0; start < duration; start += chunkSec) {
      const end = Math.min(start + chunkSec, duration)
      const barsInChunk = Math.round((end - start) / (secPerBeat * 4))
      const endBar = barCounter + barsInChunk - 1
      segs.push({
        id: `midi-seg-${segs.length}`,
        title: `Bars ${barCounter}–${endBar}`,
        startTime: start,
        endTime: end,
        startMeasure: barCounter,
        endMeasure: endBar,
        handFocus: "both",
        isRepeat: false,
        difficulty: 2,
      })
      barCounter = endBar + 1
    }
    return segs
  }, [segments, measureMap, musicXmlState, midiState])
  const tutorialMode = useTutorialMode(tutorialSegments, { autoAdvance: false, replaySegment: false })
  const [tutorialPlayerActive, setTutorialPlayerActive] = useState(false)

  // No auto-selection — tutorial mode is opt-in (user clicks a segment to start)

  // =========================================================================
  // Derived: Notes for player
  // =========================================================================
  const hybrid = useHybridScore({ midiUrl, xmlUrl: musicXmlUrl })

  const { activeSegment: activeTutorialSegment, state: tutorialState, hasNext: tutorialHasNext } = tutorialMode

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

  // When a practice segment is active, clamp notes to that segment's range so
  // the visualizer never shows notes from adjacent sections during the lead-in
  // or post-roll. Full-piece notes are still used for the timeline and audio.
  const notesForVisualizer = useMemo(() => {
    if (tutorialPlayerActive && activeTutorialSegment) {
      const { startTime, endTime } = activeTutorialSegment
      return notesForPlayer.filter(n => n.startTime >= startTime && n.startTime < endTime)
    }
    return notesForPlayer
  }, [notesForPlayer, tutorialPlayerActive, activeTutorialSegment])

  const visuallyFilteredNotes = useMemo(
    () => filterNotesByVisualHand(notesForPlayer, handVisualMode),
    [notesForPlayer, handVisualMode]
  )

  const visuallyFilteredPracticeNotes = useMemo(
    () => filterNotesByVisualHand(notesForVisualizer, handVisualMode),
    [notesForVisualizer, handVisualMode]
  )

  // The handSelection prop for the visualizer: derive from handVisualMode
  const handSelectionForVisualizer = useMemo(() => {
    switch (handVisualMode) {
      case "right-only": return "right"
      case "left-only": return "left"
      default: return "both"
    }
  }, [handVisualMode])

  // Active keys: use segment-clamped notes during practice so keys don't light
  // from out-of-section notes during lead-in / post-roll
  const activeKeys = useMemo(
    () => computeActiveKeys(visuallyFilteredPracticeNotes, playbackTime),
    [visuallyFilteredPracticeNotes, playbackTime]
  )

  // =========================================================================
  // Metadata for header
  // =========================================================================
  const pieceName = selectedPiece?.title
    ?? (file?.name ? file.name.replace(/\.(mid|midi|musicxml|mxl|xml)$/i, "") : null)
    ?? (isComplete ? "Untitled Piece" : null)
  const composerName = selectedPiece?.composer ?? ""
  const bpm = midiState.status === "ready" && midiState.bpm ? Math.round(midiState.bpm) : null
  // Actual BPM at current tempo setting
  const actualBpm = bpm ? Math.round(bpm * (tempo / 100)) : null

  // =========================================================================
  // Audio engine init
  // =========================================================================
  useEffect(() => {
    const engine = audioEngineRef.current
    const initEngine = async () => {
      try {
        await engine.load()
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error"
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
    if (droppedFile && /\.(mid|midi|musicxml|mxl|xml)$/i.test(droppedFile.name)) {
      setFile({ name: droppedFile.name, size: droppedFile.size, fileObject: droppedFile })
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile({ name: selectedFile.name, size: selectedFile.size, fileObject: selectedFile })
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
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setFile(null)
  }, [])

  // =========================================================================
  // Conversion Handlers
  // =========================================================================
  const startConversion = useCallback(() => {
    if (!file) return

    // Revoke any previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    const url = URL.createObjectURL(file.fileObject)
    blobUrlRef.current = url

    setIsConverting(true)
    setIsComplete(false)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)

    if (/\.(mid|midi)$/i.test(file.name)) {
      setMidiUrl(url)
    } else {
      setMusicXmlUrl(url)
    }
  }, [file])

  const cancelConversion = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setIsConverting(false)
    setConversionStep(0)
    setConversionProgress(0)
    setIsComplete(false)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
  }, [])

  // Watch hybrid status to know when parsing is done
  useEffect(() => {
    if (!isConverting) return
    const { status } = hybrid
    if (/^(ready|midi-only|xml-only)$/.test(status)) {
      setIsConverting(false)
      setIsComplete(true)
    } else if (/^error$/.test(status)) {
      setIsConverting(false)
    }
  }, [hybrid.status, isConverting])

  // =========================================================================
  // Player Handlers
  // =========================================================================
  const handlePlayPause = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") return
    try {
      // Cancel lead-in on pause — treat as a clean stop of the practice preview
      if (isPracticeLeadInRef.current) {
        isPracticeLeadInRef.current = false
        engine.pause()
        setIsPlaying(false)
        return
      }
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
      setTutorialPlayerActive(false)
    } catch (err) {
      console.error("Reset error:", err)
    }
  }, [])

  const handleMetronomeToggle = useCallback(() => {
    const next = !metronomeOn
    setMetronomeOn(next)
    audioEngineRef.current.setMetronome(next, bpm ?? 120)
  }, [metronomeOn, bpm])

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

  const handleSelectPiece = useCallback((piece: PieceFile) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setSelectedPiece(piece)
    setFile(null)

    const pieceMidiUrl = piece.midiPath ? `/api/piece?path=${encodeURIComponent(piece.midiPath)}` : null
    const pieceXmlUrl = piece.xmlPath ? `/api/piece?path=${encodeURIComponent(piece.xmlPath)}` : null

    setMidiUrl(pieceMidiUrl)
    setMusicXmlUrl(pieceXmlUrl)

    setIsComplete(true)
    setPlaybackTime(0)
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const response = await fetch("/api/pieces")
        if (!response.ok) throw new Error(`Status ${response.status}`)
        const data = await response.json()
        if (data?.library) {
          setPieceLibrary(data.library)
        } else {
          setPieceLibrary(buildPieceLibrary(MOCK_PIECE_FILE_PATHS))
        }
      } catch (err) {
        console.error("Piece library fetch failed", err)
        setPieceLibrary(buildPieceLibrary(MOCK_PIECE_FILE_PATHS))
      }
    }
    loadLibrary()
  }, [])

  // Set notes to audio engine based on handAudioMode
  useEffect(() => {
    const engine = audioEngineRef.current
    const filteredNotes = filterNotesByAudioHand(notesForPlayer, handAudioMode)
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

  // Tutorial segment loop control
  useEffect(() => {
    if (activeTutorialSegment) {
      audioEngineRef.current.setLoop({ enabled: false })
    }
  }, [activeTutorialSegment])

  // Stable refs so handleMarkComplete doesn't need tutorialMode in its deps
  // (tutorialMode is a plain object that gets a new reference every render;
  //  putting it in deps would restart the animation loop on every render).
  const completedSegmentIdsRef = useRef<string[]>(tutorialMode.state.completedSegmentIds)
  const markCompleteRef        = useRef(tutorialMode.markComplete)
  useEffect(() => {
    completedSegmentIdsRef.current = tutorialMode.state.completedSegmentIds
    markCompleteRef.current        = tutorialMode.markComplete
  })

  // Wrap markComplete with persistence + XP + achievement logic
  const handleMarkComplete = useCallback((segmentId: string) => {
    if (completedSegmentIdsRef.current.includes(segmentId)) return
    markCompleteRef.current(segmentId)

    const newIds = [...completedSegmentIdsRef.current, segmentId]

    if (pieceHash) {
      saveCompletedSegments(pieceHash, newIds, tutorialSegments.length)
      const fp = selectedPiece?.filePath ?? (file?.name ?? null)
      if (fp) {
        recordPiecePathHash(fp, pieceHash)
        setPieceProgress((prev) => ({ ...prev, [fp]: { completed: newIds.length, total: tutorialSegments.length } }))
      }
    }

    const xpResult = awardXp(15)
    const { unlocked, progress: afterAchievements } = checkAndUnlockAchievements({
      totalCompleted: newIds.length,
      streak: xpResult.progress.streak,
      tempo,
      allSegmentsComplete: tutorialSegments.length > 0 && newIds.length >= tutorialSegments.length,
    })
    setProgress(afterAchievements)
    pushAchievements(unlocked)
  }, [pieceHash, tutorialSegments.length, selectedPiece, file, tempo, pushAchievements])

  // Playback animation and tutorial segment control
  useEffect(() => {
    if (!isPlaying || !isComplete) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    // Helper: begin a visual lead-in for a segment, leaving audio parked silently
    const startLeadIn = (seg: TutorialSegment) => {
      audioEngineRef.current.seek(seg.startTime, { resume: false })
      isPracticeLeadInRef.current = true
      leadInWallStartMsRef.current = performance.now()
      leadInVisualStartSecRef.current = seg.startTime - PRACTICE_PREROLL_SEC
      leadInTargetSecRef.current = seg.startTime
      setPlaybackTime(seg.startTime - PRACTICE_PREROLL_SEC)
    }

    const animate = () => {
      try {
        const engine = audioEngineRef.current
        engine.tickLoop()

        // ── PRACTICE LEAD-IN PHASE ──────────────────────────────────────────
        // Virtual visual clock ticks ahead of silent, parked audio.
        // When it reaches seg.startTime the transport fires and audio begins.
        if (isPracticeLeadInRef.current) {
          const elapsed = (performance.now() - leadInWallStartMsRef.current) / 1000
          const visualTime = leadInVisualStartSecRef.current + elapsed
          setPlaybackTime(visualTime)

          if (visualTime >= leadInTargetSecRef.current) {
            isPracticeLeadInRef.current = false
            // Transport is parked at seg.startTime — fire it
            engine.resumeFromSeek()
          }
          animationRef.current = requestAnimationFrame(animate)
          return
        }

        // ── POST-ROLL PHASE (audio silent, visual clock ticks via wall clock) ──
        if (isPracticePostRollRef.current) {
          const elapsed = (performance.now() - postRollWallStartMsRef.current) / 1000
          const visualTime = postRollVisualStartSecRef.current + elapsed
          setPlaybackTime(visualTime)

          if (elapsed >= PRACTICE_POSTROLL_SEC) {
            isPracticePostRollRef.current = false
            postRollFiredRef.current = false
            const activeSeg = tutorialPlayerActive ? activeTutorialSegment : null
            if (activeSeg && tutorialMode.state.replaySegment) {
              startLeadIn(activeSeg)
              tutorialMode.setPlaybackMode("replay")
              animationRef.current = requestAnimationFrame(animate)
              return
            } else if (activeSeg && tutorialState.autoAdvance && tutorialHasNext) {
              const nextIdx = tutorialState.currentSegmentIndex + 1
              const nextSeg = tutorialSegments[nextIdx]
              if (nextSeg) {
                tutorialMode.nextSegment()
                startLeadIn(nextSeg)
                tutorialMode.setPlaybackMode("playing")
                animationRef.current = requestAnimationFrame(animate)
                return
              }
            }
            setIsPlaying(false)
            tutorialMode.setPlaybackMode("paused")
            return
          }
          animationRef.current = requestAnimationFrame(animate)
          return
        }

        // ── NORMAL PLAYBACK ─────────────────────────────────────────────────
        const currentTime = engine.getTime()
        setPlaybackTime(currentTime)

        // Only impose segment boundary when the user explicitly started a tutorial segment
        const activeSeg = tutorialPlayerActive ? activeTutorialSegment : null

        if (activeSeg) {
          // Segment end: cut audio immediately and enter wall-clock post-roll
          if (currentTime >= activeSeg.endTime && !postRollFiredRef.current) {
            postRollFiredRef.current = true
            engine.pause()
            handleMarkComplete(activeSeg.id)
            isPracticePostRollRef.current = true
            postRollWallStartMsRef.current = performance.now()
            postRollVisualStartSecRef.current = activeSeg.endTime
          }
        } else {
          // No active tutorial segment — fall back to natural piece end
          if (currentTime >= playbackDuration) {
            engine.stop()
            setPlaybackTime(0)
            setIsPlaying(false)
            return
          }
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
  }, [isPlaying, isComplete, playbackDuration, tutorialPlayerActive, tutorialState.autoAdvance, tutorialState.replaySegment, tutorialState.currentSegmentIndex, tutorialHasNext, activeTutorialSegment?.id, tutorialSegments, handleMarkComplete])

  // =========================================================================
  // Analysis + Persistence
  // =========================================================================
  useEffect(() => {
    if (notesForPlayer.length === 0 || notesForPlayer === MOCK_NOTES) return
    const hash = computePieceHash(
      notesForPlayer.map((n) => ({ midi: n.midi ?? 0, startTime: n.startTime }))
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
      setPatternInsights(cached.insights)
      return
    }
    const result = analyzePiece(musicXmlState.events as any, musicXmlState.measureMap)
    setSegments(result.segments)
    setPatternInsights(result.insights)
    cacheAnalysis(pieceHash, ALGO_VERSION, result.segments, result.lessons, result.insights)
  }, [musicXmlState, pieceHash])

  // MIDI-only analysis (no MusicXML available)
  useEffect(() => {
    if (musicXmlState.status === "ready") return // XML analysis takes priority
    if (midiState.status !== "ready" || !pieceHash) return
    const cached = getCachedAnalysis(pieceHash, ALGO_VERSION)
    if (cached) {
      setSegments(cached.segments)
      setPatternInsights(cached.insights)
      return
    }
    const bpm = midiState.bpm ?? 120
    const notes = midiState.events.map((e) => ({
      startTime: e.time,
      duration: e.duration,
      midi: e.midi,
      hand: undefined as string | undefined,
    }))
    const result = analyzeFromNotes(notes, bpm, midiState.duration)
    setSegments(result.segments)
    setPatternInsights(result.insights)
    cacheAnalysis(pieceHash, ALGO_VERSION, result.segments, result.lessons, result.insights)
  }, [midiState, musicXmlState.status, pieceHash])

  useEffect(() => {
    if (!pieceHash || !isPlaying) return
    const interval = setInterval(() => saveLastPosition(pieceHash, playbackTime), 2000)
    return () => clearInterval(interval)
  }, [pieceHash, isPlaying, playbackTime])

  // Record streak on first play each session
  useEffect(() => {
    if (!isPlaying || hasRecordedSessionRef.current) return
    hasRecordedSessionRef.current = true
    const result = recordPracticeSession()
    setProgress(result.progress)
  }, [isPlaying])

  // Unlock "First Note" achievement when a piece is loaded for the first time
  useEffect(() => {
    if (!isComplete || !pieceHash) return
    const achievement = unlockFirstNoteAchievement()
    if (achievement) {
      pushAchievements([achievement])
      setProgress(loadProgress())
    }
  }, [isComplete, pieceHash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved segment completions whenever the piece changes
  useEffect(() => {
    if (!pieceHash) return
    const savedIds = loadCompletedSegments(pieceHash)
    tutorialMode.setCompletedIds(savedIds)
  }, [pieceHash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save filePath→hash mapping and totalSegmentCount so PieceLibrary can show progress
  useEffect(() => {
    if (!pieceHash || tutorialSegments.length === 0) return
    const fp = selectedPiece?.filePath ?? (file?.name ?? null)
    if (fp) {
      recordPiecePathHash(fp, pieceHash)
      saveCompletedSegments(pieceHash, tutorialMode.state.completedSegmentIds, tutorialSegments.length)
      setPieceProgress((prev) => ({
        ...prev,
        [fp]: { completed: tutorialMode.state.completedSegmentIds.length, total: tutorialSegments.length },
      }))
    }
  }, [pieceHash, tutorialSegments.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalBars = measureMap.length
  const currentBar = useMemo(
    () => measureMap.find((m) => playbackTime >= m.startSec && playbackTime < m.endSec)?.measure ?? null,
    [measureMap, playbackTime]
  )

  const barsToSeconds = useCallback(
    (startBar: number, endBar: number): { startSec: number; endSec: number } | null => {
      const startEntry = measureMap.find((m) => m.measure === startBar)
      const endEntry = measureMap.find((m) => m.measure === endBar)
      if (!startEntry || !endEntry) return null
      return { startSec: startEntry.startSec, endSec: endEntry.endSec }
    },
    [measureMap]
  )

  // Derive loop region in seconds for the timeline
  const currentLoopSec = useMemo(() => {
    if (!currentLoop || /^off$/.test(loopSelection)) return null
    const r = barsToSeconds(currentLoop.start, currentLoop.end)
    if (r) return r
    return { startSec: currentLoop.start, endSec: currentLoop.end }
  }, [currentLoop, loopSelection, barsToSeconds])

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

  // Set loop from seconds (timeline drag — finds nearest bars when measureMap exists)
  const handleSetTimeLoop = useCallback(
    (startSec: number, endSec: number) => {
      if (measureMap.length > 0) {
        const startEntry = measureMap.reduce((best, m) =>
          Math.abs(m.startSec - startSec) < Math.abs(best.startSec - startSec) ? m : best
        )
        const endEntry = measureMap.reduce((best, m) =>
          Math.abs(m.endSec - endSec) < Math.abs(best.endSec - endSec) ? m : best
        )
        handleSetBarLoop(startEntry.measure, endEntry.measure)
      } else {
        setCurrentLoop({ start: startSec, end: endSec })
        setLoopSelection("custom")
        audioEngineRef.current.setLoop({ enabled: true, startSec, endSec })
      }
    },
    [measureMap, handleSetBarLoop]
  )

  // Loop the single bar at current playback position
  const handleLoopCurrentBar = useCallback(() => {
    const m = measureMap.find((entry) => playbackTime >= entry.startSec && playbackTime < entry.endSec)
    if (m) handleSetBarLoop(m.measure, m.measure)
  }, [playbackTime, measureMap, handleSetBarLoop])

  // Play a tutorial segment: park the audio at seg.startTime, then run a visual
  // lead-in so section notes are already falling before audio fires.
  const handlePlaySegment = useCallback(async (seg: import("@/types/tutorial").TutorialSegment) => {
    // Unlock AudioContext from within this user-gesture callback
    try { await Tone.start() } catch {}

    tutorialMode.selectSegment(seg.id)
    audioEngineRef.current.setLoop({ enabled: false })
    setCurrentLoop(null)
    setLoopSelection("off")
    postRollFiredRef.current = false

    // Park audio at the section start (silent, not playing yet)
    audioEngineRef.current.seek(seg.startTime, { resume: false })

    // Visual lead-in: clock ticks from (startTime - PREROLL) → startTime via wall clock.
    // Negative visual times are fine — the visualizer positions notes by timeUntilHit.
    isPracticeLeadInRef.current = true
    leadInWallStartMsRef.current = performance.now()
    leadInVisualStartSecRef.current = seg.startTime - PRACTICE_PREROLL_SEC
    leadInTargetSecRef.current = seg.startTime

    setPlaybackTime(seg.startTime - PRACTICE_PREROLL_SEC)
    setIsPlaying(true)  // keeps the RAF running
    tutorialMode.setPlaybackMode("playing")
    setTutorialPlayerActive(true)
  }, [tutorialMode])

  // Keyboard shortcuts — must be after all handlers are declared
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "?") { setShowShortcuts((v) => !v); return }
      if (e.key === "Escape") { setShowShortcuts(false); return }
      if (!isComplete) return
      if (e.key === " " && !e.repeat) {
        e.preventDefault(); handlePlayPause()
      } else if (e.key === "l" || e.key === "L") {
        handleLoopCurrentBar()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        tutorialMode.nextSegment()
        const next = tutorialMode.activeSegment
        if (next) handlePlaySegment(next)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        tutorialMode.prevSegment()
        const prev = tutorialMode.activeSegment
        if (prev) handlePlaySegment(prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isComplete, handlePlayPause, handleLoopCurrentBar, handlePlaySegment, tutorialMode])

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              {!isComplete ? (
                <h1 className="text-2xl font-bold text-foreground tracking-tight">ScoreSense</h1>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">
                    {pieceName}
                  </h1>
                  {composerName && (
                    <p className="text-sm text-muted-foreground mt-0.5">{composerName}</p>
                  )}
                </>
              )}

              {/* Ambient metadata + loop pill + hand badge */}
              {isComplete && (
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
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
                    <Music className="h-3 w-3" />
                    {notesForPlayer.length} notes
                  </Badge>
                  {currentLoop && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-medium">
                      <Repeat className="h-3 w-3" />
                      Bars {currentLoop.start}–{currentLoop.end}
                      <button
                        type="button"
                        onClick={handleClearLoop}
                        className="hover:bg-accent/20 rounded-full p-0.5 transition-colors"
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                  {handVisualMode !== "both" && (
                    <Badge
                      variant="secondary"
                      className={`text-xs gap-1 border ${handVisualMode === "right-only" ? "border-pink-500/40 text-pink-400" : "border-purple-500/40 text-purple-400"}`}
                    >
                      <Hand className="h-3 w-3" />
                      {handVisualMode === "right-only" ? "R Hand" : "L Hand"}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Right side: progress HUD + upload */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:block">
                <ProgressHUD progress={progress} sessionMinutes={sessionMinutes} />
              </div>
              <div className="block sm:hidden">
                <ProgressHUD progress={progress} sessionMinutes={sessionMinutes} compact />
              </div>
              <label>
                <input
                  type="file"
                  accept=".mid,.midi,.musicxml,.mxl,.xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant={isComplete ? "ghost" : "outline"} size="sm" asChild>
                  <span className="cursor-pointer gap-1.5 text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{isComplete ? "Change piece" : "Upload file"}</span>
                  </span>
                </Button>
              </label>
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
        )}

        {/* Right Column - Tutorial Player */}
        <div className="space-y-3">
          {/* =============================================================== */}
          {/* MAIN TABS */}
          {/* =============================================================== */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-secondary/60 border border-border/40 w-full sm:w-auto">
            <TabsTrigger value="player" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Play className="h-3.5 w-3.5" />
              Player
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
              <div className="flex-1 min-w-0 space-y-3">
                {/* grid-rows trick: slides in/out without a layout jump */}
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: tutorialPlayerActive && activeTutorialSegment ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    {activeTutorialSegment && (
                      <div className="pb-3">
                        <TutorialPlayerCard
                          segment={activeTutorialSegment}
                          playbackTime={playbackTime}
                          isPlaying={isPlaying}
                          hasNext={tutorialHasNext}
                          hasPrev={tutorialState.currentSegmentIndex > 0}
                          preRollSec={PRACTICE_PREROLL_SEC}
                          onPlayPause={handlePlayPause}
                          onNext={() => {
                            const nextIdx = tutorialState.currentSegmentIndex + 1
                            const next = tutorialSegments[nextIdx]
                            if (next) handlePlaySegment(next)
                          }}
                          onPrev={() => {
                            const prevIdx = Math.max(0, tutorialState.currentSegmentIndex - 1)
                            const prev = tutorialSegments[prevIdx]
                            if (prev) handlePlaySegment(prev)
                          }}
                          onClose={() => setTutorialPlayerActive(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <PlayerStageCard
                  notes={notesForVisualizer}
                  pianoKeys={PIANO_KEYS}
                  isComplete={isComplete}
                  playbackTime={playbackTime}
                  handSelection={handSelectionForVisualizer}
                  handVisualMode={handVisualMode}
                  showNoteNames={showNoteNames}
                  showKeyLabels={showKeyLabels}
                  currentLoop={currentLoop}
                  tempo={tempo}
                  activeKeys={activeKeys}
                  currentLessonTitle={null}
                  loopEndTimeSec={currentLoopSec?.endSec}
                />
                {isComplete && notesForPlayer.length > 0 && (
                  <PieceTimeline
                    notes={visuallyFilteredNotes}
                    duration={playbackDuration}
                    playbackTime={playbackTime}
                    loopStartSec={currentLoopSec ? currentLoopSec.startSec : null}
                    loopEndSec={currentLoopSec ? currentLoopSec.endSec : null}
                    measureMap={measureMap}
                    patternInsights={patternInsights}
                    onSeek={handleSeek}
                    onSetTimeLoop={handleSetTimeLoop}
                  />
                )}

                {/* Inline transport bar — sits below the timeline */}
                {isComplete && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
                    {/* Always-visible: reset + play + time */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Reset to start"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="h-9 w-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 transition-colors"
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying
                          ? <Pause className="h-4 w-4" />
                          : <Play className="h-4 w-4 ml-0.5" />}
                      </button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtDuration(playbackTime)} / {fmtDuration(playbackDuration)}
                      </span>
                    </div>
                    {/* Tempo row — wraps below on narrow screens */}
                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                      <span className="text-xs text-muted-foreground shrink-0">Tempo</span>
                      <input
                        type="range"
                        min={25}
                        max={100}
                        step={5}
                        value={tempo}
                        onChange={(e) => handleTempoChange(Number(e.target.value))}
                        className="flex-1 accent-accent min-w-0"
                      />
                      <span className="text-xs font-medium text-foreground tabular-nums shrink-0">
                        {tempo}%{actualBpm ? ` · ${actualBpm} BPM` : ""}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar: Piece library + tutorial + controls */}
              <div className="lg:w-80 shrink-0 space-y-4">
                <PieceLibrary
                  pieces={pieceLibrary}
                  selectedPiece={selectedPiece}
                  onSelectPiece={handleSelectPiece}
                  defaultCollapsed={isComplete}
                  pieceProgress={pieceProgress}
                />
                <TutorialPanel
                  segments={tutorialSegments}
                  notes={notesForPlayer}
                  tutorialState={tutorialMode.state}
                  activeSegment={activeTutorialSegment}
                  playbackTime={playbackTime}
                  onPlaySegment={handlePlaySegment}
                  onSelectSegment={(id) => {
                    tutorialMode.selectSegment(id)
                    const seg = tutorialSegments.find((s) => s.id === id)
                    if (seg) {
                      audioEngineRef.current.seek(seg.startTime, { resume: false })
                      setPlaybackTime(seg.startTime)
                      setIsPlaying(false)
                    }
                  }}
                  onNext={() => {
                    const nextIdx = tutorialState.currentSegmentIndex + 1
                    const next = tutorialSegments[nextIdx]
                    tutorialMode.nextSegment()
                    if (next) {
                      audioEngineRef.current.seek(next.startTime, { resume: false })
                      setPlaybackTime(next.startTime)
                      setIsPlaying(false)
                    }
                  }}
                  onPrev={() => {
                    const prevIdx = Math.max(0, tutorialState.currentSegmentIndex - 1)
                    const prev = tutorialSegments[prevIdx]
                    tutorialMode.prevSegment()
                    if (prev) {
                      audioEngineRef.current.seek(prev.startTime, { resume: false })
                      setPlaybackTime(prev.startTime)
                      setIsPlaying(false)
                    }
                  }}
                  onMarkComplete={handleMarkComplete}
                  onToggleAutoAdvance={tutorialMode.toggleAutoAdvance}
                  onToggleReplaySegment={tutorialMode.toggleReplaySegment}
                />
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
                  onLoopCurrentBar={handleLoopCurrentBar}
                  currentBar={currentBar ?? undefined}
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
                />
              </div>
            </div>
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* INSIGHTS TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="insights">
            <InsightsTab
              insights={patternInsights}
              isComplete={isComplete}
              pieceLoaded={isComplete || midiState.status === "ready"}
              onPracticeSection={handlePracticeSection}
            />
          </TabsContent>
        </Tabs>
            </div>
      </main>

      {/* Achievement toast */}
      <AchievementToast
        achievement={achievementQueue[0] ?? null}
        onDismiss={dismissAchievement}
      />

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-80 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              {[
                ["Space", "Play / Pause"],
                ["L", "Loop current bar"],
                ["→", "Next segment"],
                ["←", "Previous segment"],
                ["?", "Toggle this overlay"],
                ["Esc", "Close overlay"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{desc}</span>
                  <kbd className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary border border-border/60 text-xs font-mono text-foreground">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground/60 text-center">
              Shortcuts are disabled when an input is focused
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
