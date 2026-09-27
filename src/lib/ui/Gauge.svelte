<script lang="ts">
  import { DRIVETRAIN } from '../config'
  import { car } from '../state.svelte'

  let { accent = '#4fb0e0' }: { accent?: string } = $props()
  let canvas: HTMLCanvasElement
  let size = $state(320)

  const MAX = 8000
  const A0 = Math.PI * 0.75
  const SWEEP = Math.PI * 1.5
  const ang = (r: number) => A0 + (Math.min(r, MAX) / MAX) * SWEEP

  // Riše ob vsaki spremembi rpm (glavna zanka ga osveži ≤ 30× na s, zvezno iz ekstrapolacije).
  $effect(() => {
    const rpm = car.rpm
    const gear = car.gear
    const limiter = car.limiter
    const kmh = Math.round(car.v * 3.6)
    const c = canvas?.getContext('2d')
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const s = Math.max(1, size)
    if (canvas.width !== s * dpr) {
      canvas.width = s * dpr
      canvas.height = s * dpr
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, s, s)
    const cx = s / 2
    const cy = s / 2
    const R = s * 0.44
    const fg = getComputedStyle(canvas).color

    // lok in rdeče polje
    c.lineWidth = s * 0.03
    c.strokeStyle = 'rgba(128,128,128,0.35)'
    c.beginPath()
    c.arc(cx, cy, R, A0, A0 + SWEEP)
    c.stroke()
    c.strokeStyle = '#e03030'
    c.beginPath()
    c.arc(cx, cy, R, ang(DRIVETRAIN.limiterRpm - 500), A0 + SWEEP)
    c.stroke()
    // aktivni lok
    c.strokeStyle = accent
    c.beginPath()
    c.arc(cx, cy, R, A0, ang(rpm))
    c.stroke()

    // oznake
    c.fillStyle = fg
    c.font = `600 ${s * 0.055}px system-ui, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (let k = 0; k <= MAX / 1000; k++) {
      const a = ang(k * 1000)
      c.fillText(String(k), cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8)
    }

    // igla
    const a = ang(rpm)
    c.strokeStyle = limiter ? '#e03030' : fg
    c.lineWidth = s * 0.012
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(cx, cy)
    c.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92)
    c.stroke()

    // prestava in hitrost
    c.font = `700 ${s * 0.2}px system-ui, sans-serif`
    c.fillText(String(gear), cx, cy + s * 0.2)
    c.font = `500 ${s * 0.07}px system-ui, sans-serif`
    c.fillText(`${kmh} km/h`, cx, cy + s * 0.36)
  })
</script>

<div class="wrap" bind:clientWidth={size}>
  <canvas bind:this={canvas} aria-label="Merilnik obratov"></canvas>
</div>

<style>
  .wrap {
    width: min(100%, 60vh);
    aspect-ratio: 1;
    margin: 0 auto;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    color: var(--fg);
  }
</style>
