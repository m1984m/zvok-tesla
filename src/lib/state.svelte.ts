export type SourceKind = 'gps' | 'replay' | 'manual'

/** En skupni reaktivni state. Izvožen je objekt; spreminjamo samo lastnosti. */
export const car = $state({
  v: 0, // m/s
  a: 0, // m/s²
  load: 0,
  overrun: false,
  rpm: 1000,
  gear: 1,
  limiter: false,
  shift: 0, // števec menjav
  gLong: 0, // g, + pospeševanje, − zaviranje
  gLat: 0, // g, + desni zavoj
  peakAcc: 0,
  peakBrake: 0,
  peakLat: 0,
  source: 'gps' as SourceKind,
  sceneId: 'v12',
  volume: 0.8,
  started: false,
  paused: false,
  lowPower: false,
  uiScale: 1, // pomanjšava plošče na okno
  error: '',
})
