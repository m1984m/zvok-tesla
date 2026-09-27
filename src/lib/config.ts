// Vse konstante fizike, telemetrije in zvoka. Nikjer drugje ni številk.

export const GPS = {
  // PREDPOSTAVKA: ~1 Hz v brskalniku Tesle, preveri v vozilu
  maxAccuracyM: 30,
  maxExtrapolationS: 1.5,
  timeoutMs: 10000,
} as const

export const SMOOTHING = {
  accelTauS: 0.3,
  loadFullAccel: 3.5, // m/s² → load = 1. PREDPOSTAVKA: preveri v vozilu
  overrunAccel: -0.3, // m/s², pod tem brez plina
  correctionTauS: 0.3, // napaka napovedi ob novem vzorcu se zgladi s to konstanto
} as const

export const DRIVETRAIN = {
  wheelRadiusM: 0.33,
  finalDrive: 3.7,
  gears: [3.6, 2.2, 1.5, 1.15, 0.92, 0.75],
  idleRpm: 780,
  limiterRpm: 7000,
} as const

export const GEARBOX = {
  // PREDPOSTAVKA: pragovi za prvo verzijo, uglasitev v vozilu
  upBaseRpm: 2500,
  upLoadRpm: 4000,
  downBaseRpm: 1300,
  downLoadRpm: 1500,
  minShiftIntervalS: 0.8,
  shiftLoadDipS: 0.15,
  limiterCutHz: 12,
  limiterCutDropRpm: 150, // padec obratov med prekinitvijo omejevalnika
} as const

export const MANUAL = {
  // razvojni vir hitrosti brez avta
  throttleAccel: 3.0, // m/s² ob držanem plinu
  coastAccel: -0.8, // m/s² brez plina (upor)
  brakeAccel: -6.0,
  maxSpeedMs: 70,
  sampleHz: 10,
  replayTickMs: 50,
} as const

export const LOOP = {
  // en sam cikel fizika → zvok → UI
  uiMaxFps: 30,
  slowFrameMs: 40, // povprečje nad tem → statično ozadje
  slowFrameWindow: 60,
} as const

export const AUDIO = {
  paramTimeConstantS: 0.05, // glajenje AudioParam (brez »zipper« šuma)
  limiterThresholdDb: -1,
  limiterRatio: 20,
  limiterAttackS: 0.003,
  limiterReleaseS: 0.1,
  defaultMaxVolume: 0.8,
  sceneFadeS: 0.2, // preliv ob preklopu scene (< 300 ms)
  samplerStepRpm: 500,
  samplerMinRpm: 1000,
  samplerMaxRpm: 7000,
} as const
