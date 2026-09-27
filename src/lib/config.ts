// Vse konstante fizike, telemetrije in zvoka. Nikjer drugje ni številk.

export const GPS = {
  // PREDPOSTAVKA: ~1 Hz v brskalniku Tesle, preveri v vozilu
  maxAccuracyM: 30,
  maxExtrapolationS: 1.5,
} as const

export const SMOOTHING = {
  accelTauS: 0.3,
  loadFullAccel: 3.5, // m/s² → load = 1. PREDPOSTAVKA: preveri v vozilu
  overrunAccel: -0.3, // m/s², pod tem brez plina
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
} as const

export const AUDIO = {
  paramTimeConstantS: 0.05,
  limiterThresholdDb: -1,
} as const
