"use client"

import { useEffect, useState } from "react"
import { loadMusicXmlFromUrl, type MusicXmlParseResult, type MeasureMapEntry, type ParserStats } from "../lib/musicmxl"

type MusicXmlState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      events: MusicXmlParseResult["events"]
      duration: number
      measureMap: MeasureMapEntry[]
      detectedBpm?: number
      timeSignature?: { beats: number; beatType: number }
      stats?: ParserStats
    }
  | { status: "error"; error: string }

export function useMusicXml(url: string | null, opts?: { bpm?: number }) {
  const [state, setState] = useState<MusicXmlState>({ status: "idle" })

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        setState({ status: "loading" })
        const data = await loadMusicXmlFromUrl(url, opts)
        if (cancelled) return
        setState({
          status: "ready",
          events: data.events,
          duration: data.duration,
          measureMap: data.measureMap,
          detectedBpm: data.detectedBpm,
          timeSignature: data.timeSignature,
          stats: data.stats,
        })
      } catch (e: any) {
        if (cancelled) return
        setState({
          status: "error",
          error: e?.message ? String(e.message) : "Unknown MusicXML error",
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url, opts?.bpm])

  return state
}
