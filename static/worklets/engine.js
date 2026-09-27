// Proceduralna sinteza motorja (lastna implementacija). Parametri rpm/load/overrun so a-rate,
// zato jih glavna nit gladi s setTargetAtTime in tu ni stopnic. Faza je zvezna → brez klikov.

const DEFAULT = {
  kind: 'combustion', // 'combustion' | 'electric'
  cylinders: 4,
  pulseDecay: 9, // hitrost upada eksplozijskega impulza
  brightness: 0.5, // 0..1, odprtost filtra
  roughness: 0.15, // neenakost cilindrov
  rumble: 0.25, // polovični red (gred)
  noise: 0.3, // izpušni šum
  crackle: 0.5, // pokanje v overrunu
  gain: 0.8,
}

const NUMERIC = ['pulseDecay', 'brightness', 'roughness', 'rumble', 'noise', 'crackle', 'gain']

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 780, minValue: 0, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'overrun', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ]
  }

  constructor() {
    super()
    this.p = { ...DEFAULT } // trenutni (gladko sledi cilju)
    this.target = { ...DEFAULT }
    this.phase = 0 // faza vžiga 0..1
    this.crank = 0 // faza gredi
    this.cyl = 0
    this.cylAmp = new Float32Array(16).map(() => 1)
    this.amp = 1
    this.lp = 0
    this.lp2 = 0
    this.dcX = 0
    this.dcY = 0
    this.pop = 0
    this.w1 = 0
    this.w2 = 0
    this.seed = 22222
    this.port.onmessage = (e) => {
      this.target = { ...DEFAULT, ...e.data }
      this.p.kind = this.target.kind
      this.p.cylinders = this.target.cylinders
      for (let i = 0; i < 16; i++) this.cylAmp[i] = 1 + this.target.roughness * (this.rand() - 0.5)
    }
  }

  rand() {
    // deterministični LCG, 0..1
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
    // koeficient filtra enkrat na blok (128 vzorcev ≈ 2,7 ms); parametri so že glajeni → brez stopnic.
    // Prihranek pri Math.exp na vzorec je pomemben na Intel Atom (MCU2).
    const fc = 300 + p.brightness * 2500 + loadA[0] * 2500 + rpmA[0] * 0.4
    const a = 1 - Math.exp((-2 * Math.PI * Math.min(fc, sr * 0.45)) / sr)
    for (let i = 0; i < out.length; i++) {
      const rpm = rpmA.length > 1 ? rpmA[i] : rpmA[0]
      const load = loadA.length > 1 ? loadA[i] : loadA[0]
      const ov = ovA.length > 1 ? ovA[i] : ovA[0]
      let s
      if (p.kind === 'electric') {
        const f = rpm * 0.35
        this.w1 = (this.w1 + f / sr) % 1
        this.w2 = (this.w2 + (f * 1.5) / sr) % 1
        const tw = 2 * Math.PI
        s = (0.5 * Math.sin(tw * this.w1) + 0.2 * Math.sin(2 * tw * this.w1) + 0.15 * Math.sin(tw * this.w2)) * (0.25 + 0.75 * load)
        s += (this.rand() - 0.5) * 0.04 * (rpm / 7000)
      } else {
        const cyl = p.cylinders
        const firing = (rpm / 60) * (cyl / 2)
        this.phase += firing / sr
        this.crank = (this.crank + rpm / 60 / 2 / sr) % 1
        if (this.phase >= 1) {
          this.phase -= 1
          this.cyl = (this.cyl + 1) % cyl
          this.amp = this.cylAmp[this.cyl]
        }
        const x = this.phase
        const env = x < 0.04 ? x / 0.04 : Math.exp(-p.pulseDecay * (x - 0.04))
        const nz = this.rand() - 0.5
        s = env * this.amp * (0.8 + p.noise * nz * (0.4 + load))
        s += p.rumble * Math.sin(2 * Math.PI * this.crank)
        s *= 0.35 + 0.65 * load
        // pokanje v overrunu
        if (ov > 0.5 && rpm > 2000 && this.pop <= 0.001 && this.rand() < 0.00025 * p.crackle) this.pop = 1
        if (this.pop > 0.001) {
          s += this.pop * nz * 1.6
          this.pop *= 0.992
        }
      }
      // DC blokada, nato dvopolni nizkoprepustni filter (odpira se z obremenitvijo in obrati)
      const y = s - this.dcX + 0.995 * this.dcY
      this.dcX = s
      this.dcY = y
      this.lp += a * (y - this.lp)
      this.lp2 += a * (this.lp - this.lp2)
      out[i] = this.lp2 * p.gain
    }
    return true
  }
}

registerProcessor('engine', EngineProcessor)
