// Recorrido extremo a extremo de CMO-EM Pro en Chromium (Playwright). Datos ficticios.
//   npm run test:e2e            (requiere Playwright con Chromium)
//   AXE_PATH=<axe.min.js>       añade la auditoría WCAG A/AA en cada etapa
//   E2E_OUT=<carpeta>           guarda el PDF, el texto y las capturas
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = await import('playwright')); } catch { chromium = null; } }
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.env.E2E_OUT;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
let server, browser, base;
const external = [];

before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (file.endsWith(path.sep)) file += 'index.html';
    fs.readFile(file, (err, data) => { if (err) { if (process.env.E2E_DEBUG) console.log('404', req.url); res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
});
after(async () => { await browser?.close(); server?.close(); });

async function open(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && r.url() !== 'about:srcdoc') external.push(r.url()); });
  await page.goto(base);
  return { page, errors, context };
}
const identify = async page => { await page.fill('#hospital', 'Hospital Ficticio'); await page.fill('#pharmacist', 'Farmacéutica Ficticia'); await page.fill('#pseudoId', 'EM-0001'); };
const yes = (page, id) => page.click(`label:has(input[name="v-${id}"][value="yes"])`);
const decide = (page, label, value) => page.selectOption(`select[aria-label="Decisión para ${label}"]`, value);
const stage = page => page.locator('#stepper').getAttribute('data-current');
const save = async (download, name) => { const file = path.join(OUT || fs.mkdtempSync('/tmp/cmo-em-'), name); await download.saveAs(file); return file; };
async function axe(page, label) {
  if (!process.env.AXE_PATH) return;
  await page.evaluate(() => { const t = document.querySelector('.cmo-toast'); if (t) t.hidden = true; }); // el aviso temporal no forma parte de la etapa
  await page.addScriptTag({ path: process.env.AXE_PATH });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { preload: false, runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map(v => `${v.id}(${v.nodes.length}): ${v.nodes.map(n => n.html.slice(0, 90)).join(' | ')}`));
  assert.deepEqual(violations, [], `axe ${label}`);
}
const skip = { skip: !chromium && 'Playwright no disponible' };

test('recorrido manual completo: 18 puntos → Prioridad 1, informes y exportaciones', skip, async () => {
  const { page, errors } = await open();
  await axe(page, 'paso 1');
  await page.click('#startManual');
  assert.equal(await stage(page), '1', 'sin hospital ni farmacéutico no se avanza');
  assert.match(await page.textContent('#identityError'), /Indique el hospital/);
  await identify(page);
  await page.click('#startManual');
  assert.equal(await stage(page), '2');
  assert.equal(await page.textContent('#headerPriority'), 'Sin valorar', 'sin datos no se muestra una prioridad firme');
  // Caso de referencia «18 puntos» (tests/selfcheck.js)
  for (const id of ['age_under_16', 'progressive_ms', 'diagnosis_over_20y', 'delay_treatment_over_2y', 'functional_decline', 'cognitive_decline', 'non_adherence', 'polypharmacy', 'male']) await yes(page, id);
  assert.equal(await page.textContent('#headerScore'), '18/52');
  assert.equal(await page.textContent('#headerPriority'), 'Prioridad 1');
  assert.equal(await page.textContent('#headerState'), 'Provisional');
  // Criterios excluyentes
  await yes(page, 'age_over_65');
  assert.equal(await page.isChecked('input[name="v-age_under_16"][value="no"]'), true);
  assert.equal(await page.textContent('#headerScore'), '16/52');
  await yes(page, 'age_under_16');
  assert.equal(await page.textContent('#headerScore'), '18/52');
  await axe(page, 'paso 2');
  if (OUT) await page.screenshot({ path: path.join(OUT, 'paso2-1280.png') });

  await page.click('[data-stage="2"] [data-next]');
  assert.equal(await page.locator('#reviewRows tr').count(), 28);
  assert.match(await page.textContent('#reviewStatus'), /10Variables valoradas18Pendientes/);
  await axe(page, 'paso 3');
  await page.click('[data-stage="3"] [data-next]');
  assert.match(await page.textContent('#resultCard'), /Prioridad 1 \(provisional\)/);
  assert.match(await page.textContent('#resultCard'), /podría alcanzar \d+\/52/);

  // Informe bloqueado hasta finalizar
  await page.click('[data-go="7"]');
  assert.equal(await page.isDisabled('#downloadPdf'), true);
  assert.match(await page.textContent('#reportBlocked'), /Finalice la estratificación/);
  await page.click('[data-go="4"]');

  // Finalizar con pendientes: diálogo → volver a completar
  await page.click('#finish');
  await page.click('dialog button:has-text("Volver a completar")');
  assert.equal(await stage(page), '2');
  for (const d of ['demographic', 'clinical', 'treatment', 'social']) { await page.click(`[data-fill-no="${d}"]`); await page.click('dialog button:has-text("Registrar como «No»")'); }
  assert.equal(await page.textContent('#headerScore'), '18/52', 'registrar «No» no cambia la puntuación');
  assert.equal(await page.textContent('#headerState'), 'Sin finalizar');
  await page.click('[data-go="4"]');
  await axe(page, 'paso 4');
  await page.click('#finish');
  assert.equal(await page.textContent('#headerState'), 'Finalizada');

  await page.click('[data-go="5"]');
  assert.match(await page.textContent('#needs'), /necesidades farmacoterapéuticas[\s\S]*Falta de adherencia/);
  await axe(page, 'paso 5');
  await page.click('[data-go="6"]');
  assert.equal(await page.locator('[data-intervention]').count(), 23, 'Prioridad 1: intervenciones acumuladas de P3+P2+P1');
  await page.selectOption('[data-intervention="3.seguimiento.0"]', 'done');
  await page.selectOption('[data-intervention="1.seguimiento.0"]', 'planned');
  await page.selectOption('[data-intervention="3.educacion.1"]', 'not_applicable');
  await page.fill('#goalComments', '<img src=x onerror="window.__xss=1">');
  await page.click('#addGoal');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'los comentarios no se interpretan como HTML');
  assert.equal(await page.locator('#goalsTable img').count(), 0);
  await page.check('#dualAfChecks input >> nth=2');
  await page.fill('#followPlan', 'Revisión telefónica al mes.');
  await page.fill('#nextReview', '2027-02-10');
  await axe(page, 'paso 6');
  assert.equal(await page.textContent('#headerState'), 'Finalizada', 'registrar intervenciones no invalida la estratificación');

  await page.click('[data-go="7"]');
  const text = await page.inputValue('#reportText');
  assert.match(text, /RESULTADO DE ESTRATIFICACIÓN: PRIORIDAD 1$/m);
  assert.match(text, /Puntuación total: 18\/52/);
  assert.match(text, /Identificador del paciente \(seudonimizado\): EM-0001/);
  assert.match(text, /Realizadas en esta consulta:\n\s+- Seguimiento farmacoterapéutico: Evaluar y validar el tratamiento/);
  assert.match(text, /Planificadas \/ pendientes:/);
  assert.match(text, /Próxima valoración prevista: 10\/02\/2027/);
  assert.match(text, /Seguimiento mixto/);
  assert.doesNotMatch(text, /\{"/, 'sin JSON en el texto para HCE');
  assert.equal(await page.locator('#reportPreview img, #reportPreview script').count(), 0, 'la vista previa escapa lo tecleado');
  await axe(page, 'paso 7');

  await page.click('#copyReport');
  await page.waitForFunction(() => document.getElementById('copyStatus').textContent !== '');
  assert.match(await page.textContent('#copyStatus'), /Informe copiado/);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('#downloadPdf')]);
  assert.match(pdf.suggestedFilename(), /^cmo-em-EM-0001-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdfBytes = fs.readFileSync(await save(pdf, 'informe-P1-ficticio.pdf'));
  assert.equal(pdfBytes.subarray(0, 8).toString('latin1'), '%PDF-1.4');
  assert.ok(pdfBytes.toString('latin1').includes('Prioridad 1') && pdfBytes.toString('latin1').includes('EM-0001'));

  const [txt] = await Promise.all([page.waitForEvent('download'), page.click('#downloadTxt')]);
  assert.equal(fs.readFileSync(await save(txt, 'informe-P1-ficticio.txt'), 'utf8'), text, 'el .txt es idéntico al texto copiado');

  const printed = page.evaluate(() => new Promise(r => document.addEventListener('cmo:print', () => r(document.querySelector('iframe.cmo-print-frame').contentDocument.body.textContent), { once: true })));
  await page.click('#printReport');
  const printedText = await printed;
  assert.ok(printedText.includes('Resultado de estratificación: Prioridad 1') && printedText.includes('EM-0001'), 'la impresión contiene el mismo informe');

  const [json] = await Promise.all([page.waitForEvent('download'), page.click('#downloadJson')]);
  const jsonFile = await save(json, 'caso-ficticio.json');
  const env = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(env.schema, 'cmo-export/1'); assert.equal(env.dataSchema, 'cmo-em-case/1'); assert.equal(env.app.id, 'cmo-esclerosis-multiple');
  assert.equal(env.report.stratification.score, 18);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#downloadCsv')]);
  assert.match(fs.readFileSync(await save(csv, 'caso-ficticio.csv'), 'utf8'), /"prioridad_final";"1"/);

  // Recarga: el borrador de sesión se recupera
  await page.reload();
  assert.equal(await page.textContent('#headerScore'), '18/52');
  assert.equal(await page.inputValue('#pseudoId'), 'EM-0001');

  // Reinicio con confirmación; importación validada
  await page.click('#newCase'); await page.click('dialog button:has-text("Cancelar")');
  assert.equal(await page.textContent('#headerScore'), '18/52', 'cancelar conserva los datos');
  await page.click('#newCase'); await page.click('dialog button:has-text("Borrar todo")');
  assert.equal(await page.textContent('#headerScore'), '0/52');
  assert.equal(await stage(page), '1');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('cmo-em-pro-draft')), null);
  assert.equal(await page.evaluate(() => localStorage.length), 0, 'sin almacenamiento persistente');

  await page.fill('#hospital', 'H'); await page.fill('#pharmacist', 'F'); await page.click('#startManual'); await page.click('[data-go="7"]');
  const bad = path.join(path.dirname(jsonFile), 'malo.json');
  fs.writeFileSync(bad, '{"schema":"otro"}');
  await page.setInputFiles('#importFile', bad);
  assert.match(await page.textContent('.cmo-toast'), /No se ha podido importar/);
  await page.setInputFiles('#importFile', jsonFile);
  await page.click('dialog button:has-text("Importar y sustituir")');
  assert.equal(await page.textContent('#headerScore'), '18/52');
  assert.equal(await page.textContent('#headerState'), 'Finalizada');
  assert.equal(await stage(page), '3');
  assert.deepEqual(errors, []);
});

test('análisis asistido: evidencia, aviso de negación y nada se incorpora sin decisión', skip, async () => {
  const { page, errors } = await open();
  await identify(page);
  await page.click('#startAssisted');
  await page.click('#analyze');
  assert.match(await page.textContent('.cmo-toast'), /Pegue primero/);
  await page.fill('#clinicalText', 'Paciente varón de 67 años, EM secundaria progresiva. No fumador. 3 brotes en el último año. Efectos adversos graves.');
  await page.click('#analyze');
  const rows = page.locator('#proposals tbody tr');
  assert.equal(await rows.count(), 6);
  assert.equal(await page.textContent('#headerScore'), '0/52', 'analizar no puntúa');
  const smoking = rows.filter({ hasText: 'Hábito tabáquico' });
  assert.match(await smoking.textContent(), /Posible negación/);
  assert.equal(await smoking.locator('mark').textContent(), 'fumador');
  await axe(page, 'propuestas');
  await decide(page, 'Sexo varón', 'accept');
  await decide(page, 'Edad superior a 65 años', 'accept');
  await decide(page, 'Hábito tabáquico', 'no');
  await decide(page, 'Tasa anual de brotes o nuevas lesiones en RM', 'set:2');
  await decide(page, 'Efectos adversos', 'discard');
  // «EM primaria progresiva o secundaria progresiva» queda sin decidir
  await page.click('#applyProposals');
  assert.equal(await stage(page), '2');
  assert.equal(await page.textContent('#headerScore'), '4/52', 'varón 1 + >65 1 + 2 brotes 2');
  assert.equal(await page.isChecked('input[name="v-smoking"][value="no"]'), true);
  assert.equal(await page.isChecked('input[name="v-progressive_ms"][value=""]'), true, 'lo no decidido queda pendiente');
  assert.equal(await page.inputValue('#adverse_events'), '', 'lo descartado queda pendiente');
  assert.equal(await page.inputValue('#clinicalText'), '', 'el texto clínico no se conserva');
  assert.ok(!(await page.evaluate(() => sessionStorage.getItem('cmo-em-pro-draft'))).includes('brotes en el último'), 'ni en el borrador');
  await page.click('[data-go="3"]');
  assert.equal(await page.locator('#reviewRows .cmo-flag--assisted').count(), 4);
  // Embarazo → Prioridad 1 automática; modificación profesional
  await page.click('[data-go="2"]'); await yes(page, 'pregnancy');
  assert.equal(await page.textContent('#headerPriority'), 'Prioridad 1');
  await page.click('[data-go="4"]');
  assert.match(await page.textContent('#resultCard'), /Prioridad 1 por criterio automático/);
  await page.selectOption('#overridePriority', '2'); await page.fill('#overrideJustification', 'corta'); await page.locator('#overrideJustification').blur();
  assert.match(await page.textContent('#overrideState'), /NO aplicada/);
  assert.equal(await page.textContent('#headerPriority'), 'Prioridad 1');
  await page.fill('#overrideJustification', 'Justificación ficticia suficientemente larga'); await page.locator('#overrideJustification').blur();
  assert.equal(await page.textContent('#headerPriority'), 'Prioridad 2');
  assert.match(await page.textContent('#resultStatus'), /Prioridad 1Prioridad calculada por el modelo/);
  assert.match(await page.textContent('#resultCard'), /disminuye una Prioridad 1 automática/);
  await page.click('#finish'); await page.click('dialog button:has-text("Finalizar como provisional")');
  await page.click('[data-go="7"]');
  const text = await page.inputValue('#reportText');
  assert.match(text, /PRIORIDAD 2 \(PROVISIONAL\)/);
  assert.match(text, /Resultado calculado por el modelo: Prioridad 1/);
  assert.match(text, /4 variable\(s\) incorporada\(s\) desde el análisis asistido/);
  // Modificar un dato clínico tras finalizar invalida el informe
  await page.click('[data-go="2"]'); await yes(page, 'smoking');
  await page.click('[data-go="7"]');
  assert.equal(await page.isDisabled('#copyReport'), true);
  assert.deepEqual(errors, []);
});

test('móvil 375 px: sin desbordamiento horizontal en ninguna etapa y navegación por teclado', skip, async () => {
  const { page, errors } = await open({ width: 375, height: 740 });
  await identify(page);
  await page.click('#startManual');
  await yes(page, 'pregnancy');
  for (let n = 2; n <= 7; n++) {
    await page.click(`[data-go="${n}"]`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `paso ${n}: desbordamiento ${overflow}px`);
    assert.equal(await page.locator('#stepper [aria-current="step"]').count(), 1);
  }
  if (OUT) await page.screenshot({ path: path.join(OUT, 'paso7-375.png') });
  await page.click('[data-go="2"]');
  await page.focus('input[name="v-male"][value=""]');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.isChecked('input[name="v-male"][value="yes"]'), true, 'los tres estados se manejan con teclado');
  assert.deepEqual(errors, []);
});

test('sin peticiones a terceros en todo el recorrido', skip, () => { assert.deepEqual(external, []); });
