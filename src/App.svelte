<script lang="ts">
  import { car, type SourceKind } from './lib/state.svelte'
  import { audio } from './lib/audio/context'
  import { setSource, startLoop, stopLoop } from './lib/engine'
  import { scenes, sceneById } from './lib/scenes/registry'
  import { manualInput, type Pedal } from './lib/telemetry/manual'
  import { parseTrack } from './lib/telemetry/replay'
  import Tach from './lib/ui/Tach.svelte'
  import ShiftLights from './lib/ui/ShiftLights.svelte'
  import StartOverlay from './lib/ui/StartOverlay.svelte'
  import GMeter from './lib/ui/GMeter.svelte'
  import GStats from './lib/ui/GStats.svelte'
  import { STAGE } from './lib/config'

  const PREFS = 'pogon.prefs.v2'
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}')
    if (scenes.some((s) => s.id === p.sceneId)) car.sceneId = p.sceneId
    if (p.source) car.source = p.source
    if (typeof p.volume === 'number') car.volume = p.volume
  } catch {
    /* brez shrambe */
  }
  $effect(() => {
    const p = { sceneId: car.sceneId, source: car.source, volume: car.volume }
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

  // plošča STAGE.width × STAGE.height, pomanjšana v okno (sredinsko, z robovi)
  $effect(() => {
    const fit = () => (car.uiScale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height))
    fit()
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  })

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

  const SOURCES: [SourceKind, string, string][] = [
    ['gps', 'GPS', 'hitrost iz satelitov'],
    ['replay', 'Demo vožnja', 'posnetek, za preizkus na mestu'],
    ['manual', 'Ročni plin', 'gumba plin in zavora (razvoj)'],
  ].filter((x) => DEV || x[0] !== 'manual') as [SourceKind, string, string][]
  const sourceLabel = $derived(SOURCES.find((s) => s[0] === car.source)?.[1] ?? '')
  const gpsState = $derived(car.source !== 'gps' ? '' : car.error ? 'err' : car.stale || car.v === 0 ? 'wait' : 'ok')
</script>

<div class="stage">
<div
  class="app"
  class:low={car.lowPower}
  style:--accent={scene.theme.accent}
  style:width="{STAGE.width}px"
  style:height="{STAGE.height}px"
  style:transform="translate(-50%, -50%) scale({car.uiScale})"
>
  {#if !car.started}
    <StartOverlay label="START" sub="{scene.name} · tapni za zagon" accent={scene.theme.accent} onstart={start} />
  {:else if car.paused}
    <StartOverlay label="START" sub="Tapni za nadaljevanje" accent={scene.theme.accent} onstart={start} />
  {/if}

  <aside class="side left">
    <h2>G-SILE</h2>
    <GMeter accent={scene.theme.accent} />
  </aside>

  <section class="center">
    <ShiftLights />
    <div class="tach"><Tach accent={scene.theme.accent} /></div>
    {#if car.error}<p class="err">{car.error}</p>{/if}
  </section>

  <aside class="side right">
    <GStats />
  </aside>

  <footer class="bar">
    <div class="seg engines" role="group" aria-label="Motor">
      {#each scenes as s (s.id)}
        <button class:on={car.sceneId === s.id} style:--a={s.theme.accent} onclick={() => pickScene(s.id)}>
          <b>{s.name}</b><small>{s.subtitle}</small>
        </button>
      {/each}
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
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #07080a;
  }
  .app {
    --panel: #111317;
    --line: #23262c;
    --mute: #8a8d94;
    position: absolute;
    left: 50%;
    top: 50%;
    transform-origin: center;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr) 300px;
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

  /* stranska panela */
  .side {
    grid-row: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .side.left {
    justify-content: center;
  }
  .side h2 {
    margin: 0;
    font-size: 17px;
    letter-spacing: 0.25em;
    color: var(--mute);
    font-weight: 600;
    text-align: center;
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
    position: absolute;
    right: 332px;
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
    position: absolute;
    inset: 0;
    border: 0;
    border-radius: 0;
    background: rgb(0 0 0 / 0.55);
    z-index: 5;
  }
  .menu {
    position: absolute;
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

</style>
