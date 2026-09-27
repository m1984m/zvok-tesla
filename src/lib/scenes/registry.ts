import type { Scene } from './types'

const ORDER = ['sportni', 'v8_360', 'v12']

const mods = import.meta.glob<Scene>('./*.json', { eager: true, import: 'default' })

/** Motorja (scena = motor + akustika + barva). Vse odklenjeno, osebna raba. */
export const scenes: Scene[] = Object.values(mods).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))

export function sceneById(id: string): Scene {
  return scenes.find((s) => s.id === id) ?? scenes[0]
}
