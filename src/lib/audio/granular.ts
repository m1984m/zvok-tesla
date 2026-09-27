import { AUDIO } from '../config'

interface EngineMap {
  hop: number
  rms: number[]
  layers: Record<string, { t: number[]; rpm: number[] }>
  idle: [number, number] | null
  idleRpm: number
  gain: number
}

/** Pravi posnetek motorja prek granularnega predvajalnika (static/worklets/granular.js). */
export class GranularEngine {
  readonly output: GainNode

  private constructor(
    private ctx: BaseAudioContext,
    private node: AudioWorkletNode,
  ) {
    this.output = ctx.createGain()
    node.connect(this.output)
  }

  /** Naloži static/audio/<engine>/clip.opus + map.json; null, če motor nima posnetka. */
  static async load(ctx: BaseAudioContext, engine: string, base = import.meta.env.BASE_URL): Promise<GranularEngine | null> {
    const dir = `${base}audio/${engine}/`
    let map: EngineMap
    let pcm: Float32Array
    try {
      const r = await fetch(dir + 'map.json')
      if (!r.ok) return null
      map = await r.json()
      const buf = await ctx.decodeAudioData(await (await fetch(dir + 'clip.opus')).arrayBuffer())
      pcm = buf.getChannelData(0).slice()
    } catch {
      return null
    }
    const node = new AudioWorkletNode(ctx, 'granular', { numberOfOutputs: 1, outputChannelCount: [1] })
    node.port.postMessage(
      { pcm, hop: map.hop, rms: Float32Array.from(map.rms), layers: map.layers, idle: map.idle, idleRpm: map.idleRpm, gain: map.gain },
      [pcm.buffer],
    )
    return new GranularEngine(ctx, node)
  }

  set(rpm: number, load: number, overrun: boolean): void {
    const t = this.ctx.currentTime
    const tc = AUDIO.paramTimeConstantS
    this.node.parameters.get('rpm')!.setTargetAtTime(rpm, t, tc)
    this.node.parameters.get('load')!.setTargetAtTime(load, t, tc)
    this.node.parameters.get('overrun')!.setTargetAtTime(overrun ? 1 : 0, t, tc)
  }

  dispose(): void {
    this.node.disconnect()
    this.output.disconnect()
  }
}
