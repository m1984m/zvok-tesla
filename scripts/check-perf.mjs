// Zmogljivost na šibkem MCU (Intel Atom): Chromium s 6× upočasnjenim procesorjem.
// Meri čas JS na okvir (glavna nit) in ali zvok teče. Uporaba: npm run build && node scripts/check-perf.mjs
import { chromium } from 'playwright'
import { preview } from 'vite'

const RATE = Number(process.argv[2] ?? 6)
const server = await preview({ preview: { port: 4182, strictPort: true } })
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, colorScheme: 'dark' })
await page.goto('http://localhost:4182/')
await page.locator('.start').click()
await page.locator('.src').click()
await page.locator('.menu button', { hasText: 'Demo vožnja' }).click()
await page.getByRole('button', { name: /V8/ }).click()
await page.waitForFunction(() => window.__pogon.car.v > 5, null, { timeout: 20000 })
const cdp = await page.context().newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
await cdp.send('Performance.enable')
const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
await page.waitForTimeout(10000)
const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const busy = (m1.TaskDuration - m0.TaskDuration) / 10 // TaskDuration že vsebuje skripte
const st = await page.evaluate(() => ({ low: window.__pogon.car.lowPower, run: window.__pogon.audio.running }))
const part = (k) => (((m1[k] - m0[k]) / 10) * 100).toFixed(1)
console.log(`  skripte ${part('ScriptDuration')} %, slogi ${part('RecalcStyleDuration')} %, postavitev ${part('LayoutDuration')} %`)
console.log(`CPU ${RATE}×: glavna nit zasedena ${(busy * 100).toFixed(1)} %, lowPower=${st.low}, zvok ${st.run ? 'teče' : 'NE teče'}`)
await browser.close()
server.httpServer.close()
