-- Fiscalix - Etapa 8: expansion progresiva de regimenes fiscales.
-- Ejecutar despues de scripts/tax-estimation-stage-7.sql.
-- Activa calculos automaticos V1 para los grupos fiscales cubiertos por el motor.

begin;

insert into public.reglas_fiscales_versiones (
  clave,
  version,
  regimen_clave_sat,
  nombre,
  descripcion,
  formula,
  variables,
  fuente,
  activo
) values
(
  'RESICO_MX_PF_MONTHLY_V1',
  '1.0.0',
  '626',
  'Régimen Simplificado de Confianza',
  'ISR RESICO mensual + IVA trasladado menos acreditable sobre movimientos normalizados.',
  '{
    "baseResico": "sum(ingresos.cobrados.base_fiscal)",
    "isrDetermined": "baseResico * tasaResicoMensual",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "vatEstimated": "max(0, ivaTrasladado - ivaAcreditable)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "movimientos_fiscales_normalizados",
      "ingresos cobrados",
      "gastos pagados deducibles para IVA",
      "retenciones ISR registradas"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 626",
      "periodo mensual YYYY-MM",
      "movimientos activos del periodo"
    ],
    "testCaseFile": "docs/tax-estimation-stage-6-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
),
(
  'ACTIVIDADES_EMP_PROF_MX_PF_MONTHLY_V1',
  '1.0.0',
  '612',
  'Actividades empresariales y profesionales',
  'ISR provisional por tarifa Art. 106 con base acumulada e IVA mensual estimado.',
  '{
    "isrBase": "ingresos_cobrados_acumulados - deducciones_autorizadas_acumuladas",
    "isrDetermined": "tarifa_articulo_106(base_acumulada, mes)",
    "isrEstimated": "max(0, isrDetermined - isrRetenido - pagosProvisionalesPrevios)",
    "vatEstimated": "max(0, ivaTrasladadoPeriodo - ivaAcreditablePeriodo)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "ingresos cobrados acumulados del ejercicio",
      "gastos pagados deducibles acumulados",
      "retenciones ISR registradas",
      "IVA acreditable validado"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 612",
      "periodo mensual YYYY-MM",
      "pagos provisionales previos no descontados hasta habilitar tabla de pagos"
    ],
    "testCaseFile": "docs/tax-estimation-stage-8-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
),
(
  'ARRENDAMIENTO_MX_PF_MONTHLY_V1',
  '1.0.0',
  '606',
  'Arrendamiento',
  'ISR provisional por tarifa Art. 106 con deducciones registradas u opcion 35% e IVA mensual estimado.',
  '{
    "deductionUsed": "deducciones_registradas || ingresos_arrendamiento * 35%",
    "isrBase": "ingresos_arrendamiento - deduccion_aplicable",
    "isrDetermined": "tarifa_articulo_106(base_mensual, 1)",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "vatEstimated": "max(0, ivaTrasladado - ivaAcreditable)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "ingresos cobrados de arrendamiento",
      "deducciones pagadas o deduccion opcional 35%",
      "retenciones por arrendatario",
      "IVA acreditable validado"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 606",
      "periodo mensual YYYY-MM",
      "si no hay deducciones registradas usa deduccion opcional 35%",
      "no distingue todavia arrendamiento exento de IVA por casa habitacion"
    ],
    "testCaseFile": "docs/tax-estimation-stage-8-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
),
(
  'PLATAFORMAS_TEC_MX_PF_MONTHLY_V1',
  '1.0.0',
  '625',
  'Plataformas tecnológicas',
  'ISR estimado con tasa base 1% y acreditamiento de retenciones; IVA mensual estimado.',
  '{
    "isrDetermined": "ingresos_plataformas * tasa_default_1%",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "vatEstimated": "max(0, ivaTrasladado - ivaAcreditable)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "ingresos cobrados por plataforma",
      "retenciones ISR registradas",
      "IVA trasladado y acreditable",
      "tipo de servicio para tasas finas"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 625",
      "periodo mensual YYYY-MM",
      "tasa ISR base 1% hasta capturar tipo de servicio",
      "requiere distinguir pago definitivo vs provisional en una etapa posterior"
    ],
    "testCaseFile": "docs/tax-estimation-stage-8-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
),
(
  'SUELDOS_INTERESES_DIVIDENDOS_MX_PF_V1',
  '1.0.0',
  '605,611,614',
  'Sueldos, intereses y dividendos',
  'Cálculo automático limitado por subrégimen con retenciones capturadas.',
  '{
    "wagesIsr": "tarifa_articulo_96(ingresos_sueldos_mensuales)",
    "interestIsr": "retenciones_intereses_registradas",
    "dividendIsr": "dividendos * 10%",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "taxEstimated": "isrEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "ingresos cobrados por subregimen",
      "retenciones informadas",
      "constancias de retencion para conciliacion",
      "tratamiento anual o definitivo cuando aplique"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 605, 611 o 614",
      "periodo mensual YYYY-MM",
      "requiere constancias para conciliacion final",
      "intereses se estiman con retencion capturada hasta capturar capital o tasa LIF"
    ],
    "testCaseFile": "docs/tax-estimation-stage-8-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
),
(
  'EVENTOS_FISCALES_ESPECIALES_MX_PF_V1',
  '1.0.0',
  '607,608,610,615',
  'Eventos fiscales especiales',
  'Cálculo automático limitado para premios, enajenación/demás ingresos y retenciones de residentes en el extranjero.',
  '{
    "prizeIsr": "premios * 1%",
    "transferOrOtherIsr": "importe_evento * 20%",
    "foreignResidentIsr": "retenciones_registradas",
    "isrEstimated": "max(0, isrDetermined - isrRetenido)",
    "vatEstimated": "max(0, ivaTrasladado - ivaAcreditable)",
    "taxEstimated": "isrEstimated + vatEstimated"
  }'::jsonb,
  '{
    "status": "enabled",
    "requiredData": [
      "tipo de evento",
      "fecha de causacion",
      "costo o deduccion autorizada",
      "retenciones del evento"
    ],
    "validations": [
      "perfil fiscal activo",
      "regimen SAT 607, 608, 610 o 615",
      "periodo mensual YYYY-MM",
      "usa tasa base por subregimen hasta capturar tipo de evento especifico",
      "requiere revision profesional para inmuebles, costo comprobado y residentes en el extranjero"
    ],
    "testCaseFile": "docs/tax-estimation-stage-8-cases.json"
  }'::jsonb,
  'Fiscalix Etapa 8',
  true
)
on conflict (clave) do update set
  version = excluded.version,
  regimen_clave_sat = excluded.regimen_clave_sat,
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  formula = excluded.formula,
  variables = excluded.variables,
  fuente = excluded.fuente,
  activo = excluded.activo,
  updated_at = now();

update public.reglas_fiscales_versiones
set activo = false,
    variables = jsonb_set(coalesce(variables, '{}'::jsonb), '{status}', '"replaced_by_v1"'::jsonb, true),
    updated_at = now()
where clave in (
  'ARRENDAMIENTO_MX_PF_MONTHLY_DRAFT_V0',
  'PLATAFORMAS_TEC_MX_PF_MONTHLY_DRAFT_V0',
  'SUELDOS_INTERESES_DIVIDENDOS_MX_PF_DRAFT_V0',
  'EVENTOS_FISCALES_ESPECIALES_MX_PF_DRAFT_V0'
);

notify pgrst, 'reload schema';

commit;
