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
    this.rejects = 0
    this.tRx = NaN
  }

  private rejects = 0
  private tRx = NaN // čas zadnjega prejetega (tudi zavrnjenega) vzorca

  /** Vrne false, če je vzorec zavrnjen kot napaka GPS. */
  ingest(s: Sample): boolean {
    if (Number.isNaN(this.tLast)) {
      this.tLast = this.tRx = s.t
      this.vLast = s.v
      return true
    }
    const dt = s.t - this.tLast
    if (dt <= 0) return false
    // fizikalno nemogoč skok hitrosti (> ~1 g) je napaka GPS, razen če se ponavlja (nova raven).
    // Merilo je čas od zadnjega PREJETEGA vzorca, sicer bi drugi napačen vzorec zaradi daljšega Δt prišel skozi.
    const dtRx = Math.max(s.t - this.tRx, 1e-3)
    this.tRx = s.t
    if (Math.abs(s.v - this.vLast) / dtRx > GPS.maxPlausibleAccel && this.rejects < GPS.maxRejectsInRow) {
      this.rejects++
      return false
    }
    this.rejects = 0
    const stale = dt > GPS.staleS
    const before = this.predict(s.t).v
    // po izpadu signala ni zanesljivega pospeška: začnemo iz 0
    const aRaw = stale ? 0 : (s.v - this.vLast) / dt
    if (stale) this.a = 0
    const alpha = 1 - Math.exp(-dt / SMOOTHING.accelTauS)
    this.a += alpha * (aRaw - this.a)
    this.tLast = s.t
    this.vLast = s.v
    this.offset = before - s.v
    return true
  }

  /** Ali je zadnji vzorec starejši od GPS.staleS (ni signala). */
  isStale(t: number): boolean {
    return !Number.isNaN(this.tLast) && t - this.tLast > GPS.staleS
  }

  /** Napovedana hitrost v času t (največ maxExtrapolationS po zadnjem vzorcu). */
  predict(t: number): { v: number; a: number } {
    if (Number.isNaN(this.tLast)) return { v: 0, a: 0 }
    const age = Math.max(t - this.tLast, 0)
    const dt = Math.min(age, GPS.maxExtrapolationS)
    const corr = this.offset * Math.exp(-age / SMOOTHING.correctionTauS)
    // brez signala: hitrost ostane (ekstrapolacija je omejena), pospešek zvezno pojema proti 0 → enakomeren zvok
    const a = age > GPS.staleS ? this.a * Math.exp(-(age - GPS.staleS) / GPS.staleAccelTauS) : this.a
    return { v: Math.max(0, this.vLast + this.a * dt + corr), a }
  }
}

export function loadFromAccel(a: number): number {
  return Math.min(1, Math.max(0, a / SMOOTHING.loadFullAccel))
}

export function isOverrun(a: number): boolean {
  return a < SMOOTHING.overrunAccel
}
