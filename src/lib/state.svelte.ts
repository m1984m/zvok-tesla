import type { GearMode } from './physics/gearbox'

export type SourceKind = 'gps' | 'replay' | 'manual'

/** En skupni reaktivni state. Izvožen je objekt; spreminjamo samo lastnosti. */
export const car = $state({
  v: 0, // m/s
  a: 0, // m/s²
  load: 0,
  overrun: false,
  rpm: 1000,
  gear: 1,
  mode: 'auto' as GearMode,
  limiter: false,
  shift: 0, // števec menjav (UI animacija)
  denied: 0, // števec zavrnjenih ročnih menjav
  source: 'gps' as SourceKind,
  sceneId: 'v12',
  volume: 0.8,
  started: false,
  paused: false,
  lowPower: false,
  error: '',
})
