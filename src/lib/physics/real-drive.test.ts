import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../telemetry/replay'
import { Smoother, loadFromAccel } from './smoothing'
import { Gearbox, ShiftInputs } from './gearbox'
import { rawRpm } from './drivetrain'
import { DRIVETRAIN } from '../config'

// Prava vožnja 27.09.2026 (Matejev dnevnik vozila, 30 s ločljivost, brez koordinat):
// mesto 35–80 km/h, avtocesta 114 km/h, vrh 177 km/h. Interpolirano na 1 Hz + šum GPS.
const pts = parseCsv(readFileSync('src/lib/physics/fixtures/voznja_2026-09-27.csv', 'utf8'))

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
    si.update(loadFromAccel(a), a, dt)
    const k = gb.update(v, si.load, t, si.a)
    if (k) shifts.push({ t, kind: k, gear: gb.gear })
    maxRpm = Math.max(maxRpm, rawRpm(v, gb.gear))
    // enakomerna vožnja po avtocesti: 105–125 km/h in resnična hitrost se ne spreminja
    if (truth > 105 / 3.6 && truth < 125 / 3.6 && Math.abs(speedAt(t + 1) - truth) < 0.05) {
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

describe('prava vožnja 27.09.2026 (30 min)', () => {
  for (const [amp, seed] of [
    [0.5, 1],
    [1.0, 2],
    [1.5, 3],
  ] as const) {
    it(`šum GPS ±${amp} m/s: avtocesta v 7., brez nihanja, brez prevrtavanja`, () => {
      const r = simulate(amp, seed)
      console.log(
        `±${amp} m/s: ${r.shifts.length} menjav v 30 min, nihanj ${r.hunts}, avtocesta v 7.: ${(r.cruiseShare * 100).toFixed(1)} % ` +
          `(${(r.cruiseFrames / 30 / 60).toFixed(1)} min), najvišji obrati ${r.maxRpm.toFixed(0)}`,
      )
      expect(r.cruiseFrames).toBeGreaterThan(30 * 60 * 5) // vsaj 5 min enakomerne vožnje
      expect(r.cruiseShare).toBeGreaterThan(0.98)
      expect(r.hunts).toBe(0)
      expect(r.maxRpm).toBeLessThan(DRIVETRAIN.limiterRpm)
    })
  }
})
