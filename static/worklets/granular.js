// Granularni predvajalnik pravega posnetka motorja.
// Posnetek (pospeševanje/pojemanje) ima za vsak trenutek znane obrate (map.json). Za trenutne obrate
// vzamemo kratka zrna (100 ms, Hannovo okno, 50 % prekrivanja) z mesta, kjer je motor imel te obrate,
// in jih predvajamo s hitrostjo rpm/rpm_zrna. Tako ostane pravi zven, obrati pa sledijo hitrosti.
// Plasti: on (pod obremenitvijo), off (brez plina), idle (prosti tek). Mešanje po obremenitvi.

const GRAIN_S = 0.1
const JITTER_S = 0.012
const RATE_MIN = 0.5
const RATE_MAX = 2
const OUT_RMS = 0.12
const CANDIDATE_TOL = 0.015 // zrna znotraj ±1,5 % obratov so enakovredna (naključna izbira → raznolikost)

class Layer {
  constructor(t, rpm) {
    const idx = rpm.map((_, i) => i).sort((a, b) => rpm[a] - rpm[b])
    this.rpm = Float32Array.from(idx.map((i) => rpm[i]))
    this.t = Float32Array.from(idx.map((i) => t[i]))
  }
  get lo() {
    return this.rpm[0]
  }
  get hi() {
    return this.rpm[this.rpm.length - 1]
  }
  /** Vrne [čas, obrati] zrna za želene obrate (naključno med enakovrednimi). */
  pick(r, rand) {
    const target = Math.min(Math.max(r, this.lo), this.hi)
    let a = 0
    let b = this.rpm.length - 1
    while (a < b) {
      const m = (a + b) >> 1
      if (this.rpm[m] < target) a = m + 1
      else b = m
    }
    let i0 = a
    let i1 = a
    while (i0 > 0 && this.rpm[i0 - 1] >= target * (1 - CANDIDATE_TOL)) i0--
    while (i1 < this.rpm.length - 1 && this.rpm[i1 + 1] <= target * (1 + CANDIDATE_TOL)) i1++
    const k = i0 + Math.floor(rand() * (i1 - i0 + 1))
    return [this.t[k], this.rpm[k]]
  }
}

class GranularProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1000, minValue: 0, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'overrun', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this.ready = false
    this.grains = [] // {layer, pos, rate, i, len, amp}
    this.next = { on: 0, off: 0, idle: 0 } // vzorcev do naslednjega zrna na plast
    this.seed = 12345
    this.lpOff = 0
    this.port.onmessage = (e) => this.init(e.data)
  }

  rand = () => {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }

  init(d) {
    this.pcm = d.pcm
    this.hop = d.hop
    this.rms = d.rms
    this.layers = {}
    for (const [k, v] of Object.entries(d.layers)) this.layers[k] = new Layer(v.t, v.rpm)
    this.idle = d.idle
    this.idleRpm = d.idleRpm || 1000
    // ciljna glasnost zrna = mediana RMS po točkah plasti »on«
    const on = this.layers.on
    const vals = Array.from(on.t, (t) => this.rmsAt(t)).sort((a, b) => a - b)
    this.targetRms = vals[vals.length >> 1] || 0.1
    // izenačitev glasnosti: zrna so normirana na targetRms, izhod pa na ~0,12 (kot sinteza)
    this.gain = ((d.gain || 1) * OUT_RMS) / this.targetRms
    this.len = Math.round(GRAIN_S * sampleRate)
    this.win = new Float32Array(this.len).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.len - 1)))
    this.grains = []
    this.ready = true
  }

  rmsAt(t) {
    const i = Math.min(this.rms.length - 1, Math.max(0, Math.round(t / this.hop)))
    return this.rms[i]
  }

  spawn(layerName, r, amp) {
    let t, rate
    if (layerName === 'idle') {
      const [a, b] = this.idle
      t = a + GRAIN_S + this.rand() * Math.max(0, b - a - 2 * GRAIN_S)
      rate = r / this.idleRpm
    } else {
      const L = this.layers[layerName] || this.layers.on
      const [tg, rg] = L.pick(r, this.rand)
      t = tg + (this.rand() * 2 - 1) * JITTER_S
      rate = r / rg
    }
    rate = Math.min(RATE_MAX, Math.max(RATE_MIN, rate))
    const norm = Math.min(4, Math.max(0.25, this.targetRms / (this.rmsAt(t) + 1e-6)))
    const start = t * sampleRate - (this.len / 2) * rate
    if (start < 0 || start + this.len * rate >= this.pcm.length - 1) return
    this.grains.push({ layer: layerName, pos: start, rate, i: 0, amp: amp * norm })
  }

  process(_in, outputs, params) {
    const out = outputs[0][0]
    if (!out) return true
    out.fill(0)
    if (!this.ready) return true
    const r = params.rpm[0]
    const load = params.load[0]
    const ov = params.overrun[0] > 0.5
    const hopS = this.len >> 1

    // uteži plasti (enakomočno), prosti tek pod ~1,3 × obratov prostega teka
    const idleW = this.idle ? Math.min(1, Math.max(0, (this.idleRpm * 1.3 - r) / (this.idleRpm * 0.3))) : 0
    const m = ov ? 0 : 0.35 + 0.65 * load
    const w = {
      idle: idleW,
      on: (1 - idleW) * Math.sin((m * Math.PI) / 2) * (0.6 + 0.4 * load),
      off: (1 - idleW) * Math.cos((m * Math.PI) / 2) * (this.layers.off ? 0.8 : 0.5),
    }

    for (const name of ['on', 'off', 'idle']) {
      this.next[name] -= out.length
      while (this.next[name] <= 0) {
        if (w[name] > 0.002) this.spawn(name, r, w[name])
        this.next[name] += hopS
      }
    }

    const pcm = this.pcm
    const win = this.win
    const len = this.len
    let offBuf = null
    for (let g = this.grains.length - 1; g >= 0; g--) {
      const gr = this.grains[g]
      // plast off brez lastnih posnetkov: zrna on skozi nizkoprepustni filter (zamolklo)
      const muffle = gr.layer === 'off' && !this.layers.off
      if (muffle && !offBuf) offBuf = new Float32Array(out.length)
      const dst = muffle ? offBuf : out
      let p = gr.pos + gr.i * gr.rate
      for (let s = 0; s < out.length && gr.i < len; s++, gr.i++, p += gr.rate) {
        const k = p | 0
        const f = p - k
        dst[s] += (pcm[k] + (pcm[k + 1] - pcm[k]) * f) * win[gr.i] * gr.amp
      }
      if (gr.i >= len) this.grains.splice(g, 1)
    }
    if (offBuf) {
      const a = 1 - Math.exp((-2 * Math.PI * 1200) / sampleRate)
      for (let s = 0; s < out.length; s++) {
        this.lpOff += a * (offBuf[s] - this.lpOff)
        out[s] += this.lpOff
      }
    }
    const gain = this.gain
    for (let s = 0; s < out.length; s++) out[s] *= gain
    return true
  }
}

registerProcessor('granular', GranularProcessor)
