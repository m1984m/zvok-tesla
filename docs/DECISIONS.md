# Odločitve

- 2026-09-27 · Sredstva v `static/` (po CLAUDE.md), zato `publicDir: 'static'` v `vite.config.ts` namesto Vitovega privzetega `public/`.
- 2026-09-27 · Menjalnik odloča po obratih brez omejitve (`rawRpm`), prikaz in zvok uporabljata omejene (`rpm`). Sicer bi pri omejevalniku menjalnik »videl« 7000 in ne bi menjal dol pravilno.
- 2026-09-27 · Test »pospešek do 130 km/h konča v 6.« velja pri load 0; pri load 0,3 je prag gor 3700 rpm, 5. prestava pri 130 km/h da 3558 rpm, zato ostane v 5. To je pričakovano.
- 2026-09-27 · Projekt ima lasten git (izključen v `D:\Claude\.git\info\exclude`).
