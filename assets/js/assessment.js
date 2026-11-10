// Adaptador de CMO-EM Pro al flujo común CMO (núcleo en assets/cmo-ds/).
// No contiene reglas clínicas: el único motor es calculatePriority() de model.js, que no se modifica.
// Aquí solo se gestiona el estado de la evaluación (respuestas Sí / No / Pendiente), la modificación
// profesional documentada, el registro de intervenciones y la construcción del informe único.
import { CMO_EM_MODEL as MODEL, INTERVENTIONS, calculatePriority, getInterventions } from './model.js';
import { INTERVENTION_STATUSES } from '../cmo-ds/cmo-report.js';

export const CASE_SCHEMA = 'cmo-em-case/1';
export const APP_ID = 'cmo-esclerosis-multiple';
export const TOOL_NAME = 'CMO-EM Pro';
export const SOURCE_DOCUMENT = 'Adaptación del Modelo de Atención Farmacéutica CMO al paciente con Esclerosis Múltiple';
export const priorityLabel = p => `Prioridad ${p}`;
export const OVERRIDE_MIN_JUSTIFICATION = 12;
export const OVERRIDE_MOTIVES = ['Criterio clínico no recogido en el modelo', 'Situación social o asistencial', 'Preferencias o circunstancias del paciente', 'Otro (detallar en la justificación)'];

// Textos de la versión 1.0.0 (assets/js/app.js), sin cambios.
export const BLOCK_TITLES = { seguimiento: 'Seguimiento farmacoterapéutico', educacion: 'Educación, formación y seguimiento', coordinacion: 'Coordinación asistencial' };
export const GOAL_EXAMPLES = ['Mejorar o mantener adherencia al tratamiento modificador de la enfermedad.','Reducir o prevenir brotes.','Minimizar progresión funcional.','Controlar efectos adversos.','Optimizar medicación concomitante.','Evitar interacciones.','Mejorar conocimiento del tratamiento.','Mejorar experiencia del paciente.','Mejorar calidad de vida percibida.','Promover abandono tabáquico.','Promover actividad física adaptada.','Favorecer hábitos de sueño y autocuidado.','Mejorar competencias digitales para AF dual.'];
export const GOAL_TYPES = ['Farmacoterapéutico', 'Clínico', 'Humanístico', 'Hábitos de vida saludables'];
export const GOAL_STATUSES = ['Pendiente', 'En proceso', 'Alcanzado', 'No alcanzado'];
export const DUAL_ITEMS = ['Modalidad presencial','Modalidad telemática','Seguimiento mixto','Competencias digitales del paciente','Disponibilidad de dispositivos','Preferencia del paciente','Necesidad de hospital de día','Contacto entre visitas','Herramientas de telemonitorización'];
export const DUAL_MESSAGES = {1:'AF dual solo si es segura y compatible con la complejidad; mantener alto componente presencial si hay problemas de seguridad, adherencia, brotes, deterioro o administración compleja.',2:'Seguimiento mixto estructurado, con contactos intermedios y teleasistencia según necesidad.',3:'Seguimiento telemático preferente si el paciente tiene competencias digitales y estabilidad clínica.'};
export const EVOLUTION_MESSAGES = { met: 'Mantener plan, programar seguimiento y registrar PROM/PREM si procede.', notMet: 'Identificar causa, proponer intervención, replantear objetivos, valorar comunicación multidisciplinar y decidir si debe recalcularse la prioridad.' };
export const OBJECTIVES_MET = ['Sí', 'No', 'Parcialmente'];

const variable = id => MODEL.variables.find(v => v.id === id);
const dimensionTitle = id => (MODEL.dimensions.find(d => d.id === id)?.title || '').replace('Dimensión ', '');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function emptyForm() {
  return { hospital: '', pharmacist: '', pseudoId: '', entryMode: '', answers: {}, provenance: {}, override: null, interventions: {},
    goals: [], dual: [], followUp: { previousScore: '', previousPriority: '', objectivesMet: '', plan: '' }, plan: { nextReview: '' }, comments: '', completedAt: '', status: '' };
}

/** ¿Es un valor de respuesta admitido por el modelo para esa variable? ('' / undefined = pendiente) */
export function isValidAnswer(id, value) {
  const v = variable(id);
  if (!v) return false;
  return v.type === 'checkbox' ? value === 'yes' || value === 'no' : v.options.some(o => String(o.value) === String(value));
}

/** Registra una respuesta. «Sí» en una variable excluyente pone «No» en las demás de su grupo (misma regla que la 1.0.0). */
export function setAnswer(form, id, value, origin = 'manual') {
  const v = variable(id);
  if (!v) return form;
  if (value === '' || value === undefined || value === null) { delete form.answers[id]; delete form.provenance[id]; }
  else if (isValidAnswer(id, value)) {
    form.answers[id] = String(value);
    if (origin === 'assisted') form.provenance[id] = 'assisted'; else delete form.provenance[id];
    if (value === 'yes' && v.mutex) MODEL.variables.filter(o => o.mutex === v.mutex && o.id !== id).forEach(o => { form.answers[o.id] = 'no'; delete form.provenance[o.id]; });
  }
  form.completedAt = ''; form.status = '';
  return form;
}

/** Respuestas confirmadas → entrada del motor original. Una variable pendiente NO se envía como negativa: simplemente no consta. */
export function engineState(answers) {
  const state = {};
  for (const v of MODEL.variables) {
    const a = answers[v.id];
    if (v.type === 'checkbox') { if (a === 'yes') state[v.id] = true; }
    else if (a !== undefined && a !== '') state[v.id] = a;
  }
  return state;
}

/** Peor escenario posible si todas las pendientes resultaran positivas (calculado con el motor original). */
function worstCaseState(answers) {
  const state = engineState(answers);
  const taken = new Set(MODEL.variables.filter(v => v.mutex && answers[v.id] === 'yes').map(v => v.mutex));
  const pending = MODEL.variables.filter(v => answers[v.id] === undefined || answers[v.id] === '');
  const byPoints = [...pending].sort((a, b) => (b.points || 0) - (a.points || 0));
  for (const v of byPoints) {
    if (v.type === 'checkbox') { if (v.mutex) { if (taken.has(v.mutex)) continue; taken.add(v.mutex); } state[v.id] = true; }
    else state[v.id] = String([...v.options].sort((a, b) => b.points - a.points)[0].value);
  }
  return state;
}

export function overrideIsValid(override, calculatedPriority) {
  return !!override && [1, 2, 3].includes(Number(override.priority)) && Number(override.priority) !== calculatedPriority
    && str(override.justification, 2000).length >= OVERRIDE_MIN_JUSTIFICATION;
}

function responseLabel(v, answer) {
  if (answer === undefined || answer === '') return 'Pendiente';
  if (v.type === 'checkbox') return answer === 'yes' ? 'Sí' : 'No';
  return v.options.find(o => String(o.value) === String(answer))?.label || 'Pendiente';
}

/** Ejecuta el motor original y añade la información de flujo (pendientes, provisionalidad, modificación profesional). */
export function evaluate(form) {
  const result = calculatePriority(engineState(form.answers));
  const details = MODEL.variables.map(v => {
    const answer = form.answers[v.id];
    const pending = answer === undefined || answer === '';
    const active = result.activeVariables.find(a => a.id === v.id);
    return { variable: v, answer, pending, response: responseLabel(v, answer), points: active ? active.points : 0, active: !!active, origin: form.provenance[v.id] === 'assisted' ? 'assisted' : pending ? '' : 'manual' };
  });
  const pending = details.filter(d => d.pending).map(d => d.variable);
  const worst = pending.length ? calculatePriority(worstCaseState(form.answers)) : result;
  const override = overrideIsValid(form.override, result.priority)
    ? { priority: Number(form.override.priority), motive: str(form.override.motive, 200), justification: str(form.override.justification, 2000) } : null;
  const finalPriority = override ? override.priority : result.priority;
  return {
    result, details, pending, provisional: pending.length > 0,
    maxPossible: { total: worst.total, priority: worst.priority }, priorityMayChange: worst.priority !== result.priority,
    override, finalPriority, overrideLowersAutomatic: !!override && result.automatic && override.priority > 1,
    assistedCount: details.filter(d => d.origin === 'assisted').length
  };
}

/** Catálogo de intervenciones de la prioridad, con identificadores estables. El contenido y el carácter acumulativo salen de getInterventions(). */
export function interventionCatalog(priority) {
  const byBlock = getInterventions(priority);
  const used = new Set();
  return Object.entries(byBlock).flatMap(([block, items]) => items.map(label => {
    let id = '';
    for (const level of [3, 2, 1]) {
      const index = INTERVENTIONS[level][block].findIndex((t, i) => t === label && !used.has(`${level}.${block}.${i}`));
      if (index >= 0) { id = `${level}.${block}.${index}`; break; }
    }
    used.add(id);
    return { id, block, group: BLOCK_TITLES[block], level: Number(id[0]), label };
  }));
}
export const interventionStatus = (form, id) => (Object.hasOwn(INTERVENTION_STATUSES, form.interventions?.[id]) ? form.interventions[id] : 'recommended');

/** Variables que han puntuado y pendientes, agrupadas por dimensión del modelo (etapa «Necesidades»). */
export function needsByDimension(ev) {
  return MODEL.dimensions.map(d => ({
    dimension: d,
    confirmed: ev.details.filter(x => x.variable.dimension === d.id && x.active),
    potential: ev.details.filter(x => x.variable.dimension === d.id && x.pending)
  }));
}

/** Entrada para createReport() (cmo-report/1). Única fuente del texto para HCE, la impresión y el PDF. */
export function buildReportInput(form, ev, { version = '' } = {}) {
  const r = ev.result;
  const catalog = interventionCatalog(ev.finalPriority);
  const byStatus = status => catalog.filter(a => interventionStatus(form, a.id) === status).map(a => ({ group: a.group, label: a.label }));
  const fu = form.followUp || {};
  // Como en CMO Respiratorio: las variables de tratamiento que puntúan son las necesidades farmacoterapéuticas; el resto, factores de contexto.
  const need = d => ({ label: d.variable.label, detail: d.pending ? 'pendiente de valoración' : [d.variable.type === 'select' && d.response, `${d.points} p`].filter(Boolean).join(' · ') });
  const warnings = [];
  if (ev.provisional) {
    warnings.push(`Resultado provisional: ${ev.pending.length} variable(s) pendiente(s) de valoración. Una variable pendiente no se ha considerado negativa: no puntúa hasta que se valore.`);
    warnings.push(ev.priorityMayChange
      ? `Si las variables pendientes resultaran positivas, la puntuación podría alcanzar ${ev.maxPossible.total}/${MODEL.maxScore} y la prioridad podría llegar a ${priorityLabel(ev.maxPossible.priority)}.`
      : `Si las variables pendientes resultaran positivas, la puntuación podría alcanzar ${ev.maxPossible.total}/${MODEL.maxScore}; la prioridad no cambiaría.`);
  }
  if (ev.overrideLowersAutomatic) warnings.push('La modificación profesional disminuye una Prioridad 1 automática (embarazo/lactancia/deseo gestacional): requiere justificación reforzada documentada.');
  return {
    title: 'Atención farmacéutica en Esclerosis Múltiple — Modelo CMO',
    tool: { name: TOOL_NAME, version },
    model: { name: SOURCE_DOCUMENT, source: `Basado en el documento «${SOURCE_DOCUMENT}» (metodología CMO, MAPEX-SEFH).` },
    evaluationDate: form.completedAt, status: form.completedAt && !ev.provisional ? 'final' : 'provisional',
    hospital: form.hospital, pharmacist: form.pharmacist, patientId: form.pseudoId,
    context: [
      { label: 'Puntuación previa', value: fu.previousScore !== '' && fu.previousScore != null ? `${fu.previousScore}/${MODEL.maxScore}` : '' },
      { label: 'Prioridad previa', value: fu.previousPriority ? priorityLabel(fu.previousPriority) : '' },
      { label: '¿Se cumplen los objetivos previos?', value: fu.objectivesMet || '' },
      { label: 'Oportunidad (AF dual), aspectos valorados', value: (form.dual || []).join('; ') },
      { label: 'Orientación de AF dual del modelo para la prioridad', value: DUAL_MESSAGES[ev.finalPriority] }
    ],
    stratification: {
      score: r.total, maxScore: MODEL.maxScore,
      subtotals: MODEL.dimensions.map(d => ({ label: cap(dimensionTitle(d.id)), points: r.dimensionScores[d.id], max: d.max })),
      calculatedLevel: priorityLabel(r.priority), finalLevel: priorityLabel(ev.finalPriority), levelCode: ev.finalPriority,
      rules: r.automatic ? [r.explanation] : [], explanation: MODEL.messages[ev.finalPriority],
      override: ev.override ? { level: priorityLabel(ev.override.priority), motive: ev.override.motive, justification: ev.override.justification } : null,
      pending: ev.pending.map(v => v.label), assistedCount: ev.assistedCount
    },
    factors: r.activeVariables.filter(a => a.dimension !== 'treatment').map(a => ({ dimension: cap(dimensionTitle(a.dimension)), label: a.label, detail: a.detail, points: a.points })),
    needs: {
      confirmed: ev.details.filter(d => d.variable.dimension === 'treatment' && d.active).map(need),
      potential: ev.details.filter(d => d.variable.dimension === 'treatment' && d.pending).map(need)
    },
    interventions: { done: byStatus('done'), planned: byStatus('planned'), recommended: byStatus('recommended'), notApplicableCount: byStatus('not_applicable').length },
    plan: {
      nextReview: form.plan?.nextReview || '',
      notes: [fu.plan, form.comments && `Comentarios del farmacéutico: ${form.comments}`].filter(Boolean).join(' · '),
      goals: (form.goals || []).map(g => ({ label: g.objetivo, status: g.estado, detail: [g.tipo, g.fecha && `revisión ${g.fecha}`, g.comentarios].filter(Boolean).join(' · ') }))
    },
    warnings
  };
}

/** Datos estructurados confirmados del caso (esquema cmo-em-case/1). No incluye texto clínico pegado: nunca se conserva. */
export function serializeCase(form) {
  const f = normalizeCase(form);
  return { schema: CASE_SCHEMA, ...f };
}

/** Valida y sanea un caso (importación o borrador). Lo desconocido se descarta; nada se interpreta ni se ejecuta. */
export function normalizeCase(input) {
  const src = input && typeof input === 'object' ? input : {};
  const f = emptyForm();
  f.hospital = str(src.hospital, 200); f.pharmacist = str(src.pharmacist, 200); f.pseudoId = str(src.pseudoId, 60);
  f.entryMode = ['manual', 'assisted'].includes(src.entryMode) ? src.entryMode : '';
  for (const v of MODEL.variables) {
    const a = src.answers?.[v.id];
    if (a !== undefined && isValidAnswer(v.id, String(a))) { f.answers[v.id] = String(a); if (src.provenance?.[v.id] === 'assisted') f.provenance[v.id] = 'assisted'; }
  }
  // Coherencia: dos «Sí» en un grupo excluyente no son importables; ambas quedan pendientes.
  for (const group of new Set(MODEL.variables.map(v => v.mutex).filter(Boolean))) {
    const yes = MODEL.variables.filter(v => v.mutex === group && f.answers[v.id] === 'yes');
    if (yes.length > 1) yes.forEach(v => { delete f.answers[v.id]; delete f.provenance[v.id]; });
  }
  const o = src.override;
  if (o && [1, 2, 3].includes(Number(o.priority))) f.override = { priority: Number(o.priority), motive: str(o.motive, 200), justification: str(o.justification, 2000) };
  for (const [id, status] of Object.entries(src.interventions && typeof src.interventions === 'object' ? src.interventions : {})) {
    if (/^[123]\.(seguimiento|educacion|coordinacion)\.\d{1,2}$/.test(id) && Object.hasOwn(INTERVENTION_STATUSES, status) && status !== 'recommended') f.interventions[id] = status;
  }
  f.goals = (Array.isArray(src.goals) ? src.goals : []).slice(0, 50).map(g => ({
    objetivo: str(g?.objetivo, 300), tipo: GOAL_TYPES.includes(g?.tipo) ? g.tipo : GOAL_TYPES[0], estado: GOAL_STATUSES.includes(g?.estado) ? g.estado : GOAL_STATUSES[0],
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(g?.fecha || '') ? g.fecha : '', comentarios: str(g?.comentarios, 500)
  })).filter(g => g.objetivo);
  f.dual = (Array.isArray(src.dual) ? src.dual : []).filter(x => DUAL_ITEMS.includes(x));
  const fu = src.followUp || {};
  const prev = fu.previousScore === '' || fu.previousScore == null ? NaN : Number(fu.previousScore);
  f.followUp = {
    previousScore: Number.isInteger(prev) && prev >= 0 && prev <= MODEL.maxScore ? prev : '',
    previousPriority: [1, 2, 3].includes(Number(fu.previousPriority)) ? Number(fu.previousPriority) : '',
    objectivesMet: OBJECTIVES_MET.includes(fu.objectivesMet) ? fu.objectivesMet : '', plan: str(fu.plan, 2000)
  };
  f.plan = { nextReview: /^\d{4}-\d{2}-\d{2}$/.test(src.plan?.nextReview || '') ? src.plan.nextReview : '' };
  f.comments = str(src.comments, 2000);
  f.completedAt = !Number.isNaN(Date.parse(src.completedAt || '')) ? String(src.completedAt).slice(0, 40) : '';
  f.status = f.completedAt ? (MODEL.variables.every(v => f.answers[v.id] !== undefined) ? 'completed' : 'provisional') : '';
  return f;
}

/** Filas clave/valor para la exportación CSV (las celdas las protege toCsv del núcleo). */
export function csvRows(form, ev) {
  return [
    ['campo', 'valor'], ['esquema', CASE_SCHEMA], ['codigo', form.pseudoId], ['hospital', form.hospital], ['farmaceutico', form.pharmacist],
    ['fecha_evaluacion', form.completedAt], ['estado', form.completedAt && !ev.provisional ? 'definitiva' : 'provisional'],
    ['puntuacion_total', ev.result.total], ['puntuacion_maxima', MODEL.maxScore],
    ...MODEL.dimensions.map(d => [`puntuacion_${d.id}`, ev.result.dimensionScores[d.id]]),
    ['prioridad_calculada', ev.result.priority], ['prioridad_final', ev.finalPriority], ['prioridad_automatica', ev.result.automatic ? 'si' : 'no'],
    ['modificacion_profesional', ev.override ? `${ev.override.motive} · ${ev.override.justification}` : ''],
    ['variables_pendientes', ev.pending.length],
    ...ev.details.map(d => [`var_${d.variable.id}`, d.pending ? 'pendiente' : d.answer])
  ];
}
