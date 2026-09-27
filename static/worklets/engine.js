// Proceduralna sinteza športnega motorja (lastna implementacija, brez posnetkov).
// Parametri rpm/load/overrun so a-rate in jih glavna nit gladi s setTargetAtTime → brez stopnic.
// Faze so zvezne → brez klikov. Filtri se računajo enkrat na blok (Intel Atom).
//
// Sestava zvoka:
//   impulzi vžiga (izpuh)  → resonanci izpušne cevi (dva pasovna filtra)
//   harmoniki frekvence vžiga (»kričanje« pri visokih obratih)
//   polovični red gredi (hrapavost), šum izpuha, pokanje v overrunu
//   → dvopolni nizkoprepustni filter, ki se odpira z obremenitvijo

const DEFAULT = {
  cylinders: 12,
  pulseDecay: 12, // hitrost upada impulza vžiga
  brightness: 0.6, // 0..1 odprtost filtra
  roughness: 0.06, // neenakost cilindrov
  rumble: 0.06, // polovični red gredi
  noise: 0.18, // šum izpuha
  scream: 0.8, // harmoniki vžiga pri visokih obratih
  f1: 520, // resonanca izpuha 1 (Hz)
  f2: 1700, // resonanca izpuha 2 (Hz)
  reso: 0.55, // delež resonanc
  crackle: 0.5, // pokanje v overrunu
  gain: 0.8,
  maxRpm: 8500,
}

const NUMERIC = ['pulseDecay', 'brightness', 'roughness', 'rumble', 'noise', 'scream', 'f1', 'f2', 'reso', 'crackle', 'gain', 'maxRpm']
const TAU = 2 * Math.PI

// RBJ pasovni filter (konstantni vrh 0 dB)
function bandpass(f, q, sr) {
  const w = (TAU * f) / sr
  const al = Math.sin(w) / (2 * q)
  const a0 = 1 + al
  return { b0: al / a0, b2: -al / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - al) / a0 }
}

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1000, minValue: 0, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'overrun', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ]
  }

  constructor() {
    super()
    this.p = { ...DEFAULT }
    this.target = { ...DEFAULT }
    this.phase = 0
    this.crank = 0
    this.cyl = 0
    this.cylAmp = new Float32Array(16).fill(1)
    this.amp = 1
    this.lp = 0
    this.lp2 = 0
    this.dcX = 0
    this.dcY = 0
    this.pop = 0
    this.r1 = [0, 0, 0, 0] // x1 x2 y1 y2
    this.r2 = [0, 0, 0, 0]
    this.seed = 22222
    this.port.onmessage = (e) => {
      this.target = { ...DEFAULT, ...e.data }
      this.p.cylinders = this.target.cylinders
      for (let i = 0; i < 16; i++) this.cylAmp[i] = 1 + this.target.roughness * (this.rand() - 0.5) * 2
    }
  }

  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }

  process(_in, outputs, params) {
    const out = outputs[0][0]
    if (!out) return true
    for (const k of NUMERIC) this.p[k] += (this.target[k] - this.p[k]) * 0.05
    const p = this.p
    const sr = sampleRate
    const rpmA = params.rpm, loadA = params.load, ovA = params.overrun
    const rpm0 = rpmA[0], load0 = loadA[0]
    const rn = Math.min(1, rpm0 / p.maxRpm) // 0..1

    // koeficienti enkrat na blok
    const fc = 400 + p.brightness * 3000 + load0 * 3000 + rpm0 * 0.5
    const lpa = 1 - Math.exp((-TAU * Math.min(fc, sr * 0.45)) / sr)
    const bp1 = bandpass(p.f1 * (0.85 + 0.3 * rn), 2.5, sr)
    const bp2 = bandpass(p.f2 * (0.8 + 0.4 * rn), 3, sr)
    const screamAmt = p.scream * rn * rn * (0.4 + 0.6 * load0)
    const cyl = p.cylinders
    const r1 = this.r1, r2 = this.r2

    for (let i = 0; i < out.length; i++) {
      const rpm = rpmA.length > 1 ? rpmA[i] : rpm0
      const load = loadA.length > 1 ? loadA[i] : load0
      const ov = ovA.length > 1 ? ovA[i] : ovA[0]
      const firing = (rpm / 60) * (cyl / 2)
      this.phase += firing / sr
      this.crank = (this.crank + rpm / 120 / sr) % 1
      if (this.phase >= 1) {
        this.phase -= 1
        this.cyl = (this.cyl + 1) % cyl
        this.amp = this.cylAmp[this.cyl]
      }
      const x = this.phase
      const env = x < 0.03 ? x / 0.03 : Math.exp(-p.pulseDecay * (x - 0.03))
      const nz = this.rand() - 0.5
      let s = env * this.amp * (0.85 + p.noise * nz * (0.5 + load))

      // resonance izpuha
      const e1 = bp1.b0 * s + bp1.b2 * r1[1] - bp1.a1 * r1[2] - bp1.a2 * r1[3]
      r1[1] = r1[0]; r1[0] = s; r1[3] = r1[2]; r1[2] = e1
      const e2 = bp2.b0 * s + bp2.b2 * r2[1] - bp2.a1 * r2[2] - bp2.a2 * r2[3]
      r2[1] = r2[0]; r2[0] = s; r2[3] = r2[2]; r2[2] = e2
      s = s * (1 - p.reso) + (e1 * 2.2 + e2 * 1.6) * p.reso

      // kričanje: harmoniki frekvence vžiga (faza vžiga je zvezna)
      const ph = TAU * x
      s += screamAmt * (0.55 * Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph))
      s += p.rumble * Math.sin(TAU * this.crank)
      s *= 0.3 + 0.7 * load

      // pokanje v overrunu
      if (ov > 0.5 && rpm > 2500 && this.pop <= 0.001 && this.rand() < 0.0003 * p.crackle) this.pop = 1
      if (this.pop > 0.001) {
        s += this.pop * nz * 1.4
        this.pop *= 0.99
      }

      // DC blokada in nizkoprepustni filter
      const y = s - this.dcX + 0.995 * this.dcY
      this.dcX = s
      this.dcY = y
      this.lp += lpa * (y - this.lp)
      this.lp2 += lpa * (this.lp - this.lp2)
      out[i] = this.lp2 * p.gain
    }
    return true
  }
}

registerProcessor('engine', EngineProcessor)
