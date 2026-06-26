import { Midi } from "@tonejs/midi"

export type NoteEvent = {
  id: string
  midi: number
  name: string // e.g. C4, F#3
  time: number // seconds
  duration: number // seconds
  velocity: number // 0..1
  track: number
  channel: number // MIDI channel 0-15
}

export type TrackInfo = {
  index: number
  name: string
  channel: number
  noteCount: number
}

export type PedalEvent = {
  time: number
  down: boolean
  value: number // 0..127
}

function midiToNoteName(midi: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const pitch = names[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${pitch}${octave}`
}

export async function loadMidiFromUrl(url: string): Promise<{
  events: NoteEvent[]
  duration: number
  bpm?: number
  pedalEvents?: PedalEvent[]
  tracks: TrackInfo[]
}> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch MIDI: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()

  const midi = new Midi(arrayBuffer)

  // Tonejs/midi stores times in seconds based on the MIDI tempo map.
  const events: NoteEvent[] = []
  const tracks: TrackInfo[] = []

  midi.tracks.forEach((t, ti) => {
    // @tonejs/midi exposes .channel on the Track at runtime but not always in
    // the TypeScript declaration.  Fall back to the first note's channel if
    // the track-level property isn't available, then default to the track index
    // so different staves end up with different channel values even in edge cases.
    const firstNoteChannel = (t.notes[0] as any)?.channel as number | undefined
    const trackChannel = ((t as any).channel ?? firstNoteChannel ?? ti) as number
    tracks.push({
      index: ti,
      name: t.name ?? "",
      channel: trackChannel,
      noteCount: t.notes.length,
    })
    t.notes.forEach((n, ni) => {
      const noteChannel = ((n as any).channel as number | undefined) ?? trackChannel
      events.push({
        id: `${ti}-${ni}-${n.midi}-${n.time.toFixed(3)}`,
        midi: n.midi,
        name: midiToNoteName(n.midi),
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        track: ti,
        channel: noteChannel,
      })
    })
  })

  events.sort((a, b) => a.time - b.time || a.midi - b.midi)

  // Extract sustain pedal (CC 64) events from all tracks
  const pedalEventsRaw: PedalEvent[] = []
  midi.tracks.forEach((track) => {
    if (track.controlChanges[64]) {
      track.controlChanges[64].forEach((cc) => {
        pedalEventsRaw.push({
          time: cc.time,
          value: cc.value,
          // @tonejs/midi normalises CC values to 0–1; MIDI threshold 64/127 ≈ 0.504
          down: cc.value >= 0.5,
        })
      })
    }
  })

  // De-duplicate and sort pedal events (only keep state changes)
  const pedalEventsDeduplicated: PedalEvent[] = []
  let lastDown: boolean | null = null
  for (const evt of pedalEventsRaw.sort((a, b) => a.time - b.time)) {
    if (evt.down !== lastDown) {
      pedalEventsDeduplicated.push(evt)
      lastDown = evt.down
    }
  }

  const duration = midi.duration

  // Optional: first tempo event if present
  const bpm = midi.header.tempos?.[0]?.bpm

  return { events, duration, bpm, pedalEvents: pedalEventsDeduplicated, tracks }
}
