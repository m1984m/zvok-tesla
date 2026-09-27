import { DRIVETRAIN, GEARBOX } from '../config'
import { rawRpm } from './drivetrain'
import { loadFromAccel } from './smoothing'

export type GearMode = 'auto' | 'manual'
export type ShiftKind = 'up' | 'down' | null

export class Gearbox {
  gear = 1
  mode: GearMode = 'auto'
  lastShift: ShiftKind = null
  private lastShiftT = -Infinity

  /**
   * Kliči vsak cikel; vrne vrsto menjave ali null. t v s, a v m/s².
   * load in a naj bosta počasi glajena (ShiftInputs), sicer šum GPS sproža menjave.
   * Navzdol: pri zaviranju zgodaj (z medplinom), sicer ko obrati padejo pod prag.
   * Vedno samo ena prestava naenkrat in nikoli čez omejevalnik.
   */
  update(speedMs: number, load: number, t: number, a = 0): ShiftKind {
    if (this.mode !== 'auto' || t - this.lastShiftT < GEARBOX.minShiftIntervalS) return null
    const g = this.gear
    const r = rawRpm(speedMs, g)
    const recent = t - this.lastShiftT < GEARBOX.holdOppositeS
    const nearLimit = r > DRIVETRAIN.limiterRpm - GEARBOX.overrevMarginRpm

    // gor: nad pragom, ne med pojemanjem (sicer po medplinu takoj nazaj), ne kmalu po menjavi dol
    const up = GEARBOX.upBaseRpm + load * GEARBOX.upLoadRpm
    if (g < DRIVETRAIN.gears.length && r > up && (nearLimit || (a >= 0 && !(recent && this.lastShift === 'down'))))
      return this.shift(g + 1, t)

    if (g === 1 || !this.fits(speedMs, g - 1)) return null
    // motor »davi«: pod skoraj prostim tekom vedno dol, sicer ne takoj po menjavi gor (šum GPS pri nizki hitrosti)
    if (r < DRIVETRAIN.idleRpm * GEARBOX.hardLugFactor) return this.shift(g - 1, t)
    if (recent && this.lastShift === 'up') return null
    if (r < GEARBOX.downBaseRpm) return this.shift(g - 1, t)
    // zaviranje: dol, ko bi imela nižja prestava manj kot brakeTargetRpm (varno pod pragom gor → brez prekrivanja)
    if (a < GEARBOX.brakeAccel && rawRpm(speedMs, g - 1) < GEARBOX.brakeTargetRpm) return this.shift(g - 1, t)
    // kickdown: izrazit plin
    if (load > GEARBOX.kickdownLoad && r < GEARBOX.downBaseRpm + load * GEARBOX.downLoadRpm) return this.shift(g - 1, t)
    return null
  }

  /** Ročna menjava (±1). Navzdol je zavrnjena, če bi motor prevrtel. */
  manual(delta: 1 | -1, t: number, speedMs: number): ShiftKind {
    const g = this.gear + delta
    if (g < 1 || g > DRIVETRAIN.gears.length) return null
    if (delta < 0 && !this.fits(speedMs, g)) return null
    return this.shift(g, t)
  }

  /** Čas od zadnje menjave (s). */
  sinceShift(t: number): number {
    return t - this.lastShiftT
  }

  private fits(speedMs: number, g: number): boolean {
    return rawRpm(speedMs, g) < DRIVETRAIN.limiterRpm - GEARBOX.overrevMarginRpm
  }

  private shift(g: number, t: number): ShiftKind {
    this.lastShift = g > this.gear ? 'up' : 'down'
    this.gear = g
    this.lastShiftT = t
    return this.lastShift
  }
}

/**
 * Počasi glajen pospešek in iz njega obremenitev za odločanje menjalnika (zvok uporablja hitrejše vrednosti).
 * Obremenitev se računa iz ŽE glajenega pospeška: če bi glajenje sledilo obremenitvi, bi odrezan negativni
 * del šuma GPS dal navidezno obremenitev tudi pri enakomerni vožnji.
 */
export class ShiftInputs {
  load = 0
  a = 0
  update(a: number, dt: number): void {
    const k = dt > 1 ? 1 : 1 - Math.exp(-dt / GEARBOX.decisionTauS)
    this.a += (a - this.a) * k
    this.load = loadFromAccel(this.a)
  }
}
