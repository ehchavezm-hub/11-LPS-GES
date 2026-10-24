# Decisiones de desarrollo — LPS-GT v1.00.01

Por indicación del Gerente Técnico ("si hay algo que aprobar lo apruebas"), los puntos que el documento de alcance v0.7
dejaba abiertos se resolvieron como se indica. **Todos son configurables** desde el aplicativo (principio "nada fijo, todo editable"),
salvo donde se dice lo contrario.

## Preguntas pendientes del alcance v0.7

| # | Pregunta | Decisión | Dónde se cambia |
|---|---|---|---|
| 1 | Horas de capacidad por día | **8 h/día** por defecto; cada persona puede tener su propio valor. Capacidad semanal = días laborables × horas/día − días de vacaciones, licencia o feriado. | Configuración → Parámetros (`horas_dia`) y Configuración → Usuarios (H/día por persona). Lista "Ubicaciones": campo *cuenta para capacidad*. |
| 2 | ¿Quién acepta las solicitudes de otras gerencias? | El administrador y el delegado **siempre**; un líder solo las dirigidas a él o sin responsable, si tiene el permiso *Aceptar o rechazar solicitudes* (activo por defecto). | Configuración → Permisos. |
| 3 | Usuario de consulta: ¿una o varias gerencias? | **Varias.** Cada usuario de consulta tiene una lista de gerencias y solo ve proyectos, indicadores y solicitudes de esas gerencias. | Configuración → Usuarios. |
| 4 | Trabajo sin conexión | Fase 1: **lectura sin conexión** (la última información consultada queda disponible y el aplicativo se abre sin internet). La escritura sin conexión con sincronización posterior queda para la **fase 4**. | — |

## Reglas de funcionamiento que se definieron al construir

- **Cierre automático** (viernes 17:00, hora de Lima, configurable): los compromisos sin estado pasan a *No completado* con la CNC protegida
  **"No reportado al cierre"** y la persona recibe un aviso. Se puede desactivar (`cierre_automatico`). El administrador puede reabrir.
- **El cierre de semana exige** que todo compromiso tenga estado final y que cada *No completado* tenga CNC. Las HH reales faltantes solo generan advertencia
  (al marcar *Completado* se propone HH real = HH planificadas).
- **Restricciones**: advierten pero no bloquean ("Comprometer igual"), según el alcance.
- **Arrastre**: al cerrar se ofrece copiar los no completados a la semana siguiente; la copia guarda la semana original para medir reprogramaciones.
- **Rotación del delegado**: al nombrar un nuevo delegado, el anterior vuelve a *Líder*. El historial queda registrado. Nadie puede quitar el rol al administrador principal ni eliminar usuarios (solo desactivarlos).
- **Alta de usuarios por el administrador** (pedido del Gerente Técnico): el administrador y quien tenga el permiso *Gestionar usuarios* crean cuentas con
  contraseña temporal y la restablecen con 🔑. El delegado no puede restablecer la de administradores ni la de otro delegado. La persona debe cambiar la
  contraseña temporal en su primer ingreso. Esto se hace con la Edge Function `admin-usuarios`, porque la clave secreta de Supabase no puede estar en el navegador.
- **Primer usuario** que se registra en un área = administrador principal. Los demás quedan *Pendientes* hasta que se les asigne rol.
- **Proyectos propuestos** por líderes: pueden recibir actividades mientras están en revisión (marcados ⏳). Al rechazarlos se notifica el motivo.
- **Importación de los Excel anteriores**: los responsables del Excel se asocian a usuarios (sugerencia automática, revisable). Lo no asociado se guarda como
  **PAC histórico resumido**. Los estados vacíos o desconocidos de semanas pasadas se importan como *Cancelado* (no cuentan en el PAC, igual que en el Excel).
  Las semanas pasadas importadas quedan cerradas. Los duplicados se omiten, por lo que se puede volver a importar sin duplicar.
- **PAC** = completados ÷ (completados + no completados) de los compromisos programados. Las *no programadas* (imprevistos) y las *canceladas* no entran.
  Se muestran además el PAC ponderado por HH (M-09) y la precisión de estimación HH real / HH plan (M-03).
- **Respaldos**: semanales en Google Drive (carpeta privada) mediante GitHub Actions; nunca en el repositorio, que es público. Se conservan 12 meses.
- **Mantener activo Supabase gratuito**: el mismo flujo consulta la base lunes y jueves para evitar la pausa por inactividad.

## Seguridad
- Toda regla de permisos se aplica en la base de datos (RLS), no solo en pantalla: aunque alguien manipule el navegador no puede ver ni cambiar lo que su rol no permite.
- Las funciones de respaldo y mantenimiento no pueden llamarse con la clave pública.
- El aplicativo y la publicación rechazan una clave secreta en `config.js`.
- El repositorio es público: no contiene nombres de personas, proyectos ni datos de la empresa. Los datos de demostración son ficticios.

## Fuera de esta versión (fases siguientes)
- Escritura sin conexión con sincronización (fase 4).
- Integración con correo corporativo / Teams (por decisión: independiente de la infraestructura de la empresa). Hoy el resumen semanal se copia o se envía por *mailto*.
- Varias áreas en la misma instalación: la base de datos ya lo soporta (`area_id` en todas las tablas); falta la pantalla de alta de áreas.
