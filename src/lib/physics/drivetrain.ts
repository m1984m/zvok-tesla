import { DRIVETRAIN } from '../config'

/** Obrati brez omejitev (za odločanje menjalnika). gear je 1-based. */
export function rawRpm(speedMs: number, gear: number): number {
  const wheelRps = speedMs / (2 * Math.PI * DRIVETRAIN.wheelRadiusM)
  return wheelRps * 60 * DRIVETRAIN.gears[gear - 1] * DRIVETRAIN.finalDrive
}

/** Obrati za prikaz in zvok: najmanj prosti tek, največ omejevalnik. */
export function rpm(speedMs: number, gear: number): number {
  return Math.min(DRIVETRAIN.limiterRpm, Math.max(DRIVETRAIN.idleRpm, rawRpm(speedMs, gear)))
}
