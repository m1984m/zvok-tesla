import type { Scene } from './types'

const ORDER = ['stirivaljnik', 'karavanke', 'pohorje', 'obala', 'ljubljana_lofi', 'inverter']

const mods = import.meta.glob<Scene>('./*.json', { eager: true, import: 'default' })

/** Vse scene so odklenjene (osebna raba, docs/DECISIONS.md). */
export const scenes: Scene[] = Object.values(mods).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))

export function sceneById(id: string): Scene {
  return scenes.find((s) => s.id === id) ?? scenes[0]
}
