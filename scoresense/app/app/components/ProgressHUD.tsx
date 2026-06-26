"use client"

import React, { useState, useEffect, useRef } from "react"
import { getLevelInfo, ACHIEVEMENTS, type UserProgress } from "../lib/userProgress"

type Props = {
  progress: UserProgress
  sessionMinutes: number
  compact?: boolean
}

export function ProgressHUD({ progress, sessionMinutes, compact = false }: Props) {
  const { level, name, currentXp, nextThreshold } = getLevelInfo(progress.totalXp)
  const pct = nextThreshold > 0 ? Math.min(100, Math.round((currentXp / nextThreshold) * 100)) : 100

  const [xpBump, setXpBump] = useState(false)
  const prevXp = useRef(progress.totalXp)

  useEffect(() => {
    if (progress.totalXp > prevXp.current) {
      setXpBump(true)
      const t = setTimeout(() => setXpBump(false), 900)
      prevXp.current = progress.totalXp
      return () => clearTimeout(t)
    }
    prevXp.current = progress.totalXp
  }, [progress.totalXp])

  const unlockedCount = progress.unlockedAchievements.length
  const totalCount = ACHIEVEMENTS.length

  return (
    <div className="flex items-center gap-3 text-xs select-none">
      {/* Streak */}
      {progress.streak >= 1 && (
        <div className="flex items-center gap-1 font-bold text-orange-400 tabular-nums">
          🔥 {progress.streak}
        </div>
      )}

      {/* Level + XP bar */}
      <div className="flex items-center gap-1.5" title={`${name} · ${currentXp} / ${nextThreshold} XP`}>
        <span className="text-muted-foreground font-medium whitespace-nowrap">
          Lv.{level + 1}
        </span>
        <div className="w-16 h-1.5 rounded-full bg-secondary/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${xpBump ? "bg-yellow-400" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`tabular-nums transition-colors ${xpBump ? "text-yellow-400 font-semibold" : "text-muted-foreground"}`}>
          {progress.totalXp} XP
        </span>
      </div>

      {/* Achievements pill — hidden in compact mode */}
      {!compact && unlockedCount > 0 && (
        <span className="text-muted-foreground" title="Achievements unlocked">
          🏆 {unlockedCount}/{totalCount}
        </span>
      )}

      {/* Session time — hidden in compact mode */}
      {!compact && sessionMinutes >= 1 && (
        <span className="text-muted-foreground tabular-nums">
          🕐 {sessionMinutes}m
        </span>
      )}
    </div>
  )
}
