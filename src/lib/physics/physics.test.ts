import { describe, expect, it } from 'vitest'
import { rawRpm, rpm } from './drivetrain'
import { Gearbox } from './gearbox'
import { DRIVETRAIN } from '../config'

const kmh = (v: number) => v / 3.6

describe('drivetrain', () => {
  it('100 km/h v 6. prestavi ≈ 2231 rpm', () => {
    expect(Math.abs(rpm(kmh(100), 6) - 2231)).toBeLessThanOrEqual(5)
  })
  it('1. prestava doseže 7000 rpm pri ≈ 65 km/h', () => {
    const v = 7000 / rawRpm(1, 1) // m/s pri 7000 rpm
    expect(v * 3.6).toBeGreaterThan(63)
    expect(v * 3.6).toBeLessThan(67)
  })
  it('prosti tek in omejevalnik', () => {
    expect(rpm(0, 1)).toBe(DRIVETRAIN.idleRpm)
    expect(rpm(kmh(200), 1)).toBe(DRIVETRAIN.limiterRpm)
  })
})

describe('gearbox auto', () => {
  it('nikoli ne menja več kot 1× v 0,8 s', () => {
    const gb = new Gearbox()
    const shifts: number[] = []
    // agresiven pospešek in zaviranje, korak 10 ms
    for (let i = 0; i < 6000; i++) {
      const t = i * 0.01
      const v = kmh(100 + 100 * Math.sin(t * 3))
      if (gb.update(Math.max(0, v), i % 200 < 100 ? 1 : 0, t)) shifts.push(t)
    }
    expect(shifts.length).toBeGreaterThan(5)
    for (let i = 1; i < shifts.length; i++) expect(shifts[i] - shifts[i - 1]).toBeGreaterThanOrEqual(0.8 - 1e-9)
  })
  it('pospeševanje do 130 km/h z lahkim plinom konča v 6. prestavi', () => {
    const gb = new Gearbox()
    for (let i = 0; i <= 3000; i++) gb.update(kmh((130 * i) / 3000), 0, i * 0.01)
    expect(gb.gear).toBe(6)
  })
})
