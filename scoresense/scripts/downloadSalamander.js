// Downloads the 30 Salamander Grand Piano MP3 samples from the Tone.js CDN
// into public/salamander/ for local hosting.
// Run once: node scripts/downloadSalamander.js

const https = require("https")
const fs = require("fs")
const path = require("path")

const BASE = "https://tonejs.github.io/audio/salamander/"
const OUT = path.join(__dirname, "../public/salamander")

const FILES = [
  "A0", "C1", "Ds1", "Fs1",
  "A1", "C2", "Ds2", "Fs2",
  "A2", "C3", "Ds3", "Fs3",
  "A3", "C4", "Ds4", "Fs4",
  "A4", "C5", "Ds5", "Fs5",
  "A5", "C6", "Ds6", "Fs6",
  "A6", "C7", "Ds7", "Fs7",
  "A7", "C8",
]

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

let pending = 0

FILES.forEach((name) => {
  const file = `${name}.mp3`
  const dest = path.join(OUT, file)

  if (fs.existsSync(dest) && fs.statSync(dest).size > 50_000) {
    console.log(`Skipping ${file} (already downloaded)`)
    return
  }

  pending++
  console.log(`Downloading ${file}...`)
  const out = fs.createWriteStream(dest)

  https.get(BASE + file, (res) => {
    res.pipe(out)
    out.on("finish", () => {
      out.close()
      const size = fs.statSync(dest).size
      console.log(`  ✓ ${file} (${(size / 1024).toFixed(0)} KB)`)
      pending--
      if (pending === 0) console.log("\nAll samples downloaded to public/salamander/")
    })
  }).on("error", (err) => {
    console.error(`  ✗ Failed to download ${file}: ${err.message}`)
    fs.unlinkSync(dest)
    pending--
  })
})

if (pending === 0) console.log("All samples already present — nothing to download.")
