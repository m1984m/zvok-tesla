<script lang="ts">
  let { label, onstart }: { label: string; onstart: () => void } = $props()
</script>

<button class="overlay" onclick={onstart}>
  <span class="t">{label}</span>
  <span class="s">Zvok se v brskalniku vklopi šele z dotikom.</span>
</button>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 0;
    border-radius: 0;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    color: var(--fg);
  }
  .t {
    font-size: clamp(28px, 6vw, 56px);
    font-weight: 700;
  }
  .s {
    opacity: 0.7;
  }
</style>
