"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import type { Note, PianoKey, LoopRange } from "./types"

interface VisualizerPanelProps {
  notes: Note[]
  pianoKeys: PianoKey[]
  isComplete: boolean
  playbackTime: number
  handSelection: string
  showNoteNames: boolean
  currentLoop: LoopRange | null
  tempo: number

  keyboardMode?: "fit" | "scroll"
  keyboardZoom?: number
  keyboardScrollLeft?: number
  keyboardViewportWidth?: number
}

type KeyPos = { left: number; width: number; isBlack: boolean } // pixels in scroll-mode, % in fit-mode

const VISUALIZER_HEIGHT = 320
const LOOKAHEAD_SEC = 6
const LOOKBEHIND_SEC = 1.25

// IMPORTANT: pixels-per-second is a visual constant (do NOT tempo-scale this)
// because playbackTime is already tempo-scaled elsewhere.
const BASE_PPS = 120

const MIN_NOTE_PX = 26

// “Hit feel” tuning
const HIT_EARLY = 0.03 // allow a tiny early glow
const HIT_LATE = 0.06  // and a tiny late glow

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function binarySearchFirstIndex(notes: Note[], time: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (notes[mid].startTime < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

function findStartIndexIncludingSustains(notes: Note[], windowStart: number) {
  // start near windowStart
  let idx = Math.max(0, binarySearchFirstIndex(notes, windowStart))
  // walk backwards to include notes that started earlier but are still sounding
  while (idx > 0) {
    const prev = notes[idx - 1]
    const prevEnd = prev.startTime + prev.duration
    // if the previous note overlaps the window, include it
    if (prevEnd >= windowStart) idx--
    else break
  }
  return idx
}


export function VisualizerPanel({
  notes,
  pianoKeys,
  isComplete,
  playbackTime,
  handSelection,
  showNoteNames,
  currentLoop,
  tempo,
  keyboardMode = "fit",
  keyboardZoom = 1,
  keyboardScrollLeft = 0,
  keyboardViewportWidth,
}: VisualizerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const filteredNotes: Note[] = useMemo(() => {
    const base =
      handSelection === "both"
        ? notes
        : notes.filter((n) => n.hand === (handSelection === "right" ? "right" : "left"))
    return [...base].sort((a, b) => a.startTime - b.startTime)
  }, [notes, handSelection])

  const keyPositions = useMemo(() => {
    const whiteKeys = pianoKeys.filter((k) => !k.isBlack)
    const whiteCount = Math.max(1, whiteKeys.length)

    if (keyboardMode === "fit") {
      const keyWidthPct = 100 / whiteCount
      const map: Record<string, KeyPos> = {}
      for (let i = 0; i < pianoKeys.length; i++) {
        const k = pianoKeys[i]
        const whiteIndex = pianoKeys.slice(0, i + 1).filter((x) => !x.isBlack).length
        const leftPct = k.isBlack
          ? (whiteIndex - 0.5) * keyWidthPct - keyWidthPct * 0.15
          : (whiteIndex - 1) * keyWidthPct
        const widthPct = k.isBlack ? keyWidthPct * 0.6 : keyWidthPct
        map[k.note] = { left: leftPct, width: widthPct, isBlack: k.isBlack }
      }
      return map
    }

    // scroll: pixels (zoom matters here)
    const whiteKeyPx = 22 * keyboardZoom
    const blackKeyPx = whiteKeyPx * 0.62
    const map: Record<string, KeyPos> = {}
    for (let i = 0; i < pianoKeys.length; i++) {
      const k = pianoKeys[i]
      const whiteIndex = pianoKeys.slice(0, i + 1).filter((x) => !x.isBlack).length
      const leftPx = k.isBlack
        ? (whiteIndex - 0.5) * whiteKeyPx - blackKeyPx / 2
        : (whiteIndex - 1) * whiteKeyPx
      const widthPx = k.isBlack ? blackKeyPx : whiteKeyPx
      map[k.note] = { left: leftPx, width: widthPx, isBlack: k.isBlack }
    }
    return map
  }, [pianoKeys, keyboardMode, keyboardZoom])

  // HiDPI canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = parent.clientWidth
      const h = VISUALIZER_HEIGHT

      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const draw = () => {
      const w = canvas.clientWidth
      const h = VISUALIZER_HEIGHT

      ctx.clearRect(0, 0, w, h)

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, "rgba(255,255,255,0.03)")
      bg.addColorStop(1, "rgba(255,255,255,0.00)")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // guide lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)"
      ctx.lineWidth = 1
      for (let i = 1; i <= 8; i++) {
        const y = (h * i) / 8
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // HIT LINE
      const hitLineY = h - 28

      // approach zone glow (helps perception of “not yet hit”)
      const approach = ctx.createLinearGradient(0, hitLineY - 70, 0, hitLineY + 20)
      approach.addColorStop(0, "rgba(168,85,247,0)")
      approach.addColorStop(0.6, "rgba(168,85,247,0.10)")
      approach.addColorStop(1, "rgba(168,85,247,0)")
      ctx.fillStyle = approach
      ctx.fillRect(0, hitLineY - 70, w, 90)

      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.20)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, hitLineY)
      ctx.lineTo(w, hitLineY)
      ctx.stroke()
      ctx.restore()

      // empty state
      if (!isComplete) {
        ctx.globalAlpha = 0.12
        const demo = filteredNotes.slice(0, 10)
        for (const n of demo) {
          const pos = keyPositions[n.note]
          if (!pos) continue

          let x = 0
          let ww = 0
          if (keyboardMode === "fit") {
            x = (pos.left / 100) * w
            ww = (pos.width / 100) * w
          } else {
            x = pos.left - keyboardScrollLeft
            ww = pos.width
          }

          const y = clamp(40 + n.startTime * 28, 10, h - 60)
          const hh = clamp(n.duration * 70, MIN_NOTE_PX, 120)

          const isRight = n.hand === "right"
          const grad = ctx.createLinearGradient(x, y, x + ww, y + hh)
          grad.addColorStop(0, isRight ? "rgba(168,85,247,0.65)" : "rgba(249,115,22,0.65)")
          grad.addColorStop(1, isRight ? "rgba(236,72,153,0.35)" : "rgba(245,158,11,0.35)")
          ctx.fillStyle = grad
          roundRect(ctx, x, y, ww, hh, 10)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        const text = "Your interactive piano tutorial will appear here."
        ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system"
        const padX = 14
        const tw = ctx.measureText(text).width
        const bx = (w - (tw + padX * 2)) / 2
        const by = (h - 34) / 2
        ctx.fillStyle = "rgba(0,0,0,0.45)"
        roundRect(ctx, bx, by, tw + padX * 2, 34, 10)
        ctx.fill()
        ctx.fillStyle = "rgba(255,255,255,0.78)"
        ctx.fillText(text, bx + padX, by + 22)

        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // notes
      const pps = BASE_PPS // ✅ do NOT scale by tempo here
      const windowStart = playbackTime - LOOKBEHIND_SEC
      const windowEnd = playbackTime + LOOKAHEAD_SEC
      const startIdx = findStartIndexIncludingSustains(filteredNotes, windowStart)


      const viewW = keyboardViewportWidth ?? w

      for (let i = startIdx; i < filteredNotes.length; i++) {
        const n = filteredNotes[i]
        if (n.startTime > windowEnd + 1) break

        const pos = keyPositions[n.note]
        if (!pos) continue

        const noteHeight = Math.max(MIN_NOTE_PX, n.duration * pps)
        const y = hitLineY - (n.startTime - playbackTime) * pps - noteHeight
        if (y > h || y + noteHeight < 0) continue

        let x = 0
        let wwRaw = 0
        if (keyboardMode === "fit") {
          x = (pos.left / 100) * w
          wwRaw = (pos.width / 100) * w
        } else {
          x = pos.left - keyboardScrollLeft
          wwRaw = pos.width
          if (x + wwRaw < 0 || x > viewW) continue
        }

        const widen = pos.isBlack ? 1.15 : 1.08
        const ww = clamp(wwRaw * widen, 8, wwRaw * 1.25)
        const xCentered = x - (ww - wwRaw) / 2

        // ✅ tighter “hit” highlight (prevents “early” feel)
        const isHit =
          playbackTime >= n.startTime - HIT_EARLY &&
          playbackTime < n.startTime + HIT_LATE

        // also track sustain separately (optional)
        const isSustained =
          playbackTime >= n.startTime &&
          playbackTime < n.startTime + n.duration

        const isRight = n.hand === "right"

        ctx.save()
        ctx.shadowBlur = isHit ? 22 : isSustained ? 16 : 10
        ctx.shadowColor = isRight ? "rgba(168,85,247,0.62)" : "rgba(249,115,22,0.62)"

        const grad = ctx.createLinearGradient(xCentered, y, xCentered + ww, y + noteHeight)
        if (isRight) {
          grad.addColorStop(0, isHit ? "rgba(168,85,247,0.98)" : "rgba(168,85,247,0.78)")
          grad.addColorStop(1, isHit ? "rgba(236,72,153,0.74)" : "rgba(236,72,153,0.48)")
        } else {
          grad.addColorStop(0, isHit ? "rgba(249,115,22,0.98)" : "rgba(249,115,22,0.78)")
          grad.addColorStop(1, isHit ? "rgba(245,158,11,0.74)" : "rgba(245,158,11,0.48)")
        }

        ctx.fillStyle = grad
        roundRect(ctx, xCentered, y, ww, noteHeight, 10)
        ctx.fill()

        // outline a bit stronger when hit
        ctx.shadowBlur = 0
        ctx.strokeStyle = isHit ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Note label (auto fit)
        if (showNoteNames) {
          const labelAlpha = tempo > 80 ? 0.55 : 0.9
          ctx.globalAlpha = labelAlpha

          const label = n.note
          const padding = 6
          const maxTextWidth = ww - padding * 2

          let fontSize = Math.min(13, Math.max(10, noteHeight / 3))
          ctx.textBaseline = "middle"
          ctx.textAlign = "center"

          while (fontSize >= 9) {
            ctx.font = `700 ${Math.floor(fontSize)}px ui-sans-serif, system-ui, -apple-system`
            if (ctx.measureText(label).width <= maxTextWidth) break
            fontSize -= 1
          }

          if (fontSize >= 9 && maxTextWidth > 10) {
            ctx.fillStyle = "rgba(0,0,0,0.55)"
            ctx.fillText(label, xCentered + ww / 2 + 0.6, y + noteHeight / 2 + 0.6)
            ctx.fillStyle = "rgba(255,255,255,0.92)"
            ctx.fillText(label, xCentered + ww / 2, y + noteHeight / 2)
          }

          ctx.globalAlpha = 1
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [
    isComplete,
    filteredNotes,
    keyPositions,
    playbackTime,
    tempo,
    showNoteNames,
    keyboardMode,
    keyboardZoom,
    keyboardScrollLeft,
    keyboardViewportWidth,
  ])

  return (
    <div className="relative h-80 bg-secondary/30 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {currentLoop && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-xs">
            Looping bars {currentLoop.start}-{currentLoop.end}
          </Badge>
        </div>
      )}
    </div>
  )
}
