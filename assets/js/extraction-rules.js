// Análisis asistido de texto clínico de CMO-EM Pro: reglas locales deterministas (coincidencia
// de palabras clave). NO es inteligencia artificial generativa, no usa red y solo PROPONE.
// Las reglas (EXTRACTION_RULES y los tres patrones compuestos) son las de la versión 1.0.0,
// sin cambios: la versión congelada está en tests/fixtures/extractor-v1.0.0.js y las pruebas
// exigen que ambas propongan exactamente lo mismo. Lo añadido es solo apoyo a la revisión:
// fragmento de evidencia y aviso de posible negación (no suprime ninguna propuesta).
export const EXTRACTOR_VERSION = '1.1.0';
export const NETWORK_FREE = true;

export const EXTRACTION_RULES = [
  {id:'pregnancy',patterns:['embarazo','embarazada','lactancia','deseo gestacional']},
  {id:'age_under_16',patterns:['menor de 16','15 años','14 años','13 años','12 años']},
  {id:'age_over_65',patterns:['mayor de 65','66 años','67 años','68 años','69 años','70 años','71 años','72 años','73 años','74 años','75 años','76 años','77 años','78 años','79 años','80 años']},
  {id:'male',patterns:['varón','hombre','sexo masculino']},
  {id:'non_caucasian',patterns:['etnia no caucásica','no caucásica']},
  {id:'progressive_ms',patterns:['primaria progresiva','secundaria progresiva','empp','emsp']},
  {id:'diagnosis_over_20y',patterns:['más de 20 años de evolución','>20 años de evolución']},
  {id:'delay_treatment_over_2y',patterns:['más de 2 años entre síntomas','demora terapéutica mayor de 2 años']},
  {id:'functional_decline',patterns:['deterioro funcional','aumento de edss']},
  {id:'cognitive_decline',patterns:['deterioro cognitivo','empeoramiento cognitivo']},
  {id:'neuro_psych_comorbidity',patterns:['depresión','ansiedad','epilepsia','trastorno psicótico']},
  {id:'active_oncohematologic',patterns:['oncohematológica activa','cáncer activo','neoplasia activa']},
  {id:'multimorbidity',patterns:['pluripatología','multimorbilidad','2 o más comorbilidades']},
  {id:'current_immunosuppressants',patterns:['inmunosupresor','natalizumab','ocrelizumab','ofatumumab','rituximab','alemtuzumab','cladribina']},
  {id:'non_adherence',patterns:['falta de adherencia','mala adherencia','adherencia subóptima']},
  {id:'polypharmacy',patterns:['polimedicación','polimedicado','más de 5 medicamentos']},
  {id:'high_risk_meds',patterns:['alto riesgo','ismp']},
  {id:'smoking',patterns:['fumador','fumadora','hábito tabáquico']},
  {id:'socioeconomic',patterns:['aislamiento social','sin apoyo familiar','inestabilidad financiera','sinhogarismo']},
  {id:'training_barrier',patterns:['barrera idiomática','baja alfabetización','dificultad para asimilar pautas']}
];

// Indicios de negación o incertidumbre cerca de la coincidencia. Solo generan un aviso.
const NEG_BEFORE = /(?:^|[\s,;(])(?:no|sin|niega|niegan|nunca|ni|ex|exfumador|exfumadora|ausencia de|descarta|descartado|descartada|se descarta|antecedente de|antecedentes de|historia de|previo|previa)\s+(?:[\wáéíóúüñ]+\s+){0,3}$/;
const NEG_AFTER = /^\s*(?:negativ[oa]s?|descartad[oa]s?|ausentes?|: ?no\b|\(no\))/;

function evidenceAt(original, index, length) {
  const start = Math.max(0, index - 45), end = Math.min(original.length, index + length + 45);
  const clean = s => s.replace(/\s+/g, ' ');
  const before = original.slice(start, index), after = original.slice(index + length, end);
  const sentenceBefore = before.split(/[.\n;]/).pop() || '';
  return {
    before: (start > 0 ? '…' : '') + clean(before), match: clean(original.slice(index, index + length)), after: clean(after) + (end < original.length ? '…' : ''),
    negated: NEG_BEFORE.test(sentenceBefore.toLowerCase()) || NEG_AFTER.test(after.toLowerCase())
  };
}

/**
 * Devuelve las propuestas [{id, value, evidence:{before, match, after}, ambiguous, note}].
 * value === true para criterios Sí/No; cadena con el valor de la opción para variables con opciones.
 */
export function analyzeText(raw) {
  const original = String(raw || '');
  const text = original.toLowerCase();
  const found = [];
  const push = (id, value, index, length) => found.push({ id, value, index, length });
  EXTRACTION_RULES.forEach(rule => {
    const pattern = rule.patterns.find(p => text.includes(p));
    if (pattern) push(rule.id, true, text.indexOf(pattern), pattern.length);
  });
  const relapses = text.match(/(\d+)\s*(brotes|brote|lesiones)/);
  if (relapses) { const n = Number(relapses[1]); push('relapses_mri', n > 2 ? '3' : String(n), relapses.index, relapses[0].length); }
  const first = (...needles) => needles.map(n => [n, text.indexOf(n)]).find(([, i]) => i >= 0);
  let hit;
  if ((hit = first('efectos adversos graves'))) push('adverse_events', '3', hit[1], hit[0].length);
  else if ((hit = first('efectos adversos leves', 'efectos adversos moderados'))) push('adverse_events', '1', hit[1], hit[0].length);
  if ((hit = first('cambio por ineficacia', 'cambio por seguridad'))) push('treatment_changes', '3', hit[1], hit[0].length);
  else if ((hit = first('cambio por preferencia', 'cambio por tolerancia'))) push('treatment_changes', '1', hit[1], hit[0].length);
  // Misma deduplicación que la 1.0.0: una propuesta por variable; conserva la posición de la primera y el valor de la última.
  const unique = [...new Map(found.map(s => [s.id, s])).values()];
  return unique.map(s => {
    const ev = evidenceAt(original, s.index, s.length);
    return {
      id: s.id, value: s.value,
      evidence: { before: ev.before, match: ev.match, after: ev.after },
      ambiguous: ev.negated,
      note: ev.negated ? 'Posible negación, antecedente o descarte en el texto: compruebe el sentido antes de aceptar.' : ''
    };
  });
}
