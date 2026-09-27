// Preverjanje granularnega motorja v Chromiumu (OfflineAudioContext):
//  1) višina sledi obratom: prevladujoči harmonik pri 6000 rpm ≈ 2× tisti pri 3000 rpm
//  2) brez klikov pri stopničastem posodabljanju obratov (kot glavna zanka)
//  3) zapiše demo WAV (prosti tek → pospeševanje skozi prestave → odvzem plina) za poslušanje
// Uporaba: npm run build && node scripts/check-granular.mjs [mapa_za_wav]
import { chromium } from 'playwright'
import { preview } from 'vite'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2]
const server = await preview({ preview: { port: 4188, strictPort: true } })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:4188/')

const res = await page.evaluate(async () => {
  const SR = 48000
  async function makeNode(ctx, engine) {
    await ctx.audioWorklet.addModule('./worklets/granular.js')
    const map = await (await fetch(`./audio/${engine}/map.json`)).json()
    const buf = await ctx.decodeAudioData(await (await fetch(`./audio/${engine}/clip.opus`)).arrayBuffer())
    const pcm = buf.getChannelData(0).slice()
    const n = new AudioWorkletNode(ctx, 'granular', { outputChannelCount: [1] })
    n.port.postMessage({ pcm, hop: map.hop, rms: Float32Array.from(map.rms), layers: map.layers, idle: map.idle, idleRpm: map.idleRpm, gain: map.gain }, [pcm.buffer])
    n.connect(ctx.destination)
    return n
  }
  // log-frekvenčni spekter 60–3000 Hz (48 pasov na oktavo)
  function logSpec(d) {
    const N = 16384
    const x = d.subarray(d.length - N)
    const bins = []
    for (let k = 0; ; k++) {
      const f = 60 * 2 ** (k / 48)
      if (f > 3000) break
      let re = 0
      let im = 0
      const w = (2 * Math.PI * f) / SR
      for (let i = 0; i < N; i += 2) {
        const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)
        re += x[i] * h * Math.cos(w * i)
        im += x[i] * h * Math.sin(w * i)
      }
      bins.push(Math.log(re * re + im * im + 1e-12))
    }
    const m = bins.reduce((a, b) => a + b, 0) / bins.length
    return bins.map((v) => v - m)
  }
  // premik (v oktavah), ki najbolje poravna spekter a s spektrom b
  function octaveShift(a, b) {
    let best = -Infinity
    let bs = 0
    for (let s = 0; s <= 72; s++) {
      let c = 0
      let n = 0
      for (let i = 0; i + s < b.length; i++) {
        c += a[i] * b[i + s]
        n++
      }
      c /= n
      if (c > best) {
        best = c
        bs = s
      }
    }
    return bs / 48
  }
  function clicks(d) {
    const W = SR / 40
    const wins = []
    for (let w = 0; (w + 1) * W < d.length; w++) {
      let m = 0
      for (let i = Math.max(2, w * W); i < (w + 1) * W; i++) m = Math.max(m, Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]))
      wins.push(m)
    }
    let c = 0
    for (let w = 10; w < wins.length - 10; w++) {
      const nb = wins.slice(w - 10, w + 10).sort((a, b) => a - b)
      if (wins[w] > 3 * nb[10]) c++
    }
    return c
  }
  const out = {}
  for (const engine of ['sportni', 'v8_360']) {
    // zrnatost: nihanje glasnosti (5-ms RMS) pri stalnih obratih, koeficient variacije
    let flutter = 0
    {
      const ctx = new OfflineAudioContext(1, SR * 3, SR)
      const n = await makeNode(ctx, engine)
      n.parameters.get('rpm').value = 4000
      n.parameters.get('load').value = 0.7
      await new Promise((r) => setTimeout(r, 50))
      const d = (await ctx.startRendering()).getChannelData(0).subarray(SR)
      const W = SR / 200
      const e = []
      for (let i = 0; i + W <= d.length; i += W) {
        let q = 0
        for (let j = i; j < i + W; j++) q += d[j] * d[j]
        e.push(Math.sqrt(q / W))
      }
      const m = e.reduce((a, b) => a + b, 0) / e.length
      flutter = Math.sqrt(e.reduce((a, b) => a + (b - m) ** 2, 0) / e.length) / m
    }
    const pitch = []
    for (const rpm of [3000, 6000]) {
      const ctx = new OfflineAudioContext(1, SR * 1.2, SR)
      const n = await makeNode(ctx, engine)
      n.parameters.get('rpm').value = rpm
      n.parameters.get('load').value = 1
      await new Promise((r) => setTimeout(r, 50)) // sporočilo s posnetkom prispe pred izrisom
      pitch.push(logSpec((await ctx.startRendering()).getChannelData(0)))
    }
    // demo: 2 s prosti tek, pospeševanje 1.–3. prestava, odvzem plina
    const DUR = 14
    const ctx = new OfflineAudioContext(1, SR * DUR, SR)
    const n = await makeNode(ctx, engine)
    await new Promise((r) => setTimeout(r, 50))
    const rpm = n.parameters.get('rpm')
    const load = n.parameters.get('load')
    const ov = n.parameters.get('overrun')
    const curve = (t) => {
      if (t < 2) return [1000, 0, 0]
      const pulls = [[2, 4.5, 2200, 7800], [4.7, 7.2, 5200, 7900], [7.4, 10.2, 5800, 7700]]
      for (const [a, b, r0, r1] of pulls) if (t >= a && t < b) return [r0 + ((r1 - r0) * (t - a)) / (b - a), 1, 0]
      if (t >= 10.2) return [Math.max(1000, 7700 - (t - 10.2) * 1500), 0, 1]
      return [5500, 0.2, 0] // menjava
    }
    for (let t = 0; t < DUR; t += 1 / 30) {
      const [r, l, o] = curve(t)
      rpm.setTargetAtTime(r, t, 0.05)
      load.setTargetAtTime(l, t, 0.05)
      ov.setTargetAtTime(o, t, 0.05)
    }
    const d = (await ctx.startRendering()).getChannelData(0)
    let peak = 0
    let rms = 0
    for (const x of d) {
      peak = Math.max(peak, Math.abs(x))
      rms += x * x
    }
    out[engine] = { flutter, ratio: 2 ** octaveShift(pitch[0], pitch[1]), clicks: clicks(d), peak, rms: Math.sqrt(rms / d.length), wav: Array.from(d.filter((_, i) => i % 1 === 0)) }
  }
  return out
})

// pričakovano razmerje višine: športni sledi obratom 1 : 1; V8 ima razteg (1000–2200 posnetka → 1000–5000 prikaza),
// zato 3000 → 1600 in 6000 → 2200 · 6000/5000 (hitrost nad vrhom posnetka)
const EXPECT = { sportni: 2, v8_360: (2200 * (6000 / 4875)) / 1600 }
let ok = true
for (const [engine, r] of Object.entries(res)) {
  const ratio = r.ratio
  const want = EXPECT[engine]
  const pass = Math.abs(ratio - want) < 0.2 && r.clicks <= 2 && r.rms > 0.05
  ok &&= pass
  console.log(`${engine}: višina 3000→6000 rpm ×${ratio.toFixed(2)} (pričakovano ×${want.toFixed(2)}), klikov ${r.clicks}, zrnatost ${(r.flutter * 100).toFixed(0)} %, vrh ${r.peak.toFixed(2)}, rms ${r.rms.toFixed(3)} → ${pass ? 'OK' : 'NAPAKA'}`)
  if (outDir) {
    mkdirSync(outDir, { recursive: true })
    const d = Float32Array.from(r.wav)
    const norm = 0.9 / Math.max(1e-6, r.peak)
    const b = Buffer.alloc(44 + d.length * 2)
    b.write('RIFF', 0); b.writeUInt32LE(36 + d.length * 2, 4); b.write('WAVEfmt ', 8)
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24)
    b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(d.length * 2, 40)
    d.forEach((x, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x * norm * 32767))), 44 + i * 2))
    writeFileSync(join(outDir, `demo_${engine}.wav`), b)
  }
}
await browser.close()
server.httpServer.close()
process.exit(ok ? 0 : 1)
