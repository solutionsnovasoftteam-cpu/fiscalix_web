# API fiscal compartida · Etapa 2

Esta etapa expone el catálogo y el perfil fiscal mediante el backend de
Fiscalix. Web y Mobile consumen el mismo contrato JSON; ninguna aplicación
cliente debe usar la `service role` de Supabase.

## Autenticación

- Web: cookie segura `fiscalix_session`.
- Mobile: `Authorization: Bearer <Firebase ID token>`.

En ambos casos, el backend valida que el usuario exista, esté activo y tenga
acceso a la empresa solicitada.

## Respuesta común

Éxito:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Descripción legible del error."
  }
}
```

## Catálogo de personas físicas

`GET /api/tax/regimes`

Devuelve únicamente regímenes activos de personas físicas. El campo
`selectableForNewProfiles` permite que Web y Mobile distingan regímenes
heredados, como RIF, sin duplicar reglas en sus interfaces.

## Perfil fiscal por empresa

`GET /api/tax/profile?companyId=<uuid>`

Si aún no existe un perfil, devuelve:

```json
{
  "ok": true,
  "data": { "configured": false, "profile": null }
}
```

`PUT /api/tax/profile` (también admite `PATCH`)

```json
{
  "companyId": "uuid",
  "regimeId": "uuid",
  "startDate": "2026-08-08",
  "endDate": null,
  "periodicity": "mensual"
}
```

Periodicidades admitidas: `mensual`, `bimestral`, `trimestral`, `semestral`
y `anual`. Las fechas usan `YYYY-MM-DD`. El backend valida pertenencia a la
empresa, tipo de persona, vigencia y restricciones de selección del régimen.

La actualización conserva la trazabilidad creada en la etapa 1 mediante el
trigger de `empresa_fiscal_historial`.
