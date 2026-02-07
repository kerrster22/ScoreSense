"use client"

import { useEffect, useState } from "react"
import { loadMusicXmlFromUrl } from "../lib/musicmxl"

type MusicXmlState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: any[]; duration: number }
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
        setState({ status: "ready", ...data })
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
