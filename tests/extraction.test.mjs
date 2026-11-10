// El analizador de texto conserva las reglas 1.0.0: mismas propuestas que la copia congelada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, EXTRACTION_RULES, NETWORK_FREE } from '../assets/js/extraction-rules.js';
import { legacyAnalyze } from './fixtures/extractor-v1.0.0.js';
import { CMO_EM_MODEL as MODEL } from '../assets/js/model.js';

const TEXTS = [
  '',
  'Paciente varón, 67 años, EM secundaria progresiva, dos brotes en el último año, polimedicado.',
  'Mujer de 34 años, embarazada. 3 brotes. Efectos adversos graves. Cambio por ineficacia a ocrelizumab.',
  'No fumador. Sin deterioro cognitivo. Niega depresión. 1 brote. Efectos adversos leves. Cambio por tolerancia.',
  'EMPP de más de 20 años de evolución, aumento de EDSS, pluripatología, mala adherencia, ISMP, barrera idiomática, aislamiento social.',
  'Paciente de 15 años de evolución con 0 lesiones nuevas; cáncer activo descartado; exfumadora.',
  '12 años, menor de 16, etnia no caucásica, demora terapéutica mayor de 2 años, 5 lesiones, efectos adversos moderados, cambio por preferencia, cambio por seguridad.',
  ...EXTRACTION_RULES.flatMap(r => r.patterns.map(p => `Consta ${p} en la historia.`))
];

test('mismas propuestas (variable y valor) que el analizador 1.0.0 en todos los textos de referencia', () => {
  for (const t of TEXTS) {
    const now = analyzeText(t).map(p => [p.id, p.value === true ? undefined : p.value]);
    const before = legacyAnalyze(t).map(p => [p.id, p.value]);
    assert.deepEqual(now, before, t.slice(0, 60));
  }
});

test('cada propuesta corresponde a una variable del modelo y lleva evidencia textual literal', () => {
  const text = TEXTS[1];
  const out = analyzeText(text);
  assert.deepEqual(out.map(p => p.id), ['age_over_65', 'male', 'progressive_ms', 'polypharmacy']);
  for (const p of out) {
    assert.ok(MODEL.variables.some(v => v.id === p.id));
    assert.ok(text.toLowerCase().includes(p.evidence.match.toLowerCase()), 'el fragmento existe en el texto');
  }
});

test('posible negación: se avisa pero la propuesta no se suprime ni se convierte en «No»', () => {
  const out = analyzeText(TEXTS[3]);
  const by = id => out.find(p => p.id === id);
  for (const id of ['smoking', 'cognitive_decline', 'neuro_psych_comorbidity']) {
    assert.ok(by(id), `${id} sigue proponiéndose (regla 1.0.0 sin cambios)`);
    assert.equal(by(id).ambiguous, true, `${id} marcado como posible negación`);
    assert.equal(by(id).value, true);
  }
  assert.equal(by('relapses_mri').ambiguous, false);
  assert.equal(analyzeText('Fumador activo de 20 cigarrillos.')[0].ambiguous, false);
  assert.equal(analyzeText('Cáncer activo descartado.')[0].ambiguous, true);
});

test('texto vacío o sin coincidencias: ninguna propuesta (nada se infiere de la ausencia)', () => {
  assert.deepEqual(analyzeText(''), []);
  assert.deepEqual(analyzeText('Paciente estable, sin incidencias.'), []);
  assert.equal(NETWORK_FREE, true);
});

test('determinista', () => { assert.deepEqual(analyzeText(TEXTS[4]), analyzeText(TEXTS[4])); });
