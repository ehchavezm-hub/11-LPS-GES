# LPS-GT · Matriz de diagnóstico y compatibilidad

Inventario completo del aplicativo **LPS-GT** al 24/10/2026, con el estado verificado de cada función.

> El pedido decía "funcionalidades existentes en ECM Project". Se interpretó como **las funciones de LPS-GT**, que es el aplicativo que se diagnostica. De ECM Project solo se tomó la estructura de referencia del organigrama, sin copiar sus datos (regla del proyecto).

## Cómo se verificó

| Evidencia | Alcance | Resultado |
|---|---|---|
| Prueba de humo `pruebas/humo.mjs` | 19 pantallas × 8 roles con acceso + 1 cuenta pendiente = **152 pantallas** | Sin errores |
| Pruebas de base de datos `supabase/tests` | 15 migraciones, RLS, reglas de negocio, **aislamiento entre áreas**, autoría, permisos de funciones | Todas pasan |
| Pruebas funcionales (Playwright, 38 guiones) + exportación a Excel | Flujo semanal completo, grilla, importaciones, proyectos, usuarios, organigrama, ventanas, columnas | 28 pasan. 8 fallaron porque verificaban requisitos que se cambiaron después a pedido (renombres 51 y 52, ventanas 35, líderes 46, orden de columnas 49, grupos 42/43): se comprobó a mano que la pantalla cumple el requisito vigente. Los otros 2 fallaron por el entorno de prueba (un servidor auxiliar apagado y fuentes bloqueadas a propósito). No son defectos. |
| Revisión de código y catálogo de Postgres | Políticas, funciones, índices, service worker, librerías | 11 hallazgos, todos corregidos (sección final) |

**Leyenda.** Estado: ✅ Funciona · 🟡 Parcial / por diseño · ⚙️ Requiere configuración tuya · 🔧 Corregido en esta revisión.
*Compat. base*: la función usa correctamente las tablas, RLS y disparadores de Supabase y el adaptador de demostración.
*Compat. cruzada*: la función se integra con los demás módulos; si choca con alguno, se indica con cuál.

---

## 1. Acceso y cuenta

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| **1.1 Ingreso** | | | | | |
| 1.1.1 Ingreso con correo y contraseña | ✅ | ✅ Supabase Auth | ✅ Carga perfil, catálogo y área antes de abrir pantallas | — | — |
| 1.1.2 Registro de cuenta (queda "Pendiente") | ✅ | ✅ `tg_nuevo_usuario` | ✅ Avisa a los gestores (Notificaciones) | — | — |
| 1.1.3 Recuperar contraseña por correo | ✅ | ✅ | ✅ | — | — |
| 1.1.4 Cambio obligatorio de contraseña temporal | ✅ | ✅ `debe_cambiar_clave` | ✅ Usuarios → Restablecer contraseña | — | — |
| 1.1.5 Modo demostración (`?demo`) | ✅ | ✅ Adaptador local que emula disparadores y RPC | ✅ Mismas pantallas que el modo real | No emula los controles nuevos de la migración 015 (en demostración hay una sola área). | Baja |
| 1.1.6 Cuenta pendiente o desactivada | ✅ | ✅ | ✅ | — | — |
| 1.1.7 Cerrar sesión | 🔧 | ✅ | 🔧 **Uso sin conexión (9.2)**: la copia local de datos quedaba al salir | Ahora se borra al salir o si ingresa otra persona en el mismo navegador. | Alta |
| **1.2 Cabecera** | | | | | |
| 1.2.1 Notificaciones (panel movible) | ✅ | ✅ RLS por usuario | 🔧 **Comentarios (2.6)**: las menciones podían notificar a otra área | Ahora solo notifica a personas activas del área. | Media |
| 1.2.2 Mi perfil | ✅ | ✅ `tg_proteger_perfil` | ✅ | — | — |
| 1.2.3 Botón Actualizar / Vaciar caché y recargar | ✅ | ✅ | ✅ Service worker y versión visible | — | — |
| 1.2.4 Versión en el menú de usuario | ✅ | ✅ | ✅ | — | — |

## 2. Planificación (Last Planner)

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| **2.1 Plan semanal** | | | | | |
| 2.1.1 Grilla de compromisos (Semana, Resp. 1, Gerencia, Proyecto, CET, Servicio, Actividad, días, HH…) | ✅ | ✅ `actividades` + RLS | ✅ Proyectos, CET/Servicio, Usuarios, Capacidad | CET agregado y Semana fija en su lugar (52 y 53). | — |
| 2.1.2 Navegación de semanas y fechas de los días | ✅ | ✅ | ✅ | — | — |
| 2.1.3 Días sábado y domingo | ✅ | ✅ `hh_sa`, `hh_do` en `hh_total` | ✅ Capacidad (2.6.2) | — | — |
| 2.1.4 Traer del Look Ahead | ✅ | ✅ | ✅ Look Ahead, Restricciones (aviso de pendientes) | — | — |
| 2.1.5 Actividades recurrentes | ✅ | ✅ | ✅ Plantillas | 🔧 Los ítems de plantilla ahora no pueden apuntar a proyectos de otra área. | Media |
| 2.1.6 Arrastrar no completadas | ✅ | ✅ | ✅ PAC (cuenta como no cumplida) | — | — |
| 2.1.7 Marcar estados / CNC | ✅ | ✅ | ✅ Tablero (Pareto de CNC) | — | — |
| 2.1.8 Cerrar semana | ✅ | ✅ `tg_validar_cierre`, `tg_bloqueo_semana` | ✅ PAC, Tablero, Reunión | — | — |
| 2.1.9 Reabrir semana | ✅ | ✅ Permiso `reabrir_semana` | ✅ | — | — |
| 2.1.10 Resumen para Teams/correo | ✅ | ✅ | ✅ | — | — |
| 2.1.11 PDF | ✅ | ✅ | ✅ | — | — |
| 2.1.12 Tiempo real entre usuarios | 🔧 | ✅ | ✅ | Ahora filtrado por área (menos carga con 1000 usuarios). | Alta |
| **2.2 Look Ahead (6 semanas)** | | | | | |
| 2.2.1 Grilla por semana con CET y Servicio | ✅ | ✅ | ✅ Plan, Proyectos, CET/Servicio | — | — |
| 2.2.2 Comprometer la semana siguiente | ✅ | ✅ | ✅ Plan semanal | — | — |
| 2.2.3 Aplicar plantilla de servicio | ✅ | ✅ | ✅ Plantillas, CET/Servicio | — | — |
| 2.2.4 Crear desde la cartera | ✅ | ✅ | ✅ Cartera (enlaza `cartera_id`) | 🔧 La cartera enlazada debe ser de la misma área. | Media |
| 2.2.5 PDF | ✅ | ✅ | ✅ | — | — |
| **2.3 Restricciones** | | | | | |
| 2.3.1 Grilla y estados | ✅ | ✅ | ✅ Plan y Look Ahead (columna 🚧) | — | — |
| 2.3.2 Nueva restricción desde una actividad | ✅ | ✅ | ✅ | 🔧 La actividad y el proyecto deben ser del área; el autor lo fija la base. | Media |
| 2.3.3 Levantar restricción | ✅ | ✅ | ✅ | — | — |
| 2.3.4 Aviso al comprometer con pendientes | ✅ | ✅ | ✅ Plan semanal | — | — |
| **2.4 Detalle de actividad** | | | | | |
| 2.4.1 Comentarios y menciones | ✅ | ✅ | 🔧 Notificaciones | Ver 1.2.1. El autor no se puede suplantar. | Media |
| 2.4.2 Enlaces a documentos | 🔧 | ✅ (solo `http(s)://`) | ✅ | El autor lo fija la base: antes se podía registrar a nombre de otra persona. | Media |
| 2.4.3 Enlace directo `#/actividad/:id` | ✅ | ✅ | ✅ | — | — |
| **2.5 Reunión semanal (6 pasos)** | | | | | |
| 2.5.1 Pasos y modo reunión | ✅ | ✅ | ✅ Tablero, Plan, Restricciones | — | — |
| 2.5.2 Acuerdos | ✅ | ✅ | ✅ | 🔧 Responsable y reunión deben ser del área. | Baja |
| 2.5.3 Acta PDF | ✅ | ✅ | ✅ | — | — |
| **2.6 Equipo y capacidad** | | | | | |
| 2.6.1 Todo el personal con su cargo | ✅ | ✅ | ✅ Usuarios, Cargos | — | — |
| 2.6.2 Ubicación por día y capacidad (HH) | ✅ | ✅ | ✅ Plan (carga vs capacidad), parámetros | — | — |
| 2.6.3 Sábado y domingo | ✅ | ✅ Parámetro `trabajo_fin_semana` | ✅ Plan y Look Ahead muestran las columnas | — | — |
| 2.6.4 Heredar la semana anterior | ✅ | ✅ | ✅ Respeta las ausencias | — | — |
| 2.6.5 PDF | ✅ | ✅ | ✅ | — | — |

## 3. Cartera, proyectos y plantillas

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| **3.1 Cartera y solicitudes** | | | | | |
| 3.1.1 Nueva solicitud interna | ✅ | ✅ | ✅ Look Ahead (2.2.4) | — | — |
| 3.1.2 Solicitud de otra gerencia (rol Consulta) | ✅ | ✅ | ✅ Notificaciones | — | — |
| 3.1.3 Aceptar / rechazar | ✅ | ✅ | ✅ | — | — |
| 3.1.4 Documento de la solicitud | ✅ | ✅ | ✅ | — | — |
| **3.2 Proyectos / Procesos** (Configuración → Listas) | | | | | |
| 3.2.1 Tres ventanas: Activos, En pausa y Cerrados | ✅ | ✅ | ✅ Todos los combos de proyecto | — | — |
| 3.2.2 Nuevo / editar / proponer / aprobar | ✅ | ✅ | ✅ Notificaciones | — | — |
| 3.2.3 Desactivar y reactivar | ✅ | ✅ | ✅ Los inactivos se muestran con "(desactivado)" | — | — |
| 3.2.4 Eliminar (doble confirmación) | ✅ | ✅ Clave foránea protege el historial | ✅ | — | — |
| 3.2.5 Eliminar con todo su historial | ✅ | ✅ RPC `eliminar_proyecto_completo` | ✅ | — | — |
| 3.2.6 Importar desde Excel (actualiza existentes) | ✅ | ✅ | ✅ CET/Servicio, Gerencias | 🔧 Lector de Excel actualizado (SheetJS 0.20.3). | Alta |
| 3.2.7 Ficha del proyecto e hitos | ✅ | ✅ | ✅ | 🔧 Los hitos deben ser de un proyecto del área. | Baja |
| 3.2.8 Líderes del proyecto | 🔧 | 🔧 | ✅ | **Antes permitía ver o asignar líderes de otra área.** Corregido en la migración 015. | Alta |
| 3.2.9 Favoritos | 🔧 | 🔧 | ✅ | Solo proyectos del área. | Baja |
| **3.3 Plantillas** | | | | | |
| 3.3.1 Plantillas de servicio | ✅ | ✅ | ✅ Look Ahead | — | — |
| 3.3.2 Actividades recurrentes | ✅ | ✅ | ✅ Plan semanal | — | — |
| 3.3.3 Ítems | 🔧 | 🔧 | ✅ | Ver 2.1.5. | Media |

## 4. Indicadores y reportes

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| 4.1 Tablero: PAC semanal e histórico | ✅ | ✅ `cierres`, `pac_historico` | ✅ Plan, Importación histórica | Ahora se mide su tiempo (Sentry, si se activa). | — |
| 4.2 Pareto de CNC | ✅ | ✅ | ✅ | — | — |
| 4.3 Carga vs capacidad | ✅ | ✅ | ✅ Equipo y capacidad | — | — |
| 4.4 Restricciones abiertas | ✅ | ✅ | ✅ | — | — |
| 4.5 Resumen semanal | ✅ | ✅ | ✅ | — | — |
| 4.6 Exportar a Excel (todas las grillas) | ✅ | ✅ | ✅ | Probado con SheetJS 0.20.3, incluida la columna CET. | — |
| 4.7 PDF (todas las pantallas) | ✅ | ✅ | ✅ | — | — |

## 5. Grilla tipo Excel (común a Plan, Look Ahead, Restricciones, Cartera, Listas y Proyectos)

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| 5.1 Edición en celda, rangos, deshacer y rehacer | ✅ | ✅ | ✅ | — | — |
| 5.2 Pegar filas de Excel (con encabezados y valores nuevos para las listas) | ✅ | ✅ | ✅ Listas | — | — |
| 5.3 Filtro, orden y columnas visibles | ✅ | ✅ | ✅ | 🔧 Filtro, orden y copia ahora funcionan en columnas calculadas (Semana, CET). | Baja |
| 5.4 Vistas guardadas | ✅ | ✅ `vistas` | ✅ | Las columnas nuevas o fijas vuelven a su lugar aunque haya una vista guardada (53). | — |
| 5.5 Clic derecho en una fila / en un título → lista | ✅ | ✅ | ✅ Listas | — | — |
| 5.6 Guardado automático y conflictos en tiempo real | ✅ | ✅ | ✅ | — | — |

## 6. Configuración

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| **6.1 Usuarios y roles** | | | | | |
| 6.1.1 Tabla (Nombre, Código, Cargo, Correo, Rol, Gerencias, H/día, Estado) | ✅ | ✅ | ✅ | — | — |
| 6.1.2 Crear usuario con contraseña temporal | ✅ | ✅ Edge Function `admin-usuarios` | ✅ | 🔧 Monitoreo de errores y orígenes permitidos configurables. | Media |
| 6.1.3 Restablecer contraseña | ✅ | ✅ | ✅ | — | — |
| 6.1.4 Eliminar usuario (se conserva si tiene historial) | ✅ | ✅ RPC `eliminar_usuario` | ✅ | — | — |
| 6.1.5 Roles: Super administrador, Administrador, Delegado, Responsable de equipo, Líder de especialidad, Responsable de proceso, Responsable de actividad, Consulta | ✅ | ✅ `puede()`, `es_staff()`… | ✅ Matriz de permisos | — | — |
| 6.1.6 Organigrama (agregar, mover, generar, imprimir, pantalla completa) | ✅ | ✅ `organigrama_nodos` | ✅ Usuarios, Cargos | 🔧 Padre y persona deben ser del área. Agregado al uso sin conexión. | Baja |
| 6.1.7 Invitar usuarios / administrador delegado | ✅ | ✅ | ✅ | — | — |
| **6.2 Listas** | | | | | |
| 6.2.1 Listas agrupadas y grupo editable | ✅ | ✅ | ✅ | — | — |
| 6.2.2 CET / Servicio (Proyecto, CET, Servicio) | ✅ | ✅ | ✅ Plan, Look Ahead, Plantillas | Las columnas `cet_id` antiguas se conservan sin uso (la lista CET se retiró y sus datos se mantienen). | Baja |
| 6.2.3 Cargos | ✅ | ✅ | ✅ | — | — |
| 6.2.4 Valores protegidos | ✅ | ✅ `tg_proteger_valor` | ✅ | — | — |
| 6.3 Parámetros | ✅ | ✅ | ✅ Capacidad, Plan | — | — |
| 6.4 Matriz de permisos (el Super administrador edita la del Administrador) | ✅ | ✅ | ✅ Todos los módulos | — | — |
| 6.5 Columnas personalizadas | ✅ | ✅ | ✅ Grillas | 🔧 La lista asociada debe ser del área. | Baja |
| 6.6 Importar histórico de Excel | ✅ | ✅ | ✅ Tablero (PAC histórico) | 🔧 SheetJS 0.20.3. | Alta |
| 6.7 Respaldo (exportar) y respaldo semanal a Google Drive | ✅ | ✅ RPC `exportar_respaldo` | ✅ | ⚙️ El semanal necesita los secretos de Drive (ya documentado en el README). | — |
| 6.8 Auditoría | ✅ | ✅ `tg_auditoria` | ✅ | — | — |

## 7. Otros módulos

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| 7.1 Mejoras del aplicativo (solicitar y gestionar) | ✅ | ✅ | 🔧 | El autor lo fija la base. | Baja |
| 7.2 Ayuda, recorrido guiado y guía PDF | ✅ | ✅ | ✅ | — | — |
| 7.3 Ventanas emergentes movibles (52) | ✅ | ✅ | ✅ | Ver `docs/VENTANAS.md`. | — |

## 8. Seguridad (transversal)

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| 8.1 RLS en las 29 tablas | ✅ | ✅ | ✅ | Prueba automática. | — |
| 8.2 Aislamiento entre áreas (manipulación de IDs) | 🔧 | 🔧 | ✅ | Migración 015 + pruebas de ataque. | Alta |
| 8.3 Autoría no suplantable | 🔧 | 🔧 | ✅ | — | Media |
| 8.4 Funciones `SECURITY DEFINER` | 🔧 | 🔧 | ✅ | Sin acceso anónimo y `search_path` fijo. | Media |
| 8.5 Claves (solo la clave anon en el navegador) | ✅ | ✅ | ✅ | El CI bloquea una `service_role` o `sb_secret_`. | — |
| 8.6 Repositorio público sin datos de la empresa | 🔧 | — | ✅ | `.gitignore` + control en el CI. | Alta |
| 8.7 Librerías de terceros | 🔧 | — | ✅ | SheetJS actualizada; integridad verificada contra las fuentes oficiales. | Alta |
| 8.8 Escapado de HTML (XSS) | 🔧 | — | ✅ | Corregido un mensaje de error sin escapar. CodeQL en el CI. | Media |

## 9. Infraestructura

| Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada | Observaciones técnicas / acción | Prioridad |
|---|:-:|:-:|---|---|:-:|
| 9.1 Publicación en GitHub Pages | ✅ | — | ✅ | — | — |
| 9.2 Instalable y uso sin conexión (solo lectura) | 🟡 | ✅ | 🔧 Organigrama, Importar proyectos y Monitoreo no se guardaban | Agregados. Sin conexión solo se consulta, por diseño. | Media |
| 9.3 Rendimiento con 1000 usuarios | 🔧 | 🔧 | ✅ | Políticas `(select f())`, 18 índices y tiempo real por área. | Alta |
| 9.4 Plan de Supabase para 1000 concurrentes | ⚙️ | — | — | El plan gratuito admite 200 conexiones de tiempo real. Ver `docs/PRODUCCION.md`, Etapa 2. | Alta |
| 9.5 Aplicar la migración 015 en Supabase | ⚙️ | — | — | SQL Editor → pegar → Run. | Alta |
| 9.6 Monitoreo de errores (Sentry) | ⚙️ | ✅ | ✅ | Listo; se activa con la variable `SENTRY_DSN`. | Media |
| 9.7 CI "Listo para producción" | ✅ | ✅ | ✅ | Recomendado: exigirlo para fusionar en `main`. | Media |

---

## Incompatibilidades encontradas y corregidas

| # | Conflicto | Módulos que chocaban | Corrección |
|---|---|---|---|
| 1 | Líderes de proyecto sin control de área | Proyectos ↔ Usuarios (de otra área) | Políticas con área (015) |
| 2 | Referencias a registros de otra área por ID | Plan, Look Ahead, Restricciones, Cartera, Reunión, Comentarios, Organigrama ↔ Proyectos, Usuarios y Listas | `tg_misma_area` y `tg_items_misma_area` (015) |
| 3 | Autor suplantable | Detalle (enlaces), Cartera, Restricciones, Mejoras ↔ Auditoría | `tg_fijar_autor` (015) |
| 4 | Menciones a otra área | Comentarios ↔ Notificaciones | Disparador corregido (015) |
| 5 | Datos sin conexión visibles para el siguiente usuario | Uso sin conexión ↔ Cerrar sesión | Borrado de la copia local |
| 6 | Pantallas sin copia sin conexión | Service worker ↔ Organigrama, Importar proyectos | Lista de archivos actualizada |
| 7 | Lector de Excel vulnerable | Importaciones ↔ Seguridad | SheetJS 0.20.3 |
| 8 | Tiempo real sin filtro de área | Plan, Look Ahead, Restricciones, Cartera, Tablero, Organigrama ↔ Rendimiento | Filtro `area_id` |
| 9 | Políticas evaluadas fila por fila | Todas las grillas ↔ Rendimiento | `(select f())` + índices |
| 10 | Filtro y orden vacíos en columnas calculadas | Grilla ↔ columnas Semana y CET | Usan el texto mostrado |
| 11 | Error de carga mostrado sin escapar | Enrutador ↔ Seguridad (XSS) | Escapado |

**Pendiente de tu parte** (no se puede hacer desde el código): aplicar la migración 015, elegir el plan de Supabase, configurar Sentry si lo deseas y activar la protección de la rama `main`. Los pasos están en [`docs/PRODUCCION.md`](PRODUCCION.md).
