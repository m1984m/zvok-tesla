<script lang="ts">
  import { car } from '../state.svelte'
  import { shift } from '../engine'
</script>

<div class="gears">
  <div class="mode" role="group" aria-label="Menjalnik">
    <button class:on={car.mode === 'auto'} onclick={() => (car.mode = 'auto')}>Auto</button>
    <button class:on={car.mode === 'manual'} onclick={() => (car.mode = 'manual')}>Ročno</button>
  </div>
  {#if car.mode === 'manual'}
    <div class="pm">
      <button class="big" onclick={() => shift(-1)} aria-label="Prestava dol">−</button>
      <button class="big" onclick={() => shift(1)} aria-label="Prestava gor">+</button>
    </div>
  {/if}
</div>

<style>
  .gears {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mode,
  .pm {
    display: flex;
    gap: 8px;
  }
  .mode button {
    flex: 1;
    min-height: 56px;
  }
  .big {
    flex: 1;
    min-height: 96px;
    min-width: 96px;
    font-size: 48px;
  }
</style>
