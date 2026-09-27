<script lang="ts">
  import { GFORCE, LOOP } from '../config'
  import { car } from '../state.svelte'

  let { accent = '#ff2a1a' }: { accent?: string } = $props()
  let canvas: HTMLCanvasElement
  let size = $state(260)
  const FONT = "'Barlow Condensed', system-ui, sans-serif"
  const TRAIL = Math.round(GFORCE.trailS * LOOP.uiMaxFps)
  const trail: [number, number][] = []

  // Prikaz kot ga čuti voznik: zaviranje → pika naprej (gor), pospeševanje → nazaj (dol),
  // desni zavoj → pika levo.
  const toXY = (gLat: number, gLong: number, cx: number, R: number): [number, number] => {
    const k = R / GFORCE.meterMaxG
    const x = -gLat * k
    const y = gLong * k
    const d = Math.hypot(x, y)
    const f = d > R ? R / d : 1
    return [cx + x * f, cx + y * f]
  }

  let bg: HTMLCanvasElement | null = null
  let bgKey = ''
  let fontsReady = $state(false)
  $effect(() => {
    void document.fonts.ready.then(() => (fontsReady = true))
  })

  function staticLayer(s: number, dpr: number): HTMLCanvasElement {
    const key = `${s}|${dpr}|${fontsReady}`
    if (bg && bgKey === key) return bg
    bg = document.createElement('canvas')
    bg.width = bg.height = s * dpr
    const c = bg.getContext('2d')!
    c.scale(dpr, dpr)
    const cx = s / 2
    const R = s * 0.44
    c.fillStyle = '#0b0c0f'
    c.beginPath()
    c.arc(cx, cx, R, 0, Math.PI * 2)
    c.fill()
    for (const g of [0.25, 0.5, 0.75, 1.0]) {
      c.strokeStyle = g === 1 ? '#3a3d44' : g === 0.5 ? '#2c2f36' : '#1c1e23'
      c.lineWidth = g === 0.5 || g === 1 ? 2 : 1
      c.beginPath()
      c.arc(cx, cx, (R * g) / GFORCE.meterMaxG, 0, Math.PI * 2)
      c.stroke()
    }
    c.strokeStyle = '#1c1e23'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(cx - R, cx)
    c.lineTo(cx + R, cx)
    c.moveTo(cx, cx - R)
    c.lineTo(cx, cx + R)
    c.stroke()
    c.fillStyle = '#5c5f66'
    c.font = `500 ${s * 0.05}px ${FONT}`
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText('0,5', cx + (R * 0.5) / GFORCE.meterMaxG + 3, cx - s * 0.03)
    c.fillText('1,0', cx + R / GFORCE.meterMaxG + 3, cx - s * 0.03)
    c.textAlign = 'center'
    c.fillStyle = '#7d8088'
    c.font = `600 ${s * 0.055}px ${FONT}`
    c.fillText('ZAVIRANJE', cx, cx - R - s * 0.035)
    c.fillText('POSPEŠEK', cx, cx + R + s * 0.035)
    bgKey = key
    return bg
  }

  $effect(() => {
    const gLat = car.gLat
    const gLong = car.gLong
    const c = canvas?.getContext('2d')
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const s = Math.max(1, Math.round(size))
    if (canvas.width !== s * dpr) canvas.width = canvas.height = s * dpr
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, canvas.width, canvas.height)
    c.drawImage(staticLayer(s, dpr), 0, 0)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cx = s / 2
    const R = s * 0.44
    const p = toXY(gLat, gLong, cx, R)
    trail.push(p)
    if (trail.length > TRAIL) trail.shift()

    // sled
    c.strokeStyle = accent
    c.lineWidth = s * 0.012
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.globalAlpha = 0.35
    c.beginPath()
    trail.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.stroke()
    c.globalAlpha = 1
    // pika
    c.fillStyle = accent
    c.globalAlpha = 0.25
    c.beginPath()
    c.arc(p[0], p[1], s * 0.06, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1
    c.fillStyle = '#f4f4f5'
    c.beginPath()
    c.arc(p[0], p[1], s * 0.03, 0, Math.PI * 2)
    c.fill()
  })
</script>

<div class="wrap" bind:clientWidth={size}>
  <canvas bind:this={canvas} aria-label="G-merilnik"></canvas>
</div>

<style>
  .wrap {
    width: 100%;
    aspect-ratio: 1;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
