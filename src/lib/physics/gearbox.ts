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
   * Navzdol: pri zaviranju zgodaj (z medplinom), sicer ko obrati padejo pod prag.
   * Vedno samo ena prestava naenkrat in nikoli čez omejevalnik.
   */
  update(speedMs: number, load: number, t: number, a = 0): ShiftKind {
    if (this.mode !== 'auto' || t - this.lastShiftT < GEARBOX.minShiftIntervalS) return null
    const r = rawRpm(speedMs, this.gear)
    const up = GEARBOX.upBaseRpm + load * GEARBOX.upLoadRpm
    const down = a < GEARBOX.brakeAccel ? GEARBOX.brakeDownRpm : GEARBOX.downBaseRpm + load * GEARBOX.downLoadRpm
    // med pojemanjem ne gor (sicer bi po medplinu takoj menjal nazaj), razen tik pred omejevalnikom
    const mayUp = a >= 0 || r > DRIVETRAIN.limiterRpm - GEARBOX.overrevMarginRpm
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
