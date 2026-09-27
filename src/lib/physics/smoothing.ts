import { GPS, SMOOTHING } from '../config'

export interface Sample {
  t: number // s
  v: number // m/s
  heading?: number | null // smer vožnje v stopinjah (0 = sever, v smeri urinega kazalca)
}

/** EMA pospeška + ekstrapolacija hitrosti med vzorci. */
export class Smoother {
  private tLast = NaN
  private vLast = 0
  private offset = 0 // razlika stara − nova napoved v trenutku vzorca
  a = 0

  reset(): void {
    this.tLast = NaN
    this.vLast = 0
    this.offset = 0
    this.a = 0
  }

  ingest(s: Sample): void {
    if (Number.isNaN(this.tLast)) {
      this.tLast = s.t
      this.vLast = s.v
      return
    }
    const dt = s.t - this.tLast
    if (dt <= 0) return
    const before = this.predict(s.t).v
    const aRaw = (s.v - this.vLast) / dt
    const alpha = 1 - Math.exp(-dt / SMOOTHING.accelTauS)
    this.a += alpha * (aRaw - this.a)
    this.tLast = s.t
    this.vLast = s.v
    this.offset = before - s.v
  }

  /** Napovedana hitrost v času t (največ maxExtrapolationS po zadnjem vzorcu). */
  predict(t: number): { v: number; a: number } {
    if (Number.isNaN(this.tLast)) return { v: 0, a: 0 }
    const dt = Math.min(Math.max(t - this.tLast, 0), GPS.maxExtrapolationS)
    const corr = this.offset * Math.exp(-Math.max(t - this.tLast, 0) / SMOOTHING.correctionTauS)
    return { v: Math.max(0, this.vLast + this.a * dt + corr), a: this.a }
  }
}

export function loadFromAccel(a: number): number {
  return Math.min(1, Math.max(0, a / SMOOTHING.loadFullAccel))
}

export function isOverrun(a: number): boolean {
  return a < SMOOTHING.overrunAccel
}
