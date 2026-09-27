import { describe, expect, it } from 'vitest'
import { rawRpm, rpm } from './drivetrain'
import { Gearbox } from './gearbox'
import { DRIVETRAIN, GEARBOX } from '../config'

const kmh = (v: number) => v / 3.6

describe('drivetrain', () => {
  it('100 km/h v 7. prestavi ≈ 2508 rpm', () => {
    expect(Math.abs(rpm(kmh(100), 7) - 2508)).toBeLessThanOrEqual(5)
  })
  it('1. prestava doseže omejevalnik pri ≈ 78 km/h', () => {
    const v = DRIVETRAIN.limiterRpm / rawRpm(1, 1)
    expect(v * 3.6).toBeGreaterThan(75)
    expect(v * 3.6).toBeLessThan(81)
  })
  it('prosti tek in omejevalnik', () => {
    expect(rpm(0, 1)).toBe(DRIVETRAIN.idleRpm)
    expect(rpm(kmh(200), 1)).toBe(DRIVETRAIN.limiterRpm)
  })
})

describe('gearbox auto', () => {
  it(`nikoli ne menja pogosteje kot na ${GEARBOX.minShiftIntervalS} s`, () => {
    const gb = new Gearbox()
    const shifts: number[] = []
    for (let i = 0; i < 6000; i++) {
      const t = i * 0.01
      const v = kmh(100 + 100 * Math.sin(t * 3))
      if (gb.update(Math.max(0, v), i % 200 < 100 ? 1 : 0, t)) shifts.push(t)
    }
    expect(shifts.length).toBeGreaterThan(5)
    for (let i = 1; i < shifts.length; i++) expect(shifts[i] - shifts[i - 1]).toBeGreaterThanOrEqual(GEARBOX.minShiftIntervalS - 1e-9)
  })
  it('lahko pospeševanje do 130 km/h konča v 7. prestavi', () => {
    const gb = new Gearbox()
    for (let i = 0; i <= 3000; i++) gb.update(kmh((130 * i) / 3000), 0, i * 0.01)
    expect(gb.gear).toBe(7)
  })
  it('zaviranje 130 → 0 km/h: prestave padajo ena po ena do 1., obrati ostanejo nad prostim tekom', () => {
    const gb = new Gearbox()
    gb.gear = 7
    let prev = 7
    const dt = 0.01
    const decel = -5 // m/s²
    let v = kmh(130)
    let t = 0
    while (v > 0) {
      gb.update(v, 0, t, decel)
      expect(prev - gb.gear).toBeLessThanOrEqual(1) // brez preskakovanja
      expect(gb.gear).toBeLessThanOrEqual(prev) // pri zaviranju nikoli gor
      prev = gb.gear
      if (v > kmh(25)) expect(rawRpm(v, gb.gear)).toBeGreaterThan(1500)
      expect(rawRpm(v, gb.gear)).toBeLessThan(DRIVETRAIN.limiterRpm)
      v += decel * dt
      t += dt
    }
    expect(gb.gear).toBeLessThanOrEqual(2)
  })
})

describe('gearbox brez nihanja', () => {
  it('pojemek, ki niha okoli meje zaviranja, ne povzroča menjav gor-dol', () => {
    const gb = new Gearbox()
    gb.gear = 5
    let v = kmh(90)
    const kinds: string[] = []
    for (let i = 0; i < 800; i++) {
      const a = i % 20 < 10 ? -1.4 : -1.6
      const k = gb.update(v, 0, i * 0.01, a)
      if (k) kinds.push(k)
      v += a * 0.01
    }
    expect(kinds).not.toContain('up')
  })
})

describe('gearbox ročno', () => {
  it('menjava dol, ki bi prevrtela motor, je zavrnjena', () => {
    const gb = new Gearbox()
    gb.mode = 'manual'
    gb.gear = 3
    expect(gb.manual(-1, 0, kmh(120))).toBeNull() // 2. pri 120 km/h > 8200 rpm
    expect(gb.gear).toBe(3)
    expect(gb.manual(-1, 1, kmh(60))).toBe('down')
    expect(gb.gear).toBe(2)
  })
})
