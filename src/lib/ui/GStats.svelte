<script lang="ts">
  import { car } from '../state.svelte'
  import { resetPeaks } from '../engine'

  const f = (g: number) => Math.abs(g).toFixed(2).replace('.', ',')
  // številke se osvežijo 8× na s (berljivo, in na Intel Atom ne rišemo besedila vsak okvir)
  let long = $state(0)
  let lat = $state(0)
  let pk = $state({ acc: 0, brake: 0, lat: 0 })
  $effect(() => {
    const id = setInterval(() => {
      long = car.gLong
      lat = car.gLat
      pk = { acc: car.peakAcc, brake: car.peakBrake, lat: car.peakLat }
    }, 125)
    return () => clearInterval(id)
  })
</script>

<div class="stats">
  <div class="row">
    <span class="lbl">{long > 0.02 ? 'POSPEŠEK' : long < -0.02 ? 'ZAVIRANJE' : 'VZDOLŽNO'}</span>
    <span class="val" class:brake={long < -0.05}>{f(long)}<i>g</i></span>
  </div>
  <div class="row">
    <span class="lbl">BOČNO {lat > 0.03 ? '→' : lat < -0.03 ? '←' : ''}</span>
    <span class="val">{f(lat)}<i>g</i></span>
  </div>

  <div class="peaks">
    <h3>NAJVIŠJE</h3>
    <div class="p"><span>Pospešek</span><b>{f(pk.acc)} g</b></div>
    <div class="p"><span>Zaviranje</span><b>{f(pk.brake)} g</b></div>
    <div class="p"><span>Bočno</span><b>{f(pk.lat)} g</b></div>
    <button onclick={resetPeaks}>PONASTAVI</button>
  </div>
</div>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    font-family: 'Barlow Condensed', system-ui, sans-serif;
  }
  .row {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    border: 1px solid #23262c;
    border-radius: 16px;
    background: #0b0c0f;
  }
  .lbl {
    font-size: 17px;
    letter-spacing: 0.2em;
    color: #8a8d94;
    font-weight: 600;
  }
  .val {
    font-size: 60px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: #f4f4f5;
  }
  .val.brake {
    color: #ff5a4a;
  }
  .val i {
    font-style: normal;
    font-size: 0.5em;
    color: #8a8d94;
    margin-left: 4px;
  }
  .peaks {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
    border: 1px solid #23262c;
    border-radius: 16px;
    background: #0b0c0f;
  }
  h3 {
    margin: 0 0 2px;
    font-size: 15px;
    letter-spacing: 0.25em;
    color: #8a8d94;
    font-weight: 600;
  }
  .p {
    display: flex;
    justify-content: space-between;
    font-size: 22px;
  }
  .p span {
    color: #a6a9b0;
  }
  .p b {
    font-variant-numeric: tabular-nums;
  }
  button {
    margin-top: 6px;
    min-height: 52px;
    font-family: inherit;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: #f4f4f5;
    border: 1px solid #23262c;
    border-radius: 12px;
    background: #15171b;
  }
</style>
