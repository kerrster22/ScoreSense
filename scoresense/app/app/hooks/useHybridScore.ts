"use client"

import { useEffect, useState } from "react"
import { useMidi } from "../lib/useMidi"
import { useMusicXml } from "./useMusicXml"
import { alignMidiWithMusicXml } from "../lib/hybrid/align"
import type { MidiNoteEvent, XmlNoteEvent, UnifiedNoteEvent } from "../lib/hybrid/types"

type HybridState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      events: UnifiedNoteEvent[]
      duration: number
      stats: any
    }
  | { status: "midi-only"; events: UnifiedNoteEvent[]; duration: number; stats: any }
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

      const result = alignMidiWithMusicXml(midiEvents, xmlEvents)
      const duration = midiState.duration ?? xmlState.duration
      setState({ status: "ready", events: result.events, duration, stats: result.stats })
      return
    }

    // MIDI only
    if (midiState.status === "ready" && (xmlState.status === "idle" || !opts.xmlUrl)) {
      const events = midiState.events.map((e) => ({
        id: `m-${e.id}`,
        midi: e.midi,
        noteName: e.name,
        startTime: e.time,
        duration: e.duration,
        hand: e.midi <= 60 ? "left" : "right",
        velocity: e.velocity,
        source: { midiId: e.id, xmlId: undefined, confidence: 0.25 },
      }))
      setState({ status: "midi-only", events, duration: midiState.duration, stats: { midiCount: events.length } })
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
