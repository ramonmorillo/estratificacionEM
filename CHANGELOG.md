# Changelog — CMO-EM Pro

## 1.1.0 — 2026-11-11

Adopción del flujo asistencial común del ecosistema CMO (patrón CMO Respiratorio). **Sin cambios en el modelo clínico**: `assets/js/model.js` es idéntico byte a byte (huella fijada en `tests/fixtures/model.sha256`).

### Flujo
- Siete etapas con indicador de progreso: Inicio → Historia clínica → Revisión → Estratificación → Necesidades → Intervenciones → Informe. Sustituyen a las pestañas libres; no se ha eliminado ningún contenido (objetivos, visitas sucesivas, AF dual, metodología).
- Inicio: hospital o centro y farmacéutico/a responsable (obligatorios), identificador seudonimizado (opcional), elección de método y aviso de privacidad y finalidad.
- Cada variable admite **Sí / No / Pendiente** (antes, casilla sin marcar = «No»). Una variable pendiente no puntúa y deja el resultado como **provisional**; se informa de la puntuación y prioridad máximas alcanzables, calculadas con el motor original.
- Análisis asistido: las reglas de palabras clave son las de la 1.0.0 (verificado frente a una copia congelada). Ahora cada propuesta muestra el fragmento del texto, avisa de posible negación y exige una decisión (aceptar, corregir, descartar); lo no decidido queda pendiente. El texto pegado no se guarda ni se exporta.
- Modificación por criterio profesional con motivo y justificación (≥12 caracteres); el resultado del modelo se conserva y se muestra siempre.
- Necesidades por dimensión (confirmadas y potenciales) y registro del estado de cada intervención del modelo (realizada, planificada, no procede).
- Finalización explícita («Validar y finalizar»); modificar un dato clínico después invalida el informe hasta volver a validar.

### Informe y exportación
- Un único modelo de informe (`cmo-report/1`) del que salen el texto para historia clínica, la vista previa, la impresión y un **PDF real** generado en local.
- Exportación JSON con esquema y versión (`cmo-export/1` + `cmo-em-case/1`), CSV con protección frente a fórmulas e **importación validada**.

### Seguridad y privacidad
- Corregido: los comentarios de los objetivos se insertaban como HTML sin escapar (XSS). Todo dato tecleado o importado se escapa.
- Corregido: CSV con comillas sin doblar y sin neutralizar fórmulas.
- Borrador de la evaluación en `sessionStorage` (se elimina al cerrar la pestaña, sin cifrar) y aviso al salir con datos sin exportar. Sigue sin haber almacenamiento persistente, red ni terceros.
- Confirmación antes de reiniciar o de sustituir la evaluación al importar.

### Pruebas
- `npm test`: autocomprobación original + 21 pruebas (paridad con el motor, analizador frente a la 1.0.0, informe, importación, firma).
- `npm run test:e2e`: 4 recorridos en Chromium (manual, asistido, móvil 375 px, sin terceros), con auditoría axe WCAG A/AA opcional (`AXE_PATH`).

### Pendiente de validación profesional
- La modificación profesional y la presentación de necesidades (variables de tratamiento que puntúan = necesidades farmacoterapéuticas) son capacidades de flujo nuevas en esta herramienta.
- Reglas del analizador heredadas (p. ej. «15 años» como subcadena para «< 16 años»; sin tratamiento de la negación): no se han modificado.
- Pie: «Junio 2026» no se ha tocado. `cmo-app-meta` queda en `status: "draft"` hasta el commit de publicación.

## 1.0.0 — 2026-10-30 — Primera versión declarada

Primera versión declarada (confirmada por el autor): el repositorio no declaraba ninguna versión. Se declara 1.0.0 en `package.json` y `cmo-app-meta` (la prueba exige que coincidan); `status: "released"`, `releaseDate: "2026-10-30"`. CMO Design System actualizado a 0.2.0 (firma multilingüe, compatible). Sin cambios en el modelo ni en `assets/js/app.js`.

### Cambios incluidos (antes «sin publicar»)

Cambio exclusivamente visual. Sin cambios en `assets/js/model.js` ni `assets/js/app.js`.
- Copia fijada del CMO Design System 0.1.0 en `assets/cmo-ds/` (manifiesto SHA-256).
- `assets/css/cmo-visual.css` reescrito como tema «Estratos» sobre tokens, cargado tras `styles.css`; `styles.css` remapea `--blue/--green/--ink/--muted/--bg` a tokens. Colores de prioridad (`--p1/--p2/--p3`) sin cambios.
- Accesibilidad: foco con teclado de #ffbf47 (1,6:1) a #1f3aa8 (9,4:1); borde de campos de #bdd0d8 (1,6:1) a #7b8495 (≥3:1).
- Pie: firma `<cmo-author-signature>` (desarrollo digital y documento fuente del modelo); favicon del ecosistema.
- Pruebas: `tests/cmo-ds.test.mjs`, añadidas a `npm test` junto a la autocomprobación existente.

Pendiente: el repositorio no declara número de versión; la firma no muestra versión hasta que el autor la fije.
