# Fiscalix - Etapa 8: expansion progresiva

La Etapa 8 amplía el motor fiscal por régimen. RESICO se conserva como cálculo
base aprobado, Actividades empresariales/profesionales queda con ISR acumulado, y
los demás grupos ya tienen cálculo automático V1 con advertencias cuando el
movimiento normalizado aún no contiene todo el detalle fiscal fino.

## Alcance implementado

- RESICO conserva el cálculo aprobado en Etapas 6 y 7.
- Actividades empresariales y profesionales calcula ISR acumulado del ejercicio
  con tarifa Art. 106 e IVA mensual.
- Arrendamiento calcula ISR mensual con tarifa Art. 106; si no hay deducciones
  registradas usa la opción 35% como estimación limitada.
- Plataformas tecnológicas calcula ISR base 1%, resta retenciones registradas y
  estima IVA mensual.
- Sueldos, intereses y dividendos calculan por subrégimen:
  sueldos con tarifa mensual, intereses con retenciones capturadas y dividendos
  con retención adicional 10%.
- Eventos fiscales especiales calculan por subrégimen con tasas base: premios
  1%, enajenación/demás ingresos 20%, residentes en el extranjero con retención
  capturada.
- `/api/tax/estimation` y `/taxes` usan la misma fórmula centralizada.
- La trazabilidad de Etapa 7 guarda fórmula, variables, versión de regla,
  movimientos considerados/excluidos y catálogo aplicado.

## Regímenes

| Orden | Grupo | Claves SAT | Estado |
| ---: | --- | --- | --- |
| 1 | RESICO | 626 | Habilitado |
| 2 | Actividades empresariales y profesionales | 612 | Habilitado |
| 3 | Arrendamiento | 606 | Habilitado limitado |
| 4 | Plataformas tecnológicas | 625 | Habilitado limitado |
| 5 | Sueldos, intereses y dividendos | 605, 611, 614 | Habilitado limitado |
| 6 | Eventos fiscales especiales | 607, 608, 610, 615 | Habilitado limitado |

## Fórmulas nuevas

Actividades empresariales/profesionales:

```text
base_acumulada = ingresos_cobrados_acumulados - gastos_deducibles_pagados_acumulados
isr_determinado = tarifa_articulo_106_2026(base_acumulada, mes)
isr_estimado = max(0, isr_determinado - isr_retenido)
iva_estimado = max(0, iva_trasladado_periodo - iva_acreditable_periodo)
```

Arrendamiento:

```text
deduccion_aplicable = deducciones_registradas || ingresos * 35%
base = ingresos - deduccion_aplicable
isr_estimado = max(0, tarifa_articulo_106_2026(base, 1) - isr_retenido)
iva_estimado = max(0, iva_trasladado - iva_acreditable)
```

Plataformas tecnológicas:

```text
isr_estimado = max(0, ingresos * 1% - isr_retenido)
iva_estimado = max(0, iva_trasladado - iva_acreditable)
```

Sueldos, intereses y dividendos:

```text
sueldos = max(0, tarifa_articulo_96_mensual(ingresos) - isr_retenido)
intereses = max(0, retenciones_registradas - isr_retenido)
dividendos = max(0, dividendos * 10% - isr_retenido)
```

Eventos fiscales especiales:

```text
premios = max(0, ingresos * 1% - isr_retenido)
enajenacion_o_demas_ingresos = max(0, ingresos * 20% - isr_retenido)
residentes_extranjero = max(0, retenciones_registradas - isr_retenido)
```

## Supabase

Ejecutar:

```sql
scripts/tax-estimation-stage-8.sql
```

El script actualiza `public.reglas_fiscales_versiones`:

- Activa las reglas V1 de los seis grupos.
- Marca los borradores `DRAFT_V0` como `replaced_by_v1`.
- Guarda `formula`, `variables.status`, `requiredData`, `validations` y
  `testCaseFile`.

Consulta de verificación:

```sql
select clave, version, regimen_clave_sat, nombre, activo, variables->>'status' as status
from public.reglas_fiscales_versiones
where fuente = 'Fiscalix Etapa 8'
order by nombre, version;
```

## APIs

Estimación:

```http
GET /api/tax/estimation?period=2026-08
GET /api/tax/estimation?period=2026-08&companyId=<uuid>
```

Historial:

```http
GET /api/tax/estimation/history?limit=8
GET /api/tax/estimation/history?id=<executionId>
```

Catálogo de regímenes:

```http
GET /api/tax/estimation/regimes
```

## Criterios de aprobación

- `npm run lint` pasa.
- `npx tsc --noEmit --pretty false` pasa.
- `npm run build` pasa.
- Supabase contiene las seis reglas V1 activas.
- `/api/tax/estimation/regimes` devuelve los seis grupos en `enabledRegimes`.
- Cada empresa calcula con la regla que corresponde a su `clave_sat`.
- Los movimientos cancelados, pendientes o inactivos quedan excluidos.
- Las estimaciones limitadas devuelven `warnings` y `validationMessages`.
- La ejecución guardada permite auditar fórmula, variables y movimientos.

## Fuentes consultadas

- SAT, declaración de actividades empresariales, servicios profesionales,
  arrendamiento e IVA:
  `https://wwwmatnp.sat.gob.mx/declaracion/33006/presenta-tu-declaracion-de-actividades-empresariales-y-servicios-profesionales%2C-arrendamiento-e-iva%2C-personas-fisicas-de-2025-en-adelante-%28simulador%29`
- SAT, Artículo 106 LISR:
  `https://wwwmatnp.sat.gob.mx/articulo/36658/articulo-106`
- SAT, Artículo 116 LISR:
  `https://wwwmatnp.sat.gob.mx/articulo/53508/articulo-116`
- SAT, Artículo 113-A LISR:
  `https://wwwmat.sat.gob.mx/articulo/05058/articulo-113-a`
- SAT, Artículo 96 LISR:
  `https://wwwmat.sat.gob.mx/cs/Satellite?c=Articulo&childpagename=SatTyR%2FArticulo%2FSAT_LandingArticulo&cid=1462228636534&packedargs=d%3DTouch&pagename=TySWrapper`
- SAT, Artículo 135 LISR:
  `https://wwwmatnp.sat.gob.mx/articulo/89366/articulo-135`
- SAT, Artículo 140 LISR:
  `https://wwwmat.sat.gob.mx/articulo/32450/articulo-140`
- SAT, Artículo 126 LISR:
  `https://wwwmat.sat.gob.mx/articulo/18353/articulo-126`
- SAT, Artículo 138 LISR:
  `https://wwwmatnp.sat.gob.mx/articulo/38032/articulo-138`
- SAT, Normatividad RMF 2026 y anexos:
  `https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html`
