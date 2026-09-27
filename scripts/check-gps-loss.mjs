// Izpad signala GPS: 12 s položaji pri 110 km/h (brez coords.speed → hitrost iz razdalje), nato 12 s nič.
// Med izpadom: obrati mirni (brez skokov), prestava ista, zvok teče, brez napake na zaslonu.
// Uporaba: npm run build && node scripts/check-gps-loss.mjs
import { chromium } from 'playwright'
import { preview } from 'vite'

const server = await preview({ preview: { port: 4190, strictPort: true } })
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 46.0, longitude: 15.0 } })
const page = await context.newPage()
await page.goto('http://localhost:4190/')
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.locator('.start').click() // privzeti vir je GPS

const v = 110 / 3.6
let lat = 46.0
for (let i = 0; i < 12; i++) {
  lat += v / 111320
  await context.setGeolocation({ latitude: lat, longitude: 15.0, accuracy: 5 })
  await page.waitForTimeout(1000)
}
const before = await page.evaluate(() => ({ gear: window.__pogon.car.gear, kmh: window.__pogon.car.v * 3.6 }))
// izpad: 12 s brez novih položajev, vzorčimo stanje vsak okvir
const r = await page.evaluate(
  () =>
    new Promise((res) => {
      const rpm = []
      const gears = new Set()
      const t0 = performance.now()
      let stale = false
      const tick = () => {
        const c = window.__pogon.car
        rpm.push(c.rpm)
        gears.add(c.gear)
        stale ||= c.stale
        if (performance.now() - t0 < 12000) requestAnimationFrame(tick)
        else res({ rpm, gears: [...gears], stale, err: c.error, running: window.__pogon.audio.running })
      }
      requestAnimationFrame(tick)
    }),
)
let maxJump = 0
for (let i = 1; i < r.rpm.length; i++) maxJump = Math.max(maxJump, Math.abs(r.rpm[i] - r.rpm[i - 1]))
const ok = before.gear === 7 && r.gears.length === 1 && maxJump < 60 && r.running && !r.err && r.stale
console.log(`pred izpadom: ${before.kmh.toFixed(0)} km/h, ${before.gear}. prestava`)
console.log(`izpad 12 s: prestave ${r.gears.join(',')}, največji skok obratov na okvir ${maxJump.toFixed(1)}, zvok ${r.running ? 'teče' : 'NE teče'}, »ni signala« ${r.stale ? 'prikazan' : 'NI prikazan'}, napaka »${r.err}« → ${ok ? 'OK' : 'NAPAKA'}`)
await browser.close()
server.httpServer.close()
process.exit(ok ? 0 : 1)
