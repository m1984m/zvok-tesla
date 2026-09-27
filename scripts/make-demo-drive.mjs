// Ustvari tri 20-sekundne tipične vožnje za poslušanje (1 Hz: t_s, speed_kmh, heading_deg):
//   static/replay/mesto.csv, regionalna.csv, avtocesta.csv
// Pospeški so realni za Model 3 (mesto ~2,3 m/s², priključek na avtocesto ~3 m/s², zaviranje 2,5–3 m/s²).
import { mkdirSync, writeFileSync } from 'node:fs'

// [trajanje s, pospešek m/s², zavijanje °/s (+ desno)]
const drives = {
  mesto: {
    v0: 0,
    legs: [
      [2, 0, 0], // stoji na semaforju
      [6, 2.3, 0], // speljevanje do ~50 km/h
      [5, 0, 0],
      [2, -1.5, 8], // desno v ulico
      [5, -2.3, 0], // zaviranje do ustavitve
    ],
  },
  regionalna: {
    v0: 60 / 3.6,
    legs: [
      [6, 1.6, 0], // 60 → 95 km/h
      [5, 0, -6], // levi ovinek ~0,28 g
      [4, -2.8, 0], // zaviranje pred križiščem
      [5, 2.0, 0], // ponovno pospeševanje
    ],
  },
  avtocesta: {
    v0: 60 / 3.6,
    legs: [
      [7, 3.0, 0], // priključek: 60 → ~135 km/h
      [2, -0.6, 0],
      [11, 0, 1.2], // enakomerno ~130 km/h, blag ovinek
    ],
  },
}

mkdirSync('static/replay', { recursive: true })
for (const [name, d] of Object.entries(drives)) {
  const rows = ['t_s,speed_kmh,heading_deg']
  let t = 0
  let v = d.v0
  let h = 0
  rows.push(`0,${(v * 3.6).toFixed(1)},0.0`)
  for (const [dur, acc, yaw] of d.legs)
    for (let k = 0; k < dur; k++) {
      t++
      v = Math.max(0, v + acc)
      if (v > 0) h = (h + yaw + 360) % 360
      rows.push(`${t},${(v * 3.6).toFixed(1)},${h.toFixed(1)}`)
    }
  writeFileSync(`static/replay/${name}.csv`, rows.join('\n') + '\n')
  const kmh = rows.slice(1).map((r) => Number(r.split(',')[1]))
  console.log(`${name}.csv: ${t} s, ${Math.min(...kmh)}–${Math.max(...kmh)} km/h, konec ${kmh[kmh.length - 1]} km/h`)
}
