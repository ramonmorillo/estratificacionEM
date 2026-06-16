# CMO-EM Pro

Herramienta estática para estratificación y apoyo a la Atención Farmacéutica CMO en pacientes con Esclerosis Múltiple.

## Estructura

- `index.html`: interfaz principal y módulos de navegación.
- `assets/css/styles.css`: identidad visual responsive.
- `assets/js/model.js`: configuración clínica, puntuaciones, reglas e intervenciones.
- `assets/js/app.js`: renderizado, cálculo en navegador, objetivos, seguimiento e informes.
- `tests/selfcheck.js`: autocomprobaciones del motor de prioridad.

## GitHub Pages

1. Subir el repositorio a GitHub.
2. Ir a **Settings > Pages**.
3. Seleccionar **Deploy from a branch**.
4. Elegir la rama principal y la carpeta `/root`.
5. Guardar. La aplicación funcionará como sitio estático sin backend.

## Validación

Ejecutar:

```bash
npm test
```
