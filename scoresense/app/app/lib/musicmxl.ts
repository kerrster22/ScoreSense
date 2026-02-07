import JSZip from "jszip"
import { XMLParser } from "fast-xml-parser"

export type MusicXmlNoteEvent = {
  id: string
  note: string // e.g. C#4
  midi: number
  startTime: number // seconds
  duration: number // seconds
  hand: "left" | "right"
  staff: number
  measure: number
}

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const
const STEP_TO_SEMITONE: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

function midiToNoteName(midi: number) {
  const pitch = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${pitch}${octave}`
}

function pitchToMidi(step: string, alter: number | undefined, octave: number) {
  const base = STEP_TO_SEMITONE[step] ?? 0
  const semitone = base + (alter ?? 0)
  return (octave + 1) * 12 + semitone
}

function stripBOM(s: string) {
  return s.replace(/^\uFEFF/, "")
}

function looksLikeHtml(s: string) {
  const t = s.trim().toLowerCase()
  return t.startsWith("<!doctype html") || t.startsWith("<html")
}

function looksLikeXml(s: string) {
  const t = s.trim()
  return t.startsWith("<?xml") || t.startsWith("<score-partwise") || t.startsWith("<score-timewise")
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

function durationToSeconds(durationDivisions: number, divisionsPerQuarter: number, bpm: number) {
  const quarters = durationDivisions / divisionsPerQuarter
  return (60 / bpm) * quarters
}

function staffToHand(staff: number): "left" | "right" {
  return staff === 2 ? "left" : "right"
}

/**
 * fast-xml-parser preserveOrder shape:
 * doc = [ { "score-partwise": [ ...children... ] } ] etc.
 * Text nodes typically appear as { "#text": "123" }
 * Attributes appear as { ":@": { id: "P1" } }
 */
type ONode = Record<string, any>

function isObj(x: any): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x)
}

function getAttrs(node: any): Record<string, any> {
  if (!isObj(node)) return {}
  return (node[":@"] ?? {}) as Record<string, any>
}

function nodeKeys(node: any): string[] {
  if (!isObj(node)) return []
  return Object.keys(node).filter((k) => k !== ":@")
}

function firstTagName(node: any): string | null {
  const ks = nodeKeys(node)
  return ks.length ? ks[0] : null
}

function getChildren(node: any): ONode[] {
  const tag = firstTagName(node)
  if (!tag) return []
  const val = node[tag]
  return asArray(val) as ONode[]
}

function findTop(doc: any[], tag: string): ONode | null {
  for (const n of doc) {
    if (isObj(n) && n[tag]) return n
  }
  return null
}

function findAll(nodes: any[], tag: string): ONode[] {
  const out: ONode[] = []
  for (const n of nodes) {
    if (isObj(n) && n[tag]) out.push(n)
  }
  return out
}

function findFirst(nodes: any[], tag: string): ONode | null {
  for (const n of nodes) {
    if (isObj(n) && n[tag]) return n
  }
  return null
}

function readText(node: any): string | null {
  // Handles:
  // { "#text": "12" }
  // { "duration": [ { "#text": "12" } ] }
  // "12"
  if (node === null || node === undefined) return null
  if (typeof node === "string" || typeof node === "number") return String(node)

  if (Array.isArray(node)) {
    for (const item of node) {
      const t = readText(item)
      if (t !== null) return t
    }
    return null
  }

  if (isObj(node)) {
    if (node["#text"] !== undefined) return String(node["#text"])
    // sometimes leaf tag maps straight to string or array
    const ks = nodeKeys(node)
    for (const k of ks) {
      const t = readText(node[k])
      if (t !== null) return t
    }
  }

  return null
}

function childText(children: any[], tag: string): string | null {
  const n = findFirst(children, tag)
  if (!n) return null
  return readText(n[tag])
}

function hasChild(children: any[], tag: string): boolean {
  return !!findFirst(children, tag)
}

/**
 * Tie extraction:
 * <tie type="start|stop"/>
 * <notations><tied type="start|stop"/></notations>
 */
function getTieTypesFromNoteChildren(noteChildren: any[]): { start: boolean; stop: boolean } {
  let start = false
  let stop = false

  for (const tieNode of findAll(noteChildren, "tie")) {
    const attrs = getAttrs(tieNode)
    if (attrs.type === "start") start = true
    if (attrs.type === "stop") stop = true
  }

  const notations = findFirst(noteChildren, "notations")
  if (notations) {
    const notChildren = asArray(notations["notations"]) as any[]
    for (const tiedNode of findAll(notChildren, "tied")) {
      const attrs = getAttrs(tiedNode)
      if (attrs.type === "start") start = true
      if (attrs.type === "stop") stop = true
    }
  }

  return { start, stop }
}

/**
 * Merge tied segments into a single long note.
 * Key by staff+midi (works well for piano).
 */
function mergeTies(
  events: (MusicXmlNoteEvent & { _tie?: { start: boolean; stop: boolean } })[]
): MusicXmlNoteEvent[] {
  const out: MusicXmlNoteEvent[] = []
  const open = new Map<string, MusicXmlNoteEvent>()

  for (const e of events) {
    const tie = e._tie
    const key = `${e.staff}:${e.midi}`

    if (tie?.start && !tie?.stop) {
      open.set(key, { ...e })
      continue
    }

    const existing = open.get(key)
    if (existing) {
      const end = Math.max(existing.startTime + existing.duration, e.startTime + e.duration)
      existing.duration = end - existing.startTime
      if (tie?.stop) {
        out.push(existing)
        open.delete(key)
      }
      continue
    }

    out.push(e)
  }

  for (const v of open.values()) out.push(v)
  return out
}

function tempoFromMeasureChildren(measureChildren: any[]): number | null {
  // direction -> sound tempo="..."
  for (const direction of findAll(measureChildren, "direction")) {
    const dirChildren = asArray(direction["direction"]) as any[]
    for (const sound of findAll(dirChildren, "sound")) {
      const attrs = getAttrs(sound)
      const tempo = safeNum(attrs.tempo, NaN)
      if (Number.isFinite(tempo) && tempo > 0) return tempo
    }
  }
  return null
}

const orderParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
})

const normalParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
})

async function extractScoreXmlFromMxl(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)

  // 1) container.xml preferred
  const container = zip.file("META-INF/container.xml")
  if (container) {
    const containerText = await container.async("text")
    const containerDoc = normalParser.parse(stripBOM(containerText).trim())
    const rootfiles = containerDoc?.container?.rootfiles?.rootfile
    const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles
    const fullPath = rootfile?.["full-path"] || rootfile?.fullPath
    if (typeof fullPath === "string") {
      const scoreFile = zip.file(fullPath)
      if (!scoreFile) throw new Error(`MXL container points to missing file: ${fullPath}`)
      return await scoreFile.async("text")
    }
  }

  // 2) fallback: pick the largest xml
  const xmlFiles = Object.values(zip.files).filter((f) => f.name.toLowerCase().endsWith(".xml"))
  const candidates = xmlFiles.filter((f) => !f.name.toLowerCase().includes("meta-inf/container.xml"))
  if (candidates.length === 0) throw new Error("MXL contains no XML score file")

  const sorted = candidates.sort(
    (a, b) => ((b as any)._data?.uncompressedSize ?? 0) - ((a as any)._data?.uncompressedSize ?? 0)
  )
  return await sorted[0].async("text")
}

export async function loadMusicXmlFromUrl(url: string, opts?: { bpm?: number }) {
  const fallbackBpm = opts?.bpm ?? 90

  const res = await fetch(url)
  if (!res.ok) throw new Error(`MusicXML fetch failed: ${res.status} ${res.statusText}`)

  const contentType = res.headers.get("content-type") || ""
  let xmlTextRaw: string

  if (url.toLowerCase().endsWith(".mxl") || contentType.includes("zip") || contentType.includes("octet-stream")) {
    const buffer = await res.arrayBuffer()
    xmlTextRaw = await extractScoreXmlFromMxl(buffer)
  } else {
    xmlTextRaw = await res.text()
  }

  const xmlText = stripBOM(xmlTextRaw).trim()

  console.log("MusicXML first 200:", xmlText.slice(0, 200))

  if (looksLikeHtml(xmlText)) {
    throw new Error("Fetched HTML instead of MusicXML — check filename/path in /public")
  }
  if (!looksLikeXml(xmlText)) {
    throw new Error(`Not valid MusicXML. First chars: ${xmlText.slice(0, 80)}`)
  }

  const doc = orderParser.parse(xmlText) as any[]
  const rootPartwise = findTop(doc, "score-partwise")
  if (rootPartwise) return parseScorePartwise(rootPartwise["score-partwise"], fallbackBpm)

  const rootTimewise = findTop(doc, "score-timewise")
  if (rootTimewise) return parseScoreTimewise(rootTimewise["score-timewise"], fallbackBpm)

  throw new Error("Unsupported MusicXML root (expected score-partwise or score-timewise)")
}

// -----------------------------
// PARTWISE (ordered, robust)
// -----------------------------
function parseScorePartwise(scoreChildren: any[], fallbackBpm: number) {
  const partNodes = findAll(scoreChildren, "part")
  if (partNodes.length === 0) throw new Error("No <part> found")

  const eventsRaw: (MusicXmlNoteEvent & { _tie?: { start: boolean; stop: boolean } })[] = []

  for (const partNode of partNodes) {
    const partChildren = asArray(partNode["part"]) as any[]
    const measures = findAll(partChildren, "measure")

    let t = 0
    let divisionsPerQuarter = 1
    let bpm = fallbackBpm

    measures.forEach((mNode, mi) => {
      const measureChildren = asArray(mNode["measure"]) as any[]

      // tempo change?
      const tempoHere = tempoFromMeasureChildren(measureChildren)
      if (tempoHere) bpm = tempoHere

      for (const item of measureChildren) {
        const tag = firstTagName(item)

        if (tag === "attributes") {
          const attrsChildren = asArray(item["attributes"]) as any[]
          const divText = childText(attrsChildren, "divisions")
          if (divText) {
            const d = safeNum(divText, divisionsPerQuarter)
            if (d > 0) divisionsPerQuarter = d
          }
          continue
        }

        if (tag === "backup") {
          const bChildren = asArray(item["backup"]) as any[]
          const durText = childText(bChildren, "duration")
          const dur = safeNum(durText, 0)
          t -= durationToSeconds(dur, divisionsPerQuarter, bpm)
          continue
        }

        if (tag === "forward") {
          const fChildren = asArray(item["forward"]) as any[]
          const durText = childText(fChildren, "duration")
          const dur = safeNum(durText, 0)
          t += durationToSeconds(dur, divisionsPerQuarter, bpm)
          continue
        }

        if (tag === "note") {
          const noteChildren = asArray(item["note"]) as any[]

          const durationText = childText(noteChildren, "duration")
          const durationDiv = safeNum(durationText, 0)
          if (!durationDiv) continue
          const durSec = durationToSeconds(durationDiv, divisionsPerQuarter, bpm)

          if (hasChild(noteChildren, "rest")) {
            t += durSec
            continue
          }

          const pitchNode = findFirst(noteChildren, "pitch")
          if (!pitchNode) {
            t += durSec
            continue
          }

          const pitchChildren = asArray(pitchNode["pitch"]) as any[]
          const step = childText(pitchChildren, "step")
          const octaveText = childText(pitchChildren, "octave")
          if (!step || octaveText === null) {
            t += durSec
            continue
          }

          const alterText = childText(pitchChildren, "alter")
          const alter = alterText !== null ? safeNum(alterText, 0) : undefined
          const octave = safeNum(octaveText, 0)

          const midi = pitchToMidi(step, alter, octave)
          const noteName = midiToNoteName(midi)

          const staffText = childText(noteChildren, "staff")
          const staff = safeNum(staffText, 1)
          const hand = staffToHand(staff)

          const tie = getTieTypesFromNoteChildren(noteChildren)
          const isChord = hasChild(noteChildren, "chord")

          eventsRaw.push({
            id: `m${mi + 1}-${eventsRaw.length}-${noteName}`,
            note: noteName,
            midi,
            startTime: t,
            duration: durSec,
            hand,
            staff,
            measure: mi + 1,
            _tie: tie,
          })

          if (!isChord) t += durSec
        }
      }
    })
  }

  eventsRaw.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)
  const merged = mergeTies(eventsRaw)
  merged.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)

  const duration = merged.length ? Math.max(...merged.map((e) => e.startTime + e.duration)) : 0
  return { events: merged, duration }
}

// -----------------------------
// TIMEWISE (ordered, robust)
// -----------------------------
function parseScoreTimewise(scoreChildren: any[], fallbackBpm: number) {
  const measureNodes = findAll(scoreChildren, "measure")
  if (measureNodes.length === 0) throw new Error("No <measure> found")

  const eventsRaw: (MusicXmlNoteEvent & { _tie?: { start: boolean; stop: boolean } })[] = []

  const partTime = new Map<string, number>()
  const partDivisions = new Map<string, number>()
  const partBpm = new Map<string, number>()

  measureNodes.forEach((mNode, mi) => {
    const measureChildren = asArray(mNode["measure"]) as any[]
    const partNodes = findAll(measureChildren, "part")

    for (const partNode of partNodes) {
      const partAttrs = getAttrs(partNode)
      const partId = String(partAttrs.id ?? "P1")

      let t = partTime.get(partId) ?? 0
      let divisionsPerQuarter = partDivisions.get(partId) ?? 1
      let bpm = partBpm.get(partId) ?? fallbackBpm

      const partChildren = asArray(partNode["part"]) as any[]
      const tempoHere = tempoFromMeasureChildren(partChildren)
      if (tempoHere) bpm = tempoHere

      for (const item of partChildren) {
        const tag = firstTagName(item)

        if (tag === "attributes") {
          const attrsChildren = asArray(item["attributes"]) as any[]
          const divText = childText(attrsChildren, "divisions")
          if (divText) {
            const d = safeNum(divText, divisionsPerQuarter)
            if (d > 0) divisionsPerQuarter = d
          }
          continue
        }

        if (tag === "backup") {
          const bChildren = asArray(item["backup"]) as any[]
          const durText = childText(bChildren, "duration")
          const dur = safeNum(durText, 0)
          t -= durationToSeconds(dur, divisionsPerQuarter, bpm)
          continue
        }

        if (tag === "forward") {
          const fChildren = asArray(item["forward"]) as any[]
          const durText = childText(fChildren, "duration")
          const dur = safeNum(durText, 0)
          t += durationToSeconds(dur, divisionsPerQuarter, bpm)
          continue
        }

        if (tag === "note") {
          const noteChildren = asArray(item["note"]) as any[]

          const durationText = childText(noteChildren, "duration")
          const durationDiv = safeNum(durationText, 0)
          if (!durationDiv) continue
          const durSec = durationToSeconds(durationDiv, divisionsPerQuarter, bpm)

          if (hasChild(noteChildren, "rest")) {
            t += durSec
            continue
          }

          const pitchNode = findFirst(noteChildren, "pitch")
          if (!pitchNode) {
            t += durSec
            continue
          }

          const pitchChildren = asArray(pitchNode["pitch"]) as any[]
          const step = childText(pitchChildren, "step")
          const octaveText = childText(pitchChildren, "octave")
          if (!step || octaveText === null) {
            t += durSec
            continue
          }

          const alterText = childText(pitchChildren, "alter")
          const alter = alterText !== null ? safeNum(alterText, 0) : undefined
          const octave = safeNum(octaveText, 0)

          const midi = pitchToMidi(step, alter, octave)
          const noteName = midiToNoteName(midi)

          const staffText = childText(noteChildren, "staff")
          const staff = safeNum(staffText, 1)
          const hand = staffToHand(staff)

          const tie = getTieTypesFromNoteChildren(noteChildren)
          const isChord = hasChild(noteChildren, "chord")

          eventsRaw.push({
            id: `m${mi + 1}-${partId}-${eventsRaw.length}-${noteName}`,
            note: noteName,
            midi,
            startTime: t,
            duration: durSec,
            hand,
            staff,
            measure: mi + 1,
            _tie: tie,
          })

          if (!isChord) t += durSec
        }
      }

      partTime.set(partId, t)
      partDivisions.set(partId, divisionsPerQuarter)
      partBpm.set(partId, bpm)
    }
  })

  eventsRaw.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)
  const merged = mergeTies(eventsRaw)
  merged.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)

  const duration = merged.length ? Math.max(...merged.map((e) => e.startTime + e.duration)) : 0
  return { events: merged, duration }
}
