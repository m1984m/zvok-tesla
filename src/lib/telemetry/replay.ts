import { MANUAL } from '../config'
import { haversineM } from './gps'
import { bearingDeg } from '../physics/lateral'
import { Smoother, type Sample } from '../physics/smoothing'
import { now, type Source } from './types'

/** CSV: t_s,speed_kmh[,heading_deg] (glava neobvezna). */
export function parseCsv(text: string): Sample[] {
  const out: Sample[] = []
  for (const line of text.split(/\r?\n/)) {
    const [a, b, c] = line.split(/[,;\t]/).map((x) => (x.trim() === '' ? NaN : Number(x.trim())))
    if (line.trim() && Number.isFinite(a) && Number.isFinite(b))
      out.push({ t: a, v: b / 3.6, heading: Number.isFinite(c) ? c : null })
  }
  return out
}

/** GPX: trkpt z lat, lon in time; hitrost iz razdalje/Δt. */
export function parseGpx(text: string): Sample[] {
  const pts: { lat: number; lon: number; t: number }[] = []
  const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g
  for (const m of text.matchAll(re)) pts.push({ lat: +m[1], lon: +m[2], t: Date.parse(m[3]) / 1000 })
  const out: Sample[] = []
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].t - pts[i - 1].t
    if (dt <= 0) continue
    const a = pts[i - 1]
    const b = pts[i]
    out.push({ t: b.t - pts[0].t, v: haversineM(a.lat, a.lon, b.lat, b.lon) / dt, heading: bearingDeg(a.lat, a.lon, b.lat, b.lon) })
  }
  return out
}

export function parseTrack(text: string): Sample[] {
  return text.includes('<gpx') ? parseGpx(text) : parseCsv(text)
}

/** Deterministična krivulja v/a pri fiksnem koraku (za test in analizo). */
export function simulate(samples: Sample[], stepS: number): { t: number; v: number; a: number }[] {
  const sm = new Smoother()
  const out: { t: number; v: number; a: number }[] = []
  if (!samples.length) return out
  const t0 = samples[0].t
  const n = Math.floor((samples[samples.length - 1].t - t0) / stepS)
  let i = 0
  for (let k = 0; k <= n; k++) {
    const t = t0 + k * stepS
    while (i < samples.length && samples[i].t <= t + 1e-9) sm.ingest(samples[i++])
    out.push({ t: k * stepS, ...sm.predict(t) })
  }
  return out
}

/** Predvaja posnetek v realnem času; loop = false: enkrat, nato ni več vzorcev (hitrost se drži). */
export function replaySource(samples: Sample[], loop = true): Source {
  return (emit) => {
    if (!samples.length) return () => {}
    const t0 = samples[0].t
    const lapS = samples[samples.length - 1].t - t0 + 1
    const start = now()
    let i = 0
    let lap = 0
    const tick = () => {
      const el = now() - start
      for (;;) {
        const ts = samples[i].t - t0 + lap * lapS
        if (ts > el) break
        emit({ t: start + ts, v: samples[i].v, heading: samples[i].heading })
        if (++i >= samples.length) {
          if (!loop) {
            clearInterval(id)
            return
          }
          i = 0
          lap++
        }
      }
    }
    const id = setInterval(tick, MANUAL.replayTickMs)
    tick()
    return () => clearInterval(id)
  }
}
