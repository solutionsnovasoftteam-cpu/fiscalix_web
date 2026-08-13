# Fiscalix - Etapa 9: integracion final

La Etapa 9 conecta el motor fiscal de las etapas 5 a 8 con Dashboard,
Reportes, recordatorios y una capa de API apta para la aplicacion Mobile.
La estimacion sigue siendo informativa y conserva el control de acceso por
usuario y empresa.

## Alcance

- Dashboard muestra un resumen fiscal del periodo vigente, desglosado por
  empresa y regimen, sin guardar una nueva ejecucion.
- Reportes agrega filtros de periodo, empresa, regimen, estado, historial y
  movimientos considerados/excluidos.
- Las notificaciones automaticas cubren estimacion pendiente o generada,
  pago provisional proximo, datos fiscales incompletos y movimientos excluidos.
- Las APIs de estimacion, reporte, historial y notificaciones admiten sesion
  Web o `Authorization: Bearer <firebase-id-token>` para Mobile.
- Mobile puede distinguir sus propias ejecuciones con `channel=mobile`.

## Rutas Web

- `/dashboard`: resumen financiero y fiscal por empresa/regimen.
- `/reports`: desglose fiscal actual, traza de movimientos e historial.
- `/taxes`: estimacion detallada y ejecuciones auditadas.

## APIs para Mobile

Todas usan el sobre de respuesta existente:

```json
{ "ok": true, "data": {} }
```

Errores:

```json
{ "ok": false, "error": { "code": "ACCESS_DENIED", "message": "..." } }
```

### Estimacion

```http
GET /api/tax/estimation?period=2026-08&companyId=<uuid>&channel=mobile
Authorization: Bearer <firebase-id-token>
```

- `period`: opcional, formato `YYYY-MM`.
- `companyId`: opcional; debe pertenecer al usuario autenticado.
- `channel=mobile`: registra `canal = mobile` al persistir una ejecucion.
- `persist=false`: previsualiza el calculo sin crear una ejecucion auditada.

La respuesta incluye empresas disponibles, empresa seleccionada, estimacion,
traza de movimientos, `traceId` y `traceError`.

### Reporte fiscal

```http
GET /api/tax/estimation/report?period=2026-08&companyId=<uuid>&regime=612&status=estimated&movement=considered&history=period
Authorization: Bearer <firebase-id-token>
```

Filtros admitidos:

- `period`: `YYYY-MM`.
- `companyId`: UUID de una empresa autorizada.
- `regime`: clave SAT habilitada, por ejemplo `626`, `612`, `606`, `625`,
  `605`, `611`, `614`, `607`, `608`, `610` o `615`.
- `status`: `all`, `estimated`, `limited`, `review`.
- `movement`: `all`, `considered`, `excluded`.
- `history`: `period`, `all`.

La respuesta devuelve `report.rows`, `report.movementTrace`, `report.history`,
totales y las empresas disponibles. El reporte es una consulta (`persist=false`)
y por lo tanto no agrega filas al historial.

### Historial y detalle

```http
GET /api/tax/estimation/history?limit=25
GET /api/tax/estimation/history?id=<executionId>
Authorization: Bearer <firebase-id-token>
```

La consulta por `id` solo devuelve una ejecucion cuyo `usuario_id` coincida con
el usuario autenticado. Incluye formula, variables, parametros, resultado y
movimientos guardados.

### Regimenes y notificaciones

```http
GET /api/tax/estimation/regimes
GET /api/notifications
PATCH /api/notifications
PATCH /api/notifications/<notificationId>
Authorization: Bearer <firebase-id-token>
```

`GET /api/notifications` tambien sincroniza recordatorios fiscales antes de
devolver las notificaciones del usuario autenticado. `PATCH` sin identificador
marca todas como leidas; el endpoint con identificador solo permite modificar
una notificacion propia.

## Supabase y permisos

Antes de habilitar persistencia desde Mobile se debe ejecutar
`scripts/tax-estimation-stage-9.sql` en el SQL Editor de Supabase. La
migracion permite `canal = mobile` en las ejecuciones auditadas y agrega un
indice para las consultas por usuario, periodo y canal.

Deben existir las tablas de etapas previas:

- `movimientos_fiscales_normalizados`.
- `empresa_fiscal` y `regimenes_fiscales`.
- `reglas_fiscales_versiones`.
- `estimaciones_fiscales_ejecuciones` y `estimaciones_fiscales_movimientos`.
- `notificaciones`.

El acceso de aplicacion no acepta una empresa arbitraria: usa
`getAccessibleCompanies` antes de consultar movimientos, perfiles o historial.
RLS debe conservar el mismo limite en las consultas directas de Supabase.

## Criterios de aprobacion

- Dashboard y Reports muestran solo empresas autorizadas.
- El filtro de empresa no permite consultar una empresa ajena: API responde
  `403 ACCESS_DENIED`.
- Los filtros cambian filas, traza e historial de forma consistente.
- Cancelados, pendientes e inactivos quedan como excluidos con una razon.
- La consulta de Dashboard o Reportes no crea ejecuciones nuevas.
- La estimacion persistida desde Web, API y Mobile conserva el canal correcto y
  devuelve el mismo resultado para los mismos datos, periodo y empresa.
- La migracion de Etapa 9 se ejecuto y una solicitud autenticada con
  `channel=mobile` puede crear una ejecucion con `canal = mobile`.
- Las notificaciones se generan como maximo una vez al dia por tipo, usuario,
  mensaje y URL.
- `npm run lint`, `npx tsc --noEmit --pretty false` y `npm run build` pasan.
