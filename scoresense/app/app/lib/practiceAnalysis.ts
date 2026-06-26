"use client"

/**
 * Practice Analysis — structure detection, similarity matching, segment/lesson generation.
 *
 * Works with both MusicXML (via MusicXmlNoteEvent + MeasureMapEntry) and
 * MIDI-only files (via UnifiedNoteEvent + BPM-derived measure map).
 */

import type { Segment, Lesson, PatternInsight } from "../components/types"
import type { MeasureMapEntry, MusicXmlNoteEvent } from "./musicmxl"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ALGO_VERSION = "1.1"
const MIN_SECTION_BARS = 2
const MAX_SECTION_BARS = 16
const DEFAULT_SECTION_BARS = 8
const SIMILARITY_THRESHOLD = 0.72
const RHYTHM_BINS = 16

// ---------------------------------------------------------------------------
// Common note shape (accepts both XML and unified MIDI events)
// ---------------------------------------------------------------------------

interface AnalyzableNote {
  startTime: number
  duration: number
  midi: number
  hand?: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface BarFeature {
  measure: number
  startSec: number
  endSec: number
  rhythm: number[]
  pitchClasses: number[]
  contour: number[]
  avgPitch: number
  noteCount: number
  hand: "combined" | "left" | "right"
}

interface SectionBoundary {
  startBar: number
  endBar: number
  startSec: number
  endSec: number
}

interface SimilarityMatch {
  sectionA: SectionBoundary
  sectionB: SectionBoundary
  score: number
  hand: "combined" | "left" | "right"
  transposeInterval: number | null // non-null when sections are transpositions of each other
}

// ---------------------------------------------------------------------------
// Measure map builder for MIDI-only files
// ---------------------------------------------------------------------------

export function buildMidiMeasureMap(
  duration: number,
  bpm: number,
  beatsPerBar = 4
): MeasureMapEntry[] {
  if (duration <= 0 || bpm <= 0) return []
  const secPerBar = (60 / bpm) * beatsPerBar
  const map: MeasureMapEntry[] = []
  let bar = 1
  for (let t = 0; t < duration; t += secPerBar) {
    map.push({
      measure: bar,
      playthroughIndex: 0,
      startSec: t,
      endSec: Math.min(t + secPerBar, duration),
    })
    bar++
  }
  return map
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

function extractBarFeatures(
  notes: AnalyzableNote[],
  measureMap: MeasureMapEntry[],
  hand: "combined" | "left" | "right" = "combined"
): BarFeature[] {
  return measureMap.map((m) => {
    const barDur = Math.max(m.endSec - m.startSec, 0.01)
    const barNotes = notes.filter((n) => {
      if (hand !== "combined" && n.hand !== hand) return false
      return n.startTime >= m.startSec - 0.001 && n.startTime < m.endSec + 0.001
    })

    const rhythm = new Array(RHYTHM_BINS).fill(0)
    const pitchClassSet = new Set<number>()
    const contour: number[] = []

    for (const n of barNotes) {
      const relTime = (n.startTime - m.startSec) / barDur
      const bin = Math.min(RHYTHM_BINS - 1, Math.floor(relTime * RHYTHM_BINS))
      rhythm[bin] = 1
      pitchClassSet.add(n.midi % 12)
      contour.push(n.midi)
    }

    const avgPitch =
      contour.length > 0
        ? contour.reduce((s, v) => s + v, 0) / contour.length
        : 60

    return {
      measure: m.measure,
      startSec: m.startSec,
      endSec: m.endSec,
      rhythm,
      pitchClasses: Array.from(pitchClassSet).sort((a, b) => a - b),
      contour,
      avgPitch,
      noteCount: barNotes.length,
      hand,
    }
  })
}

// ---------------------------------------------------------------------------
// Similarity metrics
// ---------------------------------------------------------------------------

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function jaccardSim(a: number[], b: number[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const v of setA) if (setB.has(v)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

function contourSim(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const aa = a.slice(0, 32)
  const bb = b.slice(0, 32)
  const intervalsA = aa.slice(1).map((v, i) => v - aa[i])
  const intervalsB = bb.slice(1).map((v, i) => v - bb[i])
  if (intervalsA.length === 0 && intervalsB.length === 0) return 1
  const maxLen = Math.max(intervalsA.length, intervalsB.length)
  while (intervalsA.length < maxLen) intervalsA.push(0)
  while (intervalsB.length < maxLen) intervalsB.push(0)
  return Math.max(0, cosineSim(intervalsA, intervalsB))
}

function windowSimilarity(windowA: BarFeature[], windowB: BarFeature[]): number {
  if (windowA.length === 0 || windowB.length === 0) return 0
  if (windowA.length !== windowB.length) return 0
  let totalRhythm = 0, totalPitch = 0, totalContour = 0
  for (let i = 0; i < windowA.length; i++) {
    totalRhythm  += cosineSim(windowA[i].rhythm,       windowB[i].rhythm)
    totalPitch   += jaccardSim(windowA[i].pitchClasses, windowB[i].pitchClasses)
    totalContour += contourSim(windowA[i].contour,      windowB[i].contour)
  }
  const n = windowA.length
  return (totalRhythm / n) * 0.4 + (totalPitch / n) * 0.3 + (totalContour / n) * 0.3
}

/**
 * Detect transposition: if the rhythm/contour shapes match but pitches are
 * shifted by a consistent interval, return that interval in semitones.
 */
function detectTransposeInterval(
  windowA: BarFeature[],
  windowB: BarFeature[]
): number | null {
  const pitchesA = windowA.flatMap((f) => f.contour)
  const pitchesB = windowB.flatMap((f) => f.contour)
  if (pitchesA.length < 2 || pitchesB.length < 2) return null

  const avgA = pitchesA.reduce((s, v) => s + v, 0) / pitchesA.length
  const avgB = pitchesB.reduce((s, v) => s + v, 0) / pitchesB.length
  const interval = Math.round(avgB - avgA)

  // Minimum 2-semitone shift to count as intentional transposition
  if (Math.abs(interval) < 2) return null

  // Also require that the contour shape similarity is high (same melody, diff key)
  const shapeSim = contourSim(pitchesA, pitchesB)
  if (shapeSim < 0.6) return null

  return interval
}

// ---------------------------------------------------------------------------
// Structure detection
// ---------------------------------------------------------------------------

function detectSections(
  features: BarFeature[],
  measureMap: MeasureMapEntry[]
): SectionBoundary[] {
  if (features.length === 0) return []
  const totalBars = features.length
  const sectionSize =
    totalBars <= 16 ? Math.max(MIN_SECTION_BARS, Math.ceil(totalBars / 2)) : DEFAULT_SECTION_BARS

  const densities = features.map((f) => f.noteCount)
  const boundaries: number[] = [0]

  for (let i = 1; i < densities.length; i++) {
    const prev = densities[i - 1]
    const curr = densities[i]
    if (Math.abs(curr - prev) > Math.max(3, prev * 0.5)) {
      const lastBoundary = boundaries[boundaries.length - 1]
      if (i - lastBoundary >= MIN_SECTION_BARS) boundaries.push(i)
    }
  }

  // Fill large gaps
  const filled: number[] = [0]
  for (let i = 1; i < boundaries.length; i++) {
    const gap = boundaries[i] - filled[filled.length - 1]
    if (gap > MAX_SECTION_BARS) {
      let pos = filled[filled.length - 1]
      while (boundaries[i] - pos > MAX_SECTION_BARS) {
        pos += sectionSize
        if (pos < boundaries[i]) filled.push(pos)
      }
    }
    filled.push(boundaries[i])
  }
  const lastB = filled[filled.length - 1]
  if (totalBars - lastB > MAX_SECTION_BARS) {
    let pos = lastB
    while (totalBars - pos > MAX_SECTION_BARS) {
      pos += sectionSize
      if (pos < totalBars) filled.push(pos)
    }
  }

  const sortedBoundaries = [...new Set(filled)].sort((a, b) => a - b)
  const sections: SectionBoundary[] = []
  for (let i = 0; i < sortedBoundaries.length; i++) {
    const startIdx = sortedBoundaries[i]
    const endIdx =
      i + 1 < sortedBoundaries.length ? sortedBoundaries[i + 1] - 1 : totalBars - 1
    if (startIdx > endIdx) continue
    sections.push({
      startBar: features[startIdx].measure,
      endBar: features[endIdx].measure,
      startSec: features[startIdx].startSec,
      endSec: features[endIdx].endSec,
    })
  }
  return sections
}

// ---------------------------------------------------------------------------
// Similarity detection
// ---------------------------------------------------------------------------

function findSimilarSections(
  sections: SectionBoundary[],
  allFeatures: BarFeature[],
  hand: "combined" | "left" | "right" = "combined"
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = []
  const featureByBar = new Map<number, BarFeature>()
  for (const f of allFeatures) featureByBar.set(f.measure, f)

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const sA = sections[i]
      const sB = sections[j]

      const windowA: BarFeature[] = []
      const windowB: BarFeature[] = []
      for (let bar = sA.startBar; bar <= sA.endBar; bar++) {
        const f = featureByBar.get(bar)
        if (f) windowA.push(f)
      }
      for (let bar = sB.startBar; bar <= sB.endBar; bar++) {
        const f = featureByBar.get(bar)
        if (f) windowB.push(f)
      }

      const minLen = Math.min(windowA.length, windowB.length)
      if (minLen < MIN_SECTION_BARS) continue

      const trimA = windowA.slice(0, minLen)
      const trimB = windowB.slice(0, minLen)

      const score = windowSimilarity(trimA, trimB)
      if (score >= SIMILARITY_THRESHOLD) {
        const transposeInterval = detectTransposeInterval(trimA, trimB)
        matches.push({ sectionA: sA, sectionB: sB, score, hand, transposeInterval })
      }
    }
  }
  return matches
}

// ---------------------------------------------------------------------------
// Segment & lesson generation
// ---------------------------------------------------------------------------

function generateSegments(
  sections: SectionBoundary[],
  matches: SimilarityMatch[]
): Segment[] {
  return sections.map((section, idx) => {
    const similar = matches.filter(
      (m) =>
        (m.sectionA.startBar === section.startBar && m.sectionA.endBar === section.endBar) ||
        (m.sectionB.startBar === section.startBar && m.sectionB.endBar === section.endBar)
    )
    const occurrenceSet = new Set<string>()
    occurrenceSet.add(`${section.startBar}-${section.endBar}`)
    let bestScore = 0
    for (const m of similar) {
      const other = m.sectionA.startBar === section.startBar ? m.sectionB : m.sectionA
      occurrenceSet.add(`${other.startBar}-${other.endBar}`)
      bestScore = Math.max(bestScore, m.score)
    }
    return {
      id: `seg-${idx + 1}`,
      title: `Section ${idx + 1} (Bars ${section.startBar}-${section.endBar})`,
      startBar: section.startBar,
      endBar: section.endBar,
      startSec: section.startSec,
      endSec: section.endSec,
      repeatCount: occurrenceSet.size,
      occurrences: Array.from(occurrenceSet),
      similarityScore: bestScore > 0 ? bestScore : undefined,
    }
  })
}

function generateLessons(segments: Segment[]): Lesson[] {
  if (segments.length === 0) return []
  const groupSize = segments.length <= 4 ? segments.length : Math.min(4, Math.ceil(segments.length / 3))
  const lessons: Lesson[] = []
  for (let i = 0; i < segments.length; i += groupSize) {
    const group = segments.slice(i, i + groupSize)
    const lessonIdx = Math.floor(i / groupSize) + 1
    lessons.push({
      id: `lesson-${lessonIdx}`,
      title: `Part ${lessonIdx}: Bars ${group[0].startBar}-${group[group.length - 1].endBar}`,
      segments: group,
      durationSec: group[group.length - 1].endSec - group[0].startSec,
      startSec: group[0].startSec,
      endSec: group[group.length - 1].endSec,
    })
  }
  return lessons
}

// ---------------------------------------------------------------------------
// Insight generation (loopStart/loopEnd are SECONDS, not bar numbers)
// ---------------------------------------------------------------------------

function generateInsights(
  segments: Segment[],
  matches: SimilarityMatch[],
  lhFeatures: BarFeature[]
): PatternInsight[] {
  const insights: PatternInsight[] = []
  let id = 1
  const seen = new Set<string>()

  // ── Match-based insights (exact / near / transposed) ───────────────────
  for (const match of matches) {
    const sA = match.sectionA
    const sB = match.sectionB

    // Deduplicate: skip if we already have an insight for this pair from the other direction
    const pairKey = `${Math.min(sA.startBar, sB.startBar)}:${Math.max(sA.endBar, sB.endBar)}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)

    const scorePercent = Math.round(match.score * 100)
    const isExact = match.score > 0.95
    const isTransposed = !isExact && match.transposeInterval !== null

    let type: PatternInsight["type"]
    let text: string

    if (isExact) {
      type = "exact"
      text = `Bars ${sA.startBar}–${sA.endBar} repeat exactly at bars ${sB.startBar}–${sB.endBar}. Master it once, play it twice.`
    } else if (isTransposed) {
      const semitones = match.transposeInterval!
      const direction = semitones > 0 ? "up" : "down"
      const absSteps = Math.abs(semitones)
      type = "transposed"
      text = `Bars ${sA.startBar}–${sA.endBar} return at bars ${sB.startBar}–${sB.endBar} transposed ${absSteps} semitone${absSteps !== 1 ? "s" : ""} ${direction}. Same fingering, new position.`
    } else {
      type = "near"
      text = `Bars ${sA.startBar}–${sA.endBar} are ${scorePercent}% similar to bars ${sB.startBar}–${sB.endBar} — same patterns with minor variations.`
    }

    insights.push({
      id: id++,
      text,
      barRange: `Bars ${sA.startBar}–${sA.endBar}`,
      type,
      loopStart: sA.startSec,   // ← seconds, not bar numbers
      loopEnd:   sA.endSec,
      occurrences: [`${sB.startBar}–${sB.endBar}`],
      score: match.score,
    })
  }

  // ── Left-hand pattern insights ──────────────────────────────────────────
  // Find sections where the left-hand alone has a strong repeating pattern
  const lhFeatureByBar = new Map<number, BarFeature>()
  for (const f of lhFeatures) lhFeatureByBar.set(f.measure, f)

  for (const seg of segments) {
    // Only emit a left-hand insight if there's no combined insight already
    const alreadyCovered = insights.some(
      (ins) =>
        ins.loopStart === seg.startSec && ins.loopEnd === seg.endSec
    )
    if (alreadyCovered) continue

    // Gather the left-hand bar features for this segment
    const lhBars: BarFeature[] = []
    for (let bar = seg.startBar; bar <= seg.endBar; bar++) {
      const f = lhFeatureByBar.get(bar)
      if (f) lhBars.push(f)
    }
    if (lhBars.length < 2) continue

    // A consistent left-hand pattern: low variance in rhythm across bars
    const rhythmSims: number[] = []
    for (let i = 1; i < lhBars.length; i++) {
      rhythmSims.push(cosineSim(lhBars[i - 1].rhythm, lhBars[i].rhythm))
    }
    const avgRhythmSim = rhythmSims.reduce((s, v) => s + v, 0) / rhythmSims.length
    if (avgRhythmSim < 0.7) continue

    // Has enough notes to be meaningful
    const totalNotes = lhBars.reduce((s, f) => s + f.noteCount, 0)
    if (totalNotes < 4) continue

    insights.push({
      id: id++,
      text: `Left-hand pattern is consistent across bars ${seg.startBar}–${seg.endBar} — a great place to build muscle memory separately.`,
      barRange: `Bars ${seg.startBar}–${seg.endBar}`,
      type: "left-hand",
      loopStart: seg.startSec,
      loopEnd:   seg.endSec,
      score: avgRhythmSim,
    })
  }

  return insights
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  segments: Segment[]
  lessons: Lesson[]
  insights: PatternInsight[]
  algoVersion: string
}

/** Analyse a MusicXML piece (has a proper measure map). */
export function analyzePiece(
  events: MusicXmlNoteEvent[],
  measureMap: MeasureMapEntry[]
): AnalysisResult {
  if (measureMap.length === 0 || events.length === 0) {
    return { segments: [], lessons: [], insights: [], algoVersion: ALGO_VERSION }
  }

  const notes: AnalyzableNote[] = events.map((e) => ({
    startTime: e.startTime,
    duration: e.duration,
    midi: e.midi,
    hand: e.hand,
  }))

  return _analyze(notes, measureMap)
}

/** Analyse a MIDI-only piece using a BPM-derived measure map. */
export function analyzeFromNotes(
  events: { startTime: number; duration: number; midi: number; hand?: string }[],
  bpm: number,
  duration: number
): AnalysisResult {
  if (events.length === 0 || duration <= 0) {
    return { segments: [], lessons: [], insights: [], algoVersion: ALGO_VERSION }
  }
  const measureMap = buildMidiMeasureMap(duration, bpm)
  return _analyze(events, measureMap)
}

function _analyze(
  notes: AnalyzableNote[],
  measureMap: MeasureMapEntry[]
): AnalysisResult {
  const combinedFeatures = extractBarFeatures(notes, measureMap, "combined")
  const lhFeatures       = extractBarFeatures(notes, measureMap, "left")

  const sections = detectSections(combinedFeatures, measureMap)

  const combinedMatches = findSimilarSections(sections, combinedFeatures, "combined")
  const lhMatches       = findSimilarSections(sections, lhFeatures,       "left")
  const rhMatches       = findSimilarSections(sections, extractBarFeatures(notes, measureMap, "right"), "right")

  // Deduplicate: keep best score per section pair
  const allMatches = [...combinedMatches, ...rhMatches, ...lhMatches]
  const bestMatches = new Map<string, SimilarityMatch>()
  for (const m of allMatches) {
    const key = `${m.sectionA.startBar}-${m.sectionA.endBar}:${m.sectionB.startBar}-${m.sectionB.endBar}`
    const existing = bestMatches.get(key)
    if (!existing || m.score > existing.score) bestMatches.set(key, m)
  }

  const deduped = Array.from(bestMatches.values())
  const segments = generateSegments(sections, deduped)
  const lessons  = generateLessons(segments)
  const insights = generateInsights(segments, deduped, lhFeatures)

  return { segments, lessons, insights, algoVersion: ALGO_VERSION }
}
