<script lang="ts">
  import { car, type SourceKind } from './lib/state.svelte'
  import { audio } from './lib/audio/context'
  import { setSource, shift, startLoop, stopLoop } from './lib/engine'
  import { scenes, sceneById } from './lib/scenes/registry'
  import { manualInput, type Pedal } from './lib/telemetry/manual'
  import { parseTrack } from './lib/telemetry/replay'
  import Tach from './lib/ui/Tach.svelte'
  import ShiftLights from './lib/ui/ShiftLights.svelte'
  import StartOverlay from './lib/ui/StartOverlay.svelte'

  const PREFS = 'pogon.prefs.v2'
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}')
    if (scenes.some((s) => s.id === p.sceneId)) car.sceneId = p.sceneId
    if (p.source) car.source = p.source
    if (typeof p.volume === 'number') car.volume = p.volume
    if (p.mode) car.mode = p.mode
  } catch {
    /* brez shrambe */
  }
  $effect(() => {
    const p = { sceneId: car.sceneId, source: car.source, volume: car.volume, mode: car.mode }
    try {
      localStorage.setItem(PREFS, JSON.stringify(p))
    } catch {
      /* brez shrambe */
    }
  })

  // nalaganje datotek samo za razvoj (?dev); v avtu ni datotek
  const DEV = new URLSearchParams(location.search).has('dev')
  const scene = $derived(sceneById(car.sceneId))
  let menu = $state(false)

  async function start() {
    try {
      await audio.start()
      if (!car.started) {
        await audio.setScene(scene)
        await setSource(car.source)
        car.started = true
      }
      audio.setVolume(car.volume)
      car.paused = false
      startLoop()
    } catch (e) {
      car.error = e instanceof Error ? e.message : String(e)
    }
  }

  function pickScene(id: string) {
    car.sceneId = id
    void audio.setScene(sceneById(id))
  }

  function pickSource(k: SourceKind) {
    menu = false
    void setSource(k)
  }

  async function loadFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    const samples = parseTrack(await f.text())
    if (samples.length < 2) {
      car.error = 'V datoteki ni uporabnih točk.'
      return
    }
    menu = false
    await setSource('replay', samples)
  }

  const pedal = (p: Pedal) => (manualInput.pedal = p)

  $effect(() => audio.setVolume(car.volume))

  // zavihek v ozadju: zvok ustavi
  $effect(() => {
    const onVis = () => {
      if (document.hidden && car.started) {
        audio.suspend()
        stopLoop()
        car.paused = true
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  })

  // kratek odziv obvolanske ročice: barva teme ob menjavi, rdeča ob zavrnitvi
  let flash = $state<{ side: -1 | 1; ok: boolean; n: number } | null>(null)
  function paddle(side: -1 | 1) {
    const before = car.denied
    shift(side)
    const n = (flash?.n ?? 0) + 1
    flash = { side, ok: car.denied === before, n }
    setTimeout(() => {
      if (flash?.n === n) flash = null
    }, 220)
  }

  const SOURCES: [SourceKind, string, string][] = [
    ['gps', 'GPS', 'hitrost iz satelitov'],
    ['replay', 'Demo vožnja', 'posnetek, za preizkus na mestu'],
    ['manual', 'Ročni plin', 'gumba plin in zavora'],
  ]
  const sourceLabel = $derived(SOURCES.find((s) => s[0] === car.source)?.[1] ?? '')
  const gpsState = $derived(car.source !== 'gps' ? '' : car.error ? 'err' : car.v > 0 ? 'ok' : 'wait')
</script>

<div class="app" class:low={car.lowPower} style:--accent={scene.theme.accent}>
  {#if !car.started}
    <StartOverlay label="START" sub="{scene.name} · tapni za zagon" accent={scene.theme.accent} onstart={start} />
  {:else if car.paused}
    <StartOverlay label="START" sub="Tapni za nadaljevanje" accent={scene.theme.accent} onstart={start} />
  {/if}

  <button
    class="paddle left"
    class:hit={flash?.side === -1 && flash.ok}
    class:deny={flash?.side === -1 && !flash.ok}
    onpointerdown={() => paddle(-1)}
    aria-label="Prestava dol"
  >
    <span class="sym">−</span><span class="cap">DOL</span>
  </button>

  <section class="center">
    <ShiftLights />
    <div class="tach"><Tach accent={scene.theme.accent} /></div>
    {#if car.error}<p class="err">{car.error}</p>{/if}
  </section>

  <button
    class="paddle right"
    class:hit={flash?.side === 1 && flash.ok}
    class:deny={flash?.side === 1 && !flash.ok}
    onpointerdown={() => paddle(1)}
    aria-label="Prestava gor"
  >
    <span class="sym">+</span><span class="cap">GOR</span>
  </button>

  <footer class="bar">
    <div class="seg engines" role="group" aria-label="Motor">
      {#each scenes as s (s.id)}
        <button class:on={car.sceneId === s.id} style:--a={s.theme.accent} onclick={() => pickScene(s.id)}>
          <b>{s.name}</b><small>{s.subtitle}</small>
        </button>
      {/each}
    </div>

    <div class="seg mode" role="group" aria-label="Menjalnik">
      <button class:on={car.mode === 'auto'} onclick={() => (car.mode = 'auto')}>AUTO</button>
      <button class:on={car.mode === 'manual'} onclick={() => (car.mode = 'manual')}>ROČNO</button>
    </div>

    <label class="vol">
      <span>GLASNOST</span>
      <input type="range" min="0" max="1" step="0.05" bind:value={car.volume} aria-label="Glasnost" />
    </label>

    <button class="src" onclick={() => (menu = !menu)} aria-expanded={menu}>
      <i class="dot {gpsState}"></i>{sourceLabel}
    </button>
  </footer>

  {#if car.source === 'manual'}
    <div class="pedals">
      <button onpointerdown={() => pedal('brake')} onpointerup={() => pedal('none')} onpointerleave={() => pedal('none')}
        >ZAVORA</button
      >
      <button class="gas" onpointerdown={() => pedal('gas')} onpointerup={() => pedal('none')} onpointerleave={() => pedal('none')}
        >PLIN</button
      >
    </div>
  {/if}

  {#if menu}
    <button class="scrim" onclick={() => (menu = false)} aria-label="Zapri"></button>
    <div class="menu" role="dialog" aria-label="Vir hitrosti">
      <h2>Vir hitrosti</h2>
      {#each SOURCES as [k, label, hint] (k)}
        <button class:on={car.source === k} onclick={() => pickSource(k)}><b>{label}</b><small>{hint}</small></button>
      {/each}
      {#if DEV}
        <label class="file">Naloži GPX ali CSV <input type="file" accept=".gpx,.csv,.txt" onchange={loadFile} /></label>
      {/if}
    </div>
  {/if}
</div>

<style>
  .app {
    --panel: #111317;
    --line: #23262c;
    --mute: #8a8d94;
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: clamp(96px, 9vw, 150px) minmax(0, 1fr) clamp(96px, 9vw, 150px);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 14px 16px 16px;
    background: radial-gradient(ellipse at 50% 40%, #16181d 0%, #07080a 65%);
    color: #f4f4f5;
    font-family: 'Barlow Condensed', system-ui, sans-serif;
    overflow: hidden;
  }
  .app.low {
    background: #07080a;
  }
  button {
    font-family: inherit;
    color: inherit;
    border: 1px solid var(--line);
    background: var(--panel);
    border-radius: 14px;
    cursor: pointer;
  }

  /* obvolanski ročici */
  .paddle {
    grid-row: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: linear-gradient(180deg, #1a1c21, #0e0f12);
    border-radius: 22px;
    transition: background 0.12s;
  }
  .paddle .sym {
    font-size: 72px;
    font-weight: 600;
    line-height: 0.8;
  }
  .paddle .cap {
    font-size: 18px;
    letter-spacing: 0.25em;
    color: var(--mute);
  }
  .paddle.hit {
    background: color-mix(in srgb, var(--accent) 35%, #0e0f12);
    border-color: var(--accent);
  }
  .paddle.deny {
    background: #3a0c0a;
    border-color: #ff3b2f;
  }

  .center {
    grid-row: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
  }
  .tach {
    min-height: 0;
    display: flex;
    justify-content: center;
  }
  .err {
    position: absolute;
    left: 50%;
    top: 70px;
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 16px;
    border-radius: 10px;
    background: #3a0c0a;
    color: #ffb4ad;
    font-size: 20px;
  }

  /* spodnja vrstica */
  .bar {
    grid-column: 1 / -1;
    display: flex;
    align-items: stretch;
    gap: 12px;
  }
  .seg {
    display: flex;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #0b0c0f;
  }
  .seg button {
    border: 0;
    background: transparent;
    border-radius: 12px;
    min-height: 64px;
    padding: 0 22px;
    color: var(--mute);
  }
  .seg button.on {
    background: #1d2026;
    color: #f4f4f5;
    box-shadow: inset 0 -3px 0 var(--a, var(--accent));
  }
  .engines button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-width: 170px;
  }
  .engines b {
    font-size: 30px;
    line-height: 1;
  }
  .engines small {
    font-size: 15px;
    letter-spacing: 0.02em;
  }
  .mode button {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.12em;
  }
  .vol {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 18px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #0b0c0f;
    color: var(--mute);
    font-size: 18px;
    letter-spacing: 0.18em;
  }
  .vol input {
    flex: 1;
    min-width: 60px;
    height: 44px;
    accent-color: var(--accent);
  }
  .src {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 22px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--mute);
  }
  .dot.ok {
    background: #28e06a;
  }
  .dot.wait {
    background: #ffc21a;
  }
  .dot.err {
    background: #ff3b2f;
  }

  /* ročni plin (razvoj) */
  .pedals {
    position: fixed;
    right: calc(clamp(96px, 9vw, 150px) + 32px);
    bottom: 110px;
    display: flex;
    gap: 10px;
  }
  .pedals button {
    width: 150px;
    height: 110px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .pedals .gas {
    background: var(--accent);
    color: #0b0c0f;
  }

  /* meni vira */
  .scrim {
    position: fixed;
    inset: 0;
    border: 0;
    border-radius: 0;
    background: rgb(0 0 0 / 0.55);
    z-index: 5;
  }
  .menu {
    position: fixed;
    right: 16px;
    bottom: 100px;
    z-index: 6;
    width: min(420px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: #0f1115;
  }
  .menu h2 {
    margin: 0 0 4px;
    font-size: 18px;
    letter-spacing: 0.2em;
    color: var(--mute);
    text-transform: uppercase;
    font-weight: 600;
  }
  .menu button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 14px 18px;
    min-height: 70px;
    text-align: left;
  }
  .menu button b {
    font-size: 26px;
  }
  .menu button small {
    font-size: 16px;
    color: var(--mute);
  }
  .menu button.on {
    border-color: var(--accent);
  }
  .file {
    font-size: 16px;
    color: var(--mute);
  }

  /* ozek zaslon (razvoj na telefonu) */
  @media (max-width: 760px) {
    .app {
      grid-template-columns: 72px minmax(0, 1fr) 72px;
      padding: 10px;
    }
    .bar {
      flex-wrap: wrap;
    }
    .engines button {
      min-width: 0;
      padding: 0 12px;
    }
    .paddle .sym {
      font-size: 48px;
    }
  }
</style>
