// Ustvari static/replay/demo.csv: sintetična vožnja 1 Hz (t_s, speed_kmh).
import { mkdirSync, writeFileSync } from 'node:fs'

// [trajanje s, ciljna hitrost km/h]
const legs = [[4, 0], [12, 70], [8, 70], [6, 40], [15, 110], [20, 120], [10, 60], [8, 90], [12, 0], [5, 0]]
const rows = ['t_s,speed_kmh']
let t = 0
let v = 0
for (const [dur, target] of legs) {
  const start = v
  for (let k = 1; k <= dur; k++) {
    t++
    v = start + ((target - start) * k) / dur
    rows.push(`${t},${v.toFixed(1)}`)
  }
}
mkdirSync('static/replay', { recursive: true })
writeFileSync('static/replay/demo.csv', rows.join('\n') + '\n')
console.log(`demo.csv: ${rows.length - 1} vzorcev, ${t} s`)
