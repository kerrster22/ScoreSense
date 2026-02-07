"use client"

import React, { useEffect, useMemo, useRef } from "react"
import type { Note, PianoKey, LoopRange } from "./types"

// =============================================================================
// CONFIG
// =============================================================================

const VFX = {
  // Bloom envelope (ms)
  attackMs: 40,
  releaseMs: 600,
  peakAlpha: 0.92,

  // Particles
  particleCount: 6,
  particleLifeMs: 480,
  particleSpeed: 0.55,

  // Glow sprites
  glowSpriteSize: 64,
  glowIntensity: 1.0,

  // Note width multiplier (1.0 = raw key width, 1.8 = much fatter)
  noteWidthScale: 1.8,
  noteWidthScaleFullscreen: 2.1,

  // Note colors
  rhColor: { r: 236, g: 72, b: 153 },
  rhGlow: { r: 190, g: 80, b: 230 },
  lhColor: { r: 99, g: 102, b: 241 },
  lhGlow: { r: 130, g: 140, b: 248 },

  // Sustain column
  sustainColumnAlpha: 0.07,
  sustainColumnWidth: 1.6, // multiplier of note width

  // Fullscreen cinematic tweaks
  fullscreen: {
    noteWidthMult: 1.15,
    leadTimeMult: 1.4,
    glowSoftnessMult: 1.2,
    ppsMult: 0.8, // slower fall speed
  },
} as const

// =============================================================================
// LAYOUT
// =============================================================================

const NORMAL_HEIGHT = 320
const LOOKAHEAD_SEC = 6
const LOOKBEHIND_SEC = 1.25
const BASE_PPS = 120
const MIN_NOTE_PX = 28
const HIT_EARLY = 0.04
const HIT_LATE = 0.08

const MAX_HIT_EFFECTS = 64
const MAX_PARTICLES = 140

// =============================================================================
// EASING
// =============================================================================

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }
function easeOutExpo(t: number) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t) }
function easeInCubic(t: number) { return t * t * t }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
// BINARY SEARCH (cull notes outside visible window)
// =============================================================================

function binarySearchFirst(notes: Note[], time: number) {
  let lo = 0, hi = notes.length
  while (lo < hi) { const m = (lo + hi) >> 1; notes[m].startTime < time ? lo = m + 1 : hi = m }
  return lo
}

function findStartIndex(notes: Note[], windowStart: number) {
  let idx = Math.max(0, binarySearchFirst(notes, windowStart))
  while (idx > 0 && notes[idx - 1].startTime + notes[idx - 1].duration >= windowStart) idx--
  return idx
}

// =============================================================================
// CACHED GLOW SPRITE (offscreen canvas drawn once)
// =============================================================================

function createGlowSprite(size: number, r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = size; c.height = size
  const ctx = c.getContext("2d")!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${g},${b},0.65)`)
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.2)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return c
}

// =============================================================================
// CACHED BACKGROUND (painted once per resize)
// =============================================================================

function paintBgSprite(canvas: HTMLCanvasElement, w: number, h: number) {
  const ctx = canvas.getContext("2d")!
  canvas.width = w; canvas.height = h

  ctx.fillStyle = "#08080d"
  ctx.fillRect(0, 0, w, h)

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
  bgGrad.addColorStop(0, "rgba(18, 8, 38, 0.25)")
  bgGrad.addColorStop(0.5, "rgba(4, 4, 12, 0)")
  bgGrad.addColorStop(1, "rgba(8, 4, 28, 0.18)")
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, w, h)

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72)
  vig.addColorStop(0, "rgba(0,0,0,0)")
  vig.addColorStop(1, "rgba(0,0,0,0.45)")
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 1
  for (let i = 1; i <= 8; i++) {
    const y = (h * i) / 8
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

// =============================================================================
// OBJECT POOLS
// =============================================================================

interface HitEffect {
  noteId: number; x: number; y: number; w: number; isRight: boolean
  startMs: number; phase: "attack" | "release" | "done"; peakAlpha: number
}

interface Particle {
  active: boolean; x: number; y: number; vx: number; vy: number
  alpha: number; startMs: number; lifetimeMs: number; size: number; isRight: boolean
}

function makeHitPool(n: number): HitEffect[] {
  return Array.from({ length: n }, () => ({
    noteId: -1, x: 0, y: 0, w: 0, isRight: true, startMs: 0, phase: "done" as const, peakAlpha: 0,
  }))
}

function makeParticlePool(n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, alpha: 0, startMs: 0, lifetimeMs: 0, size: 0, isRight: true,
  }))
}

function spawnHit(pool: HitEffect[], noteId: number, x: number, y: number, w: number, isRight: boolean, nowMs: number) {
  for (const e of pool) { if (e.noteId === noteId && e.phase !== "done") return }
  for (const e of pool) {
    if (e.phase === "done") {
      e.noteId = noteId; e.x = x; e.y = y; e.w = w; e.isRight = isRight
      e.startMs = nowMs; e.phase = "attack"; e.peakAlpha = VFX.peakAlpha
      return
    }
  }
}

function computeHitAlpha(e: HitEffect, nowMs: number): number {
  const elapsed = nowMs - e.startMs
  if (e.phase === "attack") {
    if (elapsed >= VFX.attackMs) { e.phase = "release"; e.startMs = nowMs; return e.peakAlpha }
    return easeInCubic(elapsed / VFX.attackMs) * e.peakAlpha
  }
  if (e.phase === "release") {
    if (elapsed >= VFX.releaseMs) { e.phase = "done"; return 0 }
    return (1 - easeOutExpo(elapsed / VFX.releaseMs)) * e.peakAlpha
  }
  return 0
}

function emitParticles(pool: Particle[], x: number, y: number, w: number, isRight: boolean, nowMs: number) {
  let spawned = 0
  for (let i = 0; i < pool.length && spawned < VFX.particleCount; i++) {
    if (!pool[i].active) {
      const p = pool[i]
      p.active = true
      p.x = x + Math.random() * w
      p.y = y + (Math.random() - 0.5) * 4
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.55
      const speed = (0.25 + Math.random() * 0.75) * VFX.particleSpeed
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed
      p.alpha = 0.55 + Math.random() * 0.45
      p.startMs = nowMs
      p.lifetimeMs = VFX.particleLifeMs * (0.55 + Math.random() * 0.45)
      p.size = 1.5 + Math.random() * 2.5
      p.isRight = isRight
      spawned++
    }
  }
}

// =============================================================================
// TYPES
// =============================================================================

type KeyPos = { left: number; width: number; isBlack: boolean }

interface VisualizerPanelProps {
  notes: Note[]
  pianoKeys: PianoKey[]
  isComplete: boolean
  playbackTime: number
  handSelection: string
  showNoteNames: boolean
  currentLoop: LoopRange | null
  tempo: number
  isFullscreen?: boolean
  keyboardMode?: "fit" | "scroll"
  keyboardZoom?: number
  keyboardScrollLeft?: number
  keyboardViewportWidth?: number
}

// =============================================================================
// COMPONENT
// =============================================================================

export function VisualizerPanel({
  notes, pianoKeys, isComplete, playbackTime, handSelection, showNoteNames,
  currentLoop, tempo, isFullscreen = false,
  keyboardMode = "fit", keyboardZoom = 1,
  keyboardScrollLeft = 0, keyboardViewportWidth,
}: VisualizerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)

  // Fast-changing values stored in refs (no rAF restart)
  const ptRef = useRef(playbackTime); ptRef.current = playbackTime
  const tempoRef = useRef(tempo); tempoRef.current = tempo
  const showNamesRef = useRef(showNoteNames); showNamesRef.current = showNoteNames
  const scrollRef = useRef(keyboardScrollLeft); scrollRef.current = keyboardScrollLeft
  const vpWRef = useRef(keyboardViewportWidth); vpWRef.current = keyboardViewportWidth

  // VFX pools
  const hitPool = useRef(makeHitPool(MAX_HIT_EFFECTS))
  const particlePool = useRef(makeParticlePool(MAX_PARTICLES))
  const glowRef = useRef<{ rh: HTMLCanvasElement; lh: HTMLCanvasElement } | null>(null)
  const prevHits = useRef(new Set<number>())
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const bgSize = useRef({ w: 0, h: 0 })

  // Derived
  const filteredNotes = useMemo(() => {
    const base = handSelection === "both" ? notes : notes.filter(n => n.hand === (handSelection === "right" ? "right" : "left"))
    return [...base].sort((a, b) => a.startTime - b.startTime)
  }, [notes, handSelection])

  const keyPositions = useMemo(() => {
    const whites = pianoKeys.filter(k => !k.isBlack)
    const wCount = Math.max(1, whites.length)
    if (keyboardMode === "fit") {
      const pct = 100 / wCount
      const map: Record<string, KeyPos> = {}
      for (let i = 0; i < pianoKeys.length; i++) {
        const k = pianoKeys[i]
        const wi = pianoKeys.slice(0, i + 1).filter(x => !x.isBlack).length
        const l = k.isBlack ? (wi - 0.5) * pct - pct * 0.15 : (wi - 1) * pct
        const w = k.isBlack ? pct * 0.6 : pct
        map[k.note] = { left: l, width: w, isBlack: k.isBlack }
      }
      return map
    }
    const wkPx = 22 * keyboardZoom, bkPx = wkPx * 0.62
    const map: Record<string, KeyPos> = {}
    for (let i = 0; i < pianoKeys.length; i++) {
      const k = pianoKeys[i]
      const wi = pianoKeys.slice(0, i + 1).filter(x => !x.isBlack).length
      const l = k.isBlack ? (wi - 0.5) * wkPx - bkPx / 2 : (wi - 1) * wkPx
      const w = k.isBlack ? bkPx : wkPx
      map[k.note] = { left: l, width: w, isBlack: k.isBlack }
    }
    return map
  }, [pianoKeys, keyboardMode, keyboardZoom])

  // Init glow sprites + bg sprite (once)
  useEffect(() => {
    const s = VFX.glowSpriteSize
    glowRef.current = {
      rh: createGlowSprite(s, VFX.rhGlow.r, VFX.rhGlow.g, VFX.rhGlow.b),
      lh: createGlowSprite(s, VFX.lhGlow.r, VFX.lhGlow.g, VFX.lhGlow.b),
    }
    bgRef.current = document.createElement("canvas")
  }, [])

  // HiDPI canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth, h = container.clientHeight
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (bgRef.current) { paintBgSprite(bgRef.current, w, h); bgSize.current = { w, h } }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [isFullscreen])

  // Clear effects on loop change
  useEffect(() => {
    for (const e of hitPool.current) e.phase = "done"
    for (const p of particlePool.current) p.active = false
    prevHits.current.clear()
  }, [currentLoop])

  // =========================================================================
  // DRAW LOOP (stable -- only structural deps, no playbackTime)
  // =========================================================================
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const labelFont = "700 11px ui-sans-serif,system-ui,-apple-system"
    const fs = isFullscreen

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight || NORMAL_HEIGHT
      const now = performance.now()
      const curTime = ptRef.current
      const curTempo = tempoRef.current
      const curNames = showNamesRef.current
      const curScroll = scrollRef.current
      const curVpW = vpWRef.current

      ctx.clearRect(0, 0, w, h)

      // =====================================================================
      // PASS 0: Background (cached sprite)
      // =====================================================================
      const bg = bgRef.current
      if (bg && bgSize.current.w === w && bgSize.current.h === h) {
        ctx.drawImage(bg, 0, 0)
      } else {
        ctx.fillStyle = "#08080d"; ctx.fillRect(0, 0, w, h)
      }

      // =====================================================================
      // PASS 1: Strike line (proportional Y -- ALWAYS visible)
      // =====================================================================
      // In fullscreen, leave 12% at bottom for keyboard clearance
      // In normal, leave 28px at bottom
      const hitLineY = fs ? h * 0.88 : h - 28

      // Soft glow band
      const glowH = fs ? 50 : 36
      const sGrad = ctx.createLinearGradient(0, hitLineY - glowH, 0, hitLineY + glowH)
      sGrad.addColorStop(0, "rgba(168,85,247,0)")
      sGrad.addColorStop(0.5, "rgba(168,85,247,0.06)")
      sGrad.addColorStop(1, "rgba(168,85,247,0)")
      ctx.fillStyle = sGrad
      ctx.fillRect(0, hitLineY - glowH, w, glowH * 2)

      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.13)"
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, hitLineY); ctx.lineTo(w, hitLineY); ctx.stroke()
      ctx.restore()

      // =====================================================================
      // Empty state (not-ready)
      // =====================================================================
      if (!isComplete) {
        ctx.globalAlpha = 0.1
        const demo = filteredNotes.slice(0, 10)
        for (const n of demo) {
          const pos = keyPositions[n.note]; if (!pos) continue
          let x: number, ww: number
          if (keyboardMode === "fit") { x = (pos.left / 100) * w; ww = (pos.width / 100) * w }
          else { x = pos.left - curScroll; ww = pos.width }
          const yy = clamp(40 + n.startTime * 28, 10, h - 60)
          const hh = clamp(n.duration * 70, MIN_NOTE_PX, 120)
          const c = n.hand === "right" ? VFX.rhColor : VFX.lhColor
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.4)`
          roundRect(ctx, x, yy, ww, hh, ww * 0.22)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        const text = "Your interactive piano tutorial will appear here."
        ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system"
        const tw = ctx.measureText(text).width; const padX = 14
        const bx = (w - (tw + padX * 2)) / 2, by = (h - 34) / 2
        ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(ctx, bx, by, tw + padX * 2, 34, 10); ctx.fill()
        ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.fillText(text, bx + padX, by + 22)
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // =====================================================================
      // PASS 2: Notes (wider bars, sustain column, organic envelope)
      // =====================================================================
      const widthScale = fs ? VFX.noteWidthScaleFullscreen : VFX.noteWidthScale
      const lookahead = fs ? LOOKAHEAD_SEC * VFX.fullscreen.leadTimeMult : LOOKAHEAD_SEC
      const pps = BASE_PPS * (fs ? VFX.fullscreen.ppsMult : 1.0)
      const windowStart = curTime - LOOKBEHIND_SEC
      const windowEnd = curTime + lookahead
      const startIdx = findStartIndex(filteredNotes, windowStart)
      const viewW = curVpW ?? w

      const currentHitSet = new Set<number>()
      const glowSprites = glowRef.current

      for (let i = startIdx; i < filteredNotes.length; i++) {
        const n = filteredNotes[i]
        if (n.startTime > windowEnd + 1) break

        const pos = keyPositions[n.note]; if (!pos) continue
        const noteH = Math.max(MIN_NOTE_PX, n.duration * pps)
        const y = hitLineY - (n.startTime - curTime) * pps - noteH
        if (y > h || y + noteH < 0) continue

        let xRaw: number, wRaw: number
        if (keyboardMode === "fit") { xRaw = (pos.left / 100) * w; wRaw = (pos.width / 100) * w }
        else { xRaw = pos.left - curScroll; wRaw = pos.width; if (xRaw + wRaw < 0 || xRaw > viewW) continue }

        // --- WIDER bars ---
        const ww = clamp(wRaw * widthScale, 10, wRaw * 2.4)
        const xC = xRaw + (wRaw - ww) / 2
        const cornerR = ww * 0.22

        const isRight = n.hand === "right"
        const color = isRight ? VFX.rhColor : VFX.lhColor
        const glow = isRight ? VFX.rhGlow : VFX.lhGlow

        // --- Organic proximity envelope (300ms ramp, easeOutExpo) ---
        const dist = curTime - n.startTime
        const approachRaw = clamp(1 - Math.abs(dist) / 0.3, 0, 1)
        const hitProximity = easeOutExpo(approachRaw)

        const isSustained = dist >= 0 && dist < n.duration
        const sustainT = isSustained ? clamp(dist / Math.max(n.duration, 0.01), 0, 1) : 0
        // Sustain intensity: strong at start, gentle fade to 0.4 over duration
        const sustainI = isSustained ? 1 - easeOutCubic(sustainT) * 0.6 : 0

        const isHit = dist >= -HIT_EARLY && dist < HIT_LATE

        // Spawn bloom + particles (once per note-on)
        if (isHit) {
          currentHitSet.add(n.id)
          if (!prevHits.current.has(n.id)) {
            spawnHit(hitPool.current, n.id, xC, hitLineY, ww, isRight, now)
            emitParticles(particlePool.current, xC, hitLineY, ww, isRight, now)
          }
        }

        // --- SUSTAIN COLUMN GLOW (vertical light behind held note) ---
        if (isSustained) {
          const colW = ww * VFX.sustainColumnWidth
          const colX = xC - (colW - ww) / 2
          const colTop = y
          const colBot = hitLineY
          const colH = colBot - colTop
          if (colH > 0) {
            const colGrad = ctx.createLinearGradient(0, colTop, 0, colBot)
            colGrad.addColorStop(0, `rgba(${glow.r},${glow.g},${glow.b},0)`)
            colGrad.addColorStop(0.4, `rgba(${glow.r},${glow.g},${glow.b},${VFX.sustainColumnAlpha * sustainI})`)
            colGrad.addColorStop(1, `rgba(${glow.r},${glow.g},${glow.b},${VFX.sustainColumnAlpha * sustainI * 1.5})`)
            ctx.fillStyle = colGrad
            ctx.fillRect(colX, colTop, colW, colH)
          }
        }

        // --- Outer glow (cached sprite) ---
        const glowI = Math.max(hitProximity * 0.55, sustainI * 0.3)
        if (glowSprites && glowI > 0.01) {
          const sprite = isRight ? glowSprites.rh : glowSprites.lh
          const gs = 1.5 + hitProximity * 1.8 + sustainI * 0.8
          const gW = ww * gs, gH = Math.min(noteH * 1.4, 90)
          ctx.save()
          ctx.globalAlpha = glowI * VFX.glowIntensity * (fs ? VFX.fullscreen.glowSoftnessMult : 1)
          ctx.globalCompositeOperation = "lighter"
          ctx.drawImage(sprite, xC - (gW - ww) / 2, y + noteH / 2 - gH / 2, gW, gH)
          ctx.restore()
        }

        // --- NOTE BAR (rich gradient, wider, rounded) ---
        ctx.save()
        // Held boost: brighter when sustained
        const heldBoost = sustainI * 0.25
        const baseAlpha = clamp(0.50 + hitProximity * 0.42 + sustainI * 0.22 + heldBoost, 0, 1)

        if (hitProximity > 0.04 || sustainI > 0.04) {
          const grad = ctx.createLinearGradient(xC, y, xC + ww, y + noteH)
          grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${baseAlpha})`)
          grad.addColorStop(0.3, `rgba(${Math.min(255, color.r + 30)},${Math.min(255, color.g + 30)},${Math.min(255, color.b + 30)},${baseAlpha * 0.95})`)
          grad.addColorStop(0.7, `rgba(${color.r},${color.g},${color.b},${baseAlpha * 0.85})`)
          grad.addColorStop(1, `rgba(${glow.r},${glow.g},${glow.b},${baseAlpha * 0.6})`)
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${baseAlpha})`
        }
        roundRect(ctx, xC, y, ww, noteH, cornerR)
        ctx.fill()

        // Inner highlight strip (brighter center column)
        const centerAlpha = 0.04 + hitProximity * 0.12 + sustainI * 0.08
        const centerW = ww * 0.4
        const centerX = xC + (ww - centerW) / 2
        ctx.fillStyle = `rgba(255,255,255,${centerAlpha})`
        roundRect(ctx, centerX, y + 2, centerW, noteH - 4, cornerR * 0.6)
        ctx.fill()

        // Top-edge shine
        const shineA = 0.04 + hitProximity * 0.20 + sustainI * 0.08
        const shine = ctx.createLinearGradient(xC, y, xC, y + 8)
        shine.addColorStop(0, `rgba(255,255,255,${shineA})`)
        shine.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = shine
        roundRect(ctx, xC, y, ww, Math.min(noteH, 8), cornerR)
        ctx.fill()

        // Outline
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + hitProximity * 0.12})`
        ctx.lineWidth = 1
        roundRect(ctx, xC, y, ww, noteH, cornerR)
        ctx.stroke()

        // Label
        if (curNames && ww > 18 && noteH > 22) {
          const la = curTempo > 80 ? 0.45 : 0.80
          ctx.globalAlpha = la
          ctx.font = labelFont; ctx.textBaseline = "middle"; ctx.textAlign = "center"
          ctx.fillStyle = "rgba(0,0,0,0.4)"
          ctx.fillText(n.note, xC + ww / 2 + 0.5, y + noteH / 2 + 0.5)
          ctx.fillStyle = "rgba(255,255,255,0.88)"
          ctx.fillText(n.note, xC + ww / 2, y + noteH / 2)
          ctx.globalAlpha = 1
        }
        ctx.restore()
      }

      prevHits.current = currentHitSet

      // =====================================================================
      // PASS 3: Bloom hit effects (easeOutExpo decay)
      // =====================================================================
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      for (const e of hitPool.current) {
        if (e.phase === "done") continue
        const alpha = computeHitAlpha(e, now)
        if (alpha <= 0.001) { e.phase = "done"; continue }
        if (glowSprites) {
          const sprite = e.isRight ? glowSprites.rh : glowSprites.lh
          const size = e.w * (fs ? 5 : 4)
          ctx.globalAlpha = alpha * 0.7
          ctx.drawImage(sprite, e.x - (size - e.w) / 2, e.y - size / 2, size, size)
        }
      }
      ctx.restore()

      // =====================================================================
      // PASS 4: Particles
      // =====================================================================
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      for (const p of particlePool.current) {
        if (!p.active) continue
        const elapsed = now - p.startMs
        if (elapsed >= p.lifetimeMs) { p.active = false; continue }
        const t = elapsed / p.lifetimeMs
        const fadeA = p.alpha * (1 - easeOutCubic(t))
        p.x += p.vx; p.y += p.vy; p.vy -= 0.012
        const c = p.isRight ? VFX.rhGlow : VFX.lhGlow
        ctx.globalAlpha = fadeA
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},1)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.3), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // =====================================================================
      // LOOP
      // =====================================================================
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [isComplete, filteredNotes, keyPositions, keyboardMode, isFullscreen])

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        backgroundColor: "#08080d",
        height: isFullscreen ? "calc(100vh - 110px)" : `${NORMAL_HEIGHT}px`,
        transition: "height 0.3s ease",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {currentLoop && (
        <div className="absolute top-2 right-2 z-10">
          <span className="rounded-md bg-background/30 px-2.5 py-1 text-xs text-foreground/60 backdrop-blur-sm">
            {'Looping bars '}{currentLoop.start}{' - '}{currentLoop.end}
          </span>
        </div>
      )}
    </div>
  )
}
