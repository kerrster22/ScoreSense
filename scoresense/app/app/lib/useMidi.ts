"use client"

import { useEffect, useState } from "react"
import { NoteEvent, PedalEvent, loadMidiFromUrl } from "./midi";

type MidiLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: NoteEvent[]; duration: number; bpm?: number; pedalEvents?: PedalEvent[] }
  | { status: "error"; error: string }

export function useMidi(url: string | null) {
  const [state, setState] = useState<MidiLoadState>({ status: "idle" })

  useEffect(() => {
    if (!url) return
    let cancelled = false

    ;(async () => {
      try {
        setState({ status: "loading" })
        const data = await loadMidiFromUrl(url)
        if (cancelled) return
        setState({ status: "ready", ...data })
      } catch (e) {
        if (cancelled) return
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Unknown error",
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url])

  return state
}
