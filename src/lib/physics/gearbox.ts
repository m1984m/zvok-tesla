import { DRIVETRAIN, GEARBOX } from '../config'
import { rawRpm } from './drivetrain'

export type GearMode = 'auto' | 'manual'

export class Gearbox {
  gear = 1
  mode: GearMode = 'auto'
  private lastShiftT = -Infinity

  /** Kliči vsak cikel; vrne true, če je prišlo do menjave. t v sekundah. */
  update(speedMs: number, load: number, t: number): boolean {
    if (this.mode !== 'auto' || t - this.lastShiftT < GEARBOX.minShiftIntervalS) return false
    const r = rawRpm(speedMs, this.gear)
    const up = GEARBOX.upBaseRpm + load * GEARBOX.upLoadRpm
    const down = GEARBOX.downBaseRpm + load * GEARBOX.downLoadRpm
    if (r > up && this.gear < DRIVETRAIN.gears.length) return this.shift(this.gear + 1, t)
    if (r < down && this.gear > 1) return this.shift(this.gear - 1, t)
    return false
  }

  /** Ročna menjava (±1). */
  manual(delta: 1 | -1, t: number): boolean {
    const g = this.gear + delta
    if (g < 1 || g > DRIVETRAIN.gears.length) return false
    return this.shift(g, t)
  }

  /** Ali je v teku kratek padec obremenitve po menjavi. */
  inShiftDip(t: number): boolean {
    return t - this.lastShiftT < GEARBOX.shiftLoadDipS
  }

  private shift(g: number, t: number): boolean {
    this.gear = g
    this.lastShiftT = t
    return true
  }
}
