import { loadCoachProfile } from "./coachProfile"

export type RecommendationType = "loop" | "warmup" | "tempo-reduction"

export interface Recommendation {
  type: RecommendationType
  label: string
  detail: string
}

export interface WeakBarInput {
  bar: number
  count: number
}

// Explicit, tunable thresholds — a rule ladder over real telemetry, not a
// trained model. Easy to see exactly why a recommendation did or didn't fire.
const LEAP_TAG_THRESHOLD = 3
const FAST_PASSAGE_TAG_THRESHOLD = 3
const TIMING_DRIFT_TAG_THRESHOLD = 4

/**
 * Turns the accumulated weakness-tag profile (+ the current piece's weak
 * bars) into a short, ranked list of concrete next steps. Pure function —
 * no side effects, easy to unit-test by hand with a plain object.
 */
export function getRecommendations(weakBars: WeakBarInput[] = []): Recommendation[] {
  const profile = loadCoachProfile()
  const recs: Recommendation[] = []

  const leftLeaps = profile["left-hand-leap"] ?? 0
  const rightLeaps = profile["right-hand-leap"] ?? 0
  const fastPassages = profile["fast-passage"] ?? 0
  const timingDrift = profile["timing-drift"] ?? 0

  if (leftLeaps >= LEAP_TAG_THRESHOLD) {
    recs.push({
      type: "warmup",
      label: "Hand independence warm-up",
      detail: `Your left hand has missed ${leftLeaps} big jumps recently — a few rounds of the hand-independence exercise should help.`,
    })
  }
  if (rightLeaps >= LEAP_TAG_THRESHOLD) {
    recs.push({
      type: "warmup",
      label: "Arpeggio practice",
      detail: `Right-hand leaps have caused ${rightLeaps} misses recently — arpeggios build that jump accuracy directly.`,
    })
  }
  if (fastPassages >= FAST_PASSAGE_TAG_THRESHOLD) {
    recs.push({
      type: "tempo-reduction",
      label: "Slow this passage down",
      detail: "Fast runs are where most of your misses happen. Try a few passes at 70% tempo before bringing it back up.",
    })
  }
  if (timingDrift >= TIMING_DRIFT_TAG_THRESHOLD) {
    recs.push({
      type: "warmup",
      label: "Metronome subdivision drill",
      detail: "Your timing drifts more than expected on sustained passages — a rhythm drill can tighten this up.",
    })
  }
  if (weakBars.length > 0) {
    const worst = [...weakBars].sort((a, b) => b.count - a.count)[0]
    recs.push({
      type: "loop",
      label: `Loop bar ${worst.bar}`,
      detail: `This is your most-missed bar in the piece right now (${worst.count} miss${worst.count !== 1 ? "es" : ""}).`,
    })
  }

  return recs.slice(0, 3)
}
