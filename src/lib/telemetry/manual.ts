import { MANUAL } from '../config'
import { now, type Source } from './types'

export type Pedal = 'gas' | 'none' | 'brake'
export const manualInput = { pedal: 'none' as Pedal }

/** Ročni vir: držanje plina pospešuje, sicer upor zavira. */
export const manualSource: Source = (emit) => {
  let v = 0
  let t = now()
  const id = setInterval(() => {
    const tn = now()
    const dt = tn - t
    t = tn
    const acc =
      manualInput.pedal === 'gas' ? MANUAL.throttleAccel : manualInput.pedal === 'brake' ? MANUAL.brakeAccel : MANUAL.coastAccel
    v = Math.min(MANUAL.maxSpeedMs, Math.max(0, v + acc * dt))
    emit({ t: tn, v })
  }, 1000 / MANUAL.sampleHz)
  return () => clearInterval(id)
}
