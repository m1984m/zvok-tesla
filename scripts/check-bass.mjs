// Delež nizkih tonov (< 200 Hz) v zvoku motorja pri stalnih obratih. Uporaba: npm run build && node scripts/check-bass.mjs
import { chromium } from 'playwright'
import { preview } from 'vite'
import { readFileSync } from 'node:fs'

const server = await preview({ preview: { port: 4186, strictPort: true } })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:4186/')
const profiles = {
  V12: JSON.parse(readFileSync('src/lib/scenes/v12.json', 'utf8')).synth,
  V8: JSON.parse(readFileSync('src/lib/scenes/v8.json', 'utf8')).synth,
}
const res = await page.evaluate(async (profiles) => {
  const SR = 48000
  async function band(profile, rpm, lowpass) {
    const ctx = new OfflineAudioContext(1, SR * 2, SR)
    await ctx.audioWorklet.addModule('./worklets/engine.js')
    const n = new AudioWorkletNode(ctx, 'engine', { outputChannelCount: [1], processorOptions: { profile } })
    n.parameters.get('rpm').value = rpm
    n.parameters.get('load').value = 0.6
    let node = n
    if (lowpass) {
      const f = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 200, Q: 0.7 })
      n.connect(f)
      node = f
    }
    node.connect(ctx.destination)
    const d = (await ctx.startRendering()).getChannelData(0).slice(SR / 2) // brez vklopa
    return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length)
  }
  const out = {}
  for (const [name, p] of Object.entries(profiles))
    for (const rpm of [1500, 3000, 6000]) {
      const all = await band(p, rpm, false)
      const low = await band(p, rpm, true)
      out[`${name} ${rpm}`] = { rms: all, lowShare: low / all }
    }
  return out
}, profiles)
for (const [k, v] of Object.entries(res)) console.log(`${k.padEnd(9)} rpm: skupaj ${v.rms.toFixed(3)}, delež < 200 Hz ${(v.lowShare * 100).toFixed(0)} %`)
await browser.close()
server.httpServer.close()
