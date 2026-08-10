# Fiscalix - Etapa 6: primera estimacion fiscal

La primera estimacion fiscal se limita a RESICO para personas fisicas, regimen SAT `626`.
La formula vive en `src/lib/taxEstimation.shared.ts` y se consume desde Web y desde
`GET /api/tax/estimation`.

## Alcance

- Calcula por empresa y periodo mensual (`YYYY-MM`).
- Usa `public.movimientos_fiscales_normalizados`, creado en la Etapa 5.
- Incluye solo movimientos con `activo_fiscal = true`.
- Ingresos entran al calculo si tienen `estado = cobrado`.
- Gastos entran como gastos pagados si tienen `estado = pagado`.
- Gastos deducibles acreditan IVA; gastos no deducibles se muestran, pero no acreditan IVA.
- Movimientos `pendiente` y `cancelado` quedan fuera del impuesto estimado.
- Empresas sin perfil fiscal RESICO se muestran sin estimacion para evitar aplicar un regimen incorrecto.

## Formula RESICO mensual

ISR RESICO:

```text
base_resico = ingresos cobrados sin IVA
isr_determinado = base_resico * tasa_resico_mensual
isr_estimado = max(0, isr_determinado - isr_retenido)
```

Tabla mensual aplicada:

| Ingreso mensual | Tasa |
| ---: | ---: |
| Hasta 25,000.00 | 1.00% |
| Hasta 50,000.00 | 1.10% |
| Hasta 83,333.33 | 1.50% |
| Hasta 208,333.33 | 2.00% |
| Hasta 3,500,000.00 | 2.50% |

IVA estimado:

```text
iva_estimado = max(0, iva_trasladado - iva_acreditable)
```

Impuesto estimado:

```text
impuesto_estimado = isr_estimado + iva_estimado
```

## API

```http
GET /api/tax/estimation?period=2026-08
GET /api/tax/estimation?period=2026-08&companyId=<uuid>
```

Respuesta exitosa:

```json
{
  "ok": true,
  "data": {
    "availableCompanies": [],
    "selectedCompanyId": null,
    "estimation": {
      "source": "movimientos_fiscales_normalizados",
      "regime": { "satCode": "626" },
      "period": { "key": "2026-08" },
      "totals": {},
      "companies": []
    }
  }
}
```

## Casos Web/Mobile

Los casos compartidos estan en `docs/tax-estimation-stage-6-cases.json`.
Web debe mostrar los mismos valores en `/taxes`; Mobile debe comparar su consumo
del endpoint contra los mismos `expected`.

## Criterios de aprobacion

- `npm run lint` pasa.
- `npx tsc --noEmit --pretty false` pasa.
- `npm run build` pasa.
- `/taxes` muestra periodo, ingresos, gastos, base RESICO, IVA, ISR e impuesto estimado.
- `/api/tax/estimation` devuelve la misma estructura de datos que usa Web.
- Empresas con regimen distinto de `626` no reciben impuesto estimado.
- Movimientos pendientes y cancelados no cambian el impuesto estimado.
- Gastos no deducibles no aumentan IVA acreditable.

## Fuentes normativas consultadas

- SAT, Articulo 113-E LISR: pagos mensuales RESICO sobre ingresos cobrados sin IVA y sin deducciones.
- SAT, Articulo 113-J LISR: retencion de ISR por personas morales.
