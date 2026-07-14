"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, FileWarning } from "lucide-react"

interface NotationViewProps {
  /** URL (blob or http) of the piece's raw MusicXML source; null when unavailable. */
  xmlUrl: string | null
  /** Current 1-based measure number, used to keep the cursor roughly in sync with playback. */
  currentBar: number | null
}

/**
 * Standard notation view rendered via OpenSheetMusicDisplay. Only available
 * for pieces that have a MusicXML source — MIDI-only pieces carry no
 * engraving data (beaming, key signature, etc.) to render from.
 *
 * The cursor is synced at measure granularity only: OSMD's cursor advances
 * per voice-entry, and mapping our playback-seconds precisely onto that
 * would require re-deriving OSMD's internal tempo/timestamp model. Jumping
 * cursor.nextMeasure()/previousMeasure() to track the currently-playing bar
 * is a much simpler, still useful approximation.
 */
export function NotationView({ xmlUrl, currentBar }: NotationViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const osmdRef = useRef<any>(null)
  const lastMeasureIdxRef = useRef<number>(0)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    osmdRef.current = null
    lastMeasureIdxRef.current = 0

    if (!xmlUrl || !containerRef.current) {
      setStatus("idle")
      return
    }

    setStatus("loading")
    setError(null)

    ;(async () => {
      try {
        const mod = await import("opensheetmusicdisplay")
        const res = await fetch(xmlUrl)
        if (!res.ok) throw new Error(`Failed to fetch MusicXML (${res.status})`)
        const xmlText = await res.text()
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ""
        const osmd = new mod.OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,
          followCursor: true,
          backend: "svg",
        })
        await osmd.load(xmlText)
        if (cancelled) return
        osmd.render()
        osmd.cursor.show()
        osmdRef.current = osmd
        lastMeasureIdxRef.current = 0
        setStatus("ready")
      } catch (e: any) {
        if (cancelled) return
        console.error("Notation render error:", e)
        setError(e?.message ? String(e.message) : "Failed to render notation")
        setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [xmlUrl])

  // Keep the cursor roughly tracking the currently-playing bar.
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd || status !== "ready" || currentBar == null) return
    const targetIdx = Math.max(0, currentBar - 1)
    const cursor = osmd.cursor
    try {
      let guard = 0
      while (cursor.iterator.CurrentMeasureIndex < targetIdx && !cursor.iterator.EndReached && guard < 500) {
        cursor.nextMeasure()
        guard++
      }
      while (cursor.iterator.CurrentMeasureIndex > targetIdx && !cursor.iterator.FrontReached && guard < 500) {
        cursor.previousMeasure()
        guard++
      }
      lastMeasureIdxRef.current = cursor.iterator.CurrentMeasureIndex
    } catch (e) {
      // OSMD cursor navigation can throw at score boundaries / during re-render; non-fatal.
    }
  }, [currentBar, status])

  if (!xmlUrl) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Standard notation is only available for pieces loaded from a MusicXML file.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="py-4">
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Rendering notation…
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <FileWarning className="h-5 w-5" />
            {error ?? "Failed to render notation"}
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full overflow-x-auto"
          style={{ display: status === "ready" ? "block" : "none" }}
        />
      </CardContent>
    </Card>
  )
}
