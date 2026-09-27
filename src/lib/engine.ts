import { DRIVETRAIN, GEARBOX, LOOP } from './config'
import { car, type SourceKind } from './state.svelte'
import { Smoother, isOverrun, loadFromAccel } from './physics/smoothing'
import { Gearbox } from './physics/gearbox'
import { rawRpm, rpm as limitedRpm } from './physics/drivetrain'
import { audio } from './audio/context'
import { gpsSource } from './telemetry/gps'
import { manualSource } from './telemetry/manual'
import { parseTrack, replaySource } from './telemetry/replay'
import { now, type Sample, type Source } from './telemetry/types'

/** En sam cikel: telemetrija → glajenje → menjalnik → rpm → state → zvok (UI bere state). */
const smoother = new Smoother()
export const gearbox = new Gearbox()
let stopSource: (() => void) | null = null
let raf = 0
let lastFrame = 0
const frameTimes: number[] = []
let replaySamples: Sample[] | null = null

async function sourceFor(kind: SourceKind): Promise<Source> {
  if (kind === 'gps') return gpsSource
  if (kind === 'manual') return manualSource
  if (!replaySamples) {
    const r = await fetch(`${import.meta.env.BASE_URL}replay/demo.csv`)
    replaySamples = parseTrack(await r.text())
  }
  return replaySource(replaySamples)
}

export async function setSource(kind: SourceKind, samples?: Sample[]): Promise<void> {
  stopSource?.()
  smoother.reset()
  car.source = kind
  car.error = ''
  if (samples) replaySamples = samples
  const src = await sourceFor(kind)
  stopSource = src(
    (s) => smoother.ingest(s),
    (msg) => (car.error = msg),
  )
}

function frame(): void {
  raf = requestAnimationFrame(frame)
  const t = now()
  const dtMs = (t - lastFrame) * 1000
  if (dtMs < 1000 / LOOP.uiMaxFps - 2) return
  lastFrame = t
  frameTimes.push(dtMs)
  if (frameTimes.length > LOOP.slowFrameWindow) frameTimes.shift()
  if (frameTimes.length === LOOP.slowFrameWindow) {
    car.lowPower = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length > LOOP.slowFrameMs
  }

  const { v, a } = smoother.predict(t)
  let load = loadFromAccel(a)
  const overrun = isOverrun(a)
  gearbox.mode = car.mode
  gearbox.update(v, load, t)
  if (gearbox.inShiftDip(t)) load = 0

  let r = limitedRpm(v, gearbox.gear)
  const atLimiter = rawRpm(v, gearbox.gear) >= DRIVETRAIN.limiterRpm
  // omejevalnik: ritmična prekinitev vžiga
  if (atLimiter && Math.floor(t * GEARBOX.limiterCutHz * 2) % 2 === 1) {
    load = 0
    r -= GEARBOX.limiterCutDropRpm
  }

  car.v = v
  car.a = a
  car.load = load
  car.overrun = overrun
  car.rpm = r
  car.gear = gearbox.gear
  car.limiter = atLimiter
  audio.setDrive(r, load, overrun || (atLimiter && load === 0))
}

export function startLoop(): void {
  if (!raf) raf = requestAnimationFrame(frame)
}

export function stopLoop(): void {
  cancelAnimationFrame(raf)
  raf = 0
}

export function shift(delta: 1 | -1): void {
  gearbox.manual(delta, now())
  car.gear = gearbox.gear
}
