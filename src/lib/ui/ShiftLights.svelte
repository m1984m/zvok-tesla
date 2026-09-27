<script lang="ts">
  import { GEARBOX } from '../config'
  import { car } from '../state.svelte'

  const N = 12
  const lit = $derived(
    Math.max(0, Math.min(N, Math.ceil(((car.rpm - GEARBOX.shiftLightStartRpm) / (GEARBOX.shiftLightFullRpm - GEARBOX.shiftLightStartRpm)) * N))),
  )
  const color = (i: number) => (i < 4 ? 'g' : i < 8 ? 'y' : 'r')
</script>

<div class="lights" class:flash={car.limiter} aria-hidden="true">
  {#each Array.from({ length: N }, (_, i) => i) as i (i)}
    <span class="led {color(i)}" class:on={i < lit}></span>
  {/each}
</div>

<style>
  .lights {
    display: flex;
    gap: 1.2%;
    justify-content: center;
    padding: 0 4%;
  }
  .led {
    flex: 1;
    max-width: 44px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #16181c;
    box-shadow: inset 0 0 0 2px #23262c;
  }
  .led.on.g {
    background: #28e06a;
  }
  .led.on.y {
    background: #ffc21a;
  }
  .led.on.r {
    background: #ff2a1a;
  }
  .flash .led {
    background: #3a7bff;
    animation: blink 0.16s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.15;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flash .led {
      animation: none;
    }
  }
</style>
