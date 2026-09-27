import { DRIVETRAIN, GEARBOX } from '../config'
import { rawRpm } from './drivetrain'

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
    const r = rawRpm(speedMs, this.gear)
    const up = GEARBOX.upBaseRpm + load * GEARBOX.upLoadRpm
    // dol: pri zaviranju zgodaj; pri plinu (kickdown) samo nad izrazito obremenitvijo; sicer šele pri nizkih obratih
    const down =
      a < GEARBOX.brakeAccel
        ? GEARBOX.brakeDownRpm
        : load > GEARBOX.kickdownLoad
          ? GEARBOX.downBaseRpm + load * GEARBOX.downLoadRpm
          : GEARBOX.downBaseRpm
    // gor ne: med pojemanjem (sicer po medplinu takoj nazaj) in kratek čas po menjavi dol (proti nihanju),
    // razen tik pred omejevalnikom
    const nearLimit = r > DRIVETRAIN.limiterRpm - GEARBOX.overrevMarginRpm
    const holding = this.lastShift === 'down' && t - this.lastShiftT < GEARBOX.holdAfterDownS
    const mayUp = nearLimit || (a >= 0 && !holding)
    if (r > up && mayUp && this.gear < DRIVETRAIN.gears.length) return this.shift(this.gear + 1, t)
    if (r < down && this.gear > 1 && this.fits(speedMs, this.gear - 1)) return this.shift(this.gear - 1, t)
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

/** Počasi glajena obremenitev in pospešek za odločanje menjalnika (zvok uporablja hitrejše vrednosti). */
export class ShiftInputs {
  load = 0
  a = 0
  update(load: number, a: number, dt: number): void {
    const k = dt > 1 ? 1 : 1 - Math.exp(-dt / GEARBOX.decisionTauS)
    this.load += (load - this.load) * k
    this.a += (a - this.a) * k
  }
}
