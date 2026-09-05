"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import * as Tone from "tone"
import { toast } from "sonner"

// Components
import { AppTopNav } from "./components/AppTopNav"
import { UploadCard } from "./components/UploadCard"
import { ConversionStatusCard } from "./components/ConversionStatusCard"
import { PlayerStageCard } from "./components/PlayerStageCard"
import { PieceTimeline } from "./components/PieceTimeline"
import { SidebarControls } from "./components/SidebarControls"
import { PedalIndicator } from "./components/PedalIndicator"
import { ScoringHUD } from "./components/ScoringHUD"
import { TutorialPlayerCard } from "./components/TutorialPlayerCard"
import { InsightsTab } from "./components/InsightsTab"
import { ChordEncyclopedia } from "./components/ChordEncyclopedia"
import { ChordTrainingSession } from "./components/ChordTrainingSession"
import { WarmupTab } from "./components/WarmupTab"
import { detectChord } from "./lib/chordDetection"
import { findChordDefinitionBySymbol } from "@/lib/chordLibrary"
import { recordChordSeenInPieces } from "./lib/chordMastery"
import { recordCoachWeaknessTags } from "./lib/coachProfile"
import { getRecommendations } from "./lib/practiceCoach"
import { loadAppSettings, saveAppSettings } from "./lib/appSettings"
import { SettingsTab } from "./components/SettingsTab"
import { exerciseToMidiBlobUrl } from "./lib/exerciseMidi"
import type { ExerciseDefinition } from "@/types/exercises"
import { useMicInput } from "./hooks/useMicInput"
import { MicInputPanel } from "./components/MicInputPanel"
import { SessionSummaryModal } from "./components/SessionSummaryModal"
import { NotationView } from "./components/NotationView"

// UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

// Piece library feature
import { PieceLibrary } from "@/components/PieceLibrary"
import { DemoPieceSwitcher } from "@/components/DemoPieceSwitcher"
import { buildPieceLibrary, MOCK_PIECE_FILE_PATHS } from "@/lib/buildPieceLibrary"
import { DEMO_PIECES } from "@/lib/demoPieces"
import type { ComposerGroup, PieceFile } from "@/types/pieces"
import { saveUpload, listUploads, getUploadBlob, type UploadRecord } from "./lib/uploadStore"

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
  getCachedDifficulty,
  cacheDifficulty,
  recordSessionMinutes,
  getPracticeHistory,
} from "@/lib/persistence"
import { computeDifficulty } from "./lib/difficulty"

// Icons
import {
  Music,
  Music2,
  Dumbbell,
  Settings as SettingsIcon,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  FileText,
  Upload,
  Timer,
  Clock,
  Hand,
  Repeat,
  X as XIcon,
  SkipBack,
  SkipForward,
} from "lucide-react"

// Types
import type {
  UploadedFile,
  Note,
  PianoKey,
  ConversionStep,
  LoopOption,
  PatternInsight,
  LoopRange,
  NamedLoop,
  Segment,
  HandAudioMode,
  HandVisualMode,
} from "@/types/practice"

// Hooks / utils
import { useMidi } from "./lib/useMidi"
import { generateFullPianoKeys, noteNameToMidi } from "./lib/piano"
import { useMusicXml } from "./hooks/useMusicXml"
import { useHybridScore } from "./hooks/useHybridScore"
import { getPianoAudioEngine } from "./lib/pianoAudioEngine"
import { ScoringEngine, type Verdict, type SessionSummary, type ScoringWindows } from "./lib/scoringEngine"
import type { UnifiedNoteEvent } from "./lib/hybrid/types"
import { analyzePiece, analyzeFromNotes, ALGO_VERSION } from "./lib/practiceAnalysis"
import {
  computePieceHash,
  loadPieceData,
  addNamedLoop,
  deleteNamedLoop,
  saveLastPosition,
  getCachedAnalysis,
  cacheAnalysis,
  recordBarMiss,
  recordPieceWeaknessTags,
  getBarMissCounts,
} from "@/lib/persistence"
import { filterNotesByVisualHand, filterNotesByAudioHand, computeActiveKeys } from "./lib/handFilter"

// ============================================================================
// Practice section timing constants — tweak here to adjust the feel
// ============================================================================

const PRACTICE_PREROLL_SEC  = 2.0  // how many seconds of "run-up" before the first note
const PRACTICE_POSTROLL_SEC = 2.0  // how many seconds to linger after the last note
const QUICK_LOOP_SEC = 5.0  // length of the one-click "Quick Loop" window
const TEMPO_RAMP_STEP = 5   // tempo % added each successful loop pass in ramp mode

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

// Computer-keyboard-as-piano mapping (one octave, C4-C5). Deliberately avoids
// Space/L/ArrowLeft/ArrowRight/?/Escape, which are already bound to transport
// shortcuts above. Home row = white keys, row above = black keys, in the same
// left-to-right pitch order as a real keyboard.
const QWERTY_NOTE_MAP: Record<string, string> = {
  a: "C4", w: "C#4", s: "D4", e: "D#4", d: "E4",
  f: "F4", t: "F#4", g: "G4", y: "G#4", h: "A4",
  u: "A#4", j: "B4", k: "C5",
}

// Classifies a missed note into a coarse "why" tag for the Adaptive Practice
// Coach — explicit, tunable thresholds rather than a black-box model.
const LEAP_SEMITONES_THRESHOLD = 7 // a fifth or more from the previous same-hand note
const FAST_PASSAGE_GAP_SEC = 0.2 // less than this between same-hand notes counts as "fast"

// Microphone pitch detection is inherently less precise than a keypress —
// wider timing tolerance and a bit of grace absorb tuning drift and the
// extra latency of the onset detector in useMicInput.ts.
const MIC_SCORING_WINDOWS: Partial<ScoringWindows> = { perfectMs: 70, greatMs: 120, goodMs: 220, missMs: 500 }

function classifyMissTag(ref: UnifiedNoteEvent, prev: UnifiedNoteEvent | null): string {
  if (!prev) return "timing-drift"
  const leap = Math.abs(ref.midi - prev.midi)
  const gapSec = ref.startTime - prev.startTime
  if (leap >= LEAP_SEMITONES_THRESHOLD) {
    return ref.hand === "left" ? "left-hand-leap" : "right-hand-leap"
  }
  if (gapSec < FAST_PASSAGE_GAP_SEC) return "fast-passage"
  return "timing-drift"
}


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

export type PracticeAppMode = "full" | "demo"

export function PracticeApp({ mode }: { mode: PracticeAppMode }) {
  const isDemo = mode === "demo"

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
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying
  const [tempo, setTempo] = useState(100)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [countInEnabled, setCountInEnabled] = useState(false)
  const [loopSelection, setLoopSelection] = useState("off")
  const [volume, setVolume] = useState(0.7)
  const [currentLoop, setCurrentLoop] = useState<LoopRange | null>(null)
  const [pedalActive, setPedalActive] = useState(false)
  const [beatPhase, setBeatPhase] = useState(0)
  const [quickLoopActive, setQuickLoopActive] = useState(false)
  const [drillActive, setDrillActive] = useState(false)
  const [loopRepeatTarget, setLoopRepeatTarget] = useState<number | null>(null)
  const loopRepeatTargetRef = useRef<number | null>(null)
  loopRepeatTargetRef.current = loopRepeatTarget
  const [tempoRampActive, setTempoRampActive] = useState(false)
  const tempoRampActiveRef = useRef(false)
  tempoRampActiveRef.current = tempoRampActive
  const tempoRef = useRef(100)
  tempoRef.current = tempo

  // ---------- Visual aids ----------
  const [showNoteNames, setShowNoteNames] = useState(true)
  const [showKeyLabels, setShowKeyLabels] = useState(false)
  const [colorblindMode, setColorblindMode] = useState(false)

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

  // Local scrub preview for the seek bar — while non-null, the slider shows
  // this instead of the live (rAF-driven) playbackTime, so dragging doesn't
  // fight with playback advancing underneath it. Cleared once the drag/key
  // nudge commits and the actual engine.seek() has been issued.
  const [scrubSeconds, setScrubSeconds] = useState<number | null>(null)

  // ---------- Audio engine ----------
  const audioEngineRef = useRef(getPianoAudioEngine())

  // ---------- Live input + scoring (clickable keyboard / computer keys) ----------
  const scoringEngineRef = useRef<ScoringEngine | null>(null)
  const referenceNotesByIdRef = useRef<Map<string, UnifiedNoteEvent>>(new Map())
  // The note immediately before each note in the same hand — used to classify
  // misses (a big pitch gap from the previous same-hand note = a "leap").
  const previousNoteByHandRef = useRef<Map<string, UnifiedNoteEvent | null>>(new Map())
  const pieceHashRef = useRef<string | null>(null)
  pieceHashRef.current = pieceHash
  const measureMapRef = useRef<{ measure: number; startSec: number; endSec: number }[]>([])
  const playbackTimeRef = useRef(0)
  playbackTimeRef.current = playbackTime
  const [manualActiveKeys, setManualActiveKeys] = useState<Set<string>>(new Set())
  const [inputMode, setInputMode] = useState<"keyboard" | "microphone">("keyboard")
  // Play-along input/scoring and live chord labels are both beta features,
  // off by default — persisted across sessions.
  const [playAlongEnabled, setPlayAlongEnabled] = useState(false)
  const playAlongEnabledRef = useRef(false)
  playAlongEnabledRef.current = playAlongEnabled
  const [liveChordDisplayEnabled, setLiveChordDisplayEnabled] = useState(false)
  useEffect(() => {
    const settings = loadAppSettings()
    setPlayAlongEnabled(settings.playAlongEnabled)
    setLiveChordDisplayEnabled(settings.liveChordDisplayEnabled)
  }, [])
  const handlePlayAlongEnabledChange = useCallback((enabled: boolean) => {
    setPlayAlongEnabled(enabled)
    saveAppSettings({ ...loadAppSettings(), playAlongEnabled: enabled })
  }, [])
  const handleLiveChordDisplayEnabledChange = useCallback((enabled: boolean) => {
    setLiveChordDisplayEnabled(enabled)
    saveAppSettings({ ...loadAppSettings(), liveChordDisplayEnabled: enabled })
  }, [])
  const [comboCount, setComboCount] = useState(0)
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null)
  const [lastHitNoteName, setLastHitNoteName] = useState<string | null>(null)
  const [verdictFlashToken, setVerdictFlashToken] = useState(0)
  const [waitForNoteEnabled, setWaitForNoteEnabled] = useState(true)
  const waitForNoteRef = useRef(waitForNoteEnabled)
  waitForNoteRef.current = waitForNoteEnabled
  const [isWaitingForNote, setIsWaitingForNote] = useState(false)
  const isWaitingForNoteRef = useRef(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [weakSpotVersion, setWeakSpotVersion] = useState(0)

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
  const [historyVersion, setHistoryVersion] = useState(0)
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
      // Attribute active practice time to whichever piece is currently loaded,
      // so the per-piece practice-history dashboard has real data to show.
      if (isPlayingRef.current && pieceHashRef.current) {
        recordSessionMinutes(pieceHashRef.current, 0.5)
        setHistoryVersion((v) => v + 1)
      }
    }, 30000) // update every 30 s
    return () => clearInterval(interval)
  }, [])

  // ---------- Engagement / gamification ----------
  // Starts at the same neutral default on both server and client — reading
  // localStorage here would make the client's first render (which has real
  // saved progress) diverge from the server-rendered HTML (which never has
  // access to localStorage) and fail hydration. The real value is loaded in
  // an effect below, which only runs after hydration on the client.
  const [progress, setProgress] = useState<UserProgress>({
    totalXp: 0,
    streak: 0,
    lastPracticeDate: "",
    unlockedAchievements: [],
  })
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([])
  const hasRecordedSessionRef = useRef(false)

  useEffect(() => {
    setProgress(loadProgress())
  }, [])

  const pushAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length > 0) setAchievementQueue((prev) => [...prev, ...achievements])
  }, [])

  const dismissAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1))
  }, [])

  // ---------- Piece library ----------
  const [pieceLibrary, setPieceLibrary] = useState<ComposerGroup[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PieceFile | null>(null)
  const [myUploads, setMyUploads] = useState<UploadRecord[]>([])
  const [activeExercise, setActiveExercise] = useState<ExerciseDefinition | null>(null)
  const [chordTraining, setChordTraining] = useState<{ focusChordId: string | null } | null>(null)

  const refreshMyUploads = useCallback(() => {
    listUploads().then(setMyUploads).catch(() => {})
  }, [])

  useEffect(() => {
    refreshMyUploads()
  }, [refreshMyUploads])

  // Merge the local "My Uploads" IndexedDB library in as its own composer group.
  const combinedPieceLibrary: ComposerGroup[] = useMemo(() => {
    if (myUploads.length === 0) return pieceLibrary
    const uploadGroup: ComposerGroup = {
      composer: "My Uploads",
      pieces: myUploads.map((u) => {
        const dot = u.name.lastIndexOf(".")
        const extension = dot >= 0 ? u.name.slice(dot).toLowerCase() : ""
        const title = dot >= 0 ? u.name.slice(0, dot) : u.name
        const isMidi = extension === ".mid" || extension === ".midi"
        return {
          composer: "My Uploads",
          title,
          fileName: u.name,
          filePath: `upload:${u.id}`,
          extension,
          midiPath: isMidi ? `upload:${u.id}` : undefined,
          xmlPath: !isMidi ? `upload:${u.id}` : undefined,
          uploadId: u.id,
        } satisfies PieceFile
      }),
    }
    return [uploadGroup, ...pieceLibrary]
  }, [pieceLibrary, myUploads])
  // Starts empty on both server and client for the same hydration-safety
  // reason as `progress` above — populated from localStorage in an effect.
  const [pieceProgress, setPieceProgress] = useState<Record<string, { completed: number; total: number }>>({})

  useEffect(() => {
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
    if (Object.keys(out).length > 0) setPieceProgress(out)
  }, [])

  // ---------- Tutorial mode ----------
  const measureMap = musicXmlState.status === "ready" ? musicXmlState.measureMap : []
  measureMapRef.current = measureMap

  // Weak spots: bars with the most recorded live-scoring misses, worst first.
  // Only available for pieces with a measure map (MusicXML-derived) since bar
  // boundaries aren't otherwise known.
  const weakSpots = useMemo(() => {
    if (!pieceHash || measureMap.length === 0) return []
    const counts = getBarMissCounts(pieceHash)
    return Object.entries(counts)
      .map(([bar, count]) => ({ bar: Number(bar), count }))
      .filter((w) => w.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((w) => {
        const m = measureMap.find((mm) => mm.measure === w.bar)
        return m ? { ...w, startSec: m.startSec, endSec: m.endSec } : null
      })
      .filter((w): w is { bar: number; count: number; startSec: number; endSec: number } => w !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceHash, measureMap, weakSpotVersion])

  // Adaptive Practice Coach: ranked recommendations from the cross-piece
  // weakness profile + this piece's current weak bars.
  const recommendations = useMemo(
    () => getRecommendations(weakSpots),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weakSpots, weakSpotVersion]
  )

  // Practice history: per-piece session log + last-played timestamp, refreshed
  // whenever the session timer attributes new minutes to the active piece.
  const practiceHistory = useMemo(() => {
    if (!pieceHash) return null
    return getPracticeHistory(pieceHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceHash, historyVersion])

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
        fingering: e.fingering,
        source: e.source,
      }))
    }
    return MOCK_NOTES
  }, [hybrid])

  // Build/reset the scoring engine whenever a new piece's reference notes are ready.
  // hybrid.events is already UnifiedNoteEvent[] — no adapter needed.
  useEffect(() => {
    if (hybrid.status === "ready" || hybrid.status === "midi-only" || hybrid.status === "xml-only") {
      const windows = inputMode === "microphone" ? MIC_SCORING_WINDOWS : undefined
      scoringEngineRef.current = new ScoringEngine(hybrid.events, windows)
      referenceNotesByIdRef.current = new Map(hybrid.events.map((e) => [e.id, e]))

      const prevByHand = new Map<string, UnifiedNoteEvent | null>()
      for (const hand of ["left", "right"] as const) {
        const handNotes = hybrid.events.filter((e) => e.hand === hand).sort((a, b) => a.startTime - b.startTime)
        for (let i = 0; i < handNotes.length; i++) {
          prevByHand.set(handNotes[i].id, i > 0 ? handNotes[i - 1] : null)
        }
      }
      previousNoteByHandRef.current = prevByHand
    } else {
      scoringEngineRef.current = null
      referenceNotesByIdRef.current = new Map()
      previousNoteByHandRef.current = new Map()
    }
    setComboCount(0)
    setLastVerdict(null)
    setSessionSummary(null)
  }, [hybrid, inputMode])

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

  // Scheduled-note highlights plus whatever the user is manually pressing right now
  // (clicked/touched keys or mapped computer-keyboard keys).
  const combinedActiveKeys = useMemo(() => {
    if (manualActiveKeys.size === 0) return activeKeys
    return [...activeKeys, ...manualActiveKeys]
  }, [activeKeys, manualActiveKeys])

  // =========================================================================
  // Metadata for header
  // =========================================================================
  const pieceName = activeExercise?.title
    ?? selectedPiece?.title
    ?? (file?.name ? file.name.replace(/\.(mid|midi|musicxml|mxl|xml)$/i, "") : null)
    ?? (isComplete ? "Untitled Piece" : null)
  const composerName = activeExercise ? "Warm-up exercise" : (selectedPiece?.composer ?? "")
  const bpm =
    (midiState.status === "ready" && midiState.bpm)
      ? Math.round(midiState.bpm)
      : (musicXmlState.status === "ready" && musicXmlState.detectedBpm)
        ? Math.round(musicXmlState.detectedBpm)
        : null
  // Actual BPM at current tempo setting
  const actualBpm = bpm ? Math.round(bpm * (tempo / 100)) : null
  const hasPedalData = midiState.status === "ready" && (midiState.pedalEvents?.length ?? 0) > 0

  // =========================================================================
  // Audio engine init
  // =========================================================================
  useEffect(() => {
    const hasAudioContext =
      typeof window !== "undefined" &&
      (typeof window.AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined")
    if (!hasAudioContext) {
      toast.error("Your browser doesn't support Web Audio", {
        description: "Try the latest Chrome, Firefox, Safari, or Edge to use ScoreSense.",
      })
      return
    }

    const engine = audioEngineRef.current
    const initEngine = async () => {
      try {
        await engine.load()
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error"
        console.error("Audio engine failed to load:", errMsg)
        toast.error("Couldn't load piano sounds", { description: errMsg })
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

    // Persist the raw bytes to IndexedDB so this upload survives a reload
    // and shows up under "My Uploads" without asking the user to re-pick it.
    saveUpload(file.fileObject)
      .then(() => refreshMyUploads())
      .catch(() => {})

    audioEngineRef.current.stop()
    audioEngineRef.current.setLoop({ enabled: false })
    setIsConverting(true)
    setIsComplete(false)
    setActiveExercise(null)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
    setTutorialPlayerActive(false)
    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)
    setDrillActive(false)

    if (/\.(mid|midi)$/i.test(file.name)) {
      setMidiUrl(url)
    } else {
      setMusicXmlUrl(url)
    }
  }, [file, refreshMyUploads])

  const cancelConversion = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    audioEngineRef.current.stop()
    audioEngineRef.current.setLoop({ enabled: false })
    setIsConverting(false)
    setConversionStep(0)
    setConversionProgress(0)
    setIsComplete(false)
    setMidiUrl(null)
    setMusicXmlUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
    setTutorialPlayerActive(false)
    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)
    setDrillActive(false)
  }, [])

  // Drive the conversion-status UI (step list + progress bar) from the
  // underlying loader states, since neither loader reports fine-grained
  // progress — this is coarse but keeps the UI from sitting frozen at 0%.
  useEffect(() => {
    if (!isConverting) return
    if (midiState.status === "loading" || musicXmlState.status === "loading") {
      setConversionStep(1)
      setConversionProgress(25)
    }
    if (midiState.status === "ready" || musicXmlState.status === "ready") {
      setConversionStep(3)
      setConversionProgress(75)
    }
  }, [isConverting, midiState.status, musicXmlState.status])

  // Watch hybrid status to know when parsing is done
  useEffect(() => {
    if (!isConverting) return
    const { status } = hybrid
    if (/^(ready|midi-only|xml-only)$/.test(status)) {
      setConversionStep(4)
      setConversionProgress(100)
      setIsConverting(false)
      setIsComplete(true)
    } else if (/^error$/.test(status)) {
      setIsConverting(false)
    }
  }, [hybrid.status, isConverting])

  // Surface parse failures — these previously failed silently (console only)
  useEffect(() => {
    if (midiState.status === "error") {
      toast.error("Couldn't read this MIDI file", { description: midiState.error })
    }
  }, [midiState])

  useEffect(() => {
    if (musicXmlState.status === "error") {
      toast.error("Couldn't read this MusicXML file", { description: musicXmlState.error })
    }
  }, [musicXmlState])

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
        // Defensive: a leftover post-roll phase from a previous segment
        // interaction must not leak into regular playback (see the same
        // reset in handlePlaySegment for why this flag can get stuck true).
        isPracticePostRollRef.current = false
        await engine.play()
        setIsPlaying(true)
      }
    } catch (err) {
      console.error("Play/pause error:", err)
      setIsPlaying(false)
      toast.error("Audio could not start", {
        description: "Click anywhere on the page and try again.",
      })
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

  const handlePracticeAgain = useCallback(() => {
    setSessionSummary(null)
    scoringEngineRef.current?.reset()
    setComboCount(0)
    setLastVerdict(null)
    audioEngineRef.current.seek(0, { resume: false })
    setPlaybackTime(0)
  }, [])

  const handleMetronomeToggle = useCallback(() => {
    const next = !metronomeOn
    setMetronomeOn(next)
    audioEngineRef.current.setMetronome(next, bpm ?? 120)
  }, [metronomeOn, bpm])

  const handleCountInToggle = useCallback(() => {
    const next = !countInEnabled
    setCountInEnabled(next)
    audioEngineRef.current.setCountIn(next ? 4 : 0)
  }, [countInEnabled])

  const handleTempoChange = useCallback((value: number) => {
    setTempo(value)
    audioEngineRef.current.setTempo(value)
  }, [])

  const handleTestTone = useCallback(async () => {
    const engine = audioEngineRef.current
    if (engine.getState().status !== "ready") return
    try {
      await Tone.start()
      engine.playNoteNow("C4", 0.8, 1)
    } catch (err) {
      console.error("Test tone error:", err)
    }
  }, [])

  // Live (non-MIDI) input: a clicked/touched keyboard key, a mapped computer-keyboard
  // press, or (silently, no synth playback) a detected microphone pitch. Plays the note
  // immediately and, if a piece is loaded, feeds ScoringEngine — one event shape shared
  // by every non-MIDI input source.
  const handleLiveKeyPress = useCallback((note: string, down: boolean, opts?: { silent?: boolean }) => {
    setManualActiveKeys((prev) => {
      if (down === prev.has(note)) return prev
      const next = new Set(prev)
      if (down) next.add(note)
      else next.delete(note)
      return next
    })
    if (!down) return

    const velocity = 0.85
    if (!opts?.silent) {
      const engine = audioEngineRef.current
      if (engine.getState().status === "ready") {
        Tone.start().catch(() => {})
        engine.playNoteNow(note, velocity)
      }
    }

    // Scoring against the loaded piece is the beta "play-along" feature —
    // clicking/typing a note for sound (and for Chord Training, which reads
    // manualActiveKeys above) still works either way.
    if (!playAlongEnabledRef.current) return

    const scoring = scoringEngineRef.current
    if (!scoring) return
    const midi = noteNameToMidi(note)
    if (midi === null) return
    const result = scoring.noteOn({ midi, time: playbackTimeRef.current, velocity })
    if (result) {
      setLastVerdict(result.verdict)
      setLastHitNoteName(note)
      setVerdictFlashToken((t) => t + 1)
      setComboCount(scoring.getSummary().combo)
    }
  }, [])

  // Microphone input: a third producer of the exact same live-note-event
  // stream as the clickable keyboard and QWERTY mapping (silent — no synth
  // playback, since the user is already producing sound acoustically).
  const handleMicNote = useCallback(
    (note: string, down: boolean) => handleLiveKeyPress(note, down, { silent: true }),
    [handleLiveKeyPress]
  )
  const micInput = useMicInput(handleMicNote)
  useEffect(() => {
    if (inputMode !== "microphone") micInput.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode])
  // Play-along is beta/opt-in — if it gets turned off, drop back to keyboard
  // mode and release the microphone rather than leaving it listening silently.
  useEffect(() => {
    if (!playAlongEnabled) {
      setInputMode("keyboard")
      micInput.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAlongEnabled])

  const handleLoopChange = useCallback((value: string) => {
    setLoopSelection(value)
    if (value === "off") {
      setCurrentLoop(null)
      setQuickLoopActive(false)
      setDrillActive(false)
      audioEngineRef.current.setLoop({ enabled: false })
    }
  }, [])

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v)
    audioEngineRef.current.setVolume(v)
  }, [])

  const handleClearLoop = useCallback(() => {
    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)
    setDrillActive(false)
    audioEngineRef.current.setLoop({ enabled: false })
  }, [])

  // Repeat count applies to bar/named/timeline loops (not Quick Loop, which
  // always runs until explicitly toggled off). Changing it while a loop of
  // that kind is already active re-arms the wrap counter immediately.
  const handleLoopRepeatTargetChange = useCallback((target: number | null) => {
    setLoopRepeatTarget(target)
    const engine = audioEngineRef.current
    if (loopSelection !== "off" && !quickLoopActive && engine.isLooping()) {
      engine.setLoop({ enabled: true, repeatTarget: target })
    }
  }, [loopSelection, quickLoopActive])

  const handleTempoRampToggle = useCallback(() => {
    setTempoRampActive((v) => !v)
  }, [])

  const handlePracticeSection = useCallback((start: number, end: number) => {
    setCurrentLoop({ start, end })
    setLoopSelection("custom")
    setQuickLoopActive(false)
    setDrillActive(false)
    audioEngineRef.current.setLoop({ enabled: true, startSec: start, endSec: end, repeatTarget: loopRepeatTarget })
    setActiveTab("player") // switch to player tab
  }, [loopRepeatTarget])

  // One-click loop of the next QUICK_LOOP_SEC seconds from wherever playback
  // currently is. The engine only tracks a single loop region, so engaging
  // this supersedes any bar/named loop selection (and vice versa — see the
  // setQuickLoopActive(false) resets in the other loop handlers).
  const handleQuickLoopToggle = useCallback(() => {
    const engine = audioEngineRef.current
    if (quickLoopActive) {
      setQuickLoopActive(false)
      engine.setLoop({ enabled: false })
      return
    }

    setCurrentLoop(null)
    setLoopSelection("off")
    setDrillActive(false)

    let startSec = playbackTime
    let endSec = startSec + QUICK_LOOP_SEC
    // Near the end of the piece: keep the loop a full QUICK_LOOP_SEC long by
    // anchoring it to the piece's end instead of shrinking to a tiny sliver.
    if (playbackDuration > 0 && endSec > playbackDuration) {
      endSec = playbackDuration
      startSec = Math.max(0, endSec - QUICK_LOOP_SEC)
    }

    // Quick Loop always runs until explicitly toggled off — never inherits the
    // repeat-count setting, which would otherwise silently disable it out from
    // under the button's own on/off state.
    engine.setLoop({ enabled: true, startSec, endSec, repeatTarget: null })
    setQuickLoopActive(true)
    if (!isPlaying) handlePlayPause()
  }, [quickLoopActive, playbackTime, playbackDuration, isPlaying, handlePlayPause])

  // Same one-click 5s loop as Quick Loop, but also drops tempo to half speed —
  // a one-tap "slow this bit down" shortcut. Toggling off just stops the loop;
  // tempo is left wherever it is (same as any other tempo change in the app,
  // nothing else auto-restores tempo either).
  const handleDrillToggle = useCallback(() => {
    const engine = audioEngineRef.current
    if (drillActive) {
      setDrillActive(false)
      engine.setLoop({ enabled: false })
      return
    }

    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)

    let startSec = playbackTime
    let endSec = startSec + QUICK_LOOP_SEC
    if (playbackDuration > 0 && endSec > playbackDuration) {
      endSec = playbackDuration
      startSec = Math.max(0, endSec - QUICK_LOOP_SEC)
    }

    handleTempoChange(Math.max(25, Math.round(tempoRef.current * 0.5)))
    engine.setLoop({ enabled: true, startSec, endSec, repeatTarget: null })
    setDrillActive(true)
    if (!isPlaying) handlePlayPause()
  }, [drillActive, playbackTime, playbackDuration, isPlaying, handlePlayPause, handleTempoChange])

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
    setActiveExercise(null)

    // Reset the engine's own transport position, not just the React state —
    // otherwise Transport.seconds keeps whatever position the previous piece
    // was at, and if the new piece is shorter, playbackTime can display (or
    // even resume from) a position past the new piece's own duration.
    audioEngineRef.current.stop()
    audioEngineRef.current.setLoop({ enabled: false })

    setPlaybackTime(0)
    setIsPlaying(false)
    setTutorialPlayerActive(false)
    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)
    setDrillActive(false)

    // "My Uploads" pieces have no server file path — reconstruct a blob URL
    // from IndexedDB instead of fetching a static file.
    if (piece.uploadId) {
      const isMidi = !!piece.midiPath
      setMidiUrl(null)
      setMusicXmlUrl(null)
      getUploadBlob(piece.uploadId).then((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        if (isMidi) setMidiUrl(url)
        else setMusicXmlUrl(url)
        setIsComplete(true)
      })
      return
    }

    const pieceMidiUrl = piece.midiPath ?? null
    const pieceXmlUrl = piece.xmlPath ?? null

    setMidiUrl(pieceMidiUrl)
    setMusicXmlUrl(pieceXmlUrl)
    setIsComplete(true)
  }, [])

  // Demo visitors never see the upload/library UI, so nothing else would ever
  // call handleSelectPiece for them — load the first curated piece up front.
  useEffect(() => {
    if (isDemo) handleSelectPiece(DEMO_PIECES[0].piece)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  // Warm-up/technique exercises are generated in-memory, then serialized to a
  // real (tiny) MIDI file so they flow through the exact same midiUrl -> parse
  // -> hybrid-align -> score pipeline as any uploaded or library piece.
  const handleSelectExercise = useCallback((exercise: ExerciseDefinition) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setSelectedPiece(null)
    setFile(null)
    setActiveExercise(exercise)

    audioEngineRef.current.stop()
    audioEngineRef.current.setLoop({ enabled: false })

    setPlaybackTime(0)
    setIsPlaying(false)
    setTutorialPlayerActive(false)
    setCurrentLoop(null)
    setLoopSelection("off")
    setQuickLoopActive(false)
    setDrillActive(false)

    const url = exerciseToMidiBlobUrl(exercise)
    blobUrlRef.current = url
    setMusicXmlUrl(null)
    setMidiUrl(url)
    setIsComplete(true)
    setActiveTab("player")
  }, [])

  useEffect(() => {
    // Demo mode never shows the full library — skip the fetch entirely.
    if (isDemo) return
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
  }, [isDemo])

  // Set notes to audio engine based on handAudioMode.
  // Each note's own stable id (string or number) is passed through as-is —
  // the engine keys per-voice attack/release by this id, so mangling it
  // (e.g. parseInt-ing a compound string id down to NaN, as this used to
  // do) would collapse every note onto one shared identity and reintroduce
  // exactly the same-pitch collision this architecture exists to prevent.
  useEffect(() => {
    const engine = audioEngineRef.current
    const filteredNotes = filterNotesByAudioHand(notesForPlayer, handAudioMode)

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
        const loopTickResult = engine.tickLoop()
        if (loopTickResult === "completed") {
          toast.success("Loop finished", { description: `Repeated ${loopRepeatTargetRef.current}x — looping is now off.` })
          setLoopSelection("off")
          setCurrentLoop(null)
        } else if (loopTickResult === "wrapped" && tempoRampActiveRef.current) {
          const nextTempo = Math.min(100, tempoRef.current + TEMPO_RAMP_STEP)
          if (nextTempo !== tempoRef.current) handleTempoChange(nextTempo)
        }

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

        // "Wait for note" practice mode: hold the transport (and therefore
        // the visualizer) exactly here until the note that's due gets played
        // correctly. Skips tick()'s miss-resolution entirely while waiting,
        // so a held note is never scored a miss out from under the player.
        if (playAlongEnabledRef.current && waitForNoteRef.current && scoringEngineRef.current?.hasPendingNoteAt(currentTime)) {
          if (!isWaitingForNoteRef.current) {
            isWaitingForNoteRef.current = true
            setIsWaitingForNote(true)
            engine.pause()
          }
          animationRef.current = requestAnimationFrame(animate)
          return
        }
        if (isWaitingForNoteRef.current) {
          isWaitingForNoteRef.current = false
          setIsWaitingForNote(false)
          engine.resumeFromSeek()
        }

        setPlaybackTime(currentTime)
        setPedalActive(engine.getPedalState())
        setBeatPhase(engine.getBeatPhase(bpm ?? 120))
        // Scoring/miss-tracking is the beta "play-along" feature — skip tick()
        // entirely when it's off, so untouched notes never get recorded as
        // misses just because nobody was trying to play along.
        const missResults = playAlongEnabledRef.current ? scoringEngineRef.current?.tick(currentTime) ?? [] : []
        if (missResults.length > 0 && pieceHashRef.current) {
          const weaknessTags: string[] = []
          for (const r of missResults) {
            const ref = referenceNotesByIdRef.current.get(r.refNoteId)
            if (!ref) continue
            const bar = measureMapRef.current.find(
              (m) => ref.startTime >= m.startSec && ref.startTime < m.endSec
            )?.measure
            if (bar !== undefined) recordBarMiss(pieceHashRef.current, bar)
            weaknessTags.push(classifyMissTag(ref, previousNoteByHandRef.current.get(ref.id) ?? null))
          }
          recordPieceWeaknessTags(pieceHashRef.current, weaknessTags)
          recordCoachWeaknessTags(weaknessTags)
          setWeakSpotVersion((v) => v + 1)
        }

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
            const scoring = scoringEngineRef.current
            if (scoring && playAlongEnabledRef.current) {
              scoring.tick(playbackDuration)
              const summary = scoring.getSummary()
              if (summary.notesResolved > 0) setSessionSummary(summary)
            }
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

  // Difficulty heuristic: compute once per piece and cache, so the Piece
  // Library can show a 1-5 badge without re-parsing on every render.
  useEffect(() => {
    if (!pieceHash || notesForPlayer.length === 0 || notesForPlayer === MOCK_NOTES) return
    if (getCachedDifficulty(pieceHash) != null) return
    const difficulty = computeDifficulty(
      notesForPlayer.map((n) => ({ midi: n.midi ?? 0, startTime: n.startTime })),
      bpm ?? 120,
      playbackDuration
    )
    cacheDifficulty(pieceHash, difficulty)
  }, [pieceHash, notesForPlayer, bpm, playbackDuration])

  // Chord mastery: every distinct chord recognized in this piece's harmonic
  // analysis counts as "seen" toward the Chord Encyclopedia's exposure stats.
  useEffect(() => {
    if (patternInsights.length === 0) return
    const symbols = new Set<string>()
    for (const insight of patternInsights) {
      for (const symbol of insight.chordProgression ?? []) symbols.add(symbol)
    }
    const ids = Array.from(symbols)
      .map((symbol) => findChordDefinitionBySymbol(symbol)?.id)
      .filter((id): id is string => !!id)
    recordChordSeenInPieces(ids)
  }, [patternInsights])

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

  // Live "what chord is this" readout for the current bar, using the same
  // detector the falling-notes visualizer and the Insights tab both use.
  const currentChordLabel = useMemo(() => {
    if (!liveChordDisplayEnabled || currentBar == null) return null
    const barEntry = measureMap.find((m) => m.measure === currentBar)
    if (!barEntry) return null
    const barMidis = notesForPlayer
      .filter((n) => n.midi != null && n.startTime >= barEntry.startSec && n.startTime < barEntry.endSec)
      .map((n) => n.midi as number)
    return detectChord(barMidis)?.symbol ?? null
  }, [liveChordDisplayEnabled, currentBar, measureMap, notesForPlayer])

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
      setQuickLoopActive(false)
      setDrillActive(false)
      audioEngineRef.current.setLoop({ enabled: true, startSec: range.startSec, endSec: range.endSec, repeatTarget: loopRepeatTarget })
    },
    [barsToSeconds, loopRepeatTarget]
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
        setQuickLoopActive(false)
        setDrillActive(false)
        audioEngineRef.current.setLoop({ enabled: true, startSec, endSec, repeatTarget: loopRepeatTarget })
      }
    },
    [measureMap, handleSetBarLoop, loopRepeatTarget]
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
    setQuickLoopActive(false)
    setDrillActive(false)
    postRollFiredRef.current = false
    // Clear any stale post-roll phase from whatever segment was previously
    // active — otherwise, if the user jumps to a new segment while the old
    // one is still lingering in its post-roll window, this flag stays stuck
    // true. The very next tick after THIS segment's lead-in completes would
    // then wrongly re-enter the (stale) post-roll branch using leftover
    // wall-clock refs, computing a huge bogus "elapsed" and immediately
    // halting playback right after the first note — looking like the
    // falling-note visuals just freeze.
    isPracticePostRollRef.current = false

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
      if (e.key === "Escape") { setShowShortcuts(false); setChordTraining(null); return }
      const mappedNote = QWERTY_NOTE_MAP[e.key.toLowerCase()]
      if (mappedNote && !e.repeat) { handleLiveKeyPress(mappedNote, true); return }
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
    const upHandler = (e: KeyboardEvent) => {
      const mappedNote = QWERTY_NOTE_MAP[e.key.toLowerCase()]
      if (mappedNote) handleLiveKeyPress(mappedNote, false)
    }
    window.addEventListener("keydown", handler)
    window.addEventListener("keyup", upHandler)
    return () => {
      window.removeEventListener("keydown", handler)
      window.removeEventListener("keyup", upHandler)
    }
  }, [isComplete, handlePlayPause, handleLoopCurrentBar, handlePlaySegment, tutorialMode, handleLiveKeyPress])

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
      setQuickLoopActive(false)
      setDrillActive(false)
      audioEngineRef.current.setLoop({ enabled: true, startSec: loop.startSec, endSec: loop.endSec, repeatTarget: loopRepeatTarget })
    },
    [loopRepeatTarget]
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
                        aria-label="Clear loop"
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
              {!isDemo && (
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
              )}
            </div>
          </div>
        </header>

        {/* =============================================================== */}
        {/* PRE-CONVERSION: Upload + Conversion Status */}
        {/* =============================================================== */}
        {!isDemo && !isComplete && (
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
              error={
                midiState.status === "error"
                  ? midiState.error
                  : musicXmlState.status === "error"
                    ? musicXmlState.error
                    : null
              }
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
            <TabsTrigger value="chords" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Music2 className="h-3.5 w-3.5" />
              Chords
            </TabsTrigger>
            <TabsTrigger value="warmup" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Dumbbell className="h-3.5 w-3.5" />
              Warm-up
            </TabsTrigger>
            {musicXmlUrl && (
              <TabsTrigger value="notation" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <FileText className="h-3.5 w-3.5" />
                Notation
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <SettingsIcon className="h-3.5 w-3.5" />
              Settings
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
                  colorblindMode={colorblindMode}
                  currentLoop={currentLoop}
                  tempo={tempo}
                  activeKeys={combinedActiveKeys}
                  currentLessonTitle={tutorialPlayerActive && activeTutorialSegment ? activeTutorialSegment.title : null}
                  loopEndTimeSec={currentLoopSec?.endSec}
                  onKeyPress={handleLiveKeyPress}
                  showChordLabel={liveChordDisplayEnabled}
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
                    {/* Seek bar — drag or use arrow keys to nudge by 1s; buttons jump 5s */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <button
                        type="button"
                        onClick={() => handleSeek(Math.max(0, playbackTime - 5))}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Rewind 5 seconds"
                      >
                        <SkipBack className="h-4 w-4" />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(playbackDuration, 0.01)}
                        step={1}
                        value={scrubSeconds ?? playbackTime}
                        onChange={(e) => setScrubSeconds(Number(e.target.value))}
                        onMouseUp={(e) => {
                          handleSeek(Number((e.target as HTMLInputElement).value))
                          setScrubSeconds(null)
                        }}
                        onTouchEnd={(e) => {
                          handleSeek(Number((e.target as HTMLInputElement).value))
                          setScrubSeconds(null)
                        }}
                        onKeyUp={(e) => {
                          if (
                            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(
                              e.key
                            )
                          ) {
                            handleSeek(Number((e.target as HTMLInputElement).value))
                            setScrubSeconds(null)
                          }
                        }}
                        className="flex-1 accent-accent min-w-0"
                        aria-label="Seek through piece"
                      />
                      <button
                        type="button"
                        onClick={() => handleSeek(Math.min(playbackDuration, playbackTime + 5))}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Fast-forward 5 seconds"
                      >
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Quick Loop — one click loops the next 5s from wherever playback is */}
                    <button
                      type="button"
                      onClick={handleQuickLoopToggle}
                      disabled={!isComplete}
                      className={[
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                        quickLoopActive
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      ].join(" ")}
                      aria-label={quickLoopActive ? "Stop quick loop" : "Loop the next 5 seconds"}
                    >
                      <Repeat className="h-3 w-3" />
                      Quick Loop
                    </button>
                    {/* Drill — same 5s loop, but also drops tempo to half speed */}
                    <button
                      type="button"
                      onClick={handleDrillToggle}
                      disabled={!isComplete}
                      className={[
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                        drillActive
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                      ].join(" ")}
                      aria-label={drillActive ? "Stop drilling this passage" : "Drill the next 5 seconds at half speed"}
                    >
                      <Repeat className="h-3 w-3" />
                      Drill 50%
                    </button>
                    {/* Pedal indicator — only shown when the piece actually has CC64 automation */}
                    {hasPedalData && (
                      <div className="shrink-0">
                        <PedalIndicator active={pedalActive} />
                      </div>
                    )}
                    {/* Live chord readout for the bar currently playing */}
                    {currentChordLabel && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        {currentChordLabel}
                      </span>
                    )}
                    {/* Live scoring feedback — verdict flash, combo, and "wait for note" status (beta) */}
                    {playAlongEnabled && (
                      <ScoringHUD
                        combo={comboCount}
                        lastVerdict={lastVerdict}
                        lastNoteName={lastHitNoteName}
                        flashToken={verdictFlashToken}
                        isWaitingForNote={isWaitingForNote}
                      />
                    )}
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
                {playAlongEnabled && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/50 px-3 py-2.5">
                    <span className="text-xs font-medium text-foreground">Play-along input</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setInputMode("keyboard")}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          inputMode === "keyboard"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Keyboard
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode("microphone")}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          inputMode === "microphone"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        Microphone
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/50 px-3 py-2.5">
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-medium text-foreground">Wait for correct note</span>
                      <p className="text-[11px] text-muted-foreground">Pauses playback until you play the right note.</p>
                    </div>
                    <Switch checked={waitForNoteEnabled} onCheckedChange={setWaitForNoteEnabled} />
                  </div>
                  {inputMode === "microphone" && (
                    <MicInputPanel
                      state={micInput.state}
                      reading={micInput.reading}
                      level={micInput.level}
                      onStart={micInput.start}
                      onStop={micInput.stop}
                    />
                  )}
                </div>
                )}
                {isDemo ? (
                  <DemoPieceSwitcher
                    options={DEMO_PIECES}
                    selectedPiece={selectedPiece}
                    onSelect={handleSelectPiece}
                  />
                ) : (
                  <PieceLibrary
                    pieces={combinedPieceLibrary}
                    selectedPiece={selectedPiece}
                    onSelectPiece={handleSelectPiece}
                    defaultCollapsed={isComplete}
                    pieceProgress={pieceProgress}
                  />
                )}
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
                  countInEnabled={countInEnabled}
                  onCountInToggle={handleCountInToggle}
                  beatPhase={beatPhase}
                  onTempoChange={handleTempoChange}
                  onClearLoop={handleClearLoop}
                  onSeek={handleSeek}
                  onTestTone={handleTestTone}
                  loopSelection={loopSelection}
                  loopOptions={LOOP_OPTIONS}
                  onLoopChange={handleLoopChange}
                  totalBars={totalBars}
                  onSetBarLoop={handleSetBarLoop}
                  onLoopCurrentBar={handleLoopCurrentBar}
                  currentBar={currentBar ?? undefined}
                  namedLoops={namedLoops}
                  onSaveLoop={handleSaveNamedLoop}
                  onDeleteLoop={handleDeleteNamedLoop}
                  onSelectNamedLoop={handleSelectNamedLoop}
                  loopRepeatTarget={loopRepeatTarget}
                  onLoopRepeatTargetChange={handleLoopRepeatTargetChange}
                  tempoRampActive={tempoRampActive}
                  onTempoRampToggle={handleTempoRampToggle}
                  handAudioMode={handAudioMode}
                  handVisualMode={handVisualMode}
                  onHandAudioModeChange={setHandAudioMode}
                  onHandVisualModeChange={setHandVisualMode}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                  showNoteNames={showNoteNames}
                  showKeyLabels={showKeyLabels}
                  onShowNoteNamesChange={setShowNoteNames}
                  onShowKeyLabelsChange={setShowKeyLabels}
                  colorblindMode={colorblindMode}
                  onColorblindModeChange={setColorblindMode}
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
              weakSpots={weakSpots}
              practiceHistory={practiceHistory}
              recommendations={recommendations}
            />
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* CHORDS TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="chords">
            <ChordEncyclopedia onStartTraining={(focusChordId) => setChordTraining({ focusChordId })} />
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* WARM-UP TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="warmup">
            <WarmupTab
              onSelectExercise={handleSelectExercise}
              activeExerciseId={activeExercise?.id ?? null}
              recommendations={recommendations}
            />
          </TabsContent>

          {/* --------------------------------------------------------------- */}
          {/* NOTATION TAB */}
          {/* --------------------------------------------------------------- */}
          {musicXmlUrl && (
            <TabsContent value="notation">
              <NotationView xmlUrl={musicXmlUrl} currentBar={currentBar} />
            </TabsContent>
          )}

          {/* --------------------------------------------------------------- */}
          {/* SETTINGS TAB */}
          {/* --------------------------------------------------------------- */}
          <TabsContent value="settings">
            <SettingsTab
              playAlongEnabled={playAlongEnabled}
              onPlayAlongEnabledChange={handlePlayAlongEnabledChange}
              liveChordDisplayEnabled={liveChordDisplayEnabled}
              onLiveChordDisplayEnabledChange={handleLiveChordDisplayEnabledChange}
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

      {/* Live-scoring session summary (beta) — shown once a piece finishes with played-along notes */}
      {playAlongEnabled && sessionSummary && (
        <SessionSummaryModal
          summary={sessionSummary}
          onClose={() => setSessionSummary(null)}
          onPracticeAgain={handlePracticeAgain}
        />
      )}

      {/* Chord training session */}
      {chordTraining && (
        <ChordTrainingSession
          heldNotes={Array.from(manualActiveKeys)}
          focusChordId={chordTraining.focusChordId}
          onClose={() => setChordTraining(null)}
        />
      )}

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
                aria-label="Close keyboard shortcuts"
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
            <p className="mt-3 text-[10px] text-muted-foreground/70 text-center">
              A W S E D F T G Y H U J K play notes C4–C5 along with the piece — or click/tap the on-screen keyboard.
            </p>
            <p className="mt-4 text-[10px] text-muted-foreground/60 text-center">
              Shortcuts are disabled when an input is focused
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
