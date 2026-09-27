// F3 test v pravem brskalniku: sinteza pri stopničastem posodabljanju rpm (kot glavna zanka,
// setTargetAtTime vsakih 33 ms, skakajoča obremenitev) ne sme imeti več klikov kot idealno gladka rampa.
// Uporaba: npm run build && node scripts/check-audio.mjs
import { chromium } from 'playwright'
import { preview } from 'vite'

const server = await preview({ preview: { port: 4179, strictPort: true } })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:4179/')

const res = await page.evaluate(async () => {
  const SR = 48000
  const DUR = 3
  async function render(mode, kind) {
    const ctx = new OfflineAudioContext(1, SR * DUR, SR)
    await ctx.audioWorklet.addModule('./worklets/engine.js')
    const n = new AudioWorkletNode(ctx, 'engine', { outputChannelCount: [1] })
    n.port.postMessage({ cylinders: kind === 'v12' ? 12 : 8, crackle: 0 })
    n.connect(ctx.destination)
    const rpm = n.parameters.get('rpm')
    const load = n.parameters.get('load')
    const f = (t) => 1000 + 7400 * Math.min(1, t / 2) // 1000 → 8400 v 2 s
    const lf = (t) => (Math.floor(t * 3) % 2 ? 1 : 0.2) // obremenitev skače 3× na s
    if (mode === 'click') {
      // kontrola merila: namerni skok enosmerne komponente pri 1,5 s
      const c = new ConstantSourceNode(ctx, { offset: 0 })
      c.offset.setValueAtTime(0.3, 1.5)
      c.connect(ctx.destination)
      c.start()
    }
    if (mode !== 'stepped') {
      rpm.setValueAtTime(1000, 0)
      rpm.linearRampToValueAtTime(8400, 2)
      load.setValueAtTime(0.6, 0)
    } else {
      for (let t = 0; t < DUR; t += 1 / 30) {
        rpm.setTargetAtTime(f(t), t, 0.05)
        load.setTargetAtTime(lf(t), t, 0.05)
      }
    }
    const buf = await ctx.startRendering()
    const d = buf.getChannelData(0)
    // klik = 25-ms okno (vsaj en vžig), katerega največji |drugi odvod| je > 3× mediana sosednjih 20 oken
    const W = SR / 40
    const wins = []
    let rms = 0
    for (let w = 0; (w + 1) * W < d.length; w++) {
      let m = 0
      for (let i = Math.max(2, w * W); i < (w + 1) * W; i++) {
        rms += d[i] * d[i]
        m = Math.max(m, Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]))
      }
      wins.push(m)
    }
    rms = Math.sqrt(rms / d.length)
    let clicks = 0
    for (let w = 10; w < wins.length - 10; w++) {
      const nb = wins.slice(w - 10, w + 10).sort((a, b) => a - b)
      if (wins[w] > 3 * nb[10]) clicks++
    }
    const nan = d.some((x) => !Number.isFinite(x))
    return { clicks, rms, nan }
  }
  const out = {}
  for (const kind of ['v12', 'v8']) {
    out[kind] = { ramp: await render('ramp', kind), stepped: await render('stepped', kind), click: await render('click', kind) }
  }
  return out
})

let ok = true
for (const [kind, r] of Object.entries(res)) {
  const pass = !r.stepped.nan && r.stepped.rms > 0.01 && r.stepped.clicks <= r.ramp.clicks && r.click.clicks >= 1
  ok &&= pass
  console.log(`${kind}: rms ${r.stepped.rms.toFixed(3)}, kliki stopničasto ${r.stepped.clicks}, gladko ${r.ramp.clicks}, kontrola ujame ${r.click.clicks} → ${pass ? 'OK' : 'NAPAKA'}`)
}
await browser.close()
server.httpServer.close()
process.exit(ok ? 0 : 1)
