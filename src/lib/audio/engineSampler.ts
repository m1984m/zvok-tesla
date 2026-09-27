import { AUDIO, SAMPLER } from '../config'

export interface Manifest {
  steps: number[] // rpm koraki, naraščajoče
  states: ('on' | 'off')[]
  idle: boolean
}

export interface Voice {
  key: string // npr. on_3000
  gain: number
  rate: number
}

/** Enakomočni preliv med dvema najbližjima korakoma × preliv on/off. Čista funkcija (test). */
export function samplerMix(rpm: number, load: number, overrun: boolean, m: Manifest): Voice[] {
  const s = m.steps
  const r = Math.min(Math.max(rpm, s[0]), s[s.length - 1])
  let j = 0
  while (j < s.length - 2 && r > s[j + 1]) j++
  const lo = s[j]
  const hi = s[j + 1] ?? lo
  const x = hi === lo ? 0 : (r - lo) / (hi - lo)
  const onMix = overrun ? 0 : SAMPLER.onFloor + (1 - SAMPLER.onFloor) * load
  const states: [string, number][] = m.states.includes('off')
    ? [['on', Math.sin((onMix * Math.PI) / 2)], ['off', Math.cos((onMix * Math.PI) / 2)]]
    : [['on', 1]]
  const out: Voice[] = []
  for (const [st, g] of states) {
    out.push({ key: `${st}_${lo}`, gain: g * Math.cos((x * Math.PI) / 2), rate: rpm / lo })
    if (hi !== lo) out.push({ key: `${st}_${hi}`, gain: g * Math.sin((x * Math.PI) / 2), rate: rpm / hi })
  }
  return out
}

/** Predvajalnik zank: vsi viri tečejo ves čas v zanki, spreminjajo se samo gain in playbackRate. */
export class EngineSampler {
  private voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>()
  readonly output: GainNode

  private constructor(
    private ctx: AudioContext,
    private manifest: Manifest,
  ) {
    this.output = ctx.createGain()
  }

  /** Naloži zanke motorja; vrne null, če motor nima zank (takrat velja sinteza). */
  static async load(ctx: AudioContext, engine: string): Promise<EngineSampler | null> {
    const base = `${import.meta.env.BASE_URL}audio/${engine}/`
    let manifest: Manifest
    try {
      const r = await fetch(base + 'manifest.json')
      if (!r.ok) return null
      manifest = await r.json()
    } catch {
      return null
    }
    const sp = new EngineSampler(ctx, manifest)
    const keys = manifest.states.flatMap((st) => manifest.steps.map((n) => `${st}_${n}`))
    await Promise.all(
      keys.map(async (key) => {
        const buf = await ctx.decodeAudioData(await (await fetch(`${base}${key}.opus`)).arrayBuffer())
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.loop = true
        const gain = ctx.createGain()
        gain.gain.value = 0
        src.connect(gain).connect(sp.output)
        src.start()
        sp.voices.set(key, { src, gain })
      }),
    )
    return sp
  }

  set(rpm: number, load: number, overrun: boolean): void {
    const t = this.ctx.currentTime
    const active = new Map(samplerMix(rpm, load, overrun, this.manifest).map((v) => [v.key, v]))
    for (const [key, n] of this.voices) {
      const v = active.get(key)
      n.gain.gain.setTargetAtTime(v ? v.gain : 0, t, AUDIO.paramTimeConstantS)
      if (v) n.src.playbackRate.setTargetAtTime(v.rate, t, AUDIO.paramTimeConstantS)
    }
  }

  dispose(): void {
    for (const n of this.voices.values()) n.src.stop()
    this.output.disconnect()
  }
}
