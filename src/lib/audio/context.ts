import { AUDIO } from '../config'
import type { Scene } from '../scenes/types'
import { createAmbience } from './ambience'
import { makeImpulse } from './acoustics'
import { EngineSampler } from './engineSampler'

interface SceneLayer {
  ambience: { out: GainNode; stop: () => void }
  wet: GainNode
  dry: GainNode
  convolver: ConvolverNode | null
}

/**
 * Veriga: motor (sinteza ali zanke) → [dry | convolver→wet] → limiter → master → izhod
 *         ambient ─────────────────────────────────────────→ limiter
 */
export class AudioEngine {
  ctx!: AudioContext
  private synth!: AudioWorkletNode
  private synthBus!: GainNode
  private sampler: EngineSampler | null = null
  private engineBus!: GainNode
  private limiter!: DynamicsCompressorNode
  private master!: GainNode
  private layer: SceneLayer | null = null
  private sceneToken = 0

  /** Kliči samo iz dotika uporabnika (odklep AudioContext). */
  async start(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume()
      return
    }
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    const ctx = this.ctx
    await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/engine.js`)
    this.synth = new AudioWorkletNode(ctx, 'engine', { numberOfOutputs: 1, outputChannelCount: [1] })
    this.synthBus = ctx.createGain()
    this.engineBus = ctx.createGain()
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = AUDIO.limiterThresholdDb
    this.limiter.knee.value = 0
    this.limiter.ratio.value = AUDIO.limiterRatio
    this.limiter.attack.value = AUDIO.limiterAttackS
    this.limiter.release.value = AUDIO.limiterReleaseS
    this.master = ctx.createGain()
    this.master.gain.value = AUDIO.defaultMaxVolume
    this.synth.connect(this.synthBus).connect(this.engineBus)
    this.limiter.connect(this.master).connect(ctx.destination)
    await ctx.resume()
  }

  get running(): boolean {
    return this.ctx?.state === 'running'
  }

  /** Merilnik izhoda (za preverjanje prekinitev ob preklopu scene). */
  meter(): AnalyserNode {
    const an = this.ctx.createAnalyser()
    an.fftSize = 512
    this.master.connect(an)
    return an
  }

  suspend(): void {
    void this.ctx?.suspend()
  }

  setVolume(v: number): void {
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, AUDIO.paramTimeConstantS)
  }

  /** Klic vsak cikel. Gladko sledenje → brez »zipper« šuma. */
  setDrive(rpm: number, load: number, overrun: boolean): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const tc = AUDIO.paramTimeConstantS
    this.synth.parameters.get('rpm')!.setTargetAtTime(rpm, t, tc)
    this.synth.parameters.get('load')!.setTargetAtTime(load, t, tc)
    this.synth.parameters.get('overrun')!.setTargetAtTime(overrun ? 1 : 0, t, tc)
    this.sampler?.set(rpm, load, overrun)
  }

  /** Preklop scene brez prekinitve: motor teče naprej, ambient in akustika se prelijeta. */
  async setScene(scene: Scene): Promise<void> {
    if (!this.ctx) return
    const ctx = this.ctx
    const token = ++this.sceneToken
    const t = ctx.currentTime
    const fade = AUDIO.sceneFadeS
    this.synth.port.postMessage(scene.synth)

    // nova plast
    const dry = ctx.createGain()
    const wet = ctx.createGain()
    dry.gain.value = 0
    wet.gain.value = 0
    let convolver: ConvolverNode | null = null
    this.engineBus.connect(dry).connect(this.limiter)
    if (scene.acoustics.ir !== 'none' && scene.acoustics.wet > 0) {
      convolver = ctx.createConvolver()
      convolver.buffer = makeImpulse(ctx, scene.acoustics)
      this.engineBus.connect(convolver).connect(wet).connect(this.limiter)
    }
    const ambience = createAmbience(ctx, scene.ambience)
    ambience.out.connect(this.limiter)
    dry.gain.setTargetAtTime(1 - scene.acoustics.wet * 0.5, t, fade / 3)
    wet.gain.setTargetAtTime(scene.acoustics.wet, t, fade / 3)
    ambience.out.gain.setTargetAtTime(1, t, fade / 3)

    // stara plast ven
    const old = this.layer
    this.layer = { ambience, wet, dry, convolver }
    if (old) {
      for (const g of [old.dry, old.wet, old.ambience.out]) g.gain.setTargetAtTime(0, t, fade / 3)
      setTimeout(() => {
        old.ambience.stop()
        for (const n of [old.dry, old.wet, old.ambience.out, old.convolver]) n?.disconnect()
      }, fade * 1000 * 3)
    }

    // zanke motorja, če obstajajo; do nalaganja igra sinteza
    const sampler = await EngineSampler.load(ctx, scene.engine)
    if (token !== this.sceneToken) {
      sampler?.dispose()
      return
    }
    const prev = this.sampler
    const now = ctx.currentTime
    if (sampler) {
      sampler.output.gain.value = 0
      sampler.output.connect(this.engineBus)
      sampler.output.gain.setTargetAtTime(1, now, fade / 3)
    }
    this.synthBus.gain.setTargetAtTime(sampler ? 0 : 1, now, fade / 3)
    this.sampler = sampler
    if (prev) {
      prev.output.gain.setTargetAtTime(0, now, fade / 3)
      setTimeout(() => prev.dispose(), fade * 1000 * 3)
    }
  }
}

export const audio = new AudioEngine()
