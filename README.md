# CMO-EM Pro

Herramienta estática para estratificación y apoyo a la Atención Farmacéutica CMO en pacientes con Esclerosis Múltiple.

## Estructura

- `index.html`: flujo de siete etapas (Inicio, Historia clínica, Revisión, Estratificación, Necesidades, Intervenciones, Informe).
- `assets/js/model.js`: **configuración clínica** (variables, puntuaciones, umbrales, regla automática, intervenciones). No se modifica sin validación clínica.
- `assets/js/extraction-rules.js`: reglas locales de palabras clave del análisis asistido (no es IA; solo propone).
- `assets/js/assessment.js`: adaptador al flujo común (respuestas Sí/No/Pendiente, modificación profesional, informe, exportación). Sin reglas clínicas.
- `assets/js/app.js`: interfaz.
- `assets/cmo-ds/`: copia fijada del CMO Design System y del núcleo común (`cmo-report.js`, `cmo-pdf.js`, `cmo-flow.js`); no se edita a mano (`CMO-DS-VERSION.json`).
- `tests/`: autocomprobación del motor, pruebas unitarias y recorridos E2E.

## Privacidad

Todo se procesa en el navegador; no hay servidor, analítica ni terceros. No se guardan casos de forma permanente: solo un borrador en `sessionStorage` (sin cifrar) mientras la pestaña siga abierta. Use únicamente identificadores seudonimizados (un dato seudonimizado sigue siendo un dato personal). Herramienta de apoyo profesional, no producto sanitario certificado y pendiente de validación asistencial.

## GitHub Pages

1. Subir el repositorio a GitHub.
2. Ir a **Settings > Pages**.
3. Seleccionar **Deploy from a branch**.
4. Elegir la rama principal y la carpeta `/root`.
5. Guardar. La aplicación funcionará como sitio estático sin backend.

## Validación

Ejecutar:

```bash
npm test             # motor + adaptador + analizador + firma
npm run test:e2e     # recorridos en Chromium (Playwright); AXE_PATH=<axe.min.js> añade la auditoría WCAG
```
