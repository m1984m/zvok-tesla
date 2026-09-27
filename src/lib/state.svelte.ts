import type { GearMode } from './physics/gearbox'

export type SourceKind = 'gps' | 'replay' | 'manual'

/** En skupni reaktivni state. Izvožen je objekt; spreminjamo samo lastnosti. */
export const car = $state({
  v: 0, // m/s
  a: 0, // m/s²
  load: 0,
  overrun: false,
  rpm: 780,
  gear: 1,
  mode: 'auto' as GearMode,
  limiter: false,
  source: 'replay' as SourceKind,
  sceneId: 'stirivaljnik',
  volume: 0.8,
  started: false,
  paused: false,
  lowPower: false,
  error: '',
})
