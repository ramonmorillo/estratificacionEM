# Changelog — CMO-EM Pro

## 1.0.0 — 2026-10-30 — Primera versión declarada

PROPUESTA (pendiente de confirmación del autor): el repositorio no declaraba ninguna versión, así que «subir la versión menor» no tenía base. Se declara 1.0.0 en `package.json` y `cmo-app-meta` (la prueba exige que coincidan); `status: "released"`, `releaseDate: "2026-10-30"`. CMO Design System actualizado a 0.2.0 (firma multilingüe, compatible). Sin cambios en el modelo ni en `assets/js/app.js`.

### Cambios incluidos (antes «sin publicar»)

Cambio exclusivamente visual. Sin cambios en `assets/js/model.js` ni `assets/js/app.js`.
- Copia fijada del CMO Design System 0.1.0 en `assets/cmo-ds/` (manifiesto SHA-256).
- `assets/css/cmo-visual.css` reescrito como tema «Estratos» sobre tokens, cargado tras `styles.css`; `styles.css` remapea `--blue/--green/--ink/--muted/--bg` a tokens. Colores de prioridad (`--p1/--p2/--p3`) sin cambios.
- Accesibilidad: foco con teclado de #ffbf47 (1,6:1) a #1f3aa8 (9,4:1); borde de campos de #bdd0d8 (1,6:1) a #7b8495 (≥3:1).
- Pie: firma `<cmo-author-signature>` (desarrollo digital y documento fuente del modelo); favicon del ecosistema.
- Pruebas: `tests/cmo-ds.test.mjs`, añadidas a `npm test` junto a la autocomprobación existente.

Pendiente: el repositorio no declara número de versión; la firma no muestra versión hasta que el autor la fije.
