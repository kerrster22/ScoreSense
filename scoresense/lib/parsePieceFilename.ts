import type { PieceFile } from "@/types/pieces"

export const PIECE_FILE_EXTENSIONS = [".musicxml", ".mxl", ".mid", ".midi", ".xml"] as const

const normalizeFragment = (fragment: string): string =>
  fragment
    .replace(/[_]+/g, " ")
    .replace(/[\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const composerLooksLegit = (candidate: string): boolean => {
  if (!candidate) return false
  const cleaned = candidate.replace(/[\d\s.,()\[\]'"!&]/g, "")
  return cleaned.length > 1 && /[A-Za-z]/.test(cleaned)
}

const COMPOSER_CANONICAL: Record<string, string> = {
  chopin: "Chopin",
  liszt: "Liszt",
  rachmaninoff: "Rachmaninoff",
  rachmaninov: "Rachmaninoff",
  yiruma: "Yiruma",
  gershwin: "Gershwin",
  burgmuller: "Burgmüller",
  kreisler: "Kreisler",
  beethoven: "Beethoven",
  mozart: "Mozart",
  bach: "Bach",
  schubert: "Schubert",
  tchaikovsky: "Tchaikovsky",
  debussy: "Debussy",
}

const applyKnownComposer = (title: string): { composer?: string; title: string } => {
  const lower = title.toLowerCase()
  for (const key of Object.keys(COMPOSER_CANONICAL)) {
    if (lower.includes(key)) {
      const cleanedTitle = title
        .replace(new RegExp(key, "gi"), "")
        .replace(/\s+/g, " ")
        .trim()
      return {
        composer: COMPOSER_CANONICAL[key],
        title: cleanedTitle || title,
      }
    }
  }
  return { title }
}

const CUSTOM_TITLE_MAP: Record<string, { composer: string; title: string }> = {
  "arabesque l 66 no 1 in e major": { composer: "Burgmüller", title: "Arabesque No. 1 in E Major" },
  "waltz no7 in c sharp minor op64 no2 frederic chopin": { composer: "Chopin", title: "Waltz No. 7 in C# Minor, Op. 64 No. 2" },
  "waltz in a minor chopin": { composer: "Chopin", title: "Waltz in A Minor" },
  "prelude in c sharp minor opus 3 no 2 sergei rachmaninoff": { composer: "Rachmaninoff", title: "Prelude in C# Minor, Op. 3 No. 2" },
  "prelude in g minor opus 23 no 5 sergei rachmaninoff": { composer: "Rachmaninoff", title: "Prelude in G Minor, Op. 23 No. 5" },
  "rachmaninov etude tableau op 39 no 6": { composer: "Rachmaninoff", title: "Etude-Tableau Op. 39 No. 6" },
}

const deriveComposerFromCandidate = (candidate: string): string | undefined => {
  const normalized = candidate.toLowerCase().replace(/[’'`]/g, "")
  if (!normalized) return undefined

  const git = Object.entries(COMPOSER_CANONICAL).find(([key]) => key === normalized || normalized.includes(key))
  if (git) return git[1]
  return undefined
}

const cleanTitleCandidate = (candidate: string): string =>
  normalizeFragment(candidate.replace(/\b(verse|chopin|liszt|rachmaninoff|gersion|yiruma|gershwin)\b/gi, "")).trim()

export const parsePieceFilename = (filePath: string): PieceFile => {
  const normalizedPath = filePath.replace(/\\+/g, "/")
  const parts = normalizedPath.split("/")
  const fileName = parts[parts.length - 1] || ""

  const extensionMatch = fileName.match(/\.[^.]+$/)
  const extension = (extensionMatch?.[0] || "").toLowerCase()
  const rawBase = extension ? fileName.slice(0, -extension.length) : fileName

  const cleaned = normalizeFragment(rawBase)

  const knownHit = CUSTOM_TITLE_MAP[cleaned.toLowerCase()]
  if (knownHit) {
    return {
      composer: knownHit.composer,
      title: knownHit.title,
      fileName,
      filePath: normalizedPath,
      extension,
    }
  }

  let composer = "Unknown Composer"
  let title = cleaned

  // Dash-based composer inferrence
  const dashSegments = cleaned
    .split(/\s*[-–—]\s*/)
    .map((s) => normalizeFragment(s))
    .filter(Boolean)

  if (dashSegments.length >= 2) {
    const maybeComposer = deriveComposerFromCandidate(dashSegments[0])
    if (maybeComposer) {
      composer = maybeComposer
      title = dashSegments.slice(1).join(" - ")
    }
  }

  if (composer === "Unknown Composer") {
    // Underscore-based composer inference
    const underscoreSegments = rawBase
      .split(/[_]+/)
      .map((s) => normalizeFragment(s))
      .filter(Boolean)

    if (underscoreSegments.length >= 2) {
      const maybeComposer = deriveComposerFromCandidate(underscoreSegments[0])
      if (maybeComposer) {
        composer = maybeComposer
        title = underscoreSegments.slice(1).join(" ")
      }
    }
  }

  // Known artist token in anywhere in the filename
  if (composer === "Unknown Composer") {
    const inferred = applyKnownComposer(title)
    if (inferred.composer) {
      composer = inferred.composer
      title = inferred.title
    }
  }

  // Clean known composer names from title
  const maybeTitle = cleanTitleCandidate(title)
  if (maybeTitle) title = maybeTitle

  title = normalizeFragment(title)
  if (!title) title = rawBase || "Untitled"

  if (!composerLooksLegit(composer)) {
    composer = "Unknown Composer"
  }

  return {
    composer,
    title,
    fileName,
    filePath: normalizedPath,
    extension,
  }
}

