# LPS-GES · Inventario de reportes

Revisión de todos los módulos y procesos del aplicativo al 25/10/2026: cada reporte, impresión y exportación, con su ubicación y contenido.

**Reglas comunes a todos los PDF**
- Se abren en la misma **presentación preliminar**: papel A0–A6, horizontal o vertical, "Todo en 1 hoja", nombre del archivo y **Guardar PDF**.
- Nombre del archivo: **`GT-LPS_Usuario_Reporte_Fecha`** (fecha DD-MM-AAAA). La misma regla se aplica a Excel y al respaldo.
- Encabezado: versión, proyecto seleccionado (o "Todos los proyectos"), fecha y hora. Pie: firma y número de página.
- Las tablas tienen anchos de columna fijos y proporcionales. Si el reporte sale de una grilla, usa **las mismas columnas, orden y anchos que la pantalla**.
- Respetan el proyecto elegido en el menú lateral y los permisos de cada rol. La excepción es "Carga vs capacidad", que suma todos los proyectos de cada persona, porque la capacidad es de la persona.
- El rol Consulta ve en el módulo Reportes solo los 4 del Tablero (Informe ejecutivo, PAC por semana, PAC por responsable y Pareto).
- Los reportes de PAC terminan, por defecto, en la última semana completa, como el Tablero. El Plan semanal y las No programadas usan la semana actual.

## 1. Módulo Reportes (menú lateral → 🖨 Reportes)

| # | Grupo | Reporte | Filtros | Contenido |
|---|---|---|---|---|
| 1 | Planificación | Plan semanal | Semana, Responsable | PAC, comprometidas, completadas, no completadas, no programadas y HH plan; compromisos con las columnas de la grilla del Plan |
| 2 | Planificación | Look Ahead | Responsable | Una tabla por semana del horizonte (columnas de la grilla) más las restricciones pendientes de cada actividad |
| 3 | Planificación | Actividades no programadas | Semana, Responsable | Compromisos que surgieron durante la semana (no afectan el PAC) |
| 4 | Planificación | Log de restricciones | Responsable | Abiertas, vencidas, levantadas y % a tiempo; detalle con las columnas de la pantalla Restricciones |
| 5 | Planificación | Cartera de servicios | Responsable | Total, abiertas y nuevas; detalle con las columnas de la pantalla Cartera (incluye CET y Servicio) |
| 6 | Seguimiento y control | Informe ejecutivo | Semana, Periodo, Responsable | KPIs del periodo y de la semana, gráfico de PAC por semana con la meta y las 5 principales CNC |
| 7 | Seguimiento y control | PAC por semana | Semana, Periodo, Responsable | Gráfico con la meta y tabla semanal (incluye el PAC histórico importado) |
| 8 | Seguimiento y control | PAC por responsable | Semana, Periodo | Gráfico y tabla por persona: PAC, HH plan y precisión |
| 9 | Seguimiento y control | Pareto de CNC | Semana, Periodo, Responsable | Gráfico y tabla con cantidad, % y % acumulado |
| 10 | Seguimiento y control | Carga vs capacidad (HH) | Responsable | Barras de carga por persona y semana del Look Ahead (verde, ámbar, rojo) |
| 11 | Seguimiento y control | Acuerdos de mejora | — | Acuerdos de la reunión semanal: acción, causa, responsable, fecha y estado |
| 12 | Configuración | Catálogo de proyectos / procesos | — | Una tabla por estado (activos, en pausa, cerrados, propuestos) |
| 13 | Configuración | CET / Servicios | — | Proyecto, CET, servicio y si está activo |
| 14 | Configuración | Usuarios y roles (con organigrama) | — | Tabla igual a la de la pantalla Usuarios y el organigrama en imagen vectorial |
| 15 | Configuración | Plantillas | — | Plantillas recurrentes y de servicio con las columnas de la pantalla Plantillas |

## 2. Botón 🖨 PDF de cada pantalla

| # | Pantalla | Reporte | Contenido |
|---|---|---|---|
| 16 | Plan semanal | Plan semanal | KPIs de la semana y compromisos tal como se ven en la grilla |
| 17 | Look Ahead | Look Ahead | Una tabla por semana (columnas de la grilla) y las restricciones |
| 18 | Restricciones | Log de restricciones | KPIs y la grilla de restricciones |
| 19 | Cartera y solicitudes | Cartera de servicios | La grilla de cartera |
| 20 | Tablero | Tablero de indicadores | KPIs, gráficos (PAC por semana, Pareto de CNC, PAC por gerencia) y PAC por líder |
| 21 | Reunión semanal | Acta de reunión semanal | Fecha, asistentes, PAC de la semana anterior, CNC y acuerdos vigentes |
| 22 | Equipo y capacidad | Equipo y capacidad | Ubicación de cada persona por día y su capacidad en HH |
| 23 | Configuración → Usuarios | Usuarios y roles | Tabla de usuarios y organigrama |
| 24 | Usuarios → Organigrama | Organigrama del equipo | Organigrama en imagen vectorial |
| 25 | Configuración → Listas → Proyectos | Catálogo de proyectos | Columnas de las ventanas de proyectos |
| 26 | Ficha del proyecto | Ficha de proyecto | PAC, HH plan, restricciones abiertas, datos del proyecto e hitos |
| 27 | Ayuda | Guía rápida LPS-GES | Guía de uso del aplicativo |

## 3. Exportación a Excel (botón ⬇ Excel de cada grilla)

Cada archivo exporta las columnas visibles con el texto que se ve en pantalla.

| # | Pantalla | Contenido |
|---|---|---|
| 28 | Plan semanal | Compromisos de la semana |
| 29 | Look Ahead | Actividades de las semanas del horizonte |
| 30 | Restricciones | Log de restricciones |
| 31 | Cartera y solicitudes | Cartera |
| 32 | Reunión semanal | Acuerdos |
| 33 | Configuración → Listas → Proyectos | Proyectos activos, en pausa y cerrados (una grilla por ventana) |
| 34 | Configuración → Listas | Valores de la lista elegida (CET / Servicio, Cargos, Gerencias…) |
| 35 | Configuración → Columnas | Columnas personalizadas |
| 36 | Plantillas | Actividades de la plantilla elegida |

## 4. Otros resultados

| # | Dónde | Resultado | Formato |
|---|---|---|---|
| 37 | Plan semanal y Tablero → 📝 Resumen | Resumen semanal, listo para pegar en Teams o en un correo | Texto |
| 38 | Configuración → Respaldo | Respaldo completo (para restaurar); solo el administrador | JSON |
| 39 | Configuración → Respaldo | Datos principales: proyectos, actividades, restricciones, cartera, cierres, acuerdos y PAC histórico | Excel |
| 40 | Automático (GitHub Actions) | Respaldo semanal en la carpeta privada de Google Drive | JSON comprimido |

**Total: 40 salidas.** Son 27 PDF (15 en el módulo Reportes y 12 desde las pantallas), 9 exportaciones a Excel y 4 resultados de otros tipos.

## Observaciones de la revisión

| Observación | Acción |
|---|---|
| La Ficha de proyecto en PDF todavía mostraba "Líderes" (se retiraron en el pedido 46) | Corregido: ahora muestra el Estado |
| Los PDF de **Tablero** (tabla PAC por líder) y **Equipo y capacidad** copiaban la tabla de la pantalla, sin los anchos fijos del resto | Corregido (pedido 99): anchos fijos proporcionales a la pantalla, con barras de avance y colores de ubicación |
| Pedido 98: columnas calculadas vacías en el PDF, reportes con columnas propias y títulos cortados a mitad de palabra | Corregido: el PDF usa el texto de cada celda, los reportes usan las columnas de cada pantalla y ninguna palabra se corta (ver `docs/MATRIZ-DIAGNOSTICO.md`) |
| El PDF del Plan y el del Look Ahead aparecen en dos lugares: el módulo Reportes y el botón de cada pantalla | Es intencional. El de la pantalla imprime lo que se está viendo, con los filtros y columnas de ese momento. El del módulo Reportes permite elegir la semana, el periodo y el responsable. |
