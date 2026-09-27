import { SCENE_AUDIO } from '../config'
import type { Scene } from '../scenes/types'

/** Sintetičen impulzni odziv: eksponentno pojemajoč šum + zgodnji odboji glede na prostor. */
export function makeImpulse(ctx: BaseAudioContext, ac: Scene['acoustics']): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.max(1, Math.floor(sr * (ac.decayS + SCENE_AUDIO.irPreDelayS)))
  const buf = ctx.createBuffer(2, len, sr)
  const pre = Math.floor(sr * SCENE_AUDIO.irPreDelayS)
  // zgodnji odboji (s): tunel ima goste, dolina redke in pozne
  const early: Record<Scene['acoustics']['ir'], number[]> = {
    none: [],
    tunnel: [0.011, 0.023, 0.034, 0.047, 0.061],
    valley: [0.18, 0.41, 0.77],
    street: [0.009, 0.026],
    room: [0.004, 0.009, 0.013],
  }
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      d[i] = (Math.random() * 2 - 1) * Math.exp((-6.9 * t) / ac.decayS) * 0.5
    }
    early[ac.ir].forEach((e, k) => {
      const i = pre + Math.floor(sr * e * (ch ? 1.07 : 1))
      if (i < len) d[i] += 0.6 / (k + 1)
    })
  }
  return buf
}
