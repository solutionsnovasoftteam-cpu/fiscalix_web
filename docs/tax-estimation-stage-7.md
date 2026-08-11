# Fiscalix - Etapa 7: trazabilidad

La Etapa 7 vuelve auditable la estimacion fiscal RESICO de la Etapa 6. Cada
ejecucion guarda quien la solicito, cuando se genero, el periodo, empresa
filtrada, formula aplicada, version de reglas, variables usadas, resultado y
movimientos considerados o excluidos.

## Migracion

Ejecutar en Supabase:

```sql
scripts/tax-estimation-stage-7.sql
```

La migracion crea:

- `public.reglas_fiscales_versiones`: versiona la regla fiscal aplicada.
- `public.estimaciones_fiscales_ejecuciones`: cabecera auditable de cada calculo.
- `public.estimaciones_fiscales_movimientos`: movimientos asociados a cada ejecucion.

La regla inicial es `RESICO_MX_PF_MONTHLY_V1` version `1.0.0`, regimen SAT `626`.

## Persistencia

El guardado ocurre desde `src/lib/taxEstimation.ts` al generar una estimacion:

- Web registra `canal = web`.
- API/Mobile registra `canal = api`.
- Si las tablas de trazabilidad aun no existen, el calculo sigue funcionando y se
  devuelve un aviso para ejecutar la migracion.

## API

Calculo con trazabilidad:

```http
GET /api/tax/estimation?period=2026-08
GET /api/tax/estimation?period=2026-08&companyId=<uuid>
```

La respuesta incluye:

```json
{
  "ok": true,
  "data": {
    "traceId": "<uuid>",
    "traceError": null,
    "estimation": {
      "ruleVersion": {
        "code": "RESICO_MX_PF_MONTHLY_V1",
        "version": "1.0.0"
      },
      "movementTrace": []
    }
  }
}
```

Historial:

```http
GET /api/tax/estimation/history?limit=8
GET /api/tax/estimation/history?id=<uuid>
```

## Pantalla Web

`/taxes` muestra:

- Version de reglas aplicada.
- Identificador corto de la ejecucion auditada.
- Aviso si la trazabilidad no esta activa.
- Historial de ejecuciones con fecha, periodo, importes, movimientos auditados y canal.

## Consultas de verificacion

Ultimas ejecuciones:

```sql
select id, usuario_id, periodo_clave, canal, regla_clave, regla_version,
       total_ingresos, base_fiscal, iva_estimado, isr_estimado,
       impuesto_estimado, movimientos_total, movimientos_considerados,
       movimientos_excluidos, created_at
from public.estimaciones_fiscales_ejecuciones
order by created_at desc
limit 10;
```

Movimientos de una ejecucion:

```sql
select movimiento_id, tipo, estado, considerado, razon_exclusion,
       monto, base_fiscal, iva_monto, isr_retenido_monto, deducible
from public.estimaciones_fiscales_movimientos
where ejecucion_id = '<uuid>'
order by fecha_movimiento;
```

Version de reglas:

```sql
select clave, version, regimen_clave_sat, formula, variables, activo
from public.reglas_fiscales_versiones
where clave = 'RESICO_MX_PF_MONTHLY_V1';
```

## Criterios de aprobacion

- `npm run lint` pasa.
- `npx tsc --noEmit --pretty false` pasa.
- `npm run build` pasa.
- Al entrar a `/taxes?period=2026-08`, se crea una fila en
  `estimaciones_fiscales_ejecuciones`.
- La fila guarda `usuario_id`, `periodo_clave`, `canal`, `regla_clave`,
  `regla_version`, `formula_aplicada`, `variables` y `resultado`.
- La cantidad de filas en `estimaciones_fiscales_movimientos` para esa ejecucion
  coincide con `movimientos_total`.
- Movimientos cobrados/pagados activos aparecen como `considerado = true`.
- Movimientos pendientes, cancelados o fuera de RESICO aparecen con
  `considerado = false` y `razon_exclusion`.
- `GET /api/tax/estimation/history` devuelve las ejecuciones del usuario actual.
- `GET /api/tax/estimation/history?id=<uuid>` devuelve la ejecucion y sus
  movimientos.
