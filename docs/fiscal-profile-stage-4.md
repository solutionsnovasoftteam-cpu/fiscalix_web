# Etapa 4: compatibilidad y obligaciones fiscales

Esta etapa agrega el contexto necesario para validar perfiles fiscales antes de implementar cálculos de impuestos.

## Alcance

- Catálogo de actividades económicas para personas físicas.
- Relación de una empresa con una o varias actividades y una actividad principal.
- Regímenes adicionales por empresa.
- Matriz versionable de compatibilidad entre regímenes.
- Estados `compatible`, `condicionado`, `incompatible` y `revision_profesional`.
- Bloqueo de combinaciones declaradas incompatibles.
- Aceptación explícita de condiciones.
- Obligaciones sugeridas con decisión pendiente, confirmada o rechazada.
- Validación de sesión y acceso a la empresa en todos los endpoints.

La etapa no calcula impuestos ni convierte automáticamente una sugerencia en una declaración fiscal.

## Instalación

1. Confirmar que `scripts/fiscal-profiles-stage-1.sql` ya fue ejecutado.
2. Ejecutar completo `scripts/fiscal-profiles-stage-4.sql` en el SQL Editor de Supabase.
3. Reiniciar el servidor local.
4. Abrir **Mi empresa > Actividades y compatibilidad fiscal > Configurar**.

El script no incluye combinaciones legales inventadas. Mientras una combinación no exista en `regimen_compatibilidad`, la API la conserva como `revision_profesional`.

## API compartida

### Consultar configuración

`GET /api/tax/configuration?companyId=<uuid>`

### Guardar configuración

`PUT /api/tax/configuration`

```json
{
  "companyId": "uuid",
  "activityIds": ["uuid"],
  "additionalRegimeIds": ["uuid"],
  "acceptedConditions": [],
  "obligationDecisions": [
    { "suggestionId": "uuid", "state": "confirmada" }
  ]
}
```

Estados válidos para las decisiones: `pendiente`, `confirmada` y `rechazada`.

## Pruebas recomendadas

1. Sin ejecutar la migración, comprobar que la pantalla informa que falta la etapa 4.
2. Ejecutar la migración y comprobar que se muestran actividades de personas físicas.
3. Seleccionar dos actividades, guardar y verificar que solo la primera tenga `principal = true`.
4. Seleccionar un régimen adicional sin regla y comprobar que queda como `revision_profesional`.
5. Insertar una regla de prueba `incompatible` y comprobar que la interfaz deshabilita esa combinación y la API la rechaza.
6. Insertar una regla `condicionado` con texto y comprobar que exige aceptar la condición antes de guardar.
7. Confirmar, rechazar y dejar pendiente distintas obligaciones; cerrar y abrir el modal para comprobar persistencia.
8. Intentar guardar una sugerencia perteneciente a otro régimen y comprobar una respuesta `400`.
9. Probar con una empresa ajena y comprobar una respuesta `403`.
10. Probar sin cookie o token y comprobar una respuesta `401`.
11. Ejecutar `npm run lint` y `npm run build`.

## Criterio para producción

La tabla `regimen_compatibilidad` debe ser poblada y revisada por una persona responsable de contenido fiscal, incluyendo condición, fuente y vigencia. La ausencia de regla nunca se interpreta como compatibilidad automática.
