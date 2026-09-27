# CLAUDE.md — projekt POGON (delovno ime)

Spletna aplikacija za brskalnik Tesle: sintetiziran zvok motorja, vezan na dejansko hitrost po GPS, simuliran menjalnik (Auto/Manual) in zvočne scene. Referenca konkurence: dribe.app, rupteur.app. Ne kopiramo njihovih sredstev, imen ali zvokov.

Ciljna naprava: SAMO brskalnik Tesle Model 3, letnik 2021, HW3 (zaslon 15", ležeče). Osebna raba, vse odklenjeno.

Lastnik: Matej Moharič. Okolje: Windows, Claude Code CLI, MCP: Context7, GitHub, Tavily.

---

## 1. Pravila dela za Claude

1. Pred uporabo knjižnice preveri aktualno dokumentacijo prek Context7. Ne piši API klicev iz spomina.
2. Nove odvisnosti samo z utemeljitvijo v eni vrstici (zakaj, velikost, licenca). Privzeto: brez.
3. Delo po fazah (poglavje 8). Faza je zaključena šele, ko gre skozi svoj test »narobe je, če …«. Po vsaki fazi commit s sporočilom `F<n>: <kaj>`.
4. Vsaka številka v fiziki (razmerja, pragovi, konstante) je v `src/lib/config.ts`, nikoli razpršena po kodi.
5. Skripte naj delujejo na Windows: Node skripte (`scripts/*.mjs`), ne bash.
6. Ločuj preverjeno in predpostavljeno: v komentarjih konstant označi `// PREDPOSTAVKA: … preveri v vozilu`.
7. Ko nekaj ni jasno, izberi najverjetnejšo razlago, jo zapiši v `docs/DECISIONS.md` in nadaljuj. Ne ustavljaj se z vprašanji.

---

## 2. Stack

- Svelte 5 (runes: `$state`, `$derived`, `$effect`) + Vite + TypeScript strict
- Web Audio API: `AudioWorklet` za sintezo, `AudioBufferSourceNode` za zanke, `ConvolverNode` za akustiko scen, `DynamicsCompressorNode` kot limiter
- Grafika: Canvas 2D za merilnik obratov (MVP); Rive (`@rive-app/canvas`) kot nadgradnja, ko je dizajn pripravljen
- Offline: service worker (precache vseh sredstev po prvem nalaganju)
- Testi: Vitest za fiziko in menjalnik
- Hosting: statičen HTTPS (Cloudflare Pages). HTTPS je obvezen za Geolocation.
- MVP brez backenda. Plačila (Lemon Squeezy ali Stripe) šele v F7.

---

## 3. Arhitektura

```
src/
  lib/
    config.ts            # vse konstante in privzete vrednosti
    state.svelte.ts      # en skupni reaktivni state (hitrost, a, load, rpm, prestava)
    telemetry/
      gps.ts             # watchPosition, filtriranje, Haversine fallback
      replay.ts          # predvajanje GPX/CSV posnetka vožnje (razvoj brez avta)
      manual.ts          # ročni vnos hitrosti + tipka za plin (razvoj)
    physics/
      smoothing.ts       # EMA, ekstrapolacija hitrosti med GPS vzorci
      drivetrain.ts      # rpm iz hitrosti in prestave
      gearbox.ts         # Auto (histereza) in Manual, omejevalnik
    audio/
      context.ts         # odklep AudioContext z dotikom, master veriga, limiter
      engineSampler.ts   # prelivanje zank po rpm × load
      engineSynth.ts     # proceduralna rezerva (AudioWorklet)
      ambience.ts        # ambientna plast scene
      acoustics.ts       # ConvolverNode z IR scene
    scenes/
      registry.ts        # nalaganje scen iz JSON
      *.json             # definicije scen
    ui/
      Gauge.svelte       # merilnik obratov (Canvas 2D)
      GearSelector.svelte
      ScenePicker.svelte
      StartOverlay.svelte  # obvezen dotik za zagon zvoka
  static/
    audio/<motor>/       # zanke (glej poglavje 5)
    ir/                  # impulzni odzivi
    scenes/              # slike WebP
docs/
  DECISIONS.md
  LICENSES.md            # OBVEZNO: vir in licenca za vsako sredstvo
scripts/
  build-loops.mjs        # ffmpeg: rezanje, normalizacija, Opus izvoz
```

Opomba: `static/` je v korenu projekta (ne v `src/`), Vite ga streže prek `publicDir: 'static'`.

**Tok podatkov (en sam cikel, brez dveh časovnic):**

```
GPS / replay / manual
  → smoothing (v, a z EMA + ekstrapolacija)
  → load = f(a)
  → gearbox (prestava) → drivetrain (rpm)
  → state
      ├→ audio: AudioParam.setTargetAtTime(...)  (brez »zipper« šuma)
      └→ UI: requestAnimationFrame bere isti state
```

---

## 4. Fizika — izhodiščne vrednosti

Vse spodaj so PREDPOSTAVKE za prvo verzijo; uglasitev v vozilu.

**Hitrost**
- `coords.speed` (m/s); če je `null`, izračun iz razdalje (Haversine) / Δt.
- Zavrzi vzorec, če `coords.accuracy > 30 m`.
- GPS predpostavljeno ~1 Hz. Med vzorci ekstrapolacija: `v_pred = v_zadnja + a · Δt`, Δt omejen na 1,5 s.

**Pospešek in obremenitev**
- `a` = Δv/Δt, glajenje EMA s τ = 0,3 s.
- `load = clamp(a / 3.5, 0, 1)`; pri `a < -0,3 m/s²` stanje »brez plina« (overrun).

**Obrati**
- `rpm = v / (2π · r) · 60 · i_prestave · i_diferenciala`
- `r = 0,33 m`, `i_dif = 3,7`, prestave `[3.6, 2.2, 1.5, 1.15, 0.92, 0.75]`
- Prosti tek 780 rpm; `rpm = max(prosti_tek, izračun)`; omejevalnik 7000 rpm.
- Kontrolni izračun (mora iti v test): 100 km/h v 6. prestavi → 27,78 m/s / 2,073 m = 13,40 obr/s → 804 obr/min × 0,75 × 3,7 = **≈ 2231 rpm**.
- Kontrola 1. prestave: 7000 rpm → ≈ 65 km/h.

**Menjalnik Auto (s histerezo)**
- Gor: `rpm > 2500 + load · 4000`
- Dol: `rpm < 1300 + load · 1500`
- Najmanj 0,8 s med dvema menjavama.
- Ob menjavi: kratek padec load (~150 ms) za zvočni »klik« menjave.

**Menjalnik Manual**
- Gumba ± (velika, ≥ 80 px). Pri omejevalniku ritmična prekinitev (»rupteur«) ~ 12 Hz.

---

## 5. Zvočna sredstva

**Specifikacija zank (na motor):**
- Koraki rpm: 1000 do 7000 po 500 (13 korakov) × 2 stanji (`on` = pod obremenitvijo, `off` = brez plina) + `idle`.
- Dolžina zanke 2–4 s, brezšivna (preliv na koncu).
- Poimenovanje: `static/audio/<motor>/<on|off>_<rpm>.opus`, npr. `v8a/on_3000.opus`.
- Format: Opus 48 kHz mono; glasnost normalizirana na isto integrirano raven za vse zanke (`scripts/build-loops.mjs`, ffmpeg `loudnorm`).

**Predvajanje (engineSampler):**
- Za trenutni rpm izberi dva najbližja koraka, enakomočni (equal power) preliv med njima.
- `playbackRate = rpm / rpm_koraka` (odstopanje ≤ ±10 %).
- Preliv `on`/`off` glede na load.
- Master: limiter pri −1 dBFS; uporabniška največja glasnost v nastavitvah.

**Viri (licenca OBVEZNO v `docs/LICENSES.md`):**
1. Engine Simulator (AngeTheGreat, MIT) + Engine Sim Recorder → lastni posnetki po specifikaciji zgoraj. Preveri licenco novejše izdaje in konfiguracij motorjev iz skupnosti.
2. Sonniss GDC bundles (royalty free). Preveri pogoje glede redistribucije v spletni aplikaciji.
3. Proceduralna rezerva: lastna implementacija v AudioWorklet (ideja: Antonio-R1/engine-sound-generator, **kode ne kopiraj, dokler licenca ni preverjena**).
4. Ambient: Freesound samo CC0. CC-BY-NC prepovedan.

---

## 6. Scene

Scena = motor + ambient + akustika (IR) + slika + barvna tema.

```json
{
  "id": "karavanke",
  "name": "Karavanke",
  "tier": "pack1",
  "engine": "v8a",
  "ambience": { "file": "wind_valley.opus", "gain": 0.25, "lowpassHz": 4000 },
  "acoustics": { "ir": "tunnel_long.opus", "wet": 0.35 },
  "image": "karavanke.webp",
  "theme": { "accent": "#e0a030" }
}
```

Začetni nabor: `stirivaljnik` (brezplačna), `karavanke`, `pohorje`, `obala`, `ljubljana_lofi`, `inverter`.

**Prepovedano:** imena ali logotipi avtomobilskih znamk in modelov v imenih, opisih ali slikah scen.

---

## 7. Omejitve platforme in varnost

- AudioContext se odklene samo z dotikom uporabnika → `StartOverlay` pred vsem ostalim.
- Zavihek mora ostati v ospredju; ob `visibilitychange` zvok ustavi in prikaži »Tapni za nadaljevanje«.
- Brez PWA namestitve; uporabnik doda zaznamek.
- Med vožnjo: brez vnosa besedila, samo veliki gumbi; animacija samo tam, kjer nosi informacijo.
- Spoštuj `prefers-color-scheme` in `prefers-reduced-motion`; animacije omejene na 30 fps.
- Šibkejša strojna oprema (starejši MCU): samodejni padec na statično ozadje, če povprečni čas okvirja > 40 ms.

---

## 8. Faze in testi sprejema

| Faza | Vsebina | Narobe je, če … |
|---|---|---|
| F0 | Vite + Svelte 5 + TS, struktura map, `config.ts`, Vitest | build ne teče na Windows brez dodatnih orodij |
| F1 | Telemetrija: gps, replay (GPX/CSV), manual | replay posnetka ne da enake krivulje v/a pri dveh zagonih |
| F2 | Fizika + menjalnik + testi | test 100 km/h v 6. ne da 2231 ± 5 rpm; Auto menja več kot 1× v 0,8 s |
| F3 | Avdio z proceduralno sintezo (placeholder) | pri spremembi rpm se sliši klikanje ali stopnice |
| F4 | `build-loops.mjs` + engineSampler z zankami | pri počasnem naraščanju rpm se sliši prehod med koraki |
| F5 | Gauge (Canvas 2D), izbira prestave, izbira scen | igla skače v korakih GPS namesto zvezno |
| F6 | Ambient + akustika + scene iz JSON | preklop scene prekine zvok za > 300 ms |
| F7 | Service worker, offline, deploy | aplikacija po prvem nalaganju ne deluje brez povezave |
| F8 | Zaklep paketov + plačilo | plačan paket po osvežitvi strani ni več odklenjen |

---

## 9. Odprta vprašanja za preverjanje v vozilu

- Dejanska frekvenca GPS in vrednost `coords.speed` v brskalniku Tesle.
- Zakasnitev med pospeškom in zvokom (cilj: občutno pod 0,5 s).
- Obnašanje zvoka ob zaklepu zaslona in pri drugem viru zvoka (radio, navigacija).
- Zmogljivost Canvas/WebGL na starejšem MCU.
