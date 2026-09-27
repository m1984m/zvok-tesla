<script lang="ts">
  let { label, sub, accent = '#ff2a1a', onstart }: { label: string; sub: string; accent?: string; onstart: () => void } = $props()
</script>

<div class="overlay" style:--a={accent}>
  <button class="start" onclick={onstart}>
    <span class="l1">ENGINE</span>
    <span class="l2">{label}</span>
    <span class="l1">STOP</span>
  </button>
  <p>{sub}</p>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    background: radial-gradient(circle at 50% 45%, #15171b 0%, #050506 70%);
  }
  .start {
    width: min(38vh, 300px);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 0;
    background: radial-gradient(circle at 50% 35%, #2a2d33, #0e0f12 70%);
    box-shadow:
      0 0 0 6px #1d1f24,
      0 0 0 9px var(--a),
      0 0 60px color-mix(in srgb, var(--a) 45%, transparent);
    color: #f4f4f5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-family: 'Barlow Condensed', system-ui, sans-serif;
  }
  .start:active {
    transform: scale(0.97);
  }
  .l1 {
    font-size: 22px;
    letter-spacing: 0.3em;
    color: #9a9da4;
    font-weight: 600;
  }
  .l2 {
    font-size: 54px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--a);
    line-height: 1;
  }
  p {
    margin: 0;
    color: #8a8d94;
    font-size: 20px;
    letter-spacing: 0.04em;
  }
</style>
