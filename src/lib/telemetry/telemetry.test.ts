import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv, parseGpx, simulate } from './replay'
import { haversineM } from './gps'

const demo = parseCsv(readFileSync('static/replay/avtocesta.csv', 'utf8'))

describe('replay', () => {
  it('dva zagona dasta enako krivuljo v/a', () => {
    expect(demo.length).toBeGreaterThan(15)
    expect(simulate(demo, 1 / 30)).toEqual(simulate(demo, 1 / 30))
  })
  it('krivulja med GPS vzorci je zvezna (brez skokov)', () => {
    const c = simulate(demo, 1 / 30)
    for (let i = 1; i < c.length; i++) expect(Math.abs(c[i].v - c[i - 1].v)).toBeLessThan(0.5) // surovi GPS koraki so do 2,1 m/s
  })
  it('GPX: hitrost iz razdalje/Δt', () => {
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="46.0" lon="15.0"><time>2026-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="46.0009" lon="15.0"><time>2026-01-01T00:00:04Z</time></trkpt>
    </trkseg></trk></gpx>`
    const s = parseGpx(gpx)
    expect(s).toHaveLength(1)
    expect(s[0].v).toBeCloseTo(haversineM(46, 15, 46.0009, 15) / 4, 6)
    expect(s[0].v).toBeCloseTo(25, 0)
  })
})
