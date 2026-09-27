# Odločitve

- 2026-09-27 · Sredstva v `static/` (po CLAUDE.md), zato `publicDir: 'static'` v `vite.config.ts` namesto Vitovega privzetega `public/`.
- 2026-09-27 · Menjalnik odloča po obratih brez omejitve (`rawRpm`), prikaz in zvok uporabljata omejene (`rpm`). Sicer bi pri omejevalniku menjalnik »videl« 7000 in ne bi menjal dol pravilno.
- 2026-09-27 · Test »pospešek do 130 km/h konča v 6.« velja pri load 0; pri load 0,3 je prag gor 3700 rpm, 5. prestava pri 130 km/h da 3558 rpm, zato ostane v 5. To je pričakovano.
- 2026-09-27 · Projekt ima lasten git (izključen v `D:\Claude\.git\info\exclude`).
- 2026-09-27 · Glajenje: ob novem vzorcu GPS se razlika med staro napovedjo in novo meritvijo ne uporabi v hipu, ampak se zgladi (`correctionTauS` 0,3 s). Brez tega je igla ob vsakem vzorcu skočila (test F1 je to ujel).
- 2026-09-27 · Proceduralna sinteza je v `static/worklets/engine.js` (ne `src/lib/audio/engineSynth.ts`): modul AudioWorklet se naloži po URL-ju, iz `static/` to deluje enako v razvoju, buildu in brez povezave.
- 2026-09-27 · Ambient in impulzni odzivi (IR) so proceduralni (šum, filtri, LFO, sintetičen upad z zgodnjimi odboji). Zato ni tujih posnetkov in ni licenčnih vprašanj. Slike scen nadomešča barvni preliv teme.
- 2026-09-27 · Motor scene najprej poskusi zanke `static/audio/<motor>/manifest.json`; če jih ni, igra sinteza. Ko zanke pridejo (build-loops), jih aplikacija uporabi brez spremembe kode.
- 2026-09-27 · Zanke po 500 rpm: pri nizkih obratih je odstopanje playbackRate do ±25 % (1000 → 1250), nad ~2500 rpm pa ≤ ±10 %. Specifikacija je tu protislovna; sprejeto, dokler posnetki ne pokažejo slišne težave (potem dodati korak 1250/1750).
- 2026-09-27 · F8 odpade: aplikacija je samo za Mateja, vse scene so odklenjene, brez plačil.
- 2026-09-27 · Hosting: GitHub Pages (Matejeva izbira) namesto Cloudflare Pages; `base: './'` deluje na podpoti `/<repo>/`.
- 2026-09-27 · F3 test klikov je v brskalniku (`scripts/check-audio.mjs`, OfflineAudioContext), F5–F7 v `scripts/check-app.mjs`. Playwright je razvojna odvisnost (Apache-2.0, samo za teste, ni v aplikaciji).
