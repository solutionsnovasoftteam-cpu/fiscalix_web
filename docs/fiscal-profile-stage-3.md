# Configuración fiscal guiada · Etapa 3

La página **Mi empresa** incorpora una experiencia Web para configurar el
perfil fiscal sin editar directamente las tablas de Supabase.

## Flujo

1. El resumen indica si el perfil está configurado o pendiente.
2. El usuario abre **Editar información**.
3. Confirma los datos generales de la empresa.
4. Selecciona un régimen fiscal de persona física.
5. Registra inicio, término opcional y periodicidad.
6. Consulta la orientación y vigencia disponible del régimen.
7. Revisa un resumen explícito antes de confirmar el guardado.

El perfil se persiste mediante `/api/tax/profile`, por lo que conserva las
validaciones, permisos y respuestas comunes de la etapa 2. Los datos generales
se guardan mediante `/api/companies/[id]`. Si la configuración fiscal no cambió,
el formulario no vuelve a actualizarla y evita generar historial innecesario.

## Alcance

- La interfaz muestra únicamente el catálogo fiscal recibido por la API.
- Los regímenes heredados pueden conservarse en perfiles existentes, pero no
  seleccionarse para uno nuevo.
- Una sola configuración fiscal está activa por empresa en esta etapa.
- Las combinaciones de varios regímenes y sus reglas pertenecen a la etapa 4.

## Pruebas manuales

1. Abrir una empresa sin perfil y comprobar **Pendiente de configuración**.
2. Abrir el formulario y verificar régimen, vigencia y periodicidad.
3. Pulsar **Revisar configuración** y comprobar que todavía no se escriba en la
   base de datos.
4. Volver a editar y confirmar que el borrador se conserva.
5. Confirmar y guardar; recargar y comprobar los datos persistidos.
6. Intentar una fecha final anterior al inicio y esperar rechazo.
7. Comprobar que un régimen heredado no sea seleccionable para un perfil nuevo.
8. Intentar consultar o modificar una empresa ajena y esperar `403`.
9. Guardar solo datos generales y comprobar que no se agregue una fila fiscal
   nueva al historial.
10. Revisar contraste, desplazamiento y cierre del modal en temas claro y oscuro.
