# Contrato Mobile - motor fiscal

La aplicacion Mobile no necesita una tabla ni un calculo alterno. Debe consumir
las rutas bajo `/api/tax` con un Firebase ID token vigente:

```http
Authorization: Bearer <firebase-id-token>
Accept: application/json
```

Antes de enviar solicitudes persistentes con `channel=mobile`, debe estar
ejecutado `scripts/tax-estimation-stage-9.sql` en Supabase. Sin esa migracion,
la restriccion de auditoria de etapas previas rechazaria el canal Mobile.

## Flujo recomendado

1. Cargar catalogo: `GET /api/tax/estimation/regimes`.
2. Cargar selector de empresas y tarjeta de resumen:
   `GET /api/tax/estimation?period=YYYY-MM&persist=false`.
3. Al actualizar una estimacion intencionalmente, usar:
   `GET /api/tax/estimation?period=YYYY-MM&companyId=<uuid>&channel=mobile`.
4. Cargar detalle y filtros con:
   `GET /api/tax/estimation/report?...`.
5. Consultar auditoria con:
   `GET /api/tax/estimation/history?limit=25` y detalle por `id`.
6. Consultar y marcar avisos con `/api/notifications`.

## Campos que debe conservar Mobile

En una estimacion por empresa:

- `companyId`, `companyName`, `regimeSatCode`, `regimeName`.
- `incomes`, `expenses`, `deductibleExpenses`, `base`.
- `vatTransferred`, `vatCreditable`, `vatEstimated`.
- `isrRate`, `isrDetermined`, `isrWithheld`, `isrEstimated`, `taxEstimated`.
- `estimationAvailable`, `warnings`, `validationMessages`.

Para trazabilidad usar `traceId`, `ruleVersion`, `movementTrace` y el detalle
del historial. El cliente no debe recalcular importes: la fuente de verdad es
el motor de Next.js.

## Reglas de manejo de errores

- `401 AUTH_REQUIRED`: renovar sesion Firebase e intentar de nuevo.
- `403 ACCESS_DENIED`: retirar la empresa de la vista actual y mostrar que no
  esta autorizada.
- `400 INVALID_REQUEST`: corregir parametros, especialmente `period` o UUID.
- `500 DATABASE_ERROR`: conservar la ultima vista valida y ofrecer reintento.
