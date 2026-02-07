"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import type { PianoKey } from "./types"

interface PianoKeyboardProps {
  pianoKeys: PianoKey[]
  activeKeys: string[]
  showKeyLabels: boolean

  /** NEW (optional) */
  mode?: "fit" | "scroll"
  zoom?: number // 0.8 .. 2.0 typical
  onModeChange?: (mode: "fit" | "scroll") => void
  onZoomChange?: (zoom: number) => void
  onScrollChange?: (scrollLeft: number, viewportWidth: number) => void
}

export function PianoKeyboard({
  pianoKeys,
  activeKeys,
  showKeyLabels,
  mode: modeProp,
  zoom: zoomProp,
  onModeChange,
  onZoomChange,
  onScrollChange,
}: PianoKeyboardProps) {
  const [modeLocal, setModeLocal] = useState<"fit" | "scroll">(modeProp ?? "fit")
  const [zoomLocal, setZoomLocal] = useState<number>(zoomProp ?? 1.2)

  const mode = modeProp ?? modeLocal
  const zoom = zoomProp ?? zoomLocal

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys])

  // Realistic widths for scroll mode
  const whiteKeyPx = 22 * zoom
  const blackKeyPx = whiteKeyPx * 0.62

  // In fit mode, use percentages
  const keyWidthPct = 100 / Math.max(1, whiteKeys.length)

  // Report scroll to parent (so visualiser can align)
  useEffect(() => {
    if (mode !== "scroll") return
    const el = scrollRef.current
    if (!el) return

    const report = () => {
      onScrollChange?.(el.scrollLeft, el.clientWidth)
    }

    report()
    el.addEventListener("scroll", report, { passive: true })
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", report)
      ro.disconnect()
    }
  }, [mode, onScrollChange])

  const setMode = (m: "fit" | "scroll") => {
    onModeChange?.(m)
    if (!modeProp) setModeLocal(m)
  }

  const setZoom = (z: number) => {
    const next = Math.max(0.8, Math.min(2.0, z))
    onZoomChange?.(next)
    if (!zoomProp) setZoomLocal(next)
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-secondary/40 ring-1 ring-border/40">
      {/* Controls */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-background/70 px-2 py-1 backdrop-blur">
        <button
          onClick={() => setMode("fit")}
          className={`text-xs font-semibold px-2 py-1 rounded-md transition ${
            mode === "fit" ? "bg-accent text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          Fit
        </button>
        <button
          onClick={() => setMode("scroll")}
          className={`text-xs font-semibold px-2 py-1 rounded-md transition ${
            mode === "scroll" ? "bg-accent text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          Scroll
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-1">
          <span className="text-[10px] text-muted-foreground">
            Zoom{mode === "fit" ? " (Scroll)" : ""}
          </span>
          <input
            type="range"
            min={0.8}
            max={2.0}
            step={0.05}
            value={zoom}
            disabled={mode === "fit"}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={`w-24 accent-[currentColor] ${mode === "fit" ? "opacity-40 cursor-not-allowed" : ""}`}
          />
        </div>
      </div>

      {/* Keyboard bed */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/28 to-transparent" />

      {/* Scroll container (only used in scroll mode) */}
      <div
        ref={scrollRef}
        className={mode === "scroll" ? "h-24 overflow-x-auto overflow-y-hidden" : "h-24 overflow-hidden"}
      >
        {/* Inner keyboard width */}
        <div
          className="relative h-24"
          style={mode === "scroll" ? { width: `${whiteKeys.length * whiteKeyPx}px`, minWidth: "100%" } : { width: "100%" }}
        >
          {/* White keys */}
          <div className="absolute inset-0 flex">
            {whiteKeys.map((key, idx) => {
              const isActive = activeKeys.includes(key.note)
              const isC = key.note.startsWith("C")

              const widthStyle = mode === "scroll" ? { width: `${whiteKeyPx}px` } : { width: `${keyWidthPct}%` }

              return (
                <div
                  key={key.note}
                  className={[
                    "relative h-full",
                    idx === whiteKeys.length - 1 ? "" : "border-r border-border/30",
                    // more “piano-like” shading
                    "bg-gradient-to-b from-foreground via-foreground/95 to-foreground/90",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-2px_0_rgba(0,0,0,0.18)]",
                    idx === 0 ? "rounded-l-xl" : "",
                    idx === whiteKeys.length - 1 ? "rounded-r-xl" : "",
                    // smooth press + glow fade (not instant)
                    "transition-all duration-200 ease-out will-change-transform",
                    // active = smooth glow that will fade via transition when deactivated
                    isActive
                      ? "bg-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_22px_rgba(236,72,153,0.45),0_0_50px_rgba(168,85,247,0.15)]"
                      : "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-2px_0_rgba(0,0,0,0.18)]",
                  ].join(" ")}
                  style={{
                    ...widthStyle,
                    transform: isActive ? "translateY(2px) scaleY(0.97)" : "translateY(0px) scaleY(1)",
                  }}
                >
                  {/* front lip */}
                  <div className={`absolute bottom-0 left-0 right-0 h-2 ${isActive ? "bg-background/22" : "bg-background/12"}`} />

                  {/* subtle vertical sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-background/[0.04] to-transparent" />

                  {/* Organic glow overlay – fades in/out via parent transition */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent transition-opacity duration-300 ease-out"
                    style={{ opacity: isActive ? 1 : 0 }}
                  />

                  {/* Pulse ring (feels more “alive”) */}
                  {isActive && (
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-1 rounded-lg ring-1 ring-background/10 transition-opacity duration-500 ease-out" />
                    </div>
                  )}

                  {/* C dot */}
                  {isC && !showKeyLabels && (
                    <div
                      className={[
                        "absolute bottom-[10px] left-1/2 -translate-x-1/2 h-2 w-2 rounded-full",
                        isActive ? "bg-background/80" : "bg-muted-foreground/35",
                        "shadow-[inset_0_1px_1px_rgba(0,0,0,0.35)]",
                      ].join(" ")}
                    />
                  )}

                  {/* label */}
                  {showKeyLabels && (
                    <span
                      className={[
                        "absolute bottom-2 left-1/2 -translate-x-1/2 select-none",
                        mode === "scroll" ? "text-[10px]" : "text-[9px]",
                        "font-semibold tracking-tight",
                        isActive ? "text-background" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {key.note}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Black keys */}
          <div className="absolute inset-0 pointer-events-none">
            {pianoKeys.map((key, index) => {
              if (!key.isBlack) return null

              const whiteIndex = pianoKeys.slice(0, index + 1).filter((k) => !k.isBlack).length
              const isActive = activeKeys.includes(key.note)

              const left =
                mode === "scroll"
                  ? (whiteIndex - 0.5) * whiteKeyPx - blackKeyPx / 2
                  : (whiteIndex - 0.5) * keyWidthPct - keyWidthPct * 0.3

              const width = mode === "scroll" ? blackKeyPx : keyWidthPct * 0.6

              return (
                <div
                  key={key.note}
                  className={[
                    "absolute top-0 h-[62%] rounded-b-lg",
                    // matte black with depth
                    "bg-gradient-to-b from-background via-background/92 to-background/85",
                    "shadow-[0_8px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
                    "transition-all duration-200 ease-out will-change-transform",
                    isActive
                      ? "bg-accent shadow-[0_0_22px_rgba(236,72,153,0.50),0_10px_18px_rgba(0,0,0,0.70),inset_0_1px_0_rgba(255,255,255,0.22)]"
                      : "",
                  ].join(" ")}
                  style={{
                    left: mode === "scroll" ? `${left}px` : `${left}%`,
                    width: mode === "scroll" ? `${width}px` : `${width}%`,
                    transform: isActive ? "translateY(2px) scaleY(0.97)" : "translateY(0px) scaleY(1)",
                  }}
                >
                  {/* tiny top gloss strip */}
                  <div className="absolute left-1 right-1 top-1 h-1 rounded-full bg-white/10" />
                  {/* Smooth glow overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-b-lg bg-gradient-to-b from-white/15 to-transparent transition-opacity duration-300 ease-out"
                    style={{ opacity: isActive ? 1 : 0 }}
                  />

                  {showKeyLabels && mode === "scroll" && (
                    <span
                      className={[
                        "absolute bottom-2 left-1/2 -translate-x-1/2 select-none",
                        "text-[9px] font-semibold",
                        isActive ? "text-background" : "text-white/60",
                      ].join(" ")}
                    >
                      {key.note}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ground it */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
      </div>
    </div>
  )
}
