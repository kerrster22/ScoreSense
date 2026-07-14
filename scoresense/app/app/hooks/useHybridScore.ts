"use client"

import { useEffect, useState } from "react"
import { useMidi } from "../lib/useMidi"
import { useMusicXml } from "./useMusicXml"
import { alignMidiWithMusicXml } from "../lib/hybrid/align"
import type { MidiNoteEvent, XmlNoteEvent, UnifiedNoteEvent } from "../lib/hybrid/types"
import type { PedalEvent } from "../lib/midi"
import { buildHandAssigner } from "../lib/handDetection"

type HybridState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      events: UnifiedNoteEvent[]
      duration: number
      stats: any
      pedalEvents?: PedalEvent[]
    }
  | { status: "midi-only"; events: UnifiedNoteEvent[]; duration: number; stats: any; pedalEvents?: PedalEvent[] }
  | { status: "xml-only"; events: UnifiedNoteEvent[]; duration: number; stats: any }
  | { status: "error"; error: string }

export function useHybridScore(opts: { midiUrl?: string | null; xmlUrl?: string | null }) {
  const midiState = useMidi(opts.midiUrl ?? null)
  const xmlState = useMusicXml(opts.xmlUrl ?? null)

  const [state, setState] = useState<HybridState>({ status: "idle" })

  useEffect(() => {
    // Idle when neither provided
    if (!opts.midiUrl && !opts.xmlUrl) {
      setState({ status: "idle" })
      return
    }

    setState({ status: "loading" })

    // Both ready -> align
    if (midiState.status === "ready" && xmlState.status === "ready") {
      const midiEvents = midiState.events.map((e) => ({
        id: e.id,
        midi: e.midi,
        noteName: e.name,
        startTime: e.time,
        duration: e.duration,
        velocity: e.velocity,
        track: e.track,
      }) as MidiNoteEvent)

      const xmlEvents = (xmlState.events as any[]).map((x) => ({
        id: x.id,
        midi: x.midi,
        noteName: x.note,
        staff: x.staff,
        hand: x.hand,
        voice: x.voice,
        measure: x.measure,
        startTime: x.startTime,
        duration: x.duration,
        isGrace: x.isGrace,
        isOrnament: x.isOrnament,
      }) as XmlNoteEvent)

      // The MIDI file's own track/channel split (buildHandAssigner) is often
      // more reliable than the score's engraved staff for hand assignment —
      // scores routinely print a passage on the "wrong" staff for legibility
      // (cross-staff notation), while the MIDI follows the actually-performed
      // hand. Prefer it over XML staff whenever it's a confident split.
      const { assign, confidence: handConfidence } = buildHandAssigner(midiState.tracks ?? [], midiState.events)
      const midiById = new Map(midiState.events.map((e) => [e.id, e]))

      const result = alignMidiWithMusicXml(midiEvents, xmlEvents, {
        midiHandHint: (id) => {
          const e = midiById.get(id)
          return e ? assign(e) : undefined
        },
        preferMidiHand: handConfidence === "high",
      })
      const duration = midiState.duration ?? xmlState.duration
      setState({ status: "ready", events: result.events, duration, stats: result.stats, pedalEvents: midiState.pedalEvents })
      return
    }

    // MIDI only
    if (midiState.status === "ready" && (xmlState.status === "idle" || !opts.xmlUrl)) {
      const { assign, confidence: handConfidence } = buildHandAssigner(midiState.tracks ?? [], midiState.events)
      const confidence = handConfidence === "high" ? 0.80 : 0.50
      const events = midiState.events.map((e) => ({
        id: `m-${e.id}`,
        midi: e.midi,
        noteName: e.name,
        startTime: e.time,
        duration: e.duration,
        hand: assign(e),
        velocity: e.velocity,
        source: { midiId: e.id, xmlId: undefined, confidence },
      }))
      setState({ status: "midi-only", events, duration: midiState.duration, stats: { midiCount: events.length }, pedalEvents: midiState.pedalEvents })
      return
    }

    // XML only
    if (xmlState.status === "ready" && (midiState.status === "idle" || !opts.midiUrl)) {
      const events = (xmlState.events as any[]).map((x) => ({
        id: `x-${x.id}`,
        midi: x.midi,
        noteName: x.note,
        startTime: x.startTime,
        duration: x.duration,
        hand: x.hand,
        staff: x.staff,
        voice: x.voice,
        measure: x.measure,
        fingering: x.fingering,
        source: { xmlId: x.id, confidence: 0.3 },
      }))
      setState({ status: "xml-only", events, duration: xmlState.duration, stats: { xmlCount: events.length } })
      return
    }

    // Errors
    if (midiState.status === "error") setState({ status: "error", error: midiState.error })
    else if (xmlState.status === "error") setState({ status: "error", error: xmlState.error })
  }, [opts.midiUrl, opts.xmlUrl, midiState, xmlState])

  return state
}
