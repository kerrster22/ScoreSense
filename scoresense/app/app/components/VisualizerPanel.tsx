"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Maximize2, Minimize2 } from "lucide-react"
import type { Note, PianoKey, LoopRange } from "./types"

// =============================================================================
// CONFIG
// =============================================================================

const VFX_CONFIG = {
  /** "bloom" | "pulseTrail" | "keyGlowSparks" */
  hitEffectStyle: "bloom" as "bloom" | "pulseTrail" | "keyGlowSparks",

  // Bloom envelope (ms)
  attackMs: 35,
  releaseMs: 450,
  peakAlpha: 0.88,

  // Particles
  particleBaseCount: 5,
  particleCountScale: 1.0,
  particleLifetimeMs: 500,
  particleSpeed: 0.6,

  // Glow
  glowIntensityScale: 1.0,
  glowSpriteSize: 64,

  // Note colors
  rhColor: { r: 236, g: 72, b: 153 },
  rhGlow: { r: 168, g: 85, b: 247 },
  lhColor: { r: 99, g: 102, b: 241 },
  lhGlow: { r: 129, g: 140, b: 248 },
} as const

// =============================================================================
// TYPES
// =============================================================================

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

type KeyPos = { left: number; width: number; isBlack: boolean }

interface HitEffect {
  noteId: number
  x: number
  y: number
  w: number
  isRight: boolean
  startMs: number
  phase: "attack" | "release" | "done"
  peakAlpha: number
}

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  startMs: number
  lifetimeMs: number
  size: number
  isRight: boolean
}

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

const NORMAL_HEIGHT = 320
const FULLSCREEN_BOTTOM_PAD = 120 // room for keyboard below
const LOOKAHEAD_SEC = 6
const LOOKAHEAD_SEC_FS = 10 // more lead time in fullscreen
const LOOKBEHIND_SEC = 1.25
const BASE_PPS = 120
const MIN_NOTE_PX = 26
const HIT_EARLY = 0.04
const HIT_LATE = 0.08

const MAX_HIT_EFFECTS = 64
const MAX_PARTICLES = 120

// =============================================================================
// EASING
// =============================================================================

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(t: number): number {
  return t * t * t
}

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

// =============================================================================
// BINARY SEARCH (for note culling)
// =============================================================================

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
  let idx = Math.max(0, binarySearchFirstIndex(notes, windowStart))
  while (idx > 0) {
    const prev = notes[idx - 1]
    if (prev.startTime + prev.duration >= windowStart) idx--
    else break
  }
  return idx
}

// =============================================================================
// CACHED GLOW SPRITE
// =============================================================================

function createGlowSprite(size: number, r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const ctx = c.getContext("2d")!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${g},${b},0.7)`)
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.25)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return c
}

// =============================================================================
// CACHED BACKGROUND SPRITE (painted once per resize, not every frame)
// =============================================================================

function paintBackgroundSprite(canvas: HTMLCanvasElement, w: number, h: number) {
  const ctx = canvas.getContext("2d")!
  canvas.width = w
  canvas.height = h

  // Deep dark base
  ctx.fillStyle = "#0a0a0f"
  ctx.fillRect(0, 0, w, h)

  // Subtle gradient overlay
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
  bgGrad.addColorStop(0, "rgba(20, 10, 40, 0.3)")
  bgGrad.addColorStop(0.5, "rgba(5, 5, 15, 0.0)")
  bgGrad.addColorStop(1, "rgba(10, 5, 30, 0.2)")
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  // Vignette
  const vigGrad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.3,
    w / 2, h / 2, Math.max(w, h) * 0.7
  )
  vigGrad.addColorStop(0, "rgba(0,0,0,0)")
  vigGrad.addColorStop(1, "rgba(0,0,0,0.4)")
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, w, h)

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.035)"
  ctx.lineWidth = 1
  for (let i = 1; i <= 8; i++) {
    const y = (h * i) / 8
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

// =============================================================================
// PARTICLE POOL
// =============================================================================

function createParticlePool(count: number): Particle[] {
  const pool: Particle[] = []
  for (let i = 0; i < count; i++) {
    pool.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      alpha: 0, startMs: 0, lifetimeMs: 0, size: 0, isRight: true,
    })
  }
  return pool
}

function emitParticles(pool: Particle[], x: number, y: number, w: number, isRight: boolean, nowMs: number) {
  const count = Math.round(VFX_CONFIG.particleBaseCount * VFX_CONFIG.particleCountScale)
  let spawned = 0
  for (let i = 0; i < pool.length && spawned < count; i++) {
    if (!pool[i].active) {
      const p = pool[i]
      p.active = true
      p.x = x + Math.random() * w
      p.y = y + (Math.random() - 0.5) * 4
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6
      const speed = (0.3 + Math.random() * 0.7) * VFX_CONFIG.particleSpeed
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.alpha = 0.6 + Math.random() * 0.4
      p.startMs = nowMs
      p.lifetimeMs = VFX_CONFIG.particleLifetimeMs * (0.6 + Math.random() * 0.4)
      p.size = 1.5 + Math.random() * 2
      p.isRight = isRight
      spawned++
    }
  }
}

// =============================================================================
// HIT EFFECT POOL
// =============================================================================

function createHitEffectPool(count: number): HitEffect[] {
  const pool: HitEffect[] = []
  for (let i = 0; i < count; i++) {
    pool.push({
      noteId: -1, x: 0, y: 0, w: 0, isRight: true,
      startMs: 0, phase: "done", peakAlpha: 0,
    })
  }
  return pool
}

function spawnHitEffect(pool: HitEffect[], noteId: number, x: number, y: number, w: number, isRight: boolean, nowMs: number) {
  for (const e of pool) {
    if (e.noteId === noteId && e.phase !== "done") return
  }
  for (const e of pool) {
    if (e.phase === "done") {
      e.noteId = noteId
      e.x = x
      e.y = y
      e.w = w
      e.isRight = isRight
      e.startMs = nowMs
      e.phase = "attack"
      e.peakAlpha = VFX_CONFIG.peakAlpha
      return
    }
  }
}

function computeHitAlpha(effect: HitEffect, nowMs: number): number {
  const elapsed = nowMs - effect.startMs
  const { attackMs, releaseMs } = VFX_CONFIG

  if (effect.phase === "attack") {
    if (elapsed >= attackMs) {
      effect.phase = "release"
      effect.startMs = nowMs
      return effect.peakAlpha
    }
    return easeInCubic(elapsed / attackMs) * effect.peakAlpha
  }

  if (effect.phase === "release") {
    if (elapsed >= releaseMs) {
      effect.phase = "done"
      return 0
    }
    return (1 - easeOutCubic(elapsed / releaseMs)) * effect.peakAlpha
  }

  return 0
}

// =============================================================================
// COMPONENT
// =============================================================================

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
  // ---- Refs: stable rAF loop, no restarts on fast-changing values ----
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const playbackTimeRef = useRef(playbackTime)
  playbackTimeRef.current = playbackTime
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const showNoteNamesRef = useRef(showNoteNames)
  showNoteNamesRef.current = showNoteNames
  const scrollLeftRef = useRef(keyboardScrollLeft)
  scrollLeftRef.current = keyboardScrollLeft
  const viewportWidthRef = useRef(keyboardViewportWidth)
  viewportWidthRef.current = keyboardViewportWidth

  // VFX pools (never cause re-renders)
  const hitPoolRef = useRef<HitEffect[]>(createHitEffectPool(MAX_HIT_EFFECTS))
  const particlePoolRef = useRef<Particle[]>(createParticlePool(MAX_PARTICLES))
  const glowSpritesRef = useRef<{ rh: HTMLCanvasElement; lh: HTMLCanvasElement } | null>(null)
  const prevHitSetRef = useRef<Set<number>>(new Set())

  // Cached background sprite (repainted only on resize)
  const bgSpriteRef = useRef<HTMLCanvasElement | null>(null)
  const bgSizeRef = useRef({ w: 0, h: 0 })

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ---- Derived data (only recompute on structural changes) ----
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

  // ---- Glow sprites (once) ----
  useEffect(() => {
    const s = VFX_CONFIG.glowSpriteSize
    glowSpritesRef.current = {
      rh: createGlowSprite(s, VFX_CONFIG.rhGlow.r, VFX_CONFIG.rhGlow.g, VFX_CONFIG.rhGlow.b),
      lh: createGlowSprite(s, VFX_CONFIG.lhGlow.r, VFX_CONFIG.lhGlow.g, VFX_CONFIG.lhGlow.b),
    }
    bgSpriteRef.current = document.createElement("canvas")
  }, [])

  // ---- HiDPI canvas sizing via ResizeObserver ----
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight

      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Repaint background sprite on resize
      if (bgSpriteRef.current) {
        paintBackgroundSprite(bgSpriteRef.current, w, h)
        bgSizeRef.current = { w, h }
      }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [isFullscreen])

  // ---- Fullscreen API ----
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // ---- Clear VFX on loop change / seek ----
  useEffect(() => {
    for (const e of hitPoolRef.current) e.phase = "done"
    for (const p of particlePoolRef.current) p.active = false
    prevHitSetRef.current.clear()
  }, [currentLoop])

  // ---- Main draw loop (stable, no playbackTime in deps) ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Pre-compute a fixed label font (avoid per-note font-sizing loop)
    const labelFont = "700 11px ui-sans-serif,system-ui,-apple-system"

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight || NORMAL_HEIGHT
      const nowMs = performance.now()
      const curTime = playbackTimeRef.current
      const curTempo = tempoRef.current
      const curShowNames = showNoteNamesRef.current
      const curScrollLeft = scrollLeftRef.current
      const curViewportW = viewportWidthRef.current

      ctx.clearRect(0, 0, w, h)

      // =================================================================
      // PASS 1: Background (cached offscreen sprite -- zero gradient work)
      // =================================================================
      const bgSprite = bgSpriteRef.current
      if (bgSprite && bgSizeRef.current.w === w && bgSizeRef.current.h === h) {
        ctx.drawImage(bgSprite, 0, 0)
      } else {
        // Fallback: solid fill (should rarely hit after first frame)
        ctx.fillStyle = "#0a0a0f"
        ctx.fillRect(0, 0, w, h)
      }

      // =================================================================
      // PASS 2: Strike line
      // =================================================================
      const hitLineY = h - 28

      // Soft glow (cached sprite would be overkill for 1 gradient)
      const strikeGlow = ctx.createLinearGradient(0, hitLineY - 20, 0, hitLineY + 20)
      strikeGlow.addColorStop(0, "rgba(168,85,247,0)")
      strikeGlow.addColorStop(0.5, "rgba(168,85,247,0.08)")
      strikeGlow.addColorStop(1, "rgba(168,85,247,0)")
      ctx.fillStyle = strikeGlow
      ctx.fillRect(0, hitLineY - 20, w, 40)

      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.15)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, hitLineY)
      ctx.lineTo(w, hitLineY)
      ctx.stroke()
      ctx.restore()

      // =================================================================
      // Empty state
      // =================================================================
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
            x = pos.left - curScrollLeft
            ww = pos.width
          }

          const yy = clamp(40 + n.startTime * 28, 10, h - 60)
          const hh = clamp(n.duration * 70, MIN_NOTE_PX, 120)
          const isRight = n.hand === "right"
          const c = isRight ? VFX_CONFIG.rhColor : VFX_CONFIG.lhColor
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.5)`
          roundRect(ctx, x, yy, ww, hh, 8)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        const text = "Your interactive piano tutorial will appear here."
        ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system"
        const padX = 14
        const tw = ctx.measureText(text).width
        const bx = (w - (tw + padX * 2)) / 2
        const by = (h - 34) / 2
        ctx.fillStyle = "rgba(0,0,0,0.55)"
        roundRect(ctx, bx, by, tw + padX * 2, 34, 10)
        ctx.fill()
        ctx.fillStyle = "rgba(255,255,255,0.78)"
        ctx.fillText(text, bx + padX, by + 22)

        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // =================================================================
      // PASS 3: Notes
      // =================================================================
      const fsScale = isFullscreen ? 1.15 : 1.0  // slightly wider bars in fullscreen
      const lookahead = isFullscreen ? LOOKAHEAD_SEC_FS : LOOKAHEAD_SEC
      const pps = BASE_PPS * (isFullscreen ? 0.85 : 1.0) // slower fall in FS = more lead time
      const windowStart = curTime - LOOKBEHIND_SEC
      const windowEnd = curTime + lookahead
      const startIdx = findStartIndexIncludingSustains(filteredNotes, windowStart)
      const viewW = curViewportW ?? w

      const currentHitSet = new Set<number>()
      const glowSprites = glowSpritesRef.current

      for (let i = startIdx; i < filteredNotes.length; i++) {
        const n = filteredNotes[i]
        if (n.startTime > windowEnd + 1) break

        const pos = keyPositions[n.note]
        if (!pos) continue

        const noteHeight = Math.max(MIN_NOTE_PX, n.duration * pps)
        const y = hitLineY - (n.startTime - curTime) * pps - noteHeight
        if (y > h || y + noteHeight < 0) continue

        let x = 0
        let wwRaw = 0
        if (keyboardMode === "fit") {
          x = (pos.left / 100) * w
          wwRaw = (pos.width / 100) * w
        } else {
          x = pos.left - curScrollLeft
          wwRaw = pos.width
          if (x + wwRaw < 0 || x > viewW) continue
        }

        const widen = pos.isBlack ? 1.15 : 1.08
        const ww = clamp(wwRaw * widen * fsScale, 8, wwRaw * 1.3)
        const xCentered = x - (ww - wwRaw) / 2

        const isRight = n.hand === "right"
        const color = isRight ? VFX_CONFIG.rhColor : VFX_CONFIG.lhColor
        const glow = isRight ? VFX_CONFIG.rhGlow : VFX_CONFIG.lhGlow

        // ---- Smooth proximity envelope (organic fade, no binary snap) ----
        const distToHit = curTime - n.startTime
        // Approach ramp: 0 far away -> 1 at hit line (300ms window)
        const approachT = clamp(1 - Math.abs(distToHit) / 0.3, 0, 1)
        const hitProximity = easeOutCubic(approachT)

        const isSustained = distToHit >= 0 && distToHit < n.duration
        const sustainFade = isSustained
          ? 1 - easeOutCubic(clamp(distToHit / Math.max(n.duration, 0.01), 0, 1)) * 0.7
          : 0

        const isHit = distToHit >= -HIT_EARLY && distToHit < HIT_LATE

        // Spawn bloom (once per note-on)
        if (isHit) {
          currentHitSet.add(n.id)
          if (!prevHitSetRef.current.has(n.id)) {
            spawnHitEffect(hitPoolRef.current, n.id, xCentered, hitLineY, ww, isRight, nowMs)
            emitParticles(particlePoolRef.current, xCentered, hitLineY, ww, isRight, nowMs)
          }
        }

        // ---- Outer glow (cached sprite, no shadowBlur) ----
        const glowIntensity = Math.max(hitProximity * 0.5, sustainFade * 0.25)
        if (glowSprites && glowIntensity > 0.01) {
          const sprite = isRight ? glowSprites.rh : glowSprites.lh
          const glowScale = 1.5 + hitProximity * 1.5 + sustainFade * 0.7
          const glowW = ww * glowScale
          const glowH = Math.min(noteHeight * 1.3, 80)

          ctx.save()
          ctx.globalAlpha = glowIntensity * VFX_CONFIG.glowIntensityScale
          ctx.globalCompositeOperation = "lighter"
          ctx.drawImage(
            sprite,
            xCentered - (glowW - ww) / 2,
            y + noteHeight / 2 - glowH / 2,
            glowW, glowH
          )
          ctx.restore()
        }

        // ---- Note bar (smooth alpha) ----
        ctx.save()
        const baseAlpha = 0.50 + hitProximity * 0.42 + sustainFade * 0.20

        // Only create gradient for actively-glowing notes
        if (hitProximity > 0.05 || sustainFade > 0.05) {
          const grad = ctx.createLinearGradient(xCentered, y, xCentered, y + noteHeight)
          grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${baseAlpha})`)
          grad.addColorStop(0.5, `rgba(${color.r + 20},${color.g + 20},${color.b + 20},${baseAlpha * 0.9})`)
          grad.addColorStop(1, `rgba(${glow.r},${glow.g},${glow.b},${baseAlpha * 0.65})`)
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${baseAlpha})`
        }

        roundRect(ctx, xCentered, y, ww, noteHeight, 8)
        ctx.fill()

        // Top shine (smooth)
        const shineAlpha = 0.05 + hitProximity * 0.18
        const shine = ctx.createLinearGradient(xCentered, y, xCentered, y + 6)
        shine.addColorStop(0, `rgba(255,255,255,${shineAlpha})`)
        shine.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = shine
        roundRect(ctx, xCentered, y, ww, Math.min(noteHeight, 6), 8)
        ctx.fill()

        // Outline (smooth)
        const outlineAlpha = 0.03 + hitProximity * 0.14
        ctx.strokeStyle = `rgba(255,255,255,${outlineAlpha})`
        ctx.lineWidth = 1
        roundRect(ctx, xCentered, y, ww, noteHeight, 8)
        ctx.stroke()

        // Note label (fixed font -- no per-note sizing loop)
        if (curShowNames && ww > 16 && noteHeight > 20) {
          const labelAlpha = curTempo > 80 ? 0.50 : 0.85
          ctx.globalAlpha = labelAlpha
          ctx.font = labelFont
          ctx.textBaseline = "middle"
          ctx.textAlign = "center"
          ctx.fillStyle = "rgba(0,0,0,0.45)"
          ctx.fillText(n.note, xCentered + ww / 2 + 0.5, y + noteHeight / 2 + 0.5)
          ctx.fillStyle = "rgba(255,255,255,0.90)"
          ctx.fillText(n.note, xCentered + ww / 2, y + noteHeight / 2)
          ctx.globalAlpha = 1
        }

        ctx.restore()
      }

      prevHitSetRef.current = currentHitSet

      // =================================================================
      // PASS 4: Bloom hit effects
      // =================================================================
      ctx.save()
      ctx.globalCompositeOperation = "lighter"

      for (const effect of hitPoolRef.current) {
        if (effect.phase === "done") continue

        const alpha = computeHitAlpha(effect, nowMs)
        if (alpha <= 0.001) {
          effect.phase = "done"
          continue
        }

        const c = effect.isRight ? VFX_CONFIG.rhGlow : VFX_CONFIG.lhGlow

        if (VFX_CONFIG.hitEffectStyle === "bloom" || VFX_CONFIG.hitEffectStyle === "keyGlowSparks") {
          if (glowSprites) {
            const sprite = effect.isRight ? glowSprites.rh : glowSprites.lh
            const size = effect.w * 4
            ctx.globalAlpha = alpha * 0.75
            ctx.drawImage(
              sprite,
              effect.x - (size - effect.w) / 2,
              effect.y - size / 2,
              size, size
            )
          }
        }

        if (VFX_CONFIG.hitEffectStyle === "pulseTrail") {
          const elapsed = nowMs - effect.startMs
          const progress = clamp(elapsed / (VFX_CONFIG.attackMs + VFX_CONFIG.releaseMs), 0, 1)
          const ringRadius = effect.w * 0.5 + progress * effect.w * 1.5

          ctx.globalAlpha = alpha * 0.6
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},1)`
          ctx.lineWidth = 2 * (1 - progress)
          ctx.beginPath()
          ctx.arc(effect.x + effect.w / 2, effect.y, ringRadius, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.restore()

      // =================================================================
      // PASS 5: Particles
      // =================================================================
      ctx.save()
      ctx.globalCompositeOperation = "lighter"

      for (const p of particlePoolRef.current) {
        if (!p.active) continue

        const elapsed = nowMs - p.startMs
        if (elapsed >= p.lifetimeMs) {
          p.active = false
          continue
        }

        const lifeT = elapsed / p.lifetimeMs
        const fadeAlpha = p.alpha * (1 - easeOutCubic(lifeT))

        p.x += p.vx
        p.y += p.vy
        p.vy -= 0.01

        const c = p.isRight ? VFX_CONFIG.rhGlow : VFX_CONFIG.lhGlow

        ctx.globalAlpha = fadeAlpha
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},1)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - lifeT * 0.3), 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      // =================================================================
      // Continue loop
      // =================================================================
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isComplete, filteredNotes, keyPositions, keyboardMode, isFullscreen])
  // ^^^ Only structural deps -- all fast-changing values read from refs

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        backgroundColor: "#0a0a0f",
        height: isFullscreen ? "100vh" : `${NORMAL_HEIGHT}px`,
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Fullscreen toggle */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute top-2 left-2 z-10 flex items-center justify-center rounded-lg bg-background/50 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {currentLoop && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary" className="text-xs">
            {'Looping bars '}{currentLoop.start}{'-'}{currentLoop.end}
          </Badge>
        </div>
      )}

      {isFullscreen && (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-md bg-background/40 px-3 py-1 text-xs text-foreground/50 backdrop-blur-sm">
            Press ESC to exit fullscreen
          </span>
        </div>
      )}
    </div>
  )
}
