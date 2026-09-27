export interface SynthProfile {
  kind: 'combustion' | 'electric'
  cylinders?: number
  pulseDecay?: number
  brightness?: number
  roughness?: number
  rumble?: number
  noise?: number
  crackle?: number
  gain?: number
}

export interface Scene {
  id: string
  name: string
  tier: string // vsi paketi so odklenjeni (docs/DECISIONS.md)
  engine: string // mapa zank v static/audio/<engine>/; če je ni, velja synth
  synth: SynthProfile
  ambience: { type: 'none' | 'wind' | 'sea' | 'city' | 'rain'; gain: number; lowpassHz: number }
  acoustics: { ir: 'none' | 'tunnel' | 'valley' | 'street' | 'room'; decayS: number; wet: number }
  theme: { accent: string; bg: [string, string] }
}
