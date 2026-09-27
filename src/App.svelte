<script lang="ts">
  import { car, type SourceKind } from './lib/state.svelte'
  import { audio } from './lib/audio/context'
  import { setSource, startLoop, stopLoop } from './lib/engine'
  import { sceneById } from './lib/scenes/registry'
  import { manualInput, type Pedal } from './lib/telemetry/manual'
  import { parseTrack } from './lib/telemetry/replay'
  import Gauge from './lib/ui/Gauge.svelte'
  import GearSelector from './lib/ui/GearSelector.svelte'
  import ScenePicker from './lib/ui/ScenePicker.svelte'
  import StartOverlay from './lib/ui/StartOverlay.svelte'

  const PREFS = 'pogon.prefs'
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}')
    if (p.sceneId) car.sceneId = p.sceneId
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
    await setSource('replay', samples)
  }

  function pedal(p: Pedal) {
    manualInput.pedal = p
  }

  $effect(() => {
    audio.setVolume(car.volume)
  })

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

  const SOURCES: [SourceKind, string][] = [
    ['gps', 'GPS'],
    ['replay', 'Posnetek'],
    ['manual', 'Ročni plin'],
  ]
</script>

<div
  class="app"
  class:low={car.lowPower}
  style:--accent={scene.theme.accent}
  style:--g0={scene.theme.bg[0]}
  style:--g1={scene.theme.bg[1]}
>
  {#if !car.started}
    <StartOverlay label="Tapni za zagon" onstart={start} />
  {:else if car.paused}
    <StartOverlay label="Tapni za nadaljevanje" onstart={start} />
  {/if}

  <header>
    <h1>Pogon</h1>
    <span class="scene">{scene.name}</span>
  </header>

  <main>
    <section class="gauge">
      <Gauge accent={scene.theme.accent} />
      {#if car.error}<p class="err">{car.error}</p>{/if}
    </section>

    <section class="side">
      <GearSelector />

      <div class="row" role="group" aria-label="Vir hitrosti">
        {#each SOURCES as [k, label] (k)}
          <button class:on={car.source === k} onclick={() => pickSource(k)}>{label}</button>
        {/each}
      </div>

      {#if car.source === 'manual'}
        <div class="row pedals">
          <button
            class="pedal"
            onpointerdown={() => pedal('brake')}
            onpointerup={() => pedal('none')}
            onpointerleave={() => pedal('none')}>Zavora</button
          >
          <button
            class="pedal gas"
            onpointerdown={() => pedal('gas')}
            onpointerup={() => pedal('none')}
            onpointerleave={() => pedal('none')}>Plin</button
          >
        </div>
      {/if}

      {#if car.source === 'replay' && DEV}
        <label class="file">
          Naloži GPX ali CSV
          <input type="file" accept=".gpx,.csv,.txt" onchange={loadFile} />
        </label>
      {/if}

      <label class="vol">
        Glasnost
        <input type="range" min="0" max="1" step="0.05" bind:value={car.volume} />
      </label>
    </section>

    <section class="scenes">
      <ScenePicker onpick={pickScene} />
    </section>
  </main>
</div>

<style>
  .app {
    min-height: 100dvh;
    background: linear-gradient(160deg, var(--g0), var(--g1));
    --fg: #f2f2f2;
    color: var(--fg);
  }
  .app.low {
    background: var(--g0);
  }
  @media (prefers-color-scheme: light) {
    .app {
      background: linear-gradient(160deg, color-mix(in srgb, var(--g1) 12%, #fff), #f4f4f2);
      --fg: #111;
    }
    .app.low {
      background: #f4f4f2;
    }
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 16px 0;
  }
  h1 {
    margin: 0;
    font-size: 22px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .scene {
    color: var(--accent);
    font-weight: 600;
  }
  main {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 16px;
  }
  @media (min-width: 900px) {
    main {
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }
    .scenes {
      grid-column: 1 / -1;
    }
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    flex: 1;
    min-height: 64px;
  }
  .pedal {
    min-height: 120px !important;
    font-size: 24px;
  }
  .pedal.gas {
    background: var(--accent);
    color: #111;
  }
  .file,
  .vol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 15px;
  }
  .vol input {
    height: 40px;
    accent-color: var(--accent);
  }
  .err {
    color: #ff7070;
    text-align: center;
  }
</style>
