import { MidiNoteEvent, XmlNoteEvent, UnifiedNoteEvent, AlignOptions } from "./types"

const DEFAULTS: Required<AlignOptions> = {
  maxTimeDeltaSec: 0.35,
  chordWindowSec: 0.02,
  preferLongerDuration: false,
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/**
 * Align MIDI events (timing) to MusicXML events (semantics) producing unified events.
 * Algorithm: pitch-first greedy matching within a time window; falls back to sequence alignment per-pitch.
 */
export function alignMidiWithMusicXml(
  midiEvents: MidiNoteEvent[],
  xmlEvents: XmlNoteEvent[],
  opts?: AlignOptions
): { events: UnifiedNoteEvent[]; stats: any } {
  const o = { ...DEFAULTS, ...(opts || {}) }

  // Quick indexes
  const xmlByPitch = new Map<number, XmlNoteEvent[]>()
  for (const xe of xmlEvents) {
    const arr = xmlByPitch.get(xe.midi) ?? []
    arr.push(xe)
    xmlByPitch.set(xe.midi, arr)
  }
  for (const arr of xmlByPitch.values()) arr.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))

  const matchedXmlIds = new Set<string>()
  const xmlNextIndexByPitch = new Map<number, number>()

  const unified: UnifiedNoteEvent[] = []
  let matched = 0

  // Helper: attempt exact/presence-of-start matching first
  for (let i = 0; i < midiEvents.length; i++) {
    const me = midiEvents[i]
    const candidates = xmlByPitch.get(me.midi) ?? []
    let best: { xml?: XmlNoteEvent; score: number; delta?: number } = { score: -1 }

    // Search candidates near midi time
    for (let j = 0; j < candidates.length; j++) {
      const xe = candidates[j]
      if (matchedXmlIds.has(xe.id)) continue
      const xmlStart = xe.startTime ?? NaN
      const delta = Number.isFinite(xmlStart) ? Math.abs(me.startTime - xmlStart) : Infinity
      if (delta <= o.maxTimeDeltaSec) {
        // Score: base for pitch match (already same), time proximity boosts
        let score = 0.6
        // time: linear ramp to +0.34
        const tScore = Math.max(0, 1 - delta / o.maxTimeDeltaSec) * 0.34
        score += tScore
        // chord heuristic: if many MIDI notes in small window, slightly prefer grouped xml
        // (simple: if xml has many with same startTime)
        score += 0 // reserved for future

        if (score > best.score) best = { xml: xe, score, delta }
      }
    }

    // If found good candidate, consume it
    if (best.xml) {
      matchedXmlIds.add(best.xml.id)
      matched++
      const confidence = clamp01(best.score)
      unified.push({
        id: `u-m-${me.id}-${best.xml.id}`,
        midi: me.midi,
        noteName: me.noteName,
        startTime: me.startTime,
        duration: o.preferLongerDuration ? Math.max(me.duration, best.xml.duration ?? 0) : me.duration,
        hand: best.xml.hand ?? "right",
        staff: best.xml.staff,
        voice: best.xml.voice,
        measure: best.xml.measure,
        velocity: me.velocity,
        source: { midiId: me.id, xmlId: best.xml.id, confidence },
      })
      continue
    }

    // No good time-proximate XML: fallback to monotonic per-pitch mapping
    const seqIdx = xmlNextIndexByPitch.get(me.midi) ?? 0
    const pitchList = xmlByPitch.get(me.midi) ?? []
    // advance until find unmatched
    let foundIdx = -1
    for (let k = seqIdx; k < pitchList.length; k++) {
      if (!matchedXmlIds.has(pitchList[k].id)) { foundIdx = k; break }
    }
    if (foundIdx >= 0) {
      const xe = pitchList[foundIdx]
      matchedXmlIds.add(xe.id)
      xmlNextIndexByPitch.set(me.midi, foundIdx + 1)
      const confidence = 0.4 // lower for sequence-only mapping
      matched++
      unified.push({
        id: `u-m-${me.id}-${xe.id}`,
        midi: me.midi,
        noteName: me.noteName,
        startTime: me.startTime,
        duration: o.preferLongerDuration ? Math.max(me.duration, xe.duration ?? 0) : me.duration,
        hand: xe.hand ?? "right",
        staff: xe.staff,
        voice: xe.voice,
        measure: xe.measure,
        velocity: me.velocity,
        source: { midiId: me.id, xmlId: xe.id, confidence },
      })
      continue
    }

    // No XML at all for this pitch – create unified with low confidence and empty xmlId
    unified.push({
      id: `u-m-${me.id}`,
      midi: me.midi,
      noteName: me.noteName,
      startTime: me.startTime,
      duration: me.duration,
      hand: me.midi <= 60 ? "left" : "right",
      source: { midiId: me.id, xmlId: undefined, confidence: 0.2 },
    })
  }

  // For any unmatched XML notes (e.g., editorial notes) we can optionally include them with xml timing
  const unmatchedXml = xmlEvents.filter((x) => !matchedXmlIds.has(x.id))
  for (const xe of unmatchedXml) {
    unified.push({
      id: `u-x-${xe.id}`,
      midi: xe.midi,
      noteName: xe.noteName,
      startTime: xe.startTime ?? 0,
      duration: xe.duration ?? 0,
      hand: xe.hand ?? "right",
      staff: xe.staff,
      voice: xe.voice,
      measure: xe.measure,
      source: { xmlId: xe.id, confidence: 0.2 },
    })
  }

  // Sort unified by startTime then midi
  unified.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)

  const stats = {
    midiCount: midiEvents.length,
    xmlCount: xmlEvents.length,
    matchedCount: matched,
    unmatchedMidi: midiEvents.length - matched,
    unmatchedXml: unmatchedXml.length,
    averageConfidence: unified.length ? unified.reduce((s, e) => s + (e.source.confidence || 0), 0) / unified.length : 0,
  }

  return { events: unified, stats }
}
