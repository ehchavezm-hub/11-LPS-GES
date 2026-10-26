# LPS-GT · Matriz de diagnóstico y compatibilidad

Revisión completa del aplicativo al **25/10/2026** (pedido 98). Reemplaza la matriz del 24/10 (pedido 54), cuyas correcciones siguen vigentes (ver la última sección).

**Regla de prioridad.** Cuando dos observaciones se contradicen, vale la más reciente. Por ejemplo, la 52 (CET y Servicio en columnas separadas) prevalece sobre la 27 (una sola columna "CET / Servicio"), y la 46 (sin "Líderes asignados") sobre la 23.

## Cómo se verificó

| Evidencia | Alcance | Resultado |
|---|---|---|
| Prueba de humo `pruebas/humo.mjs` | 20 pantallas × 8 roles con acceso, más 1 cuenta pendiente: 160 pantallas | Sin errores |
| Pruebas de base de datos `supabase/tests` | Migraciones 001–016, RLS, reglas de negocio, aislamiento entre áreas, autoría y la nueva sincronización del Estado LA | Todas pasan |
| Pruebas funcionales en el navegador | 54 guiones vigentes, más `compat98.js` con 16 verificaciones de esta revisión | Todas pasan, sin errores de JavaScript |
| Revisión de código | Los 38 módulos JavaScript, el adaptador de demostración y las 16 migraciones, buscando qué choca entre módulos | 16 incompatibilidades, todas corregidas (sección 10) |
| Revisión visual | Capturas de Plan, Look Ahead, Cartera, Restricciones, Plantillas, Reportes y Ayuda | 3 defectos de presentación corregidos (sección 10) |

**Leyenda**
- **Estado operativo**: ✅ Funciona · 🔧 Funciona; se corrigió en esta revisión · ⚙️ Funciona; requiere una acción tuya en Supabase o GitHub. Ninguna función quedó Parcial ni No funciona.
- **Compat. base**: usa bien las tablas, las políticas RLS y los disparadores de Supabase, y el adaptador de demostración, que emula la base.
- **Compat. cruzada**: está integrada con las demás funciones. Si hubo un choque, se indica con qué módulo era y cómo se resolvió.

---

## 1. Acceso, sesión y estructura

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **1.1** | **Ingreso** | | | |
| 1.1.1 | Correo y contraseña | ✅ | ✅ Supabase Auth | ✅ Carga el perfil, el catálogo y el área antes de abrir las pantallas |
| 1.1.2 | Registro: la cuenta queda "Pendiente" | ✅ | ✅ `tg_nuevo_usuario` | ✅ Avisa a los gestores (Notificaciones) |
| 1.1.3 | Recuperar contraseña | ✅ | ✅ | ✅ |
| 1.1.4 | Cambio obligatorio de la contraseña temporal | ✅ | ✅ `debe_cambiar_clave` | ✅ Usuarios → Restablecer contraseña |
| 1.1.5 | Cuenta pendiente o desactivada | ✅ | ✅ | ✅ |
| 1.1.6 | Cerrar sesión y borrar la copia sin conexión | ✅ | ✅ | ✅ Uso sin conexión (9.2) |
| 1.1.7 | Modo demostración (`?demo`) | 🔧 | ✅ Adaptador local | 🔧 **Datos de demostración ↔ CET (72)**: los servicios no tenían CET y la columna CET se veía vacía. Ahora cada servicio de la demostración tiene un CET ficticio |
| 1.1.8 | Traer datos del modo demostración a la base real | ✅ | ✅ | ✅ Respaldo (7.8) |
| **1.2** | **Cabecera** | | | |
| 1.2.1 | Botón ☰: contraer o expandir el menú lateral | ✅ | — | ✅ Se recuerda al recargar |
| 1.2.2 | A / A+: tamaño de letra y de filas | ✅ | — | ✅ Todas las grillas recalculan el alto |
| 1.2.3 | Actualizar / Vaciar caché y recargar | ✅ | ✅ Service worker | ✅ Versión visible |
| 1.2.4 | Ayuda (❔) | ✅ | — | ✅ Ayuda (8.2) |
| 1.2.5 | Notificaciones (panel movible) | ✅ | ✅ RLS por usuario | ✅ Menciones solo dentro del área |
| 1.2.6 | Menú de usuario: Mi perfil, versión, Salir | ✅ | ✅ `tg_proteger_perfil` | ✅ |
| **1.3** | **Menú lateral** | | | |
| 1.3.1 | Navegación según el rol | ✅ | ✅ `puede()`, `es_staff()` | ✅ El enrutador aplica las mismas guardias |
| 1.3.2 | Ancho ajustable (arrastrar el borde; doble clic: ancho normal) | ✅ | — | ✅ |
| 1.3.3 | Menú de proyectos: pestañas Mis, Todos y ★ Favoritos, y buscador | ✅ | ✅ `proyecto_lideres`, `proyecto_favoritos` | ✅ "Mis" usa los líderes asignados con clic derecho → Asignar líderes |
| 1.3.4 | Selección de proyecto: filtra todas las pantallas | ✅ | ✅ | 🔧 **Reportes ↔ Look Ahead**: el reporte "Carga vs capacidad" filtraba por proyecto y la pantalla no. Ahora ambos muestran la carga de la persona en todos sus proyectos, porque la capacidad es de la persona |
| 1.3.5 | ＋ Registrar o proponer un proyecto | ✅ | ✅ | ✅ Proyectos (4.2) |

## 2. Planificación: Plan semanal

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **2.1** | **Grilla de compromisos** | | | |
| 2.1.1 | Columnas: Semana, Resp. 1, Gerencia, Proyecto / Proceso, CET, Servicio, Actividad, L–V (S–D), HH, Tipo, Estado, CNC, HH real, 🚧, 💬, Comentario, Sem. pend. | ✅ | ✅ `actividades` + RLS | ✅ Mismas definiciones que el Look Ahead, las Plantillas, el PDF y los Reportes |
| 2.1.1.1 | Semana a la izquierda de Resp. 1, en posición fija (50, 53) | ✅ | — | ✅ Las vistas guardadas no la mueven |
| 2.1.1.2 | Días L M X J V angostos; la L es el lunes de la semana (73) | ✅ | ✅ `hh_lu…hh_do` | ✅ La ayuda de cada día muestra su fecha |
| 2.1.1.3 | Sábado y domingo (40) | 🔧 | ✅ `trabajo_fin_semana` | 🔧 **Vistas guardadas ↔ Fin de semana**: la vista automática guardaba S y D como ocultas, y al activar el fin de semana seguían ocultas. Ahora su visibilidad la decide siempre el parámetro |
| 2.1.1.4 | CET ↔ Servicio enlazados (72) | 🔧 | ✅ Lista `servicios` (código = CET) | 🔧 **CET/Servicio ↔ Proyecto**: se podía elegir el servicio de otro proyecto. Ahora la lista muestra los del proyecto de la fila (y los sin proyecto); cambiar de proyecto reemplaza un servicio ajeno; elegir un servicio en una fila sin proyecto completa el proyecto y la gerencia |
| 2.1.1.5 | Actividad y Comentario en varias líneas; la caja crece (74, 77, 80) | ✅ | — | ✅ Enter guarda; Alt+Enter agrega una línea |
| 2.1.1.6 | Agrupar por Responsable, Proyecto, Gerencia, Estado o Servicio | 🔧 | — | 🔧 El agrupador decía "CET / Servicio" aunque la columna se llama "Servicio" (52) |
| **2.2** | **Semanas** | | | |
| 2.2.1 | ◀ ▶ y Semana actual; el periodo coincide con los días (48) | ✅ | ✅ | ✅ |
| 2.2.2 | Responsable: Todo el equipo, Mi plan u otra persona | ✅ | ✅ | ✅ |
| **2.3** | **Acciones** | | | |
| 2.3.1 | ⬇ Traer del Look Ahead (preselecciona Lista y Trasladada) | ✅ | ✅ | ✅ Look Ahead; avisa si hay restricciones pendientes (RN-07) |
| 2.3.2 | 🔁 Recurrentes | ✅ | ✅ | ✅ Plantillas recurrentes, incluidas S y D |
| 2.3.3 | ↪ Arrastrar no completadas | ✅ | ✅ | ✅ PAC (cuentan como no cumplidas) |
| 2.3.4 | ✔ Marcar estados (con CNC) | ✅ | ✅ | ✅ Tablero (Pareto de CNC) |
| 2.3.5 | 🔒 Cerrar semana (validaciones, HH reales, arrastre) | ✅ | ✅ `tg_validar_cierre`, `tg_bloqueo_semana` | ✅ PAC, Tablero, Reunión |
| 2.3.6 | 🔓 Reabrir semana | ✅ | ✅ Permiso `reabrir_semana` | ✅ |
| 2.3.7 | Clic derecho → Mover a la semana siguiente | ✅ | ✅ | ✅ Vuelve al Look Ahead como Pendiente |
| 2.3.8 | Actividad no programada (surge en la semana) | ✅ | ✅ | ✅ No afecta el PAC; tiene su propio reporte |
| 2.3.9 | 📝 Resumen para Teams o correo | ✅ | ✅ | ✅ |
| 2.3.10 | 🖨 PDF (presentación preliminar) | 🔧 | ✅ | 🔧 Ver 6.2.2 (columnas calculadas en el PDF) |
| **2.4** | **Indicadores**: PAC, comprometidas, no completadas, no programadas, carga vs capacidad, HH reales, PAC ponderado | ✅ | ✅ | ✅ Mismos cálculos que el Tablero y los Reportes (`indicadores.js`) |
| **2.5** | **Tiempo real**: cambios de otros usuarios | 🔧 | ✅ Filtrado por área | 🔧 **Grilla ↔ Tiempo real**: si llegaba una recarga mientras alguien escribía, se perdía lo escrito (corregido el 25/10). La fila en edición ya no se redibuja |

## 3. Planificación: Look Ahead y Restricciones

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **3.1** | **Look Ahead** | | | |
| 3.1.1 | Pestañas 🔭 Look Ahead / 📊 Carga vs capacidad (HH), junto a "Todo el equipo" (85, 94) | ✅ | — | ✅ ⚠ con el número de semanas sobrecargadas |
| 3.1.1.1 | Día de registro y semana que planifica (misma o siguiente), configurables (110) | ✅ | ✅ Parámetro `look_ahead` | ✅ Look Ahead, Comprometer, Plan (programada / no programada), Cartera, Reunión, Reportes y Ayuda usan la misma regla |
| 3.1.2 | Grilla agrupada por semana (horizonte según el parámetro) | ✅ | ✅ | ✅ Al elegir otra semana, la fila pasa a su grupo (79) |
| 3.1.3 | Filas nuevas sin datos se conservan al actualizar (78) | ✅ | — | ✅ Borradores por usuario y por grilla |
| 3.1.4 | Estado LA con su significado al pasar el mouse (75, 76) | ✅ | ✅ | ✅ |
| 3.1.4.1 | "Trasladada al plan" compromete la actividad (81) | ✅ | ✅ | ✅ Aparece en el Plan semanal |
| 3.1.4.2 | Volver de "Trasladada" a "Lista" | 🔧 | ✅ | 🔧 **Look Ahead ↔ Plan**: al quedar comprometida, la fila se bloqueaba y no se podía deshacer. Ahora sigue editable mientras el compromiso no tenga estado final; al volver a Lista sale del Plan |
| 3.1.4.3 | Con restricción / Lista según las restricciones | 🔧 | 🔧 Migración 016 | 🔧 Ver 3.2.3 |
| 3.1.5 | ✔ Comprometer semana siguiente | ✅ | ✅ | ✅ Plan semanal; aviso RN-07 |
| 3.1.6 | 🧩 Aplicar plantilla de servicio | 🔧 | ✅ | 🔧 **Plantillas ↔ CET/Servicio**: los ítems sin servicio quedaban sin CET. Ahora toman el de la plantilla o, si no tiene, el del proyecto |
| 3.1.7 | 🗂 Desde la cartera | ✅ | ✅ `cartera_id`, misma área | ✅ La solicitud pasa a "En proceso" |
| 3.1.8 | Columna 💬 Comentarios y enlaces | 🔧 | ✅ | 🔧 **Look Ahead ↔ Comentarios**: siempre mostraba "＋" (el contador no se cargaba). Ahora muestra la cantidad, como el Plan |
| 3.1.9 | Carga vs capacidad por persona y semana | ✅ | ✅ `ubicaciones_dia` | ✅ Equipo y capacidad; vacaciones y feriados |
| 3.1.10 | 🖨 PDF (una tabla por semana + restricciones) | ✅ | ✅ | ✅ Mismas columnas y anchos que la pantalla |
| **3.2** | **Restricciones** | | | |
| 3.2.1 | KPIs, tablas por tipo y por responsable | ✅ | ✅ RLS (solo el equipo) | ✅ |
| 3.2.2 | Grilla (Restricción y Comentarios en varias líneas) | 🔧 | ✅ | 🔧 Ahora aceptan varias líneas, como Actividad y Comentario (80) |
| 3.2.3 | Levantar, reabrir o eliminar desde la grilla | 🔧 | 🔧 `tg_restriccion_estado_la` (016) | 🔧 **Restricciones ↔ Look Ahead**: desde esta pantalla la actividad seguía "Con restricción" aunque ya no tuviera pendientes. Ahora pasa a "Lista", igual que desde el Look Ahead. La base lo hace aunque quien la levante no sea el responsable de la actividad |
| 3.2.4 | Nueva restricción desde una actividad (🚧) | ✅ | ✅ | ✅ La actividad pasa a "Con restricción" |
| 3.2.5 | 🖨 PDF | 🔧 | ✅ | 🔧 La columna Actividad salía vacía en el PDF (ver 6.2.2) |

## 4. Cartera, proyectos y plantillas

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **4.1** | **Cartera y solicitudes** | | | |
| 4.1.1 | Grilla con CET y Servicio enlazados | 🔧 | ✅ | 🔧 **Cartera ↔ Plan/Look Ahead (52, 72)**: la cartera tenía una sola columna "CET / Servicio" y no enlazaba proyecto, gerencia y servicio. Ahora usa las mismas columnas y reglas; la Descripción admite varias líneas |
| 4.1.2 | Solicitudes nuevas por atender: Aceptar / Rechazar | ✅ | ✅ | ✅ Muestra "CET · Servicio"; notifica al solicitante |
| 4.1.3 | Registrar solicitud de otra gerencia | ✅ | ✅ | 🔧 El selector muestra "CET · Servicio" |
| 4.1.4 | Clic derecho → Crear actividad en el Look Ahead | ✅ | ✅ | ✅ Look Ahead (3.1.7) |
| 4.1.5 | Vista del solicitante (rol Consulta): Mis solicitudes | ✅ | ✅ RLS `solicitante_id` | ✅ |
| 4.1.6 | 🖨 PDF | 🔧 | ✅ | 🔧 Antigüedad y Origen salían vacías o con el código interno (ver 6.2.2) |
| **4.2** | **Proyectos / Procesos** (Configuración → Listas) | | | |
| 4.2.1 | Tres ventanas: Activos, En pausa y Cerrados (32, 35) | ✅ | ✅ | ✅ Al cambiar el estado, el proyecto cambia de ventana |
| 4.2.2 | Nuevo / editar / proponer / aprobar, sin "Líderes asignados" (46) | ✅ | ✅ | ✅ Notificaciones |
| 4.2.2.1 | Líderes agregan proyectos activos (100) | ✅ | ✅ Permiso `agregar_proyecto` (018) | ✅ Proyecto único para todo el equipo; quien lo agregó lo edita y lo ve en «Mis»; eliminar y desactivar siguen en el administrador |
| 4.2.3 | Asignar líderes (clic derecho) | ✅ | ✅ Misma área (015) | ✅ Menú "Mis proyectos" |
| 4.2.4 | Desactivar / reactivar | ✅ | ✅ | ✅ Los inactivos se ven como "(desactivado)" |
| 4.2.5 | Eliminar (doble confirmación) y eliminar con todo su historial | ✅ | ✅ `eliminar_proyecto_completo` | ✅ También quita su asociación en CET / Servicio |
| 4.2.6 | Importar desde Excel (actualiza los existentes) | ✅ | ✅ | ✅ |
| 4.2.7 | Ficha del proyecto: KPIs, datos, hitos, comentarios y PDF | ✅ | ✅ | ✅ Pantalla y PDF muestran los mismos datos, sin "Líderes" (corregido el 25/10) |
| **4.3** | **Plantillas** | | | |
| 4.3.1 | Actividades recurrentes (por dueño) | ✅ | ✅ | ✅ Plan semanal (2.3.2) |
| 4.3.2 | Plantillas de servicio (Semana +n) | ✅ | ✅ | ✅ Look Ahead (3.1.6) |
| 4.3.3 | Columnas iguales a las del Look Ahead (84) | ✅ | ✅ | ✅ Incluido CET ↔ Servicio ↔ Proyecto |
| 4.3.4 | Nueva / renombrar / activar plantilla | ✅ | ✅ | 🔧 El selector muestra "CET · Servicio" |

## 5. Seguimiento

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **5.1** | **Tablero** | | | |
| 5.1.1 | KPIs: PAC, tendencia, PAC ponderado, precisión, restricciones, cartera, arrastres | ✅ | ✅ | ✅ Con Consulta, solo sus gerencias y sin datos internos |
| 5.1.2 | Gráficos: PAC por semana (con histórico), Pareto de CNC, PAC por gerencia | ✅ | ✅ `pac_historico` | ✅ |
| 5.1.3 | PAC por líder; carga de la semana; restricciones por tipo | ✅ | ✅ | ✅ |
| 5.1.4 | Filtros: semanas, gerencia, responsable, proyecto | ✅ | — | ✅ |
| 5.1.5 | 📝 Resumen y 🖨 PDF | 🔧 | ✅ | 🔧 La tabla PAC por líder del PDF ahora tiene anchos fijos, como las demás tablas |
| **5.2** | **Reunión semanal** | | | |
| 5.2.1 | Seis pasos, cronómetro y modo reunión | ✅ | ✅ | ✅ Plan, Restricciones, Look Ahead |
| 5.2.2 | Asistentes y Guardar reunión | ✅ | ✅ | ✅ |
| 5.2.3 | Acuerdos de mejora (grilla) | ✅ | ✅ Misma área | ✅ Reporte "Acuerdos" |
| 5.2.4 | Acta PDF | ✅ | ✅ | ✅ |
| **5.3** | **Equipo y capacidad** | | | |
| 5.3.1 | Todo el personal con su cargo | ✅ | ✅ | ✅ Usuarios, Cargos |
| 5.3.2 | Ubicación por día y capacidad (HH) | ✅ | ✅ | ✅ Look Ahead, Plan, Tablero |
| 5.3.3 | Activar sábado y domingo | ✅ | ✅ | 🔧 Ver 2.1.1.3 |
| 5.3.4 | Heredar la semana anterior | ✅ | ✅ | ✅ |
| 5.3.5 | 🖨 PDF | 🔧 | ✅ | 🔧 Ahora tiene anchos fijos, con los colores de ubicación y las barras de carga |

## 6. Reportes e impresión

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **6.1** | **Módulo Reportes** (árbol + presentación preliminar) | | | |
| 6.1.1 | Árbol de reportes según el rol | 🔧 | ✅ | 🔧 **Reportes ↔ Roles**: Consulta veía los 15 reportes, incluidos los de pantallas a las que no tiene acceso (Plan, Look Ahead, Restricciones, Usuarios…), que salían vacíos. Ahora ve los 4 del Tablero |
| 6.1.2 | Planificación: Plan semanal, Look Ahead, No programadas | ✅ | ✅ | ✅ Columnas de la grilla |
| 6.1.3 | Planificación: Log de restricciones | 🔧 | ✅ | 🔧 Ahora usa las columnas de la pantalla. El filtro Responsable incluye las restricciones de las actividades de esa persona |
| 6.1.4 | Planificación: Cartera de servicios | 🔧 | ✅ | 🔧 Ahora usa las columnas de la pantalla (CET, Servicio, Antigüedad, Origen…) |
| 6.1.5 | Seguimiento: Informe ejecutivo, PAC por semana, PAC por responsable, Pareto | 🔧 | ✅ | 🔧 **Reportes ↔ Tablero**: el periodo terminaba en la semana en curso (incompleta) y el Tablero en la última completa, así que las cifras no coincidían. Ahora coinciden; la visibilidad de Consulta y el PAC histórico siguen las reglas del Tablero |
| 6.1.6 | Seguimiento: Carga vs capacidad, Acuerdos | 🔧 | ✅ | 🔧 Ver 1.3.4 |
| 6.1.7 | Configuración: Proyectos, CET / Servicios, Usuarios y roles (con organigrama) | ✅ | ✅ | ✅ |
| 6.1.8 | Configuración: Plantillas | 🔧 | ✅ | 🔧 Mostraba solo L–V aunque se trabajara sábado y domingo. Ahora usa las columnas de la pantalla Plantillas |
| 6.1.9 | Papel A0–A6, orientación, "Todo en 1 hoja" (92) | ✅ | — | ✅ |
| 6.1.10 | Nombre del archivo GT-LPS_Usuario_Reporte_Fecha (92) | ✅ | — | ✅ PDF, Excel y respaldo |
| **6.2** | **Botón 🖨 PDF de cada pantalla** (12 pantallas, misma presentación preliminar, 93/95) | | | |
| 6.2.1 | Mismas columnas y anchos que la pantalla (88, 91) | ✅ | — | ✅ |
| 6.2.2 | Columnas calculadas (Actividad de la restricción, Días de atraso, Antigüedad, Origen, Semanas pendientes) | 🔧 | — | 🔧 **PDF ↔ Grilla**: salían vacías o con el código interno. Ahora el PDF y los Reportes usan el mismo texto que se ve en la celda |
| 6.2.3 | Legibilidad de las tablas | 🔧 | — | 🔧 Los títulos y las fechas se partían a mitad de palabra ("Responsabl e", "18/10/20 26"). Ahora cada columna tiene al menos el ancho de su palabra más larga y las fechas van en una línea |
| **6.3** | **Excel** (⬇ Excel de cada grilla, 9 grillas) | ✅ | ✅ SheetJS 0.20.3 | ✅ Columnas visibles con el texto de la pantalla |
| **6.4** | Inventario completo de las 40 salidas | ✅ | — | ✅ Ver `docs/REPORTES.md` |

## 7. Configuración

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| **7.1** | **Usuarios y roles** | | | |
| 7.1.1 | Tabla: Nombre, Código, Cargo, Correo, Rol, Gerencias, H/día, Estado (49) | ✅ | ✅ | ✅ |
| 7.1.2 | Crear usuario con contraseña temporal y restablecerla | 🔧 | 🔧 Edge Function `admin-usuarios` | 🔧 **No estaba instalada en Supabase** (al flujo de GitHub le faltaban las credenciales y se saltaba ese paso). Se instaló el 25/10 con el conector de Supabase y se probó creando un usuario real. Esa prueba mostró que el usuario no quedaba obligado a cambiar la contraseña y que llegaba un aviso falso de «por aprobar», porque Supabase guarda la marca del administrador después de crear la cuenta. Corregido en la función |
| 7.1.3 | Eliminar usuario (se desactiva si tiene historial) | ✅ | ✅ `eliminar_usuario` | ✅ |
| 7.1.4 | Ocho roles; el Super administrador edita los permisos del Administrador | ✅ | ✅ | ✅ Matriz de permisos (7.4) |
| 7.1.5 | Organigrama: agregar, mover, generar, pantalla completa, PDF | ✅ | ✅ `organigrama_nodos` | ✅ Usuarios, Cargos, Reporte "Usuarios y roles" |
| **7.2** | **Listas** | | | |
| 7.2.1 | Agrupadas; grupo editable (22) | ✅ | ✅ | ✅ |
| 7.2.2 | CET / Servicio: Proyecto · CET · Servicio (26, 30, 51) | ✅ | ✅ | 🔧 El Proyecto de cada servicio ahora también limita las opciones en Plan, Look Ahead, Plantillas y Cartera (2.1.1.4) |
| 7.2.2.1 | Líderes agregan CET / Servicio (100) | ✅ | ✅ Permiso `agregar_cet` (018) | ✅ Clic derecho en el título CET o Servicio (Plan, Look Ahead, Cartera, Plantillas) o en el proyecto; al pegar desde Excel también; editar y eliminar siguen en el administrador |
| 7.2.3 | Gerencias, Cargos, CNC, tipos, estados (protegidos) | ✅ | ✅ `tg_proteger_valor` | ✅ |
| 7.2.4 | Clic derecho en el título de una columna → editar su lista | ✅ | ✅ | ✅ |
| 7.3 | Parámetros (meta, semanas del Look Ahead, días, horas, cierre, reunión) | ✅ | ✅ | ✅ Plan, Look Ahead, Capacidad, Ayuda |
| 7.4 | Matriz de permisos | ✅ | ✅ `puede()` en el navegador y en la base | ✅ Todos los módulos |
| 7.5 | Columnas personalizadas | ✅ | ✅ | ✅ Grillas, PDF y Reportes |
| 7.6 | Importar histórico de Excel | 🔧 | ✅ | 🔧 **Importación ↔ CET/Servicio (72)**: los servicios nuevos se creaban sin su CET aunque el Excel lo trajera. Ahora se guardan con su CET y el servicio también se reconoce por su CET |
| 7.7 | Importar catálogo de proyectos | ✅ | ✅ | ✅ |
| 7.8 | Respaldo JSON, Excel de datos principales y respaldo semanal a Google Drive | ⚙️ | ✅ `exportar_respaldo` | ✅ El semanal necesita los secretos de Drive (README) |
| 7.9 | Auditoría | ✅ | ✅ `tg_auditoria` | ✅ |

## 8. Otros módulos

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| 8.1 | Mejoras del aplicativo (solicitar y gestionar) | ✅ | ✅ | ✅ |
| 8.2 | Ayuda, guía rápida en PDF y recorrido guiado | 🔧 | — | 🔧 **Ayuda ↔ pedidos 72–96**: no explicaba CET ↔ Servicio, el paso del Look Ahead al Plan, los estados LA, las no programadas, Alt+Enter, Reportes, A/A+ ni ☰. Ahora sí, y el recorrido tiene un paso para el tamaño de letra |
| 8.3 | Ventanas emergentes movibles | ✅ | — | ✅ Ver `docs/VENTANAS.md` |

## 9. Seguridad e infraestructura

| # | Módulo / Funcionalidad / Sub-funcionalidad | Estado | Compat. base | Compat. cruzada (integridad) |
|---|---|:-:|:-:|---|
| 9.1 | RLS en todas las tablas; aislamiento entre áreas; autoría no suplantable | ✅ | ✅ Pruebas de ataque | ✅ |
| 9.2 | Instalable y consulta sin conexión | ✅ | ✅ | ✅ El service worker incluye las 36 vistas y servicios |
| 9.3 | Funciones `SECURITY DEFINER` sin acceso anónimo y con `search_path` fijo | ✅ | ✅ | ✅ Incluida la nueva `tg_restriccion_estado_la` |
| 9.4 | Claves: solo la publicable en el navegador | ✅ | ✅ | ✅ El CI bloquea claves secretas |
| 9.5 | Repositorio público sin datos de la empresa | ✅ | — | ✅ *gitleaks* en el CI |
| 9.6 | Publicación en GitHub Pages y CI "Listo para producción" | ✅ | ✅ | ✅ |
| 9.7 | Migraciones 015 a 018 aplicadas en Supabase (25/10) | ✅ | ✅ Verificado en la base | ✅ Disparador del Estado LA activo; las 14 funciones de disparador ya no se pueden invocar como API (017) |
| 9.8 | Plan de Supabase para muchos usuarios simultáneos y Sentry | ⚙️ | — | Ver `docs/PRODUCCION.md` |

---

## 10. Incompatibilidades encontradas y corregidas (pedido 98)

| # | Conflicto | Módulos que chocaban | Corrección |
|---|---|---|---|
| 1 | Levantar una restricción desde su pantalla no pasaba la actividad a "Lista" | Restricciones ↔ Look Ahead | Sincronización común en el navegador y disparador en la base (migración 016) |
| 2 | Quien levanta una restricción de otro no podía actualizar el Estado LA (RLS) | Restricciones ↔ permisos de Actividades | Disparador `SECURITY DEFINER` (016) con prueba automática |
| 3 | Se podía elegir el CET / Servicio de otro proyecto | CET / Servicio ↔ Proyectos (Plan, Look Ahead, Plantillas, Cartera) | Opciones según el proyecto de la fila; reglas comunes `derivarProyectoServicio` |
| 4 | La Cartera tenía una sola columna "CET / Servicio" sin enlace | Cartera ↔ Plan y Look Ahead (52, 72) | Mismas columnas CET y Servicio, y mismas reglas |
| 5 | Sábado y domingo seguían ocultos al activarlos | Vistas guardadas ↔ Equipo (fin de semana) | La visibilidad la decide el parámetro |
| 6 | "Trasladada al plan" no se podía deshacer | Look Ahead ↔ Plan | Editable mientras no tenga estado final |
| 7 | La columna 💬 del Look Ahead no contaba los comentarios | Look Ahead ↔ Comentarios | Contador cargado, como en el Plan |
| 8 | Ítems de plantilla sin servicio quedaban sin CET al aplicarse | Plantillas ↔ CET / Servicio | Servicio de la plantilla o del proyecto |
| 9 | El histórico de Excel perdía el CET de los servicios nuevos | Importación ↔ CET / Servicio | Se guarda el CET y se busca por CET |
| 10 | Consulta veía reportes de pantallas sin acceso | Reportes ↔ Roles | Árbol según el rol |
| 11 | El PAC de Reportes no coincidía con el del Tablero | Reportes ↔ Tablero | Mismo periodo, visibilidad e histórico |
| 12 | La carga de Reportes filtraba por proyecto y la de la pantalla no | Reportes ↔ Look Ahead | Carga total de la persona en ambos |
| 13 | Los reportes Restricciones, Cartera y Plantillas no tenían las columnas de la pantalla | Reportes ↔ Pantallas (88, 91, 93) | Usan las definiciones de cada pantalla |
| 14 | Columnas calculadas vacías en los PDF | PDF ↔ Grilla | Mismo texto que la celda |
| 15 | Una recarga en segundo plano borraba lo que se estaba escribiendo | Grilla ↔ Tiempo real | La fila en edición no se redibuja |
| 16 | La Ayuda no describía los pedidos 72–96 | Ayuda ↔ todos los módulos | Guía y recorrido actualizados |

**Presentación (diseño gráfico)**
- La columna CET se veía vacía en la demostración: ahora la demostración trae CET ficticios.
- Los títulos y las fechas de los PDF se partían a mitad de palabra: ahora tienen un ancho mínimo legible.
- Las tablas "Solicitudes nuevas" y "Mis solicitudes" muestran "CET · Servicio".

**Correcciones anteriores (pedido 54) que siguen vigentes:** aislamiento entre áreas, autoría, menciones, copia sin conexión, lector de Excel actualizado, tiempo real por área, políticas optimizadas, filtro en columnas calculadas y escapado de HTML (migración 015).

**Aplicado en Supabase el 25/10** (con el conector de Supabase, sin pasos manuales): migraciones 016 y 017 (la 015 ya estaba) y la Edge Function `admin-usuarios`. Opcional y sin costo: activar en Supabase la protección contra contraseñas filtradas (Authentication → Passwords).
