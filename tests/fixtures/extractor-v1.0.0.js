// Copia congelada del analizador de texto de CMO-EM Pro 1.0.0 (assets/js/app.js: extractionRules y analyzeClinicalText),
// sin la parte de DOM. Solo es referencia comparativa en las pruebas: no se usa en la aplicación.
const extractionRules=[
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
export function legacyAnalyze(raw) {
  const text=(raw||'').toLowerCase(); const suggestions=[]; extractionRules.forEach(rule=>{ if(rule.patterns.some(p=>text.includes(p))) suggestions.push({id:rule.id}); }); const relapses=text.match(/(\d+)\s*(brotes|brote|lesiones)/); if(relapses){ const n=Number(relapses[1]); suggestions.push({id:'relapses_mri',value:n>2?'3':String(n)}); } if(text.includes('efectos adversos graves')) suggestions.push({id:'adverse_events',value:'3'}); else if(text.includes('efectos adversos leves')||text.includes('efectos adversos moderados')) suggestions.push({id:'adverse_events',value:'1'}); if(text.includes('cambio por ineficacia')||text.includes('cambio por seguridad')) suggestions.push({id:'treatment_changes',value:'3'}); else if(text.includes('cambio por preferencia')||text.includes('cambio por tolerancia')) suggestions.push({id:'treatment_changes',value:'1'}); return [...new Map(suggestions.map(s=>[s.id,s])).values()];
}
