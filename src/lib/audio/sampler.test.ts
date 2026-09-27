import { describe, expect, it } from 'vitest'
import { samplerMix, type Manifest } from './engineSampler'

const steps = Array.from({ length: 13 }, (_, i) => 1000 + i * 500)
const m: Manifest = { steps, states: ['on', 'off'], idle: false }

const gainsAt = (rpm: number, load: number) => {
  const g = new Map<string, number>()
  for (const v of samplerMix(rpm, load, false, m)) g.set(v.key, (g.get(v.key) ?? 0) + v.gain)
  return g
}

describe('samplerMix', () => {
  it('enakomočni preliv: vsota kvadratov = 1 povsod', () => {
    for (let r = 1000; r <= 7000; r += 7) {
      const s = [...gainsAt(r, 0.5).values()].reduce((a, g) => a + g * g, 0)
      expect(s).toBeCloseTo(1, 9)
    }
  })
  it('počasno naraščanje rpm: noben glas ne skoči (tudi čez mejo koraka)', () => {
    let prev = gainsAt(1000, 0.7)
    for (let r = 1001; r <= 7000; r += 1) {
      const cur = gainsAt(r, 0.7)
      for (const k of new Set([...prev.keys(), ...cur.keys()])) {
        expect(Math.abs((cur.get(k) ?? 0) - (prev.get(k) ?? 0))).toBeLessThan(0.01)
      }
      prev = cur
    }
  })
  it('playbackRate vsakega glasu = rpm / korak', () => {
    for (const v of samplerMix(3250, 1, false, m)) {
      const step = Number(v.key.split('_')[1])
      expect(v.rate).toBeCloseTo(3250 / step, 9)
    }
  })
  it('overrun: samo off zanke', () => {
    const on = samplerMix(4000, 1, true, m).filter((v) => v.key.startsWith('on_'))
    expect(on.every((v) => v.gain < 1e-9)).toBe(true)
  })
})
