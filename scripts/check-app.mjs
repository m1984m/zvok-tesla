// Preverjanje sprejema F5–F7 na zgrajeni aplikaciji v Chromiumu.
// Uporaba: npm run build && node scripts/check-app.mjs [url]
//   F5: igla (rpm/hitrost) se spreminja zvezno, ne v korakih GPS
//   F6: preklop scene ne prekine zvoka za > 300 ms
//   F7: po prvem nalaganju aplikacija deluje brez povezave
import { chromium } from 'playwright'
import { preview } from 'vite'

const arg = process.argv[2]
const server = arg ? null : await preview({ preview: { port: 4180, strictPort: true } })
const url = arg ?? 'http://localhost:4180/'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let ok = true
const report = (name, pass, detail) => {
  ok &&= pass
  console.log(`${pass ? 'OK    ' : 'NAPAKA'} ${name}: ${detail}`)
}

await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.locator('.start').click()
await page.locator('.src').click()
await page.locator('.menu button', { hasText: 'Demo vožnja' }).click()
await page.waitForFunction(() => window.__pogon.car.v > 5, null, { timeout: 20000 })

// F5: 6 s vzorčenja na vsak okvir
const f5 = await page.evaluate(
  () =>
    new Promise((res) => {
      const vs = []
      const t0 = performance.now()
      const tick = () => {
        vs.push(window.__pogon.car.v)
        if (performance.now() - t0 < 6000) requestAnimationFrame(tick)
        else res(vs)
      }
      requestAnimationFrame(tick)
    }),
)
let maxJump = 0
let changes = 0
for (let i = 1; i < f5.length; i++) {
  const d = Math.abs(f5[i] - f5[i - 1])
  maxJump = Math.max(maxJump, d)
  if (d > 1e-6) changes++
}
// zanka teče pri ≤ 30 fps, GPS pri 1 Hz → zvezno pomeni ≫ 6 sprememb v 6 s
report('F5 igla zvezna', changes > 60 && maxJump < 0.5, `${changes} sprememb v 6 s, največji skok ${maxJump.toFixed(3)} m/s`)

// F6: merjenje RMS izhoda vsakih 10 ms med preklopi scen
const f6 = await page.evaluate(async () => {
  const an = window.__pogon.audio.meter()
  const buf = new Float32Array(an.fftSize)
  const rms = []
  const iv = setInterval(() => {
    an.getFloatTimeDomainData(buf)
    rms.push(Math.sqrt(buf.reduce((a, x) => a + x * x, 0) / buf.length))
  }, 10)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await wait(800)
  const names = ['V8', 'Športni', 'V8', 'Športni', 'V8']
  for (const n of names) {
    ;[...document.querySelectorAll('.engines button')].find((b) => b.querySelector('b').textContent.trim() === n).click()
    await wait(900)
  }
  clearInterval(iv)
  const base = rms.slice(10, 70).reduce((a, b) => a + b, 0) / 60
  let run = 0
  let worst = 0
  for (const r of rms) {
    run = r < base * 0.1 ? run + 10 : 0
    worst = Math.max(worst, run)
  }
  return { base, worst, n: rms.length }
})
report('F6 preklop scene', f6.base > 0.005 && f6.worst <= 300, `osnovni RMS ${f6.base.toFixed(3)}, najdaljša tišina ${f6.worst} ms (${f6.n} meritev)`)

// F7: brez povezave
await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated', null, { timeout: 15000 })
await page.reload() // stran zdaj nadzira service worker
await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
await context.setOffline(true)
await page.reload()
const offlineOk = await page.locator('.start').isVisible()
await page.locator('.start').click()
await page.locator('.src').click()
await page.locator('.menu button', { hasText: 'Demo vožnja' }).click()
const rolling = await page
  .waitForFunction(() => window.__pogon.car.v > 1 && window.__pogon.audio.running, null, { timeout: 15000 })
  .then(() => true)
  .catch(() => false)
report('F7 brez povezave', offlineOk && rolling, `stran ${offlineOk ? 'naložena' : 'NI naložena'}, posnetek in zvok ${rolling ? 'tečeta' : 'NE tečeta'}`)
await context.setOffline(false)

report('Brez napak JS', errors.length === 0, errors.join(' | ') || 'nič')
await browser.close()
server?.httpServer.close()
process.exit(ok ? 0 : 1)
