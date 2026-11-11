// Pruebas del adaptador de flujo (assets/js/assessment.js). El motor clínico (model.js) no se modifica:
// aquí se comprueba que el adaptador le entrega exactamente lo confirmado y que no añade reglas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CMO_EM_MODEL as MODEL, calculatePriority, getInterventions } from '../assets/js/model.js';
import * as A from '../assets/js/assessment.js';
import { createReport, validateReport, reportToText, toCsv } from '../assets/cmo-ds/cmo-report.js';
import { reportToPdf } from '../assets/cmo-ds/cmo-pdf.js';

// Casos de referencia de tests/selfcheck.js (trazables a los umbrales del modelo: P1 ≥18; P2 11–17; P3 ≤10).
const CASES = [
  ['sin variables', {}, 0, 3],
  ['10 puntos', { age_under_16: true, progressive_ms: true, diagnosis_over_20y: true, delay_treatment_over_2y: true, neuro_psych_comorbidity: true }, 10, 3],
  ['11 puntos', { age_under_16: true, progressive_ms: true, diagnosis_over_20y: true, delay_treatment_over_2y: true, neuro_psych_comorbidity: true, non_neuro_comorbidity: true }, 11, 2],
  ['17 puntos', { age_under_16: true, progressive_ms: true, diagnosis_over_20y: true, delay_treatment_over_2y: true, functional_decline: true, cognitive_decline: true, non_adherence: true, polypharmacy: true }, 17, 2],
  ['18 puntos', { age_under_16: true, progressive_ms: true, diagnosis_over_20y: true, delay_treatment_over_2y: true, functional_decline: true, cognitive_decline: true, non_adherence: true, polypharmacy: true, male: true }, 18, 1],
  ['embarazo auto', { pregnancy: true }, 0, 1]
];
const formFrom = (state, rest = 'no') => {
  const f = A.emptyForm();
  for (const v of MODEL.variables) {
    if (v.type === 'checkbox') { if (state[v.id]) A.setAnswer(f, v.id, 'yes'); else if (rest === 'no' && f.answers[v.id] === undefined) A.setAnswer(f, v.id, 'no'); }
    else if (state[v.id] !== undefined) A.setAnswer(f, v.id, state[v.id]); else if (rest === 'no') A.setAnswer(f, v.id, '0');
  }
  return f;
};

test('el modelo clínico no se ha modificado (huella de model.js 1.0.0)', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(new URL('../assets/js/model.js', import.meta.url))).digest('hex');
  assert.equal(hash, fs.readFileSync(new URL('./fixtures/model.sha256', import.meta.url), 'utf8').trim());
});

test('casos de referencia: mismo total y prioridad por el flujo nuevo que con el motor directo', () => {
  for (const [name, state, total, priority] of CASES) {
    for (const rest of ['no', 'pending']) {
      const ev = A.evaluate(formFrom(state, rest));
      assert.equal(ev.result.total, total, `${name} (${rest})`);
      assert.equal(ev.result.priority, priority, `${name} (${rest})`);
      assert.deepEqual(ev.result, calculatePriority(state), `${name}: resultado idéntico al motor`);
      assert.equal(ev.provisional, rest === 'pending');
    }
  }
});

test('paridad exhaustiva por variable: cada respuesta aislada puntúa lo mismo que en el motor', () => {
  for (const v of MODEL.variables) {
    const values = v.type === 'checkbox' ? [['yes', true]] : v.options.map(o => [String(o.value), String(o.value)]);
    for (const [answer, engineValue] of values) {
      const f = A.emptyForm(); A.setAnswer(f, v.id, answer);
      assert.deepEqual(A.evaluate(f).result, calculatePriority({ [v.id]: engineValue }), `${v.id}=${answer}`);
    }
  }
});

test('«No» y «Pendiente» no puntúan, pero solo «Pendiente» deja el resultado provisional', () => {
  const f = A.emptyForm();
  let ev = A.evaluate(f);
  assert.equal(ev.pending.length, MODEL.variables.length);
  assert.equal(ev.provisional, true);
  assert.deepEqual(ev.maxPossible, { total: MODEL.maxScore, priority: 1 }, 'el peor escenario alcanza el máximo del modelo');
  A.setAnswer(f, 'smoking', 'no');
  ev = A.evaluate(f);
  assert.equal(ev.result.total, 0);
  assert.equal(ev.pending.length, MODEL.variables.length - 1);
  assert.equal(A.engineState(f.answers).smoking, undefined, '«No» no se envía al motor como criterio activo');
});

test('peor escenario respeta los criterios excluyentes y lo ya respondido', () => {
  const f = formFrom({}, 'no');
  delete f.answers.age_under_16; delete f.answers.age_over_65;
  let ev = A.evaluate(f);
  assert.equal(ev.maxPossible.total, 3, 'solo puede activarse uno del grupo de edad (el de mayor puntuación)');
  A.setAnswer(f, 'age_over_65', 'yes');
  ev = A.evaluate(f);
  assert.equal(f.answers.age_under_16, 'no', '«Sí» en un criterio excluyente pone «No» en el otro');
  assert.equal(ev.result.total, 1);
  assert.equal(ev.provisional, false);
});

test('un caso con dos «Sí» excluyentes no llega nunca al motor (importación saneada)', () => {
  const f = A.normalizeCase({ answers: { age_under_16: 'yes', age_over_65: 'yes', male: 'yes', relapses_mri: '9', inventada: 'yes' } });
  assert.equal(f.answers.age_under_16, undefined);
  assert.equal(f.answers.age_over_65, undefined);
  assert.equal(f.answers.male, 'yes');
  assert.equal(f.answers.relapses_mri, undefined, 'valor fuera del modelo descartado');
  assert.equal(f.answers.inventada, undefined);
  assert.doesNotThrow(() => A.evaluate(f));
});

test('modificación profesional: exige justificación, conserva el resultado automático y avisa si rebaja una P1 automática', () => {
  const f = formFrom({ pregnancy: true });
  f.override = { priority: 2, motive: 'x', justification: 'corta' };
  let ev = A.evaluate(f);
  assert.equal(ev.override, null); assert.equal(ev.finalPriority, 1);
  f.override.justification = 'Justificación clínica documentada';
  ev = A.evaluate(f);
  assert.equal(ev.finalPriority, 2); assert.equal(ev.result.priority, 1, 'el resultado del modelo no cambia');
  assert.equal(ev.overrideLowersAutomatic, true);
  const text = reportToText(createReport(A.buildReportInput(f, ev, { version: '1.1.0' })));
  assert.match(text, /Resultado calculado por el modelo: Prioridad 1/);
  assert.match(text, /Modificación por criterio profesional: Prioridad 2/);
  assert.match(text, /justificación reforzada/);
  f.override = { priority: 1, justification: 'Justificación clínica documentada' };
  assert.equal(A.evaluate(f).override, null, 'elegir la misma prioridad no es una modificación');
});

test('intervenciones: el catálogo es exactamente getInterventions() (acumulativo), con identificadores únicos', () => {
  for (const p of [1, 2, 3]) {
    const catalog = A.interventionCatalog(p), original = getInterventions(p);
    for (const block of Object.keys(original)) assert.deepEqual(catalog.filter(c => c.block === block).map(c => c.label), original[block], `P${p} ${block}`);
    assert.equal(new Set(catalog.map(c => c.id)).size, catalog.length);
    assert.ok(catalog.every(c => /^[123]\.\w+\.\d+$/.test(c.id)));
  }
  assert.ok(A.interventionCatalog(1).length > A.interventionCatalog(2).length && A.interventionCatalog(2).length > A.interventionCatalog(3).length);
});

test('informe: necesidades, intervenciones y resultado corresponden a lo calculado', () => {
  const f = formFrom(CASES[4][1]);
  f.hospital = 'Hospital Ficticio'; f.pharmacist = 'Farmacéutica Ficticia'; f.pseudoId = 'EM-0001'; f.completedAt = '2026-11-10T09:30:00';
  const cat = A.interventionCatalog(1);
  f.interventions[cat[0].id] = 'done'; f.interventions[cat[1].id] = 'planned'; f.interventions[cat[2].id] = 'not_applicable';
  f.goals.push({ objetivo: A.GOAL_EXAMPLES[0], tipo: 'Farmacoterapéutico', estado: 'Pendiente', fecha: '2027-01-10', comentarios: '<b>x</b>' });
  const ev = A.evaluate(f);
  const report = createReport(A.buildReportInput(f, ev, { version: '1.1.0' }));
  assert.deepEqual(validateReport(report), []);
  assert.equal(report.status, 'final');
  assert.equal(report.stratification.score, 18);
  assert.equal(report.stratification.finalLevel, 'Prioridad 1');
  assert.deepEqual(report.needs.confirmed.map(n => n.label), ['Falta de adherencia', 'Polimedicación'], 'necesidades farmacoterapéuticas = variables de tratamiento que puntúan');
  assert.equal(report.factors.length + report.needs.confirmed.length, ev.result.activeVariables.length, 'cada variable que puntúa aparece una sola vez');
  assert.equal(report.interventions.done[0].label, cat[0].label);
  assert.equal(report.interventions.planned[0].label, cat[1].label);
  assert.equal(report.interventions.notApplicableCount, 1);
  assert.equal(report.interventions.recommended.length, cat.length - 3);
  const text = reportToText(report);
  assert.match(text, /RESULTADO DE ESTRATIFICACIÓN: PRIORIDAD 1$/m);
  assert.match(text, /Puntuación total: 18\/52 \(Demográfica 4\/6; Clínica 10\/22; Tratamiento 4\/17; Sociosanitaria 0\/7\)/);
  assert.ok(Buffer.from(reportToPdf(report)).toString('latin1').includes('EM-0001'));
});

test('informe provisional: lista pendientes y el alcance máximo; nunca se rotula como definitivo', () => {
  const f = formFrom(CASES[1][1], 'pending'); f.completedAt = '2026-11-10T09:30:00';
  const ev = A.evaluate(f);
  const report = createReport(A.buildReportInput(f, ev));
  assert.equal(report.status, 'provisional');
  const text = reportToText(report);
  assert.match(text, /PRIORIDAD 3 \(PROVISIONAL\)/);
  assert.match(text, /no se ha considerado negativa/);
  assert.match(text, /podría llegar a Prioridad 1/);
  assert.match(text, /Potenciales, pendientes de evaluación/);
});

test('exportación: ida y vuelta sin pérdida; el texto clínico no forma parte del caso', () => {
  const f = formFrom(CASES[3][1]); f.hospital = 'H'; f.pharmacist = 'F'; f.provenance.male = 'assisted';
  f.override = { priority: 1, motive: A.OVERRIDE_MOTIVES[0], justification: 'Justificación suficiente' };
  f.dual = [A.DUAL_ITEMS[0], 'inventado']; f.followUp = { previousScore: 12, previousPriority: 2, objectivesMet: 'No', plan: 'Plan' };
  const data = A.serializeCase(f);
  assert.equal(data.schema, A.CASE_SCHEMA);
  assert.ok(!('clinicalText' in data) && !JSON.stringify(data).includes('texto'));
  const back = A.normalizeCase(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(A.evaluate(back).result, A.evaluate(f).result);
  assert.deepEqual(back.dual, [A.DUAL_ITEMS[0]]);
  assert.deepEqual(back.override, f.override);
  const csv = toCsv(A.csvRows(Object.assign(f, { pseudoId: '=cmd|x' }), A.evaluate(f)));
  assert.ok(csv.includes(`"'=cmd|x"`), 'fórmulas neutralizadas en CSV');
});

test('la aplicación no contiene red, IA externa ni almacenamiento persistente', () => {
  for (const file of ['app.js', 'assessment.js', 'extraction-rules.js', 'model.js']) {
    const src = fs.readFileSync(new URL(`../assets/js/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|localStorage|indexedDB/, file);
  }
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html.replace(/href="https:\/\/ramonmorillo\.es"|"website": "https:\/\/ramonmorillo\.es"/g, ''), /https?:\/\//, 'sin recursos de terceros');
  assert.doesNotMatch(html, /extracción automática con inteligencia artificial/i, 'el analizador de reglas no se presenta como IA');
});
