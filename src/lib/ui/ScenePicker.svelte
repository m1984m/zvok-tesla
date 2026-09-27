<script lang="ts">
  import { scenes } from '../scenes/registry'
  import { car } from '../state.svelte'

  let { onpick }: { onpick: (id: string) => void } = $props()
</script>

<div class="scenes" role="group" aria-label="Scene">
  {#each scenes as s (s.id)}
    <button
      class:on={car.sceneId === s.id}
      style:--a={s.theme.accent}
      style:background="linear-gradient(135deg, {s.theme.bg[0]}, {s.theme.bg[1]})"
      onclick={() => onpick(s.id)}
    >
      {s.name}
    </button>
  {/each}
</div>

<style>
  .scenes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  button {
    min-height: 72px;
    color: #fff;
    border: 3px solid transparent;
    font-weight: 600;
  }
  button.on {
    border-color: var(--a);
  }
</style>
