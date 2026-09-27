# Pogon (Zvok-Tesla)

Osebna spletna aplikacija za brskalnik Tesle: sintetiziran zvok motorja po GPS hitrosti, menjalnik Auto/Ročno, šest zvočnih scen. Vse je odklenjeno.

**V živo:** https://m1984m.github.io/zvok-tesla/

## Uporaba v avtu
1. V brskalniku Tesle odpri povezavo in jo dodaj med zaznamke.
2. Tapni »Tapni za zagon« (brskalnik zvok dovoli šele po dotiku).
3. Izberi vir **GPS** in dovoli lokacijo. Za preizkus na mestu: **Posnetek** (demo vožnja) ali **Ročni plin**.
4. Zavihek mora ostati v ospredju; ob vrnitvi tapni »Tapni za nadaljevanje«.

## Razvoj
```
npm install
npm run dev          # lokalno
npm test             # fizika, menjalnik, telemetrija, preliv zank
npm run build
npm run check:audio  # F3: kliki v sintezi (Chromium)
npm run check:app    # F5–F7: zvezna igla, preklop scene, brez povezave
npm run loops -- <mapa_s_posnetki> <motor>   # zanke iz posnetkov (ffmpeg)
```
Specifikacija: `CLAUDE.md`. Odločitve: `docs/DECISIONS.md`. Licence: `docs/LICENSES.md`.
