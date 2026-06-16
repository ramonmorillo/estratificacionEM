export const CMO_EM_MODEL = {
  maxScore: 52,
  automaticCriterionId: 'pregnancy',
  thresholds: { priority1: 18, priority2Min: 11, priority2Max: 17, priority3Max: 10 },
  dimensions: [
    { id: 'demographic', title: 'Dimensión demográfica', max: 6, letter: 'A' },
    { id: 'clinical', title: 'Dimensión clínica', max: 22, letter: 'B' },
    { id: 'treatment', title: 'Dimensión tratamiento', max: 17, letter: 'C' },
    { id: 'social', title: 'Dimensión sociosanitaria', max: 7, letter: 'D' }
  ],
  variables: [
    { id: 'pregnancy', dimension: 'demographic', type: 'checkbox', label: 'Embarazo/lactancia/deseo gestacional inminente', description: 'Paciente embarazada, en lactancia o con deseo gestacional inminente en el próximo año.', points: 0, automaticPriority: 1, help: 'No suma puntos, pero clasifica automáticamente como Prioridad 1.' },
    { id: 'age_under_16', dimension: 'demographic', type: 'checkbox', label: 'Edad inferior a 16 años', description: 'Paciente menor de 16 años.', points: 3, mutex: 'current_age' },
    { id: 'age_over_65', dimension: 'demographic', type: 'checkbox', label: 'Edad superior a 65 años', description: 'Paciente mayor de 65 años.', points: 1, mutex: 'current_age' },
    { id: 'onset_under_20', dimension: 'demographic', type: 'checkbox', label: 'Edad de debut inferior a 20 años', description: 'Debut de la enfermedad antes de los 20 años.', points: 1, mutex: 'onset_age' },
    { id: 'onset_over_40', dimension: 'demographic', type: 'checkbox', label: 'Edad de debut superior a 40 años', description: 'Debut de la enfermedad después de los 40 años.', points: 1, mutex: 'onset_age' },
    { id: 'male', dimension: 'demographic', type: 'checkbox', label: 'Sexo varón', description: 'Sexo masculino.', points: 1 },
    { id: 'non_caucasian', dimension: 'demographic', type: 'checkbox', label: 'Etnia no caucásica', description: 'Etnia no caucásica.', points: 1 },
    { id: 'progressive_ms', dimension: 'clinical', type: 'checkbox', label: 'EM primaria progresiva o secundaria progresiva', description: 'Fenotipo de esclerosis múltiple primaria progresiva o secundaria progresiva.', points: 2 },
    { id: 'diagnosis_over_20y', dimension: 'clinical', type: 'checkbox', label: 'Más de 20 años de evolución desde el diagnóstico', description: 'Tiempo desde diagnóstico superior a 20 años.', points: 2 },
    { id: 'delay_treatment_over_2y', dimension: 'clinical', type: 'checkbox', label: 'Más de 2 años entre síntomas e inicio de tratamiento', description: 'Demora terapéutica mayor de 2 años.', points: 2 },
    { id: 'relapses_mri', dimension: 'clinical', type: 'select', label: 'Tasa anual de brotes o nuevas lesiones en RM', description: 'Actividad clínica o radiológica durante el último año.', options: [{value:'0',label:'0 brotes/nuevas lesiones',points:0},{value:'1',label:'1 brote clínico y/o nuevas lesiones en RM',points:1},{value:'2',label:'2 brotes clínicos y/o nuevas lesiones en RM',points:2},{value:'3',label:'Más de 2 brotes clínicos y/o nuevas lesiones en RM',points:3}] },
    { id: 'functional_decline', dimension: 'clinical', type: 'checkbox', label: 'Deterioro funcional', description: 'Aumento de al menos 1 punto en EDSS en el último año.', points: 2 },
    { id: 'cognitive_decline', dimension: 'clinical', type: 'checkbox', label: 'Deterioro cognitivo', description: 'Empeoramiento cognitivo en historia clínica en el último año.', points: 2 },
    { id: 'neuro_psych_comorbidity', dimension: 'clinical', type: 'checkbox', label: 'Comorbilidades neurológicas o psiquiátricas', description: 'Ansiedad, depresión, trastornos psicóticos o epilepsia.', points: 1 },
    { id: 'non_neuro_comorbidity', dimension: 'clinical', type: 'checkbox', label: 'Comorbilidades no neurológicas/no psiquiátricas', description: 'Cardiovasculares, gastrointestinales, pulmonares, autoinmunes, endocrinas u otras.', points: 1 },
    { id: 'active_oncohematologic', dimension: 'clinical', type: 'checkbox', label: 'Comorbilidad oncohematológica activa', description: 'Proceso oncohematológico activo.', points: 2 },
    { id: 'multimorbidity', dimension: 'clinical', type: 'checkbox', label: 'Pluripatología', description: 'Presencia de 2 o más comorbilidades.', points: 2 },
    { id: 'disease_evolution', dimension: 'clinical', type: 'select', label: 'Indicadores de evolución de la enfermedad', description: 'Empeoramiento de control de esfínteres, espasticidad o fatiga.', options: [{value:'0',label:'Sin empeoramiento',points:0},{value:'1',label:'Empeoramiento en una situación',points:1},{value:'2',label:'Empeoramiento en dos situaciones',points:2},{value:'3',label:'Empeoramiento en las tres situaciones',points:3}] },
    { id: 'immune_footprint_prior', dimension: 'treatment', type: 'checkbox', label: 'Tratamiento previo con importante huella inmunológica', description: 'Uso previo de fármacos con huella inmunológica relevante.', points: 1, help: 'Terapias de reconstitución inmune como cladribina, alemtuzumab, trasplante de progenitores hematopoyéticos, o anti-CD20 como ocrelizumab, ofatumumab, ublituximab, rituximab.' },
    { id: 'current_immunosuppressants', dimension: 'treatment', type: 'checkbox', label: 'Tratamiento actual con inmunosupresores', description: 'Tratamiento actual con inmunosupresores o inmunomoduladores de alto impacto.', points: 2, help: 'Teriflunomida, cladribina, moduladores S1P; natalizumab; alemtuzumab; anti-CD20 como ocrelizumab, ofatumumab, ublituximab, rituximab.' },
    { id: 'adverse_events', dimension: 'treatment', type: 'select', label: 'Efectos adversos', description: 'Intensidad de efectos adversos asociados al tratamiento.', help: 'Leves: tolerables y transitorios. Moderados: interfieren en actividades diarias. Graves: interrumpen actividades normales, requieren intervención o pueden ser incapacitantes.', options: [{value:'0',label:'Ninguno',points:0},{value:'1',label:'Leves o moderados',points:1},{value:'3',label:'Graves',points:3}] },
    { id: 'non_adherence', dimension: 'treatment', type: 'checkbox', label: 'Falta de adherencia', description: 'Sospecha de adherencia subóptima.', points: 3 },
    { id: 'polypharmacy', dimension: 'treatment', type: 'checkbox', label: 'Polimedicación', description: 'Más de 5 medicamentos crónicos.', points: 1 },
    { id: 'high_risk_meds', dimension: 'treatment', type: 'checkbox', label: 'Medicamentos de alto riesgo', description: 'Medicamento incluido en listado ISMP-España de alto riesgo en crónicos.', points: 4 },
    { id: 'treatment_changes', dimension: 'treatment', type: 'select', label: 'Cambios de tratamiento durante el último año', description: 'Motivo del cambio de tratamiento modificador.', options: [{value:'0',label:'Sin cambios',points:0},{value:'1',label:'Cambio por preferencia o tolerancia',points:1},{value:'3',label:'Cambio por ineficacia o seguridad',points:3}] },
    { id: 'smoking', dimension: 'social', type: 'checkbox', label: 'Hábito tabáquico', description: 'Fumador activo.', points: 2 },
    { id: 'socioeconomic', dimension: 'social', type: 'checkbox', label: 'Nivel socioeconómico desfavorable', description: 'Situación social o económica que puede comprometer tratamiento o hábitos saludables.', points: 3, help: 'Sinhogarismo, aislamiento social, ausencia de apoyo familiar, dependencia funcional, inestabilidad financiera u otras situaciones relevantes.' },
    { id: 'training_barrier', dimension: 'social', type: 'checkbox', label: 'Formación del paciente', description: 'Dificultades para asimilar pautas por alfabetización, formación o barrera idiomática.', points: 2 }
  ],
  messages: {
    1: 'Paciente de alta complejidad o alta prioridad farmacéutica. Requiere seguimiento farmacoterapéutico intensivo, coordinación multidisciplinar estrecha, revisión periódica de objetivos farmacoterapéuticos, monitorización de seguridad, adherencia, PROM/PREM y planificación individualizada de visitas.',
    2: 'Paciente de complejidad intermedia. Requiere seguimiento farmacoterapéutico estructurado, refuerzo de adherencia, educación específica, revisión de medicación concomitante, detección de problemas de seguridad y coordinación asistencial según necesidades.',
    3: 'Paciente de menor complejidad relativa. Requiere seguimiento farmacoterapéutico habitual, educación sanitaria, validación de tratamiento, revisión de adherencia y promoción de hábitos de vida saludables, con posibilidad de AF dual según competencias y preferencias.'
  }
};
export const INTERVENTIONS = {
  3: { seguimiento: ['Evaluar y validar el tratamiento para asegurar adecuación, seguridad y efectividad.','Supervisar adherencia y proponer estrategias de mejora.','Revisar medicación concomitante, fitoterapia, interacciones y efectos adversos.','Monitorizar PROM y PREM cuando estén disponibles.','Mantener contacto adicional entre visitas cuando sea necesario mediante teleasistencia.'], educacion: ['Proporcionar información clara sobre enfermedad, tratamiento, adherencia y asociaciones de pacientes.','Ofrecer materiales educativos escritos o digitales.','Promover hábitos de vida saludables y uso correcto de medicamentos.'], coordinacion: ['Documentar intervenciones en historia clínica.','Promover comunicación bidireccional con el equipo asistencial.','Favorecer programas de seguimiento farmacoterapéutico personalizados.'] },
  2: { seguimiento: ['Asegurar conciliación de medicación en transiciones asistenciales, ingresos o altas.','Intensificar seguimiento de adherencia, seguridad y tolerancia.','Programar contactos intermedios o telemáticos según necesidad.'], educacion: ['Proporcionar educación específica a familiares o cuidadores cuando proceda.','Establecer estrategias de autocuidado y autonomía.'], coordinacion: [] },
  1: { seguimiento: ['Crear planes específicos para abordar reacciones adversas o problemas graves de seguridad.','Replantear objetivos farmacoterapéuticos si no se cumplen.','Planificar visitas de alta intensidad y seguimiento estrecho.'], educacion: ['Desarrollar programas específicos para detección, prevención o control de factores de riesgo.','Ofrecer educación sanitaria intensiva.'], coordinacion: ['Activar vías rápidas de comunicación con neurología, enfermería, hospital de día u otros niveles asistenciales.','Recomendar comunicación multidisciplinar explícita cuando existan señales de alarma.'] }
};
export function calculatePriority(state, model = CMO_EM_MODEL) {
  const dimensionScores = Object.fromEntries(model.dimensions.map(d => [d.id, 0]));
  const activeVariables = [];
  const selectedByMutex = new Map();
  for (const variable of model.variables) {
    let points = 0, active = false, selectedLabel = '';
    if (variable.type === 'checkbox') active = !!state[variable.id];
    if (variable.type === 'select') {
      const selected = variable.options.find(o => String(o.value) === String(state[variable.id] ?? '0')) || variable.options[0];
      points = selected.points; active = points > 0; selectedLabel = selected.label;
    } else points = variable.points || 0;
    if (active && variable.mutex) {
      const current = selectedByMutex.get(variable.mutex);
      if (current) throw new Error(`Variables mutuamente excluyentes activas: ${current} y ${variable.id}`);
      selectedByMutex.set(variable.mutex, variable.id);
    }
    if (active) { dimensionScores[variable.dimension] += points; activeVariables.push({ id: variable.id, label: variable.label, points, dimension: variable.dimension, detail: selectedLabel }); }
  }
  const total = Object.values(dimensionScores).reduce((a,b)=>a+b,0);
  const automatic = !!state[model.automaticCriterionId];
  const priority = automatic || total >= model.thresholds.priority1 ? 1 : total >= model.thresholds.priority2Min ? 2 : 3;
  const explanation = automatic ? 'Prioridad 1 por criterio automático: embarazo/lactancia/deseo gestacional' : model.messages[priority];
  return { total, dimensionScores, priority, explanation, activeVariables, automatic };
}
export function getInterventions(priority) {
  const levels = priority === 1 ? [3,2,1] : priority === 2 ? [3,2] : [3];
  return ['seguimiento','educacion','coordinacion'].reduce((acc, block) => ({...acc, [block]: levels.flatMap(level => INTERVENTIONS[level][block])}), {});
}
