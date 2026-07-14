import type { NoteEvent, TrackInfo } from "./midi"

const RIGHT_KEYWORDS = /\b(right|rh|treble|r\.h\.|piano\s*r|diskant|soprano)\b/i
const LEFT_KEYWORDS = /\b(left|lh|bass|l\.h\.|piano\s*l|accomp|alto)\b/i

type HandAssigner = (event: NoteEvent) => "left" | "right"

// ---------------------------------------------------------------------------
// Case 4 helper: voice separation via largest pitch gap in concurrent clusters
// ---------------------------------------------------------------------------
function buildVoiceSeparator(events: NoteEvent[]): HandAssigner {
  // Pre-compute a smoothed pitch boundary for each millisecond bucket
  const WINDOW = 1.0 // seconds for smoothing
  const CLUSTER_GAP = 0.05 // notes within 50ms are "concurrent"

  // Build list of (time, boundary) from note clusters
  const boundaries: { time: number; boundary: number }[] = []

  const sorted = [...events].sort((a, b) => a.time - b.time)
  let i = 0
  while (i < sorted.length) {
    const clusterStart = sorted[i].time
    const cluster: number[] = []
    while (i < sorted.length && sorted[i].time - clusterStart <= CLUSTER_GAP) {
      cluster.push(sorted[i].midi)
      i++
    }
    if (cluster.length < 2) continue
    cluster.sort((a, b) => a - b)
    // Find the largest gap
    let maxGap = 0
    let boundary = cluster[0]
    for (let j = 1; j < cluster.length; j++) {
      const gap = cluster[j] - cluster[j - 1]
      if (gap > maxGap) {
        maxGap = gap
        boundary = (cluster[j - 1] + cluster[j]) / 2
      }
    }
    if (maxGap >= 3) {
      boundaries.push({ time: clusterStart, boundary })
    }
  }

  // Build a lookup: for a given note time, return smoothed boundary
  const getBoundary = (time: number): number => {
    if (boundaries.length === 0) return 60 // middle C fallback
    // Average boundaries within [time - WINDOW, time]
    const relevant = boundaries.filter(b => b.time >= time - WINDOW && b.time <= time + 0.1)
    if (relevant.length === 0) {
      // find nearest
      let nearest = boundaries[0]
      let minDist = Math.abs(boundaries[0].time - time)
      for (const b of boundaries) {
        const d = Math.abs(b.time - time)
        if (d < minDist) { minDist = d; nearest = b }
      }
      return nearest.boundary
    }
    return relevant.reduce((s, b) => s + b.boundary, 0) / relevant.length
  }

  return (event: NoteEvent) => event.midi >= getBoundary(event.time) ? "right" : "left"
}

// ---------------------------------------------------------------------------
// Helper: assign hands to any number of tracks by median pitch.
// Tracks are sorted by their median MIDI pitch; the lower-pitched half →
// "left", the higher-pitched half → "right".  Works for 2, 3, 4 … N staves.
// ---------------------------------------------------------------------------
function buildMedianPitchAssigner(trackIndices: number[], events: NoteEvent[]): HandAssigner {
  const ranked = trackIndices.map(idx => {
    const pitches = events
      .filter(e => e.track === idx)
      .map(e => e.midi)
      .sort((a, b) => a - b)
    const mid = Math.floor(pitches.length / 2)
    return { idx, median: pitches[mid] ?? 60 }
  })
  ranked.sort((a, b) => a.median - b.median)

  // Lower half → left, upper half → right.
  // For odd counts the middle track goes right (treble bias is safer for piano).
  const halfIdx = Math.floor(ranked.length / 2)
  const leftSet = new Set(ranked.slice(0, halfIdx).map(r => r.idx))

  return (e: NoteEvent) => (leftSet.has(e.track) ? "left" : "right")
}

export type HandAssignerConfidence = "high" | "low"

export interface HandAssignerResult {
  assign: HandAssigner
  /**
   * "high" when the MIDI file itself gives an unambiguous per-hand split
   * (named tracks, multiple tracks, or multiple channels) — reliable enough
   * to be trusted over a score's engraved staff assignment, which can place
   * a passage on the "wrong" staff for legibility (cross-staff engraving,
   * common in virtuoso piano writing). "low" means this fell back to
   * pitch-gap voice separation on a single track/channel, which is weaker
   * than an actual score's staff data when one is available.
   */
  confidence: HandAssignerConfidence
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function buildHandAssigner(tracks: TrackInfo[], events: NoteEvent[]): HandAssignerResult {
  const tracksWithNotes = tracks.filter(t => t.noteCount > 0)

  // ── Case 1 & 2: Multiple tracks with notes ──────────────────────────────
  if (tracksWithNotes.length >= 2) {
    const assignment = new Map<number, "left" | "right">()

    // Case 1: keyword detection — assign whatever tracks we can name
    for (const t of tracksWithNotes) {
      if (RIGHT_KEYWORDS.test(t.name)) assignment.set(t.index, "right")
      else if (LEFT_KEYWORDS.test(t.name)) assignment.set(t.index, "left")
    }

    // If at least 2 tracks were keyword-matched, fill remaining by median pitch
    if (assignment.size >= 2) {
      const unmatched = tracksWithNotes
        .filter(t => !assignment.has(t.index))
        .map(t => t.index)
      const fallback = unmatched.length > 0
        ? buildMedianPitchAssigner(
            [...tracksWithNotes.map(t => t.index)],
            events
          )
        : null
      return {
        assign: (e: NoteEvent) =>
          assignment.get(e.track) ??
          (fallback ? fallback(e) : (e.midi > 60 ? "right" : "left")),
        confidence: "high",
      }
    }

    // Case 2: no keyword matches — use median pitch for all tracks.
    // This correctly handles 2-staff, 3-staff, and 4-staff (SATB) MIDI files.
    return {
      assign: buildMedianPitchAssigner(tracksWithNotes.map(t => t.index), events),
      confidence: "high",
    }
  }

  // ── Case 3: Single track, multiple channels ──────────────────────────────
  const uniqueChannels = [...new Set(events.map(e => e.channel))].sort((a, b) => a - b)
  if (uniqueChannels.length >= 2) {
    // Treat each channel as a virtual "track" and apply the same median-pitch
    // strategy so 3-channel (3-staff) Type-0 MIDI files work too.
    const channelRanked = uniqueChannels.map(ch => {
      const pitches = events
        .filter(e => e.channel === ch)
        .map(e => e.midi)
        .sort((a, b) => a - b)
      const mid = Math.floor(pitches.length / 2)
      return { ch, median: pitches[mid] ?? 60 }
    })
    channelRanked.sort((a, b) => a.median - b.median)
    const halfIdx = Math.floor(channelRanked.length / 2)
    const leftChannels = new Set(channelRanked.slice(0, halfIdx).map(r => r.ch))
    return {
      assign: (e: NoteEvent) => (leftChannels.has(e.channel) ? "left" : "right"),
      confidence: "high",
    }
  }

  // ── Case 4: Voice separation ─────────────────────────────────────────────
  return { assign: buildVoiceSeparator(events), confidence: "low" }
}
