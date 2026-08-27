"use client"

import React, { useRef, useEffect, useCallback } from "react"
import type { Note, PatternInsight } from "@/types/practice"
import type { MeasureMapEntry } from "@/lib/musicmxl"

interface PieceTimelineProps {
  notes: Note[]
  duration: number
  playbackTime: number
  loopStartSec: number | null
  loopEndSec: number | null
  measureMap: MeasureMapEntry[]
  patternInsights: PatternInsight[]
  onSeek: (seconds: number) => void
  onSetTimeLoop: (startSec: number, endSec: number) => void
}

const CANVAS_HEIGHT = 80
const MIDI_MIN = 21
const MIDI_MAX = 108

export function PieceTimeline({
  notes,
  duration,
  playbackTime,
  loopStartSec,
  loopEndSec,
  measureMap,
  patternInsights,
  onSeek,
  onSetTimeLoop,
}: PieceTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<number | null>(null)
  const dragCurrentRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  const timeToX = useCallback(
    (t: number, width: number) => (duration > 0 ? (t / duration) * width : 0),
    [duration]
  )

  const xToTime = useCallback(
    (x: number, width: number) =>
      width > 0 ? Math.max(0, Math.min(duration, (x / width) * duration)) : 0,
    [duration]
  )

  const midiToY = (midi: number) => {
    const clamped = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi))
    return (1 - (clamped - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)) * (CANVAS_HEIGHT - 4) + 2
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const W = rect.width
    if (W <= 0) return

    canvas.width = W * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = "#111113"
    ctx.fillRect(0, 0, W, CANVAS_HEIGHT)

    if (duration <= 0) return

    // ── Difficulty heatmap (bottom 12px strip) ─────────────────────────────
    const BUCKET_SEC = 2
    const numBuckets = Math.ceil(duration / BUCKET_SEC)
    const density = new Float32Array(numBuckets)
    notes.forEach((n) => {
      const b = Math.floor(n.startTime / BUCKET_SEC)
      if (b >= 0 && b < numBuckets) density[b]++
    })
    const maxDensity = Math.max(...density, 1)
    for (let b = 0; b < numBuckets; b++) {
      const ratio = density[b] / maxDensity
      if (ratio < 0.2) continue
      const x1 = timeToX(b * BUCKET_SEC, W)
      const x2 = timeToX(Math.min((b + 1) * BUCKET_SEC, duration), W)
      const alpha = ratio * 0.35
      ctx.fillStyle = `rgba(251,146,60,${alpha})`
      ctx.fillRect(x1, CANVAS_HEIGHT - 12, x2 - x1, 12)
    }

    // ── Pattern insight bands ──────────────────────────────────────────────
    patternInsights.forEach((insight) => {
      if (!measureMap.length) return
      const s = measureMap.find((m) => m.measure === insight.loopStart)
      const e = measureMap.find((m) => m.measure === insight.loopEnd)
      if (!s || !e) return
      const x1 = timeToX(s.startSec, W)
      const x2 = timeToX(e.endSec, W)
      ctx.fillStyle =
        insight.type === "exact"
          ? "rgba(236,72,153,0.08)"
          : "rgba(168,85,247,0.08)"
      ctx.fillRect(x1, 0, x2 - x1, CANVAS_HEIGHT)
    })

    // ── Measure ticks ──────────────────────────────────────────────────────
    ctx.save()
    ctx.font = "9px system-ui, sans-serif"
    ctx.textAlign = "center"
    measureMap.forEach((m) => {
      const x = timeToX(m.startSec, W)
      const isFourth = m.measure % 4 === 1
      ctx.fillStyle = isFourth ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"
      ctx.fillRect(x, 0, 1, isFourth ? CANVAS_HEIGHT : CANVAS_HEIGHT * 0.4)
      if (isFourth && W / numBuckets > 18) {
        ctx.fillStyle = "rgba(255,255,255,0.35)"
        ctx.fillText(String(m.measure), x + 1, 9)
      }
    })
    ctx.restore()

    // ── Notes ──────────────────────────────────────────────────────────────
    notes.forEach((note) => {
      const midi = note.midi ?? 60
      const x = timeToX(note.startTime, W)
      const noteW = Math.max(1.5, timeToX(note.duration, W))
      const y = midiToY(midi)
      const alpha = note.velocity != null ? Math.max(0.35, Math.min(1, note.velocity)) : 0.65
      if (note.hand === "right") {
        ctx.fillStyle = `rgba(236,72,153,${alpha})`
      } else if (note.hand === "left") {
        ctx.fillStyle = `rgba(168,85,247,${alpha})`
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
      }
      ctx.fillRect(x, y - 1, noteW, 2)
    })

    // ── Loop region ────────────────────────────────────────────────────────
    const dStart = dragStartRef.current
    const dCurrent = dragCurrentRef.current
    const showDrag = isDraggingRef.current && dStart !== null && dCurrent !== null
    const activeStart = showDrag ? Math.min(dStart!, dCurrent!) : loopStartSec
    const activeEnd = showDrag ? Math.max(dStart!, dCurrent!) : loopEndSec

    if (activeStart !== null && activeEnd !== null && activeEnd > activeStart) {
      const x1 = timeToX(activeStart, W)
      const x2 = timeToX(activeEnd, W)

      // Fill
      ctx.fillStyle = "rgba(139,92,246,0.12)"
      ctx.fillRect(x1, 0, x2 - x1, CANVAS_HEIGHT)

      // Accent top/bottom border
      ctx.fillStyle = "rgba(139,92,246,0.70)"
      ctx.fillRect(x1, 0, x2 - x1, 2)
      ctx.fillRect(x1, CANVAS_HEIGHT - 2, x2 - x1, 2)

      // Side edges
      ctx.strokeStyle = "rgba(139,92,246,0.60)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, 0)
      ctx.lineTo(x1, CANVAS_HEIGHT)
      ctx.moveTo(x2, 0)
      ctx.lineTo(x2, CANVAS_HEIGHT)
      ctx.stroke()

      // Bar number labels at loop edges
      if (!showDrag && measureMap.length > 0) {
        const startBar = measureMap.reduce((best, m) =>
          Math.abs(m.startSec - activeStart) < Math.abs(best.startSec - activeStart) ? m : best
        )
        const endBar = measureMap.reduce((best, m) =>
          Math.abs(m.endSec - activeEnd) < Math.abs(best.endSec - activeEnd) ? m : best
        )
        ctx.save()
        ctx.font = "bold 9px system-ui, sans-serif"
        ctx.fillStyle = "rgba(167,139,250,0.9)"
        ctx.textAlign = "left"
        ctx.fillText(`${startBar.measure}`, x1 + 3, CANVAS_HEIGHT - 4)
        ctx.textAlign = "right"
        ctx.fillText(`${endBar.measure}`, x2 - 3, CANVAS_HEIGHT - 4)
        ctx.restore()
      }
    }

    // ── Playhead ───────────────────────────────────────────────────────────
    const phX = timeToX(playbackTime, W)
    ctx.fillStyle = "rgba(255,255,255,0.90)"
    ctx.fillRect(phX - 1, 0, 2, CANVAS_HEIGHT)
    ctx.beginPath()
    ctx.moveTo(phX - 5, 0)
    ctx.lineTo(phX + 5, 0)
    ctx.lineTo(phX, 7)
    ctx.closePath()
    ctx.fill()
  })

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const t = xToTime(e.clientX - rect.left, rect.width)
    dragStartRef.current = t
    dragCurrentRef.current = t
    isDraggingRef.current = false
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current === null) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const t = xToTime(e.clientX - rect.left, rect.width)
    dragCurrentRef.current = t
    if (Math.abs(t - dragStartRef.current) > 0.3) isDraggingRef.current = true
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const t = xToTime(e.clientX - rect.left, rect.width)

    if (isDraggingRef.current && dragStartRef.current !== null) {
      const start = Math.min(dragStartRef.current, t)
      const end = Math.max(dragStartRef.current, t)
      if (end - start > 0.3) onSetTimeLoop(start, end)
    } else {
      onSeek(t)
    }

    dragStartRef.current = null
    dragCurrentRef.current = null
    isDraggingRef.current = false
  }

  const handleMouseLeave = () => {
    dragStartRef.current = null
    isDraggingRef.current = false
  }

  return (
    <div
      className="w-full rounded-md overflow-hidden border border-border/30"
      style={{ height: CANVAS_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair select-none"
        style={{ height: CANVAS_HEIGHT, display: "block" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}
