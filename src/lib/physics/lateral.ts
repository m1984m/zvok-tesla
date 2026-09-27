import { GFORCE } from '../config'
import type { Sample } from './smoothing'

/** Bočni pospešek iz spremembe smeri: a_lat = v · dθ/dt (desni zavoj pozitiven). */
export class LateralEstimator {
  private tLast = NaN
  private hLast: number | null = null
  aLat = 0 // m/s²

  reset(): void {
    this.tLast = NaN
    this.hLast = null
    this.aLat = 0
  }

  ingest(s: Sample): void {
    const h = s.heading
    if (h == null || !Number.isFinite(h) || s.v < GFORCE.minSpeedMs) {
      this.hLast = null
      this.tLast = s.t
      this.aLat += (0 - this.aLat) * 0.5
      return
    }
    if (this.hLast != null && s.t > this.tLast) {
      const dt = s.t - this.tLast
      const dh = ((h - this.hLast + 540) % 360) - 180 // najkrajša pot čez 0/360
      const yaw = dh / dt
      if (Math.abs(yaw) <= GFORCE.maxYawRateDegS) {
        const raw = s.v * ((yaw * Math.PI) / 180)
        const alpha = 1 - Math.exp(-dt / GFORCE.lateralTauS)
        this.aLat += alpha * (raw - this.aLat)
      }
    }
    this.hLast = h
    this.tLast = s.t
  }
}

/** Smer med dvema točkama (stopinje), za GPX in GPS brez coords.heading. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r)
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r)
  return ((Math.atan2(y, x) / r) + 360) % 360
}
