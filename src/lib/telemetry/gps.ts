import { GPS } from '../config'
import { bearingDeg } from '../physics/lateral'
import { now, type Source } from './types'

const EARTH_R = 6371000
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(h))
}

export const gpsSource: Source = (emit, onError) => {
  if (!('geolocation' in navigator)) {
    onError?.('Brskalnik nima GPS.')
    return () => {}
  }
  let prev: GeolocationPosition | null = null
  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (p.coords.accuracy > GPS.maxAccuracyM) return
      let v = p.coords.speed
      let heading = p.coords.heading
      if (prev) {
        const d = haversineM(prev.coords.latitude, prev.coords.longitude, p.coords.latitude, p.coords.longitude)
        const dt = (p.timestamp - prev.timestamp) / 1000
        if (v == null && dt > 0) v = d / dt
        if ((heading == null || Number.isNaN(heading)) && d > 3)
          heading = bearingDeg(prev.coords.latitude, prev.coords.longitude, p.coords.latitude, p.coords.longitude)
      }
      prev = p
      if (v != null && Number.isFinite(v)) emit({ t: now(), v, heading })
    },
    (e) => onError?.(e.message || 'GPS ni dosegljiv.'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: GPS.timeoutMs },
  )
  return () => navigator.geolocation.clearWatch(id)
}
