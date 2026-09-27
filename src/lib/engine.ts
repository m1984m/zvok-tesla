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
  car.source = kind
  car.error = ''
  if (samples) replaySamples = samples
  const src = await sourceFor(kind)
  stopSource = src(
    (s) => {
      smoother.ingest(s)
      car.error = ''
    },
    (msg) => (car.error = msg),
  )
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
  gearbox.mode = car.mode
  if (gearbox.update(v, load, t, a)) car.shift++
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

/** Obvolanska ročica: preklopi v ročni način in menja; zavrnjeno, če bi motor prevrtel. */
export function shift(delta: 1 | -1): void {
  car.mode = 'manual'
  gearbox.mode = 'manual'
  const t = now()
  if (gearbox.manual(delta, t, smoother.predict(t).v)) car.shift++
  else car.denied++
  car.gear = gearbox.gear
}
