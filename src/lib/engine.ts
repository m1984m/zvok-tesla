import { DRIVETRAIN, GEARBOX, GFORCE, LOOP } from './config'
import { car, type SourceKind } from './state.svelte'
import { Smoother, isOverrun, loadFromAccel } from './physics/smoothing'
import { LateralEstimator } from './physics/lateral'
import { Gearbox, ShiftInputs } from './physics/gearbox'
import { rawRpm, rpm as limitedRpm } from './physics/drivetrain'
import { audio } from './audio/context'
import { gpsSource } from './telemetry/gps'
import { manualSource } from './telemetry/manual'
import { parseTrack, replaySource } from './telemetry/replay'
import { now, type Sample, type Source } from './telemetry/types'

/** En sam cikel: telemetrija → glajenje → menjalnik → rpm → state → zvok (UI bere state). */
const smoother = new Smoother()
const lateral = new LateralEstimator()
export const gearbox = new Gearbox()
const shiftIn = new ShiftInputs()
let stopSource: (() => void) | null = null
let raf = 0
let lastFrame = 0
let rpmOut: number = DRIVETRAIN.idleRpm
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
  lateral.reset()
  car.source = kind
  car.error = ''
  if (samples) replaySamples = samples
  const src = await sourceFor(kind)
  stopSource = src(
    (s) => {
      smoother.ingest(s)
      lateral.ingest(s)
      car.error = ''
    },
    (msg) => (car.error = msg),
  )
}

export function resetPeaks(): void {
  car.peakAcc = 0
  car.peakBrake = 0
  car.peakLat = 0
}

function frame(): void {
  raf = requestAnimationFrame(frame)
  const t = now()
  const dt = t - lastFrame
  if (dt * 1000 < 1000 / LOOP.uiMaxFps - 2) return
  lastFrame = t
  frameTimes.push(dt * 1000)
  if (frameTimes.length > LOOP.slowFrameWindow) frameTimes.shift()
  if (frameTimes.length === LOOP.slowFrameWindow) {
    car.lowPower = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length > LOOP.slowFrameMs
  }

  const { v, a } = smoother.predict(t)
  let load = loadFromAccel(a)
  const overrun = isOverrun(a)
  shiftIn.update(a, dt)
  if (gearbox.update(v, shiftIn.load, t, shiftIn.a)) car.shift++
  const since = gearbox.sinceShift(t)
  // gor: kratek odvzem plina; dol: medplin
  if (gearbox.lastShift === 'up' && since < GEARBOX.shiftLoadDipS) load = 0
  const blip = gearbox.lastShift === 'down' && since < GEARBOX.blipS
  if (blip) load = Math.max(load, GEARBOX.blipLoad)

  const target = limitedRpm(v, gearbox.gear)
  // obrati sledijo cilju zvezno (tudi pri menjavi); prvi okvir brez zamika
  const k = dt > 1 ? 1 : 1 - Math.exp(-dt / DRIVETRAIN.rpmSlewTauS)
  rpmOut += (target - rpmOut) * k
  let r = rpmOut
  const atLimiter = rawRpm(v, gearbox.gear) >= DRIVETRAIN.limiterRpm
  if (atLimiter && Math.floor(t * GEARBOX.limiterCutHz * 2) % 2 === 1) {
    load = 0
    r -= GEARBOX.limiterCutDropRpm
  }

  // G-sile: vzdolžno iz pospeška, bočno iz spremembe smeri; prikaz rahlo glajen
  const kg = dt > 1 ? 1 : 1 - Math.exp(-dt / GFORCE.displayTauS)
  const gLong = v < 0.5 && a <= 0 ? 0 : a / GFORCE.g
  car.gLong += (gLong - car.gLong) * kg
  car.gLat += (lateral.aLat / GFORCE.g - car.gLat) * kg
  if (car.gLong > car.peakAcc) car.peakAcc = car.gLong
  if (-car.gLong > car.peakBrake) car.peakBrake = -car.gLong
  if (Math.abs(car.gLat) > car.peakLat) car.peakLat = Math.abs(car.gLat)

  car.stale = car.source === 'gps' && smoother.isStale(t)
  car.v = v
  car.a = a
  car.load = load
  car.overrun = overrun && !blip
  car.rpm = r
  car.gear = gearbox.gear
  car.limiter = atLimiter
  audio.setDrive(r, load, (overrun && !blip) || (atLimiter && load === 0))
}

export function startLoop(): void {
  if (!raf) raf = requestAnimationFrame(frame)
}

export function stopLoop(): void {
  cancelAnimationFrame(raf)
  raf = 0
}
