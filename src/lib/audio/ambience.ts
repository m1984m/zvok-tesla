import { SCENE_AUDIO } from '../config'
import type { Scene } from '../scenes/types'

/** Proceduralni ambient scene (brez posnetkov → brez licenčnih vprašanj). */
export function createAmbience(ctx: AudioContext, a: Scene['ambience']): { out: GainNode; stop: () => void } {
  const out = ctx.createGain()
  out.gain.value = 0
  if (a.type === 'none') return { out, stop: () => {} }

  const len = Math.floor(ctx.sampleRate * SCENE_AUDIO.noiseBufferS)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      // rjavi šum za veter/morje, beli za dež/mesto
      b = a.type === 'wind' || a.type === 'sea' ? (b + 0.02 * w) / 1.02 : w
      d[i] = a.type === 'wind' || a.type === 'sea' ? b * 3.5 : w * 0.5
    }
    // brezšivna zanka: kratek preliv konca v začetek
    const x = Math.floor(ctx.sampleRate * 0.25)
    for (let i = 0; i < x; i++) {
      const g = i / x
      d[len - x + i] = d[len - x + i] * (1 - g) + d[i] * g
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = a.lowpassHz
  const level = ctx.createGain()
  level.gain.value = a.gain
  src.connect(lp).connect(level).connect(out)
  const extra: AudioScheduledSourceNode[] = []

  if (a.type === 'sea') {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = SCENE_AUDIO.seaLfoHz
    const depth = ctx.createGain()
    depth.gain.value = a.gain * SCENE_AUDIO.seaLfoDepth
    lfo.connect(depth).connect(level.gain)
    extra.push(lfo)
  }
  if (a.type === 'city') {
    const hum = ctx.createOscillator()
    hum.frequency.value = SCENE_AUDIO.cityHumHz
    const hg = ctx.createGain()
    hg.gain.value = SCENE_AUDIO.cityHumGain
    hum.connect(hg).connect(out)
    extra.push(hum)
  }
  src.start()
  extra.forEach((n) => n.start())
  return {
    out,
    stop: () => {
      src.stop()
      extra.forEach((n) => n.stop())
    },
  }
}
