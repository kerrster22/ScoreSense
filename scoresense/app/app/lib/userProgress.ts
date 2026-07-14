"use client"

const PROGRESS_KEY = "ss_user_progress"

export interface UserProgress {
  totalXp: number
  streak: number
  lastPracticeDate: string // YYYY-MM-DD
  unlockedAchievements: string[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  xpReward: number
}

export interface AchievementContext {
  totalCompleted: number
  streak: number
  tempo: number
  allSegmentsComplete: boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_note",    title: "First Note",      description: "Loaded your first piece",              xpReward: 5   },
  { id: "first_complete",title: "Segment Star",     description: "Completed your first segment",         xpReward: 10  },
  { id: "on_a_roll",     title: "On a Roll",        description: "5 segments completed",                 xpReward: 20  },
  { id: "streak_3",      title: "Dedicated",        description: "3-day practice streak",                xpReward: 30  },
  { id: "streak_7",      title: "Week Warrior",     description: "7-day practice streak",                xpReward: 75  },
  { id: "piece_master",  title: "Piece Master",     description: "Completed all segments of a piece",    xpReward: 100 },
  { id: "speed_demon",   title: "Speed Demon",      description: "Practiced a segment at 100% tempo",    xpReward: 15  },
  { id: "level_5",       title: "Rising Musician",  description: "Reached Level 5",                      xpReward: 50  },
]

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000]
const LEVEL_NAMES = ["Novice", "Student", "Apprentice", "Musician", "Virtuoso", "Maestro", "Grand Maestro", "Legend"]

export function getLevelInfo(totalXp: number): {
  level: number
  name: string
  currentXp: number
  nextThreshold: number
} {
  let level = 0
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) { level = i; break }
  }
  const prev = LEVEL_THRESHOLDS[level] ?? 0
  const next = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  return {
    level,
    name: LEVEL_NAMES[level] ?? "Legend",
    currentXp: totalXp - prev,
    nextThreshold: next - prev,
  }
}

function todayStr()     { return new Date().toISOString().slice(0, 10) }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

function defaultProgress(): UserProgress {
  return { totalXp: 0, streak: 0, lastPracticeDate: "", unlockedAchievements: [] }
}

export function loadProgress(): UserProgress {
  if (typeof window === "undefined") return defaultProgress()
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return defaultProgress()
    const parsed = JSON.parse(raw) as Partial<UserProgress>
    return { ...defaultProgress(), ...parsed, unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : [] }
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(p: UserProgress): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) } catch {}
}

export function recordPracticeSession(): { streakUpdated: boolean; newStreak: number; progress: UserProgress } {
  const p = loadProgress()
  const today = todayStr()
  if (p.lastPracticeDate === today) {
    return { streakUpdated: false, newStreak: p.streak, progress: p }
  }
  p.streak = p.lastPracticeDate === yesterdayStr() ? p.streak + 1 : 1
  p.lastPracticeDate = today
  saveProgress(p)
  return { streakUpdated: true, newStreak: p.streak, progress: p }
}

export function awardXp(amount: number): { newTotal: number; leveledUp: boolean; newLevel: number; progress: UserProgress } {
  const p = loadProgress()
  const prevLevel = getLevelInfo(p.totalXp).level
  p.totalXp += amount
  const newLevel = getLevelInfo(p.totalXp).level
  saveProgress(p)
  return { newTotal: p.totalXp, leveledUp: newLevel > prevLevel, newLevel, progress: p }
}

export function checkAndUnlockAchievements(context: AchievementContext): { unlocked: Achievement[]; progress: UserProgress } {
  const p = loadProgress()
  const unlocked: Achievement[] = []

  const check = (id: string, condition: boolean) => {
    if (condition && !p.unlockedAchievements.includes(id)) {
      p.unlockedAchievements.push(id)
      const def = ACHIEVEMENTS.find((a) => a.id === id)
      if (def) { p.totalXp += def.xpReward; unlocked.push(def) }
    }
  }

  check("first_complete", context.totalCompleted >= 1)
  check("on_a_roll",      context.totalCompleted >= 5)
  check("streak_3",       context.streak >= 3)
  check("streak_7",       context.streak >= 7)
  check("piece_master",   context.allSegmentsComplete)
  check("speed_demon",    context.tempo >= 100)
  check("level_5",        getLevelInfo(p.totalXp).level >= 5)

  if (unlocked.length > 0) saveProgress(p)
  return { unlocked, progress: p }
}

export function unlockFirstNoteAchievement(): Achievement | null {
  const p = loadProgress()
  if (p.unlockedAchievements.includes("first_note")) return null
  p.unlockedAchievements.push("first_note")
  const def = ACHIEVEMENTS.find((a) => a.id === "first_note")!
  p.totalXp += def.xpReward
  saveProgress(p)
  return def
}
