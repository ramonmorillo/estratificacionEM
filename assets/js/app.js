// Interfaz de CMO-EM Pro sobre el flujo común CMO de 7 etapas (núcleo en assets/cmo-ds/).
// Sin lógica clínica: el cálculo es de model.js (sin cambios) a través de assessment.js.
// Todo dato introducido por el usuario se escapa antes de insertarse en el documento.
import { CMO_EM_MODEL as MODEL } from './model.js';
import { analyzeText } from './extraction-rules.js';
import * as A from './assessment.js';
import { createReport, validateReport, reportToText, reportToHtml, exportEnvelope, parseEnvelope, toCsv, escapeHtml as e, INTERVENTION_STATUSES } from '../cmo-ds/cmo-report.js';
import { reportToPdf } from '../cmo-ds/cmo-pdf.js';
import { createStepper, toast, confirmDialog, guardUnsaved, copyText, download, printHtml, safeFilename } from '../cmo-ds/cmo-flow.js';

const $ = id => document.getElementById(id);
const DRAFT_KEY = 'cmo-em-pro-draft';
const meta = (() => { try { return JSON.parse($('cmo-app-meta').textContent); } catch { return {}; } })();
const VERSION = meta.appVersion || '';
const variable = id => MODEL.variables.find(v => v.id === id);
const dimTitle = d => `${d.letter}. ${d.title}`;
const P = A.priorityLabel;

let form = A.emptyForm();
let proposals = [];
let dirty = false;
let stepper;

// ---------- Borrador de sesión (solo sessionStorage: desaparece al cerrar la pestaña) ----------
const session = () => { try { return window.sessionStorage; } catch { return null; } };
function saveDraft() { if (!hasData()) { clearDraft(); return; } try { session()?.setItem(DRAFT_KEY, JSON.stringify({ form: A.serializeCase(form), stage: stepper?.current || 1 })); } catch { /* sin almacenamiento */ } }
function loadDraft() { try { const d = JSON.parse(session()?.getItem(DRAFT_KEY) || 'null'); return d?.form ? { form: A.normalizeCase(d.form), stage: Number(d.stage) || 1 } : null; } catch { return null; } }
function clearDraft() { try { session()?.removeItem(DRAFT_KEY); } catch { /* sin almacenamiento */ } }
const hasData = () => !!(form.hospital || form.pharmacist || form.pseudoId || Object.keys(form.answers).length || form.goals.length || form.comments);
function changed({ clinical = false } = {}) {
  dirty = hasData();
  if (clinical && form.completedAt) { form.completedAt = ''; form.status = ''; toast('Ha modificado datos tras finalizar: vuelva a validar en el paso 4.', { type: 'warn' }); }
  saveDraft();
  refresh();
}
const announce = text => { $('live').textContent = text; };

// ---------- Etapa 1: inicio y análisis asistido ----------
function identityOk() {
  const missing = [!form.hospital && 'el hospital o centro', !form.pharmacist && 'el farmacéutico/a responsable'].filter(Boolean);
  $('identityError').textContent = missing.length ? `Indique ${missing.join(' y ')} para continuar.` : '';
  ['hospital', 'pharmacist'].forEach(id => $(id).setAttribute('aria-invalid', String(!form[id])));
  if (missing.length) $(form.hospital ? 'pharmacist' : 'hospital').focus();
  return !missing.length;
}
function proposedLabel(v, value) { return v.type === 'checkbox' ? 'Sí' : v.options.find(o => String(o.value) === String(value))?.label || String(value); }
function renderProposals() {
  const box = $('proposals');
  if (!proposals.length) { box.innerHTML = '<p class="muted">No se han detectado criterios. Revise el texto o complete la estratificación manualmente; todas las variables quedan pendientes.</p>'; $('applyProposals').hidden = true; return; }
  const notMentioned = MODEL.variables.length - proposals.length;
  box.innerHTML = `<p class="muted">${proposals.length} propuesta(s). Decida cada una: aceptar, corregir o descartar. ${notMentioned} variable(s) sin mención quedan pendientes (no se interpretan como «No»).</p>
  <div class="cmo-table-wrap" tabindex="0" role="region" aria-label="Propuestas del análisis"><table class="cmo-review"><thead><tr><th scope="col">Variable</th><th scope="col">Valor propuesto</th><th scope="col">Evidencia en el texto</th><th scope="col">Decisión</th></tr></thead><tbody>${proposals.map((p, i) => {
    const v = variable(p.id);
    const options = v.type === 'checkbox' ? [['no', 'Corregir a: No']] : v.options.filter(o => String(o.value) !== String(p.value)).map(o => [`set:${o.value}`, `Corregir a: ${o.label}`]);
    const current = form.answers[p.id];
    return `<tr data-state="${p.decision === 'accept' ? 'accepted' : p.decision === 'discard' ? 'discarded' : ''}"><th scope="row">${e(v.label)}${current !== undefined ? `<span class="cmo-evidence">Valor actual: ${e(v.type === 'checkbox' ? (current === 'yes' ? 'Sí' : 'No') : proposedLabel(v, current))}</span>` : ''}</th>
      <td>${e(proposedLabel(v, p.value))}</td>
      <td><span class="cmo-evidence">${e(p.evidence.before)}<mark>${e(p.evidence.match)}</mark>${e(p.evidence.after)}</span>${p.ambiguous ? `<span class="cmo-flag cmo-flag--pending">${e(p.note)}</span>` : ''}</td>
      <td><select data-proposal="${i}" aria-label="Decisión para ${e(v.label)}"><option value="">Sin decidir (queda pendiente)</option><option value="accept"${p.decision === 'accept' ? ' selected' : ''}>Aceptar: ${e(proposedLabel(v, p.value))}</option>${options.map(([val, label]) => `<option value="${e(val)}"${p.decision === val ? ' selected' : ''}>${e(label)}</option>`).join('')}<option value="discard"${p.decision === 'discard' ? ' selected' : ''}>Descartar</option></select></td></tr>`;
  }).join('')}</tbody></table></div>`;
  $('applyProposals').hidden = false;
}
function applyProposals() {
  if (!identityOk()) return;
  let applied = 0, undecided = 0;
  for (const p of proposals) {
    const v = variable(p.id);
    if (!p.decision) { undecided++; continue; }
    if (p.decision === 'discard') continue;
    const value = p.decision === 'accept' ? (v.type === 'checkbox' ? 'yes' : String(p.value)) : p.decision === 'no' ? 'no' : p.decision.slice(4);
    A.setAnswer(form, p.id, value, 'assisted'); applied++;
  }
  // El texto clínico no se conserva: se elimina de la pantalla al incorporar las propuestas.
  $('clinicalText').value = ''; proposals = []; $('proposals').innerHTML = ''; $('applyProposals').hidden = true;
  form.entryMode = 'assisted';
  changed({ clinical: true });
  stepper.go(2);
  toast(`${applied} variable(s) incorporada(s) tras su confirmación.${undecided ? ` ${undecided} propuesta(s) sin decidir quedan pendientes.` : ''}`);
}

// ---------- Etapa 2: historia clínica ----------
function renderForm() {
  $('dimensionForms').innerHTML = MODEL.dimensions.map(d => `<section class="dimension"><h3>${dimTitle(d)} <small>máx. ${d.max}</small></h3><div class="variables">${MODEL.variables.filter(v => v.dimension === d.id).map(renderVariable).join('')}</div><p><button type="button" class="secondary" data-fill-no="${d.id}">Marcar como «No» las pendientes de esta dimensión</button></p></section>`).join('');
}
function renderVariable(v) {
  const help = v.help || 'Contribuye a la puntuación total si está activada. Revise siempre la historia clínica y el juicio profesional.';
  const maxPoints = v.type === 'select' ? Math.max(...v.options.map(o => o.points)) : v.points;
  const control = v.type === 'select'
    ? `<select id="${v.id}" data-var="${v.id}" aria-labelledby="lbl-${v.id}"><option value="">Pendiente</option>${v.options.map(o => `<option value="${o.value}">${o.label} · ${o.points} p</option>`).join('')}</select>`
    : `<fieldset class="cmo-tristate" role="radiogroup" aria-labelledby="lbl-${v.id}">${[['yes', 'Sí'], ['no', 'No'], ['', 'Pendiente']].map(([val, label]) => `<label><input type="radio" name="v-${v.id}" data-var="${v.id}" value="${val}"${val === '' ? ' checked' : ''}>${label}</label>`).join('')}</fieldset>`;
  return `<article class="variable-card" data-card="${v.id}"><h4 id="lbl-${v.id}">${v.label}</h4><p>${v.description}</p><span class="points badge">${v.type === 'select' ? `0-${maxPoints} puntos` : `${v.points} puntos`}</span>${control}<details><summary>Ayuda contextual</summary><p>${help}</p></details><small class="muted" id="contrib-${v.id}"></small></article>`;
}
function syncForm(ev) {
  for (const d of ev.details) {
    const v = d.variable, value = d.pending ? '' : d.answer;
    if (v.type === 'select') $(v.id).value = value;
    else document.querySelectorAll(`input[name="v-${v.id}"]`).forEach(r => { r.checked = r.value === value; });
    $(`contrib-${v.id}`).innerHTML = d.pending ? '<span class="cmo-flag cmo-flag--pending">Pendiente de valoración</span>' : `Contribución actual: ${d.points} puntos${d.origin === 'assisted' ? ' <span class="cmo-flag cmo-flag--assisted">Análisis asistido, confirmado</span>' : ''}`;
  }
}
async function fillNo(dimensionId) {
  const targets = MODEL.variables.filter(v => v.dimension === dimensionId && form.answers[v.id] === undefined);
  if (!targets.length) { toast('No hay variables pendientes en esta dimensión.'); return; }
  const ok = await confirmDialog({ title: 'Marcar pendientes como «No»', message: `Va a registrar como «No» (o sin actividad/cambios) ${targets.length} variable(s) pendiente(s) de esta dimensión. Hágalo solo si ha comprobado que no concurren en el paciente.`, confirmLabel: 'Registrar como «No»' });
  if (!ok) return;
  targets.forEach(v => A.setAnswer(form, v.id, v.type === 'checkbox' ? 'no' : String(v.options.find(o => o.points === 0).value)));
  changed({ clinical: true });
}

// ---------- Render común ----------
const tile = (value, label) => `<div><strong>${value}</strong><small>${label}</small></div>`;
function refresh() {
  let ev;
  try { ev = A.evaluate(form); } catch (err) { toast(err.message, { type: 'error' }); return; }
  const r = ev.result;
  const stateLabel = form.completedAt ? (ev.provisional ? 'Finalizada (provisional)' : 'Finalizada') : (ev.provisional ? 'Provisional' : 'Sin finalizar');
  $('headerScore').textContent = `${r.total}/${MODEL.maxScore}`;
  $('headerPriority').textContent = ev.pending.length === ev.details.length ? 'Sin valorar' : P(ev.finalPriority);
  $('headerState').textContent = stateLabel;
  syncForm(ev);
  $('scoreOverview').innerHTML = `<article class="score-tile p${ev.finalPriority}"><span>Total actual</span><strong>${r.total}/${MODEL.maxScore}</strong><small>${P(ev.finalPriority)}${ev.provisional ? ' · provisional' : ''}</small></article>${MODEL.dimensions.map(d => `<article class="score-tile"><span>${d.letter}. ${d.title.replace('Dimensión ', '')}</span><strong>${r.dimensionScores[d.id]}/${d.max}</strong><small>${Math.round((r.dimensionScores[d.id] / d.max) * 100)}% de la dimensión</small></article>`).join('')}`;

  // Etapa 3
  const done = ev.details.length - ev.pending.length;
  $('reviewStatus').innerHTML = tile(done, 'Variables valoradas') + tile(ev.pending.length, 'Pendientes') + tile(ev.assistedCount, 'Desde análisis asistido');
  $('reviewRows').innerHTML = ev.details.map(d => `<tr><th scope="row">${d.variable.label}</th><td>${MODEL.dimensions.find(x => x.id === d.variable.dimension).title.replace('Dimensión ', '')}</td><td>${d.pending ? '<span class="cmo-flag cmo-flag--pending">Pendiente</span>' : e(d.response)}</td><td>${d.pending ? '—' : d.points}</td><td>${d.origin === 'assisted' ? '<span class="cmo-flag cmo-flag--assisted">Análisis asistido</span>' : d.origin === 'manual' ? 'Manual' : '—'}</td></tr>`).join('');

  // Etapa 4
  $('resultStatus').innerHTML = tile(`${r.total}/${MODEL.maxScore}`, 'Puntuación') + tile(P(r.priority), 'Prioridad calculada por el modelo') + tile(P(ev.finalPriority), 'Prioridad final') + tile(stateLabel, 'Estado');
  $('resultCard').className = `result-card p${ev.finalPriority}`;
  $('resultCard').innerHTML = `<p class="cmo-level" data-level="${ev.finalPriority}">${P(ev.finalPriority)}${ev.provisional ? ' (provisional)' : ''}</p><h3>${r.total} / ${MODEL.maxScore} puntos</h3>`
    + (r.automatic ? '<p class="recommendation"><strong>Prioridad 1 por criterio automático: embarazo/lactancia/deseo gestacional</strong></p>' : '')
    + (ev.override ? `<p class="recommendation"><strong>Modificada por criterio profesional.</strong> El modelo calcula ${P(r.priority)}. Motivo: ${e(ev.override.motive)}. Justificación: ${e(ev.override.justification)}</p>` : '')
    + (ev.overrideLowersAutomatic ? '<p class="recommendation"><strong>Atención:</strong> la modificación disminuye una Prioridad 1 automática; documente una justificación reforzada.</p>' : '')
    + `<p>${MODEL.messages[ev.finalPriority]}</p>`
    + (ev.provisional ? `<p class="recommendation"><strong>Resultado provisional:</strong> ${ev.pending.length} variable(s) pendiente(s) no puntúan. Si resultaran positivas, la puntuación podría alcanzar ${ev.maxPossible.total}/${MODEL.maxScore}${ev.priorityMayChange ? ` y la prioridad podría llegar a ${P(ev.maxPossible.priority)}` : '; la prioridad no cambiaría'}.</p><details><summary>Ver variables pendientes</summary><ul>${ev.pending.map(v => `<li>${v.label}</li>`).join('')}</ul></details>` : '')
    + `<progress max="${MODEL.maxScore}" value="${r.total}" aria-label="Puntuación total"></progress>`;
  $('scoreAssignment').innerHTML = `<h3>Asignación visible de puntuaciones</h3><div class="assignment-grid">${MODEL.dimensions.map(d => `<article><h4>${dimTitle(d)}</h4><p><strong>${r.dimensionScores[d.id]} de ${d.max} puntos</strong></p><ul>${r.activeVariables.filter(v => v.dimension === d.id).map(v => `<li><span>${v.label}${v.detail ? ` · ${v.detail}` : ''}</span><strong>${v.points} p</strong></li>`).join('') || '<li><span>Sin criterios activados</span><strong>0 p</strong></li>'}</ul></article>`).join('')}</div>`;
  $('dimensionBars').innerHTML = MODEL.dimensions.map(d => `<div class="bar"><strong>${d.title}: ${r.dimensionScores[d.id]} / ${d.max}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, r.dimensionScores[d.id] / d.max * 100)}%"></div></div></div>`).join('');
  const o = form.override;
  $('overrideState').textContent = !o?.priority ? 'Sin modificación profesional.' : Number(o.priority) === r.priority ? 'La prioridad elegida coincide con la calculada: no hay modificación.' : ev.override ? `Modificación aplicada: ${P(ev.override.priority)} (el modelo calcula ${P(r.priority)}).` : `Modificación NO aplicada: la justificación debe tener al menos ${A.OVERRIDE_MIN_JUSTIFICATION} caracteres.`;
  $('finishState').textContent = form.completedAt ? `Estratificación finalizada${ev.provisional ? ' como provisional' : ''}. Puede generar los informes en el paso 7.` : 'La finalización fija la fecha de evaluación y habilita los informes.';

  // Etapa 5
  $('needs').innerHTML = A.needsByDimension(ev).map(n => `<section class="cmo-panel"><h3>${dimTitle(n.dimension)}${n.dimension.id === 'treatment' ? ' · necesidades farmacoterapéuticas' : ''}</h3>`
    + `<h4>Confirmadas (variables que puntúan)</h4><ul>${n.confirmed.map(d => `<li>${d.variable.label}${d.variable.type === 'select' ? ` · ${e(d.response)}` : ''} <strong>(${d.points} p)</strong></li>`).join('') || '<li class="muted">Ninguna</li>'}</ul>`
    + (n.potential.length ? `<h4>Potenciales, pendientes de evaluación</h4><ul>${n.potential.map(d => `<li>${d.variable.label} <span class="cmo-flag cmo-flag--pending">Pendiente</span></li>`).join('')}</ul>` : '') + '</section>').join('');

  // Etapa 6
  const catalog = A.interventionCatalog(ev.finalPriority);
  $('interventionBlocks').innerHTML = Object.entries(A.BLOCK_TITLES).map(([block, title]) => `<section class="cmo-panel"><h3>${title}</h3><ul class="intervention-list">${catalog.filter(a => a.block === block).map(a => `<li><span id="int-${a.id}">${a.label} <small class="muted">(Prioridad ${a.level})</small></span><select data-intervention="${a.id}" aria-labelledby="int-${a.id}">${Object.entries(INTERVENTION_STATUSES).map(([k, label]) => `<option value="${k}"${A.interventionStatus(form, a.id) === k ? ' selected' : ''}>${label}</option>`).join('')}</select></li>`).join('') || '<li class="muted">Sin intervenciones en este bloque.</li>'}</ul></section>`).join('');
  $('goalsTable').innerHTML = form.goals.length ? `<table class="cmo-review"><thead><tr><th scope="col">Objetivo</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Revisión</th><th scope="col">Comentarios</th><th scope="col"><span class="cmo-visually-hidden">Acciones</span></th></tr></thead><tbody>${form.goals.map((g, i) => `<tr><td>${e(g.objetivo)}</td><td>${e(g.tipo)}</td><td>${e(g.estado)}</td><td>${e(g.fecha || '-')}</td><td>${e(g.comentarios)}</td><td><button type="button" class="secondary" data-remove-goal="${i}" aria-label="Quitar objetivo ${i + 1}">Quitar</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin objetivos registrados.</p>';
  $('dualRecommendation').textContent = A.DUAL_MESSAGES[ev.finalPriority];
  const fu = form.followUp;
  $('evolution').innerHTML = (fu.previousScore !== '' || fu.previousPriority ? `<p><strong>Evolución:</strong> puntuación previa ${fu.previousScore === '' ? 'no registrada' : fu.previousScore}; actual ${r.total}. Prioridad previa ${fu.previousPriority ? P(fu.previousPriority) : 'no registrada'}; actual ${P(ev.finalPriority)}.</p>` : '')
    + (fu.objectivesMet ? `<p>${fu.objectivesMet === 'Sí' ? A.EVOLUTION_MESSAGES.met : A.EVOLUTION_MESSAGES.notMet}</p>` : '');

  // Etapa 7
  const report = createReport(A.buildReportInput(form, ev, { version: VERSION }));
  const blocked = !form.completedAt ? 'Finalice la estratificación en el paso 4 («Validar y finalizar») para generar los informes.' : validateReport(report).filter(x => !/pendientes/.test(x)).join(' ');
  $('reportBlocked').hidden = !blocked; $('reportBlocked').textContent = blocked;
  ['copyReport', 'downloadPdf', 'printReport', 'downloadTxt'].forEach(id => { $(id).disabled = !!blocked; });
  $('reportText').value = blocked ? '' : reportToText(report);
  $('reportPreview').innerHTML = blocked ? '' : reportToHtml(report);
  current = { ev, report, blocked };
}
let current = null;

// ---------- Acciones ----------
async function finish() {
  const { ev } = current;
  if (ev.provisional) {
    const ok = await confirmDialog({ title: 'Variables clínicas pendientes', message: `Existen ${ev.pending.length} variable(s) pendiente(s). Puede volver a la historia clínica para completarlas o finalizar como resultado PROVISIONAL (quedará indicado en el informe).`, confirmLabel: 'Finalizar como provisional', cancelLabel: 'Volver a completar' });
    if (!ok) { stepper.go(2); return; }
  }
  if (form.override?.priority && Number(form.override.priority) !== ev.result.priority && !ev.override) { toast('La modificación profesional no tiene justificación suficiente: complétela o retírela.', { type: 'warn' }); $('overrideJustification').focus(); return; }
  form.completedAt = new Date().toISOString();
  form.status = ev.provisional ? 'provisional' : 'completed';
  dirty = true; saveDraft(); refresh();
  toast(`Estratificación finalizada: ${P(ev.finalPriority)}${ev.provisional ? ' (provisional)' : ''}.`);
}
const fileBase = () => safeFilename('cmo-em', form.pseudoId || 'caso', (form.completedAt || '').slice(0, 10));
function envelope() {
  return exportEnvelope({ app: { id: A.APP_ID, name: A.TOOL_NAME, version: VERSION }, exportedAt: new Date().toISOString(), dataSchema: A.CASE_SCHEMA, data: A.serializeCase(form), report: current.blocked ? null : current.report });
}
async function importFile(file) {
  if (!file) return;
  const parsed = parseEnvelope(await file.text(), { appId: A.APP_ID });
  if (!parsed.ok) { toast(`No se ha podido importar: ${parsed.error}`, { type: 'error' }); return; }
  if (parsed.value.dataSchema !== A.CASE_SCHEMA) { toast(`No se ha podido importar: esquema de datos no compatible (se esperaba ${A.CASE_SCHEMA}).`, { type: 'error' }); return; }
  if (hasData() && !(await confirmDialog({ title: 'Sustituir la evaluación actual', message: 'La importación sustituye los datos de la evaluación en curso.', confirmLabel: 'Importar y sustituir', danger: true }))) return;
  form = A.normalizeCase(parsed.value.data);
  fillInputs(); changed(); dirty = false;
  stepper.go(3);
  toast('Caso importado. Revise los datos antes de continuar.');
}
async function resetAll() {
  if (hasData() && !(await confirmDialog({ title: 'Reiniciar y borrar datos', message: 'Se borrarán todos los datos introducidos en esta evaluación. Esta acción no se puede deshacer.', confirmLabel: 'Borrar todo', danger: true }))) return;
  form = A.emptyForm(); proposals = []; dirty = false; clearDraft();
  $('clinicalText').value = ''; $('proposals').innerHTML = ''; $('applyProposals').hidden = true; $('assistantPanel').hidden = true; $('identityError').textContent = '';
  fillInputs(); refresh(); stepper.reset();
  toast('Evaluación reiniciada.');
}
function fillInputs() {
  $('hospital').value = form.hospital; $('pharmacist').value = form.pharmacist; $('pseudoId').value = form.pseudoId;
  $('overridePriority').value = form.override?.priority ? String(form.override.priority) : ''; $('overrideMotive').value = form.override?.motive || A.OVERRIDE_MOTIVES[0]; $('overrideJustification').value = form.override?.justification || '';
  $('previousScore').value = form.followUp.previousScore; $('previousPriority').value = String(form.followUp.previousPriority || ''); $('objectivesMet').value = form.followUp.objectivesMet; $('followPlan').value = form.followUp.plan;
  $('nextReview').value = form.plan.nextReview; $('pharmacistComments').value = form.comments;
  document.querySelectorAll('#dualAfChecks input').forEach(c => { c.checked = form.dual.includes(c.value); });
}

function bind() {
  const text = (id, set) => $(id).addEventListener('input', ev => { set(ev.target.value); changed(); });
  text('hospital', v => { form.hospital = v.trim(); }); text('pharmacist', v => { form.pharmacist = v.trim(); }); text('pseudoId', v => { form.pseudoId = v.trim(); });
  $('startManual').addEventListener('click', () => { if (identityOk()) { form.entryMode = form.entryMode || 'manual'; stepper.go(2); } });
  $('startAssisted').addEventListener('click', () => { $('assistantPanel').hidden = false; $('clinicalText').focus(); });
  $('analyze').addEventListener('click', () => {
    if (!$('clinicalText').value.trim()) { toast('Pegue primero un texto clínico seudonimizado.', { type: 'warn' }); $('clinicalText').focus(); return; }
    proposals = analyzeText($('clinicalText').value).map(p => ({ ...p, decision: '' }));
    renderProposals(); announce(`${proposals.length} propuestas detectadas.`);
  });
  $('clearText').addEventListener('click', () => { $('clinicalText').value = ''; proposals = []; $('proposals').innerHTML = '<p class="muted">Texto borrado.</p>'; $('applyProposals').hidden = true; });
  $('proposals').addEventListener('change', ev => { const i = ev.target.dataset.proposal; if (i === undefined) return; proposals[i].decision = ev.target.value; ev.target.closest('tr').dataset.state = ev.target.value === 'discard' ? 'discarded' : ev.target.value ? 'accepted' : ''; });
  $('applyProposals').addEventListener('click', applyProposals);

  $('dimensionForms').addEventListener('change', ev => { const id = ev.target.dataset.var; if (!id) return; A.setAnswer(form, id, ev.target.value); changed({ clinical: true }); });
  $('dimensionForms').addEventListener('click', ev => { const d = ev.target.dataset.fillNo; if (d) fillNo(d); });

  const override = () => { const priority = $('overridePriority').value; form.override = priority ? { priority: Number(priority), motive: $('overrideMotive').value, justification: $('overrideJustification').value } : null; changed({ clinical: true }); };
  $('overrideMotive').innerHTML = A.OVERRIDE_MOTIVES.map(m => `<option>${m}</option>`).join('');
  ['overridePriority', 'overrideMotive'].forEach(id => $(id).addEventListener('change', override));
  $('overrideJustification').addEventListener('change', override);
  $('finish').addEventListener('click', finish);

  $('interventionBlocks').addEventListener('change', ev => { const id = ev.target.dataset.intervention; if (!id) return; if (ev.target.value === 'recommended') delete form.interventions[id]; else form.interventions[id] = ev.target.value; changed(); });
  $('goalTemplate').innerHTML = A.GOAL_EXAMPLES.map(g => `<option>${g}</option>`).join('');
  $('goalType').innerHTML = A.GOAL_TYPES.map(g => `<option>${g}</option>`).join('');
  $('goalStatus').innerHTML = A.GOAL_STATUSES.map(g => `<option>${g}</option>`).join('');
  $('addGoal').addEventListener('click', () => { form.goals.push({ objetivo: $('goalTemplate').value, tipo: $('goalType').value, estado: $('goalStatus').value, fecha: $('goalDate').value, comentarios: $('goalComments').value.trim() }); $('goalComments').value = ''; $('goalDate').value = ''; changed(); toast('Objetivo añadido.'); });
  $('goalsTable').addEventListener('click', ev => { const i = ev.target.dataset.removeGoal; if (i === undefined) return; form.goals.splice(Number(i), 1); changed(); });
  $('dualAfChecks').innerHTML = A.DUAL_ITEMS.map(i => `<label><input type="checkbox" value="${i}"> ${i}</label>`).join('');
  $('dualAfChecks').addEventListener('change', () => { form.dual = [...document.querySelectorAll('#dualAfChecks input:checked')].map(c => c.value); changed(); });
  $('previousScore').addEventListener('input', ev => { const n = ev.target.value === '' ? '' : Math.min(MODEL.maxScore, Math.max(0, Math.trunc(Number(ev.target.value)) || 0)); form.followUp.previousScore = n; changed(); });
  $('previousPriority').addEventListener('change', ev => { form.followUp.previousPriority = ev.target.value ? Number(ev.target.value) : ''; changed(); });
  $('objectivesMet').addEventListener('change', ev => { form.followUp.objectivesMet = ev.target.value; changed(); });
  text('followPlan', v => { form.followUp.plan = v; }); text('pharmacistComments', v => { form.comments = v; });
  $('nextReview').addEventListener('change', ev => { form.plan.nextReview = ev.target.value; changed(); });

  $('copyReport').addEventListener('click', async () => { const ok = await copyText($('reportText').value); $('copyStatus').textContent = ok ? 'Informe copiado al portapapeles. Revíselo antes de incorporarlo a la historia clínica.' : 'No se ha podido copiar automáticamente: despliegue «Ver texto para historia clínica» y cópielo manualmente.'; });
  $('downloadPdf').addEventListener('click', () => { download(`${fileBase()}.pdf`, reportToPdf(current.report), 'application/pdf'); toast('PDF generado.'); });
  $('printReport').addEventListener('click', () => printHtml(reportToHtml(current.report), current.report.title));
  $('downloadTxt').addEventListener('click', () => { download(`${fileBase()}.txt`, $('reportText').value); toast('Texto descargado.'); });
  $('downloadJson').addEventListener('click', () => { download(`${fileBase()}.json`, JSON.stringify(envelope(), null, 2), 'application/json'); dirty = false; toast('Datos estructurados exportados (JSON).'); });
  $('downloadCsv').addEventListener('click', () => { download(`${fileBase()}.csv`, toCsv(A.csvRows(form, current.ev)), 'text/csv;charset=utf-8'); toast('Datos estructurados exportados (CSV).'); });
  $('importJson').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async ev => { await importFile(ev.target.files[0]); ev.target.value = ''; });
  $('resetTool').addEventListener('click', resetAll);
  $('newCase').addEventListener('click', resetAll);
}

renderForm();
bind();
const draft = loadDraft();
if (draft) form = draft.form;
fillInputs();
stepper = createStepper({
  nav: $('stepper'), stages: document.querySelectorAll('.cmo-stage'), announce,
  canEnter: n => (n > 1 && !identityOk() ? 'Indique el hospital y el farmacéutico/a responsable para continuar.' : true),
  onEnter: () => saveDraft()
});
refresh();
if (draft && hasData()) { dirty = true; if (form.hospital && form.pharmacist) stepper.go(draft.stage, { focus: false }); toast('Se ha recuperado el borrador de esta sesión.'); }
guardUnsaved(() => dirty);
