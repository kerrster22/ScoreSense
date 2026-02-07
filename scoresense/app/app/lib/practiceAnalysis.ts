"use client"

/**
 * Practice Analysis: Structure detection, similarity matching, segment/lesson generation.
 *
 * - Detects sections/phrases from measure map + note density
 * - Computes per-bar feature vectors (rhythm quantized, pitch set/contour)
 * - Sliding window + normalized edit-distance for near-match detection
 * - Generates segments and lessons for the lessons panel
 */

import type {
  MeasureInfo,
  Segment,
  Lesson,
  PatternInsight,
} from "../components/types"
import type { MeasureMapEntry, MusicXmlNoteEvent } from "./musicmxl"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGO_VERSION = "1.0"
const MIN_SECTION_BARS = 2
const MAX_SECTION_BARS = 16
const DEFAULT_SECTION_BARS = 8
const SIMILARITY_THRESHOLD = 0.75 // 0-1, 1 = identical
const RHYTHM_BINS = 16 // quantize each bar into 16 slots

// ---------------------------------------------------------------------------
// Types (internal)
// ---------------------------------------------------------------------------

interface BarFeature {
  measure: number
  startSec: number
  endSec: number
  /** Rhythm: 16 slots, 1 = note onset, 0 = silent */
  rhythm: number[]
  /** Sorted set of MIDI pitch classes (0-11) present */
  pitchClasses: number[]
  /** Pitch contour: sequence of MIDI notes in order of onset */
  contour: number[]
  /** Note count */
  noteCount: number
  hand: "combined" | "left" | "right"
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

function extractBarFeatures(
  events: MusicXmlNoteEvent[],
  measureMap: MeasureMapEntry[],
  hand: "combined" | "left" | "right" = "combined"
): BarFeature[] {
  const features: BarFeature[] = []

  for (const m of measureMap) {
    const barDur = Math.max(m.endSec - m.startSec, 0.01)
    const barEvents = events.filter((e) => {
      if (hand !== "combined" && e.hand !== hand) return false
      return e.startTime >= m.startSec - 0.001 && e.startTime < m.endSec + 0.001
    })

    const rhythm = new Array(RHYTHM_BINS).fill(0)
    const pitchClassSet = new Set<number>()
    const contour: number[] = []

    for (const e of barEvents) {
      const relTime = (e.startTime - m.startSec) / barDur
      const bin = Math.min(RHYTHM_BINS - 1, Math.floor(relTime * RHYTHM_BINS))
      rhythm[bin] = 1
      pitchClassSet.add(e.midi % 12)
      contour.push(e.midi)
    }

    features.push({
      measure: m.measure,
      startSec: m.startSec,
      endSec: m.endSec,
      rhythm,
      pitchClasses: Array.from(pitchClassSet).sort((a, b) => a - b),
      contour,
      noteCount: barEvents.length,
      hand,
    })
  }

  return features
}

// ---------------------------------------------------------------------------
// Similarity scoring
// ---------------------------------------------------------------------------

/** Cosine similarity between two numeric vectors */
function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/** Jaccard similarity between two sorted integer arrays */
function jaccardSim(a: number[], b: number[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const v of setA) if (setB.has(v)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

/** Contour similarity: normalized edit distance on pitch sequence */
function contourSim(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  // For performance, limit to first 32 notes
  const aa = a.slice(0, 32)
  const bb = b.slice(0, 32)

  const m = aa.length
  const n = bb.length

  // Simple normalized difference of intervals
  const intervalsA = aa.slice(1).map((v, i) => v - aa[i])
  const intervalsB = bb.slice(1).map((v, i) => v - bb[i])

  if (intervalsA.length === 0 && intervalsB.length === 0) return 1

  // Pad shorter to same length
  const maxLen = Math.max(intervalsA.length, intervalsB.length)
  while (intervalsA.length < maxLen) intervalsA.push(0)
  while (intervalsB.length < maxLen) intervalsB.push(0)

  // Cosine on interval vectors
  return Math.max(0, cosineSim(intervalsA, intervalsB))
}

/** Combined similarity between two bar-range feature windows */
function windowSimilarity(windowA: BarFeature[], windowB: BarFeature[]): number {
  if (windowA.length === 0 || windowB.length === 0) return 0
  if (windowA.length !== windowB.length) return 0

  let totalRhythm = 0
  let totalPitch = 0
  let totalContour = 0

  for (let i = 0; i < windowA.length; i++) {
    totalRhythm += cosineSim(windowA[i].rhythm, windowB[i].rhythm)
    totalPitch += jaccardSim(windowA[i].pitchClasses, windowB[i].pitchClasses)
    totalContour += contourSim(windowA[i].contour, windowB[i].contour)
  }

  const n = windowA.length
  const avgRhythm = totalRhythm / n
  const avgPitch = totalPitch / n
  const avgContour = totalContour / n

  // Weighted: rhythm 40%, pitch 30%, contour 30%
  return avgRhythm * 0.4 + avgPitch * 0.3 + avgContour * 0.3
}

// ---------------------------------------------------------------------------
// Structure detection
// ---------------------------------------------------------------------------

interface SectionBoundary {
  startBar: number
  endBar: number
  startSec: number
  endSec: number
}

/**
 * Detect section boundaries from the measure map.
 * Uses note density changes and fixed chunking as fallback.
 */
function detectSections(
  features: BarFeature[],
  measureMap: MeasureMapEntry[]
): SectionBoundary[] {
  if (features.length === 0) return []

  const totalBars = features.length

  // Determine section size based on total piece length
  let sectionSize = DEFAULT_SECTION_BARS
  if (totalBars <= 16) sectionSize = Math.max(MIN_SECTION_BARS, Math.ceil(totalBars / 2))
  else if (totalBars <= 32) sectionSize = 8
  else if (totalBars <= 64) sectionSize = 8
  else sectionSize = 8

  // Look for density boundaries (large changes in note count)
  const densities = features.map((f) => f.noteCount)
  const boundaries: number[] = [0] // always start at bar 0

  for (let i = 1; i < densities.length; i++) {
    const prev = densities[i - 1]
    const curr = densities[i]
    // Significant density change
    if (Math.abs(curr - prev) > Math.max(3, prev * 0.5)) {
      // Only add if far enough from last boundary
      const lastBoundary = boundaries[boundaries.length - 1]
      if (i - lastBoundary >= MIN_SECTION_BARS) {
        boundaries.push(i)
      }
    }
  }

  // Fill in with regular chunks where gaps are too large
  const filled: number[] = [0]
  for (let i = 1; i < boundaries.length; i++) {
    const gap = boundaries[i] - filled[filled.length - 1]
    if (gap > MAX_SECTION_BARS) {
      // Insert intermediate boundaries
      let pos = filled[filled.length - 1]
      while (boundaries[i] - pos > MAX_SECTION_BARS) {
        pos += sectionSize
        if (pos < boundaries[i]) filled.push(pos)
      }
    }
    filled.push(boundaries[i])
  }

  // Handle remaining bars after last boundary
  const lastB = filled[filled.length - 1]
  if (totalBars - lastB > MAX_SECTION_BARS) {
    let pos = lastB
    while (totalBars - pos > MAX_SECTION_BARS) {
      pos += sectionSize
      if (pos < totalBars) filled.push(pos)
    }
  }

  // Convert boundaries to sections
  const sections: SectionBoundary[] = []
  const sortedBoundaries = [...new Set(filled)].sort((a, b) => a - b)

  for (let i = 0; i < sortedBoundaries.length; i++) {
    const startIdx = sortedBoundaries[i]
    const endIdx = i + 1 < sortedBoundaries.length ? sortedBoundaries[i + 1] - 1 : totalBars - 1

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
// Similarity detection (sliding window)
// ---------------------------------------------------------------------------

interface SimilarityMatch {
  sectionA: SectionBoundary
  sectionB: SectionBoundary
  score: number
  hand: "combined" | "left" | "right"
}

function findSimilarSections(
  sections: SectionBoundary[],
  allFeatures: BarFeature[],
  hand: "combined" | "left" | "right" = "combined"
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = []

  // Filter features by hand
  const features = hand === "combined"
    ? allFeatures
    : allFeatures.filter((f) => f.hand === hand || f.hand === "combined")

  const featureByBar = new Map<number, BarFeature>()
  for (const f of features) featureByBar.set(f.measure, f)

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const sA = sections[i]
      const sB = sections[j]

      // Build feature windows
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

      // Windows must be same size for comparison
      const minLen = Math.min(windowA.length, windowB.length)
      if (minLen < MIN_SECTION_BARS) continue

      const trimA = windowA.slice(0, minLen)
      const trimB = windowB.slice(0, minLen)

      const score = windowSimilarity(trimA, trimB)
      if (score >= SIMILARITY_THRESHOLD) {
        matches.push({ sectionA: sA, sectionB: sB, score, hand })
      }
    }
  }

  return matches
}

// ---------------------------------------------------------------------------
// Segment & Lesson generation
// ---------------------------------------------------------------------------

function generateSegments(
  sections: SectionBoundary[],
  matches: SimilarityMatch[]
): Segment[] {
  return sections.map((section, idx) => {
    // Find all similar sections
    const similar = matches.filter(
      (m) =>
        (m.sectionA.startBar === section.startBar && m.sectionA.endBar === section.endBar) ||
        (m.sectionB.startBar === section.startBar && m.sectionB.endBar === section.endBar)
    )

    const occurrenceSet = new Set<string>()
    occurrenceSet.add(`${section.startBar}-${section.endBar}`)
    let bestScore = 0

    for (const m of similar) {
      const other =
        m.sectionA.startBar === section.startBar ? m.sectionB : m.sectionA
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

  const lessons: Lesson[] = []

  // Group segments into lessons of ~2-4 segments each
  const groupSize = segments.length <= 4 ? segments.length : Math.min(4, Math.ceil(segments.length / 3))

  for (let i = 0; i < segments.length; i += groupSize) {
    const group = segments.slice(i, i + groupSize)
    const lessonIdx = Math.floor(i / groupSize) + 1
    const startSec = group[0].startSec
    const endSec = group[group.length - 1].endSec

    lessons.push({
      id: `lesson-${lessonIdx}`,
      title: `Part ${lessonIdx}: Bars ${group[0].startBar}-${group[group.length - 1].endBar}`,
      segments: group,
      durationSec: endSec - startSec,
      startSec,
      endSec,
    })
  }

  return lessons
}

function generateInsights(
  segments: Segment[],
  matches: SimilarityMatch[]
): PatternInsight[] {
  const insights: PatternInsight[] = []
  let idCounter = 1

  // Insights from similarity matches
  for (const match of matches) {
    const sA = match.sectionA
    const sB = match.sectionB

    const isExact = match.score > 0.95
    const type = isExact ? "exact" : "near"

    insights.push({
      id: idCounter++,
      text: isExact
        ? `Bars ${sA.startBar}-${sA.endBar} repeat exactly at bars ${sB.startBar}-${sB.endBar} - master it once, play it twice`
        : `Bars ${sA.startBar}-${sA.endBar} are very similar to bars ${sB.startBar}-${sB.endBar} - same patterns, minor variations`,
      barRange: `Bars ${sA.startBar}-${sA.endBar}`,
      type,
      loopStart: sA.startBar,
      loopEnd: sA.endBar,
      occurrences: [`${sB.startBar}-${sB.endBar}`],
    })
  }

  // Add density-based insights for segments with high note counts
  for (const seg of segments) {
    if (seg.repeatCount > 1) {
      insights.push({
        id: idCounter++,
        text: `This section appears ${seg.repeatCount} times - practicing covers ${seg.occurrences.join(", ")}`,
        barRange: `Bars ${seg.startBar}-${seg.endBar}`,
        type: "exact",
        loopStart: seg.startBar,
        loopEnd: seg.endBar,
        occurrences: seg.occurrences.filter(
          (o) => o !== `${seg.startBar}-${seg.endBar}`
        ),
      })
    }
  }

  return insights
}

// ---------------------------------------------------------------------------
// Main analysis entry point
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  segments: Segment[]
  lessons: Lesson[]
  insights: PatternInsight[]
  algoVersion: string
}

export function analyzePiece(
  events: MusicXmlNoteEvent[],
  measureMap: MeasureMapEntry[]
): AnalysisResult {
  if (measureMap.length === 0 || events.length === 0) {
    return { segments: [], lessons: [], insights: [], algoVersion: ALGO_VERSION }
  }

  // Extract features for all hands
  const combinedFeatures = extractBarFeatures(events, measureMap, "combined")
  const rhFeatures = extractBarFeatures(events, measureMap, "right")
  const lhFeatures = extractBarFeatures(events, measureMap, "left")

  // Detect sections
  const sections = detectSections(combinedFeatures, measureMap)

  // Find similarities across all hand perspectives
  const combinedMatches = findSimilarSections(sections, combinedFeatures, "combined")
  const rhMatches = findSimilarSections(sections, rhFeatures, "right")
  const lhMatches = findSimilarSections(sections, lhFeatures, "left")

  // Deduplicate matches: keep the best score for each section pair
  const allMatches = [...combinedMatches, ...rhMatches, ...lhMatches]
  const matchKey = (m: SimilarityMatch) =>
    `${m.sectionA.startBar}-${m.sectionA.endBar}:${m.sectionB.startBar}-${m.sectionB.endBar}`
  const bestMatches = new Map<string, SimilarityMatch>()
  for (const m of allMatches) {
    const key = matchKey(m)
    const existing = bestMatches.get(key)
    if (!existing || m.score > existing.score) {
      bestMatches.set(key, m)
    }
  }

  const deduped = Array.from(bestMatches.values())

  // Generate outputs
  const segments = generateSegments(sections, deduped)
  const lessons = generateLessons(segments)
  const insights = generateInsights(segments, deduped)

  return { segments, lessons, insights, algoVersion: ALGO_VERSION }
}

export { ALGO_VERSION }
