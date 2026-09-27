<script lang="ts">
  import { DRIVETRAIN } from '../config'
  import { car } from '../state.svelte'

  let { accent = '#ff2a1a' }: { accent?: string } = $props()
  let canvas: HTMLCanvasElement
  let size = $state(600)
  let fontsReady = $state(false)

  const MAX = DRIVETRAIN.gaugeMaxRpm
  const RED = DRIVETRAIN.limiterRpm - 1000
  const A0 = Math.PI * 0.72
  const SWEEP = Math.PI * 1.56
  const ang = (r: number) => A0 + (Math.min(Math.max(r, 0), MAX) / MAX) * SWEEP
  const FONT = "'Barlow Condensed', system-ui, sans-serif"

  $effect(() => {
    void document.fonts.ready.then(() => (fontsReady = true))
  })

  // Statični sloj: številčnica se nariše enkrat na velikost (Intel Atom: vsak okvir samo kopija).
  let bg: HTMLCanvasElement | null = null
  let bgKey = ''
  function staticLayer(s: number, dpr: number): HTMLCanvasElement {
    const key = `${s}|${dpr}|${fontsReady}|${accent}`
    if (bg && bgKey === key) return bg
    bg = document.createElement('canvas')
    bg.width = bg.height = Math.round(s * dpr)
    const c = bg.getContext('2d')!
    c.scale(dpr, dpr)
    const cx = s / 2
    const R = s * 0.46

    // podlaga
    const face = c.createRadialGradient(cx, cx * 0.9, s * 0.05, cx, cx, R)
    face.addColorStop(0, '#1b1d22')
    face.addColorStop(1, '#0a0b0d')
    c.fillStyle = face
    c.beginPath()
    c.arc(cx, cx, R, 0, Math.PI * 2)
    c.fill()
    // obroč
    c.lineWidth = s * 0.008
    c.strokeStyle = '#2a2d33'
    c.stroke()

    // rdeče polje
    c.lineWidth = s * 0.045
    c.strokeStyle = '#b3120a'
    c.beginPath()
    c.arc(cx, cx, R * 0.9, ang(RED), ang(MAX))
    c.stroke()

    // oznake
    for (let r = 0; r <= MAX; r += 250) {
      const major = r % 1000 === 0
      const half = r % 500 === 0
      const a = ang(r)
      const r1 = R * 0.93
      const r0 = major ? R * 0.8 : half ? R * 0.85 : R * 0.88
      c.strokeStyle = r >= RED ? '#ff3b2f' : major ? '#e8e8ea' : '#7d8088'
      c.lineWidth = major ? s * 0.009 : s * 0.004
      c.beginPath()
      c.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0)
      c.lineTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1)
      c.stroke()
      if (major) {
        c.fillStyle = r >= RED ? '#ff3b2f' : '#e8e8ea'
        c.font = `600 ${s * 0.075}px ${FONT}`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(String(r / 1000), cx + Math.cos(a) * R * 0.66, cx + Math.sin(a) * R * 0.66)
      }
    }
    c.fillStyle = '#6b6e75'
    c.font = `500 ${s * 0.032}px ${FONT}`
    c.textAlign = 'center'
    c.fillText('× 1000 r/min', cx, cx - R * 0.36)
    bgKey = key
    return bg
  }

  $effect(() => {
    const rpm = car.rpm
    const gear = car.gear
    const limiter = car.limiter
    const kmh = Math.round(car.v * 3.6)
    const c = canvas?.getContext('2d')
    if (!c) return
    // ločljivost platna = dejanska velikost na zaslonu (plošča je pomanjšana) → na Atomu ne rišemo preveč točk
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * car.uiScale
    const s = Math.max(1, Math.round(size))
    const W = Math.round(s * dpr)
    if (canvas.width !== W || canvas.height !== W) canvas.width = canvas.height = W
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, canvas.width, canvas.height)
    c.drawImage(staticLayer(s, dpr), 0, 0)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cx = s / 2
    const R = s * 0.46
    const a = ang(rpm)

    // svetleč lok obratov (dve plasti namesto shadowBlur, ki je na Atomu drag)
    c.lineCap = 'butt'
    c.strokeStyle = accent
    c.globalAlpha = 0.18
    c.lineWidth = s * 0.05
    c.beginPath()
    c.arc(cx, cx, R * 0.975, A0, a)
    c.stroke()
    c.globalAlpha = 1
    c.lineWidth = s * 0.014
    c.beginPath()
    c.arc(cx, cx, R * 0.975, A0, a)
    c.stroke()

    // igla: zožena
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const tip = R * 0.9
    const tail = R * 0.14
    const w = s * 0.014
    c.fillStyle = limiter ? '#ff3b2f' : accent
    c.beginPath()
    c.moveTo(cx + ca * tip, cx + sa * tip)
    c.lineTo(cx - ca * tail - sa * w, cx - sa * tail + ca * w)
    c.lineTo(cx - ca * tail + sa * w, cx - sa * tail - ca * w)
    c.closePath()
    c.fill()
    // pesto
    c.fillStyle = '#16181c'
    c.beginPath()
    c.arc(cx, cx, s * 0.05, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#3a3d44'
    c.lineWidth = s * 0.006
    c.stroke()

    // prestava, način, hitrost
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = '#f4f4f5'
    c.font = `700 ${s * 0.25}px ${FONT}`
    c.fillText(String(gear), cx, cx + R * 0.42)
    c.fillStyle = '#e8e8ea'
    c.font = `600 ${s * 0.085}px ${FONT}`
    c.fillText(String(kmh), cx, cx + R * 0.74)
    c.fillStyle = '#6b6e75'
    c.font = `500 ${s * 0.032}px ${FONT}`
    c.fillText('km/h', cx, cx + R * 0.87)
  })
</script>

<div class="wrap" bind:clientWidth={size}>
  <canvas bind:this={canvas} aria-label="Merilnik obratov"></canvas>
</div>

<style>
  .wrap {
    height: 100%;
    aspect-ratio: 1;
    max-width: 100%;
    margin: 0 auto;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
