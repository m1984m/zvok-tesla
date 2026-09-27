import { describe, expect, it } from 'vitest'
import { Smoother, loadFromAccel } from './smoothing'
import { Gearbox, ShiftInputs } from './gearbox'

const kmh = (v: number) => v / 3.6

// deterministični šum (LCG), ±amp
function noise(seed: number) {
  let s = seed
  return (amp: number) => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s / 4294967296 - 0.5) * 2 * amp
  }
}

/** Celotna veriga kot v engine.ts: GPS 1 Hz → Smoother → ShiftInputs → Gearbox, 30 fps. */
function drive(speedAt: (t: number) => number, dur: number, gpsNoise: number, gapFrom = Infinity, gapTo = -1) {
  const sm = new Smoother()
  const si = new ShiftInputs()
  const gb = new Gearbox()
  gb.gear = 7
  const n = noise(7)
  const gears: number[] = []
  let shifts = 0
  let nextGps = 0
  const dt = 1 / 30
  for (let t = 0; t < dur; t += dt) {
    if (t >= nextGps) {
      if (t < gapFrom || t > gapTo) sm.ingest({ t, v: Math.max(0, speedAt(t) + n(gpsNoise)) })
      nextGps += 1
    }
    const { v, a } = sm.predict(t)
    si.update(loadFromAccel(a), a, dt)
    if (gb.update(v, si.load, t, si.a)) shifts++
    gears.push(gb.gear)
  }
  return { gears, shifts }
}

describe('vožnja po avtocesti s šumnim GPS', () => {
  it('110 km/h ±1,5 m/s šuma 5 min: ostane v 7. prestavi', () => {
    const r = drive(() => kmh(110), 300, 1.5)
    expect(r.shifts).toBe(0)
    expect(new Set(r.gears)).toEqual(new Set([7]))
  })
  it('izpad signala 20 s pri 110 km/h: brez menjav', () => {
    const r = drive(() => kmh(110), 120, 0.8, 40, 60)
    expect(r.shifts).toBe(0)
  })
  it('napačen vzorec GPS (skok na 40 km/h za 1 s) ne sproži menjave', () => {
    const r = drive((t) => (t > 30 && t < 31.5 ? kmh(40) : kmh(110)), 90, 0.3)
    expect(r.shifts).toBe(0)
  })
  it('močan pospešek 80 → 140 km/h sproži menjavo dol (kickdown) in nato nazaj gor', () => {
    const r = drive((t) => (t < 10 ? kmh(80) : kmh(Math.min(140, 80 + (t - 10) * 12))), 40, 0.2)
    expect(Math.min(...r.gears)).toBeLessThan(7)
    expect(r.gears[r.gears.length - 1]).toBe(7)
    expect(r.shifts).toBeLessThanOrEqual(6)
  })
})
