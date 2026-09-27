// Delež harmonika vžiga (±4 %) v izhodu V12 pri stalnih obratih 2500–6000: iskanje padca »zvoka«.
import { chromium } from 'playwright'
import { preview } from 'vite'
const server = await preview({ preview: { port: 4196, strictPort: true } })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:4196/')
const res = await page.evaluate(async () => {
  const SR = 48000
  const lin = (d) => (680 + ((d - 1000) * 2420) / 4500) / 10
  const out = []
  for (let rpm = 2500; rpm <= 6000; rpm += 250) {
    const ctx = new OfflineAudioContext(1, SR * 1.2, SR)
    await ctx.audioWorklet.addModule('./worklets/granular.js')
    const map = await (await fetch('./audio/v12/map.json')).json()
    const buf = await ctx.decodeAudioData(await (await fetch('./audio/v12/clip.opus')).arrayBuffer())
    const pcm = buf.getChannelData(0).slice()
    const n = new AudioWorkletNode(ctx, 'granular', { outputChannelCount: [1] })
    n.port.postMessage({ pcm, hop: map.hop, rms: Float32Array.from(map.rms), layers: map.layers, idle: map.idle, idleRpm: map.idleRpm, gain: map.gain }, [pcm.buffer])
    n.connect(ctx.destination)
    n.parameters.get('rpm').value = Math.min(rpm, 20000)
    n.parameters.get('load').value = 1
    await new Promise((r) => setTimeout(r, 30))
    const d = (await ctx.startRendering()).getChannelData(0)
    const N = 32768
    const x = d.subarray(d.length - N)
    const f0 = Math.min(lin(rpm), lin(5481) * (rpm / 5481))
    let harm = 0
    let tot = 0
    for (const h of [0.5, 1, 1.5, 2]) {
      for (let g = f0 * h * 0.96; g <= f0 * h * 1.04; g += 0.5) {
        let re = 0
        let im = 0
        const w = (2 * Math.PI * g) / SR
        for (let i = 0; i < N; i += 4) {
          const hh = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)
          re += x[i] * hh * Math.cos(w * i)
          im += x[i] * hh * Math.sin(w * i)
        }
        harm = Math.max(harm, re * re + im * im)
      }
    }
    for (let i = 0; i < N; i++) tot += x[i] * x[i]
    out.push({ rpm, rms: Math.sqrt(tot / N), harm: (10 * Math.log10(harm / tot)).toFixed(1) })
  }
  return out
})
for (const r of res) console.log(`${r.rpm} rpm: rms ${r.rms.toFixed(3)}, harmonik/skupaj ${r.harm} dB`)
await browser.close()
server.httpServer.close()
