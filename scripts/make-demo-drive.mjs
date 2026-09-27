// Ustvari static/replay/demo.csv: sintetična vožnja 1 Hz (t_s, speed_kmh, heading_deg).
import { mkdirSync, writeFileSync } from 'node:fs'

// [trajanje s, ciljna hitrost km/h, hitrost zavijanja °/s (+ desno)]
const legs = [
  [4, 0, 0],
  [12, 90, 0], // močan pospešek
  [6, 90, 0],
  [5, 50, 0], // zaviranje pred ovinkom
  [8, 50, 11], // desni ovinek ~0,27 g
  [6, 80, 0],
  [8, 70, -14], // levi ovinek ~0,4 g
  [12, 120, 0],
  [15, 120, 2],
  [6, 60, 0], // močno zaviranje
  [10, 45, 16], // krožišče
  [10, 90, 0],
  [12, 0, 0],
  [4, 0, 0],
]
const rows = ['t_s,speed_kmh,heading_deg']
let t = 0
let v = 0
let h = 0
for (const [dur, target, yaw] of legs) {
  const start = v
  for (let k = 1; k <= dur; k++) {
    t++
    v = start + ((target - start) * k) / dur
    if (v > 0) h = (h + yaw + 360) % 360
    rows.push(`${t},${v.toFixed(1)},${h.toFixed(1)}`)
  }
}
mkdirSync('static/replay', { recursive: true })
writeFileSync('static/replay/demo.csv', rows.join('\n') + '\n')
console.log(`demo.csv: ${rows.length - 1} vzorcev, ${t} s`)
