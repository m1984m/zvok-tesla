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
  // športni avto: 7-stopenjski menjalnik z dvojno sklopko, visoki obrati
  wheelRadiusM: 0.33,
  finalDrive: 4.0,
  gears: [3.4, 2.4, 1.8, 1.4, 1.15, 0.95, 0.78],
  idleRpm: 1000,
  limiterRpm: 8500,
  gaugeMaxRpm: 9000,
  rpmSlewTauS: 0.12, // obrati sledijo cilju zvezno (menjava ni skok)
} as const

export const GEARBOX = {
  // PREDPOSTAVKA: pragovi za prvo verzijo, uglasitev v vozilu
  upBaseRpm: 3200,
  upLoadRpm: 5000, // polni plin: menjava pri 8200
  downBaseRpm: 1500,
  downLoadRpm: 2500,
  brakeAccel: -1.5, // m/s², pod tem zaviranje → zgodnejša menjava dol z medplinom
  brakeDownRpm: 2800,
  minShiftIntervalS: 0.5,
  overrevMarginRpm: 300, // ročna menjava dol je zavrnjena, če bi obrati presegli omejevalnik − rob
  shiftLoadDipS: 0.15, // prestava gor: kratek odvzem plina
  blipS: 0.18, // prestava dol: medplin
  blipLoad: 0.7,
  limiterCutHz: 12,
  limiterCutDropRpm: 150,
  shiftLightStartRpm: 5500,
  shiftLightFullRpm: 8000,
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

export const SAMPLER = {
  onFloor: 0.35, // delež »on« zanke pri load 0 brez overruna
  loopLengthS: 3, // build-loops: dolžina zanke
  loopCrossfadeS: 0.5, // build-loops: preliv šiva
  loudnessLufs: -18,
} as const

export const SCENE_AUDIO = {
  noiseBufferS: 6,
  irPreDelayS: 0.02,
  seaLfoHz: 0.09,
  seaLfoDepth: 0.6,
  cityHumHz: 50,
  cityHumGain: 0.08,
} as const

export const GFORCE = {
  g: 9.81,
  lateralTauS: 0.5, // glajenje bočnega pospeška (GPS smer je šumna)
  minSpeedMs: 3, // pod tem smer ni zanesljiva → bočno 0
  maxYawRateDegS: 60, // večji skok smeri je napaka GPS
  displayTauS: 0.15, // glajenje prikaza
  meterMaxG: 1.2, // polmer G-merilnika
  trailS: 2,
} as const
