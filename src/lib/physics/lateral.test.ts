import { describe, expect, it } from 'vitest'
import { LateralEstimator, bearingDeg } from './lateral'

describe('bočni pospešek', () => {
  it('krožna vožnja 20 m/s, 10°/s desno → ≈ 3,49 m/s² (0,36 g)', () => {
    const le = new LateralEstimator()
    for (let t = 0; t <= 20; t++) le.ingest({ t, v: 20, heading: (350 + 10 * t) % 360 }) // tudi prehod čez 0°
    expect(le.aLat).toBeCloseTo(20 * ((10 * Math.PI) / 180), 2)
  })
  it('levi zavoj je negativen, ravna vožnja 0', () => {
    const le = new LateralEstimator()
    for (let t = 0; t <= 10; t++) le.ingest({ t, v: 15, heading: 90 - 5 * t })
    expect(le.aLat).toBeLessThan(-1)
    const st = new LateralEstimator()
    for (let t = 0; t <= 10; t++) st.ingest({ t, v: 30, heading: 45 })
    expect(st.aLat).toBe(0)
  })
  it('stoječ avto ali brez smeri → 0', () => {
    const le = new LateralEstimator()
    for (let t = 0; t <= 10; t++) le.ingest({ t, v: 1, heading: t * 40 })
    expect(le.aLat).toBe(0)
  })
  it('skok smeri, večji od fizikalno mogočega, se zavrže', () => {
    const le = new LateralEstimator()
    le.ingest({ t: 0, v: 20, heading: 0 })
    le.ingest({ t: 1, v: 20, heading: 170 })
    expect(le.aLat).toBe(0)
  })
  it('smer med točkama', () => {
    expect(bearingDeg(46, 15, 46.01, 15)).toBeCloseTo(0, 3)
    expect(bearingDeg(46, 15, 46, 15.01)).toBeCloseTo(90, 1)
  })
})
