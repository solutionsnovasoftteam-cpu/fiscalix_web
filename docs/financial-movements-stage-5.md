# Etapa 5: normalización de movimientos

Esta etapa prepara ingresos y gastos como una fuente consistente para el motor fiscal.

## Alcance

- Cada movimiento nuevo debe tener usuario, empresa y categoría.
- Los ingresos admiten estado `cobrado`, `pendiente` o `cancelado`.
- Los gastos admiten estado `pagado`, `pendiente` o `cancelado`.
- Cada movimiento guarda base fiscal, tasa de IVA, monto de IVA, ISR retenido y bandera de deducibilidad.
- Las pantallas existentes siguen leyendo registros históricos, pero las altas nuevas ya no aceptan empresa personalizada sin vínculo.
- Las consultas por usuario filtran movimientos de empresas ajenas para evitar mezclar contextos fiscales.

## Instalación

1. Ejecutar `scripts/financial-movements-stage-5.sql` en el SQL Editor de Supabase.
2. Reiniciar el servidor local para refrescar la caché de tipos/rutas si aplica.
3. Registrar un ingreso y un gasto desde la aplicación.
4. Consultar la vista `public.movimientos_fiscales_normalizados`.

## Vista para motor fiscal

`public.movimientos_fiscales_normalizados` unifica `ingresos` y `gastos` con estos campos:

- `tipo`
- `usuario_id`
- `empresa_id`
- `categoria_id`
- `fecha_movimiento`
- `estado`
- `deducible`
- `monto`
- `base_fiscal`
- `iva_tasa`
- `iva_monto`
- `isr_retenido_monto`
- `activo_fiscal`

`activo_fiscal` solo queda en `true` cuando el movimiento no está cancelado y tiene usuario, empresa y categoría.

## Pruebas recomendadas

1. Intentar crear un ingreso sin empresa o categoría y comprobar rechazo.
2. Crear un ingreso pendiente y confirmar que se guarda con `estado = 'pendiente'`.
3. Crear un gasto no deducible y confirmar `base_fiscal = 0`, `iva_monto = 0`.
4. Crear un gasto deducible y confirmar `base_fiscal`, `iva_tasa` e `iva_monto`.
5. Verificar que reportes, dashboard, movimientos, comprobantes e impuestos siguen cargando.
6. Probar que un usuario no vea movimientos de una empresa a la que ya no tiene acceso.
