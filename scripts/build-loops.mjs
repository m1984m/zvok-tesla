// Iz surovih posnetkov naredi brezšivne zanke Opus 48 kHz mono + manifest.json.
// Uporaba: node scripts/build-loops.mjs <mapa_s_posnetki> <motor>
//   posnetki: on_<rpm>.wav, off_<rpm>.wav (npr. iz Engine Sim Recorder), vsak ≥ dolžina + preliv
//   izhod:    static/audio/<motor>/<on|off>_<rpm>.opus + manifest.json
// Potrebuje ffmpeg v PATH (winget install Gyan.FFmpeg).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [inDir, engine] = process.argv.slice(2)
if (!inDir || !engine) {
  console.error('Uporaba: node scripts/build-loops.mjs <mapa_s_posnetki> <motor>')
  process.exit(1)
}

// konstante iz src/lib/config.ts (SAMPLER), da ni podvajanja
const cfg = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8')
const num = (name) => Number(cfg.match(new RegExp(`${name}:\\s*(-?[\\d.]+)`))[1])
const L = num('loopLengthS')
const X = num('loopCrossfadeS')
const LUFS = num('loudnessLufs')

const outDir = join('static', 'audio', engine)
mkdirSync(outDir, { recursive: true })
const files = readdirSync(inDir).filter((f) => /^(on|off)_\d+\.(wav|flac|ogg|mp3)$/i.test(f))
if (!files.length) {
  console.error(`V ${inDir} ni datotek on_<rpm>.wav / off_<rpm>.wav`)
  process.exit(1)
}

// Šiv: telo [X, L+X] se na koncu prelije v začetek [0, X] → zanka konča tam, kjer začne.
const filter =
  `[0:a]aformat=channel_layouts=mono,asplit[a][b];` +
  `[a]atrim=${X}:${L + X},asetpts=PTS-STARTPTS[body];` +
  `[b]atrim=0:${X},asetpts=PTS-STARTPTS[head];` +
  `[body][head]acrossfade=d=${X}:c1=qsin:c2=qsin,loudnorm=I=${LUFS}:TP=-2:LRA=7,aresample=48000[out]`

const steps = new Set()
const states = new Set()
for (const f of files) {
  const [, st, rpm] = f.match(/^(on|off)_(\d+)/i)
  const out = join(outDir, `${st.toLowerCase()}_${rpm}.opus`)
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(inDir, f), '-filter_complex', filter, '-map', '[out]', '-ac', '1', '-c:a', 'libopus', '-b:a', '96k', out])
  steps.add(Number(rpm))
  states.add(st.toLowerCase())
  console.log(`${f} → ${out}`)
}
const manifest = { steps: [...steps].sort((a, b) => a - b), states: [...states].sort(), idle: false }
for (const st of manifest.states)
  for (const r of manifest.steps)
    if (!files.some((f) => f.toLowerCase().startsWith(`${st}_${r}.`))) {
      console.error(`Manjka ${st}_${r}: vsako stanje mora imeti vse korake.`)
      process.exit(1)
    }
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${manifest.steps.length} korakov × ${manifest.states.join('/')}`)
