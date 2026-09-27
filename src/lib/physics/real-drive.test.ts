import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../telemetry/replay'
import { Smoother, loadFromAccel } from './smoothing'
import { Gearbox, ShiftInputs } from './gearbox'
import { rawRpm } from './drivetrain'
import { DRIVETRAIN } from '../config'

// Prave vožnje (Matejev dnevnik vozila, 30 s ločljivost, samo čas in hitrost, brez koordinat):
// mesto, regionalna cesta, avtocesta. Interpolirano na 1 Hz + šum GPS.
const DIR = 'src/lib/physics/fixtures/'
const drives = readdirSync(DIR)
  .filter((f) => f.startsWith('voznja_'))
  .map((f) => ({ name: f.replace('voznja_', '').replace('.csv', ''), pts: parseCsv(readFileSync(DIR + f, 'utf8')) }))

let pts = drives[0].pts
function speedAt(t: number): number {
  let i = 0
  while (i < pts.length - 2 && pts[i + 1].t < t) i++
  const a = pts[i]
  const b = pts[i + 1]
  const x = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))
  const s = (1 - Math.cos(Math.PI * x)) / 2 // gladko pospeševanje med zapisi
  return a.v + (b.v - a.v) * s
}

function simulate(noiseAmp: number, seed: number) {
  let r = seed
  const n = () => {
    r = (r * 1664525 + 1013904223) >>> 0
    return (r / 4294967296 - 0.5) * 2 * noiseAmp
  }
  const sm = new Smoother()
  const si = new ShiftInputs()
  const gb = new Gearbox()
  const dt = 1 / 30
  const shifts: { t: number; kind: string; gear: number }[] = []
  let cruiseFrames = 0
  let cruiseTop = 0
  let maxRpm = 0
  let next = 0
  const end = pts[pts.length - 1].t
  for (let t = 0; t < end; t += dt) {
    const truth = speedAt(t)
    if (t >= next) {
      sm.ingest({ t, v: Math.max(0, truth + (truth > 1 ? n() : 0)) })
      next += 1
    }
    const { v, a } = sm.predict(t)
    si.update(a, dt)
    const k = gb.update(v, si.load, t, si.a)
    if (k) shifts.push({ t, kind: k, gear: gb.gear })
    maxRpm = Math.max(maxRpm, rawRpm(v, gb.gear))
    // enakomerna vožnja po avtocesti: 100–135 km/h in resnična hitrost se ne spreminja
    if (truth > 100 / 3.6 && truth < 135 / 3.6 && Math.abs(speedAt(t + 1) - truth) < 0.05) {
      cruiseFrames++
      if (gb.gear === 7) cruiseTop++
    }
  }
  // nihanje: menjava in nasprotna menjava v manj kot 3 s
  let hunts = 0
  for (let i = 1; i < shifts.length; i++)
    if (shifts[i].kind !== shifts[i - 1].kind && shifts[i].t - shifts[i - 1].t < 3) hunts++
  return { shifts, hunts, cruiseShare: cruiseTop / Math.max(1, cruiseFrames), cruiseFrames, maxRpm }
}

for (const d of drives) {
  describe(`prava vožnja ${d.name}`, () => {
    for (const [amp, seed] of [
      [0.5, 1],
      [1.0, 2],
      [1.5, 3],
    ] as const) {
      it(`šum GPS ±${amp} m/s: brez nihanja, brez prevrtavanja, avtocesta v 7.`, () => {
        pts = d.pts
        const r = simulate(amp, seed)
        const min = (pts[pts.length - 1].t / 60).toFixed(0)
        console.log(
          `${d.name} (${min} min) ±${amp} m/s: ${r.shifts.length} menjav, nihanj ${r.hunts}, ` +
            `avtocesta ${(r.cruiseFrames / 30 / 60).toFixed(1)} min od tega v 7. ${(r.cruiseShare * 100).toFixed(1)} %, najvišji obrati ${r.maxRpm.toFixed(0)}`,
        )
        if (process.env.DBG && r.hunts) {
          const sh = r.shifts
          const out: string[] = []
          for (let i = 1; i < sh.length; i++)
            if (sh[i].kind !== sh[i - 1].kind && sh[i].t - sh[i - 1].t < 3)
              out.push(`[${sh[i - 1].t.toFixed(1)}s ${sh[i - 1].kind}→${sh[i - 1].gear} @${(speedAt(sh[i - 1].t) * 3.6).toFixed(0)} | ${sh[i].t.toFixed(1)}s ${sh[i].kind}→${sh[i].gear} @${(speedAt(sh[i].t) * 3.6).toFixed(0)}]`)
          console.log('NIHANJA ' + d.name + ' ' + out.join(' '))
        }
        expect(r.hunts).toBe(0)
        expect(r.maxRpm).toBeLessThan(DRIVETRAIN.limiterRpm)
        if (r.cruiseFrames > 30 * 60) expect(r.cruiseShare).toBeGreaterThan(0.98) // vsaj 1 min enakomerne vožnje
      })
    }
  })
}
