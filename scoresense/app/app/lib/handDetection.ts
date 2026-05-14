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
// Main export
// ---------------------------------------------------------------------------
export function buildHandAssigner(tracks: TrackInfo[], events: NoteEvent[]): HandAssigner {
  const tracksWithNotes = tracks.filter(t => t.noteCount > 0)

  // ── Case 1 & 2: Multiple tracks with notes ──────────────────────────────
  if (tracksWithNotes.length >= 2) {
    const assignment = new Map<number, "left" | "right">()

    // Case 1: keyword detection
    for (const t of tracksWithNotes) {
      if (RIGHT_KEYWORDS.test(t.name)) assignment.set(t.index, "right")
      else if (LEFT_KEYWORDS.test(t.name)) assignment.set(t.index, "left")
    }

    if (assignment.size >= 2) {
      return (e: NoteEvent) => assignment.get(e.track) ?? (e.midi > 60 ? "right" : "left")
    }

    // Case 2: track order — first = right, second = left
    const sorted = [...tracksWithNotes].sort((a, b) => a.index - b.index)
    const rightTrack = sorted[0].index
    const leftTrack = sorted[1].index
    return (e: NoteEvent) => {
      if (e.track === rightTrack) return "right"
      if (e.track === leftTrack) return "left"
      return e.midi > 60 ? "right" : "left"
    }
  }

  // ── Case 3: Single track, multiple channels ──────────────────────────────
  const uniqueChannels = [...new Set(events.map(e => e.channel))].sort((a, b) => a - b)
  if (uniqueChannels.length >= 2) {
    const rightCh = uniqueChannels[0]
    const leftCh = uniqueChannels[1]
    return (e: NoteEvent) => {
      if (e.channel === rightCh) return "right"
      if (e.channel === leftCh) return "left"
      return e.midi > 60 ? "right" : "left"
    }
  }

  // ── Case 4: Voice separation ─────────────────────────────────────────────
  return buildVoiceSeparator(events)
}
