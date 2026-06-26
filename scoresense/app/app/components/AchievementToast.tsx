"use client"

import React, { useEffect } from "react"
import type { Achievement } from "../lib/userProgress"

type Props = {
  achievement: Achievement | null
  onDismiss: () => void
}

export function AchievementToast({ achievement, onDismiss }: Props) {
  useEffect(() => {
    if (!achievement) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [achievement, onDismiss])

  if (!achievement) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border/60 shadow-2xl cursor-pointer"
      style={{ animation: "slideUpFadeIn 0.3s ease-out" }}
      onClick={onDismiss}
    >
      <div className="text-2xl">🏆</div>
      <div>
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
          Achievement Unlocked
        </div>
        <div className="text-sm font-bold text-foreground">{achievement.title}</div>
        <div className="text-xs text-muted-foreground">
          {achievement.description} · +{achievement.xpReward} XP
        </div>
      </div>
      <style>{`
        @keyframes slideUpFadeIn {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}
