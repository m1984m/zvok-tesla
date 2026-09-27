import type { Sample } from '../physics/smoothing'

export type { Sample }
/** Vir telemetrije: zažene oddajanje vzorcev, vrne funkcijo za ustavitev. */
export type Source = (emit: (s: Sample) => void, onError?: (msg: string) => void) => () => void

export const now = (): number => performance.now() / 1000
