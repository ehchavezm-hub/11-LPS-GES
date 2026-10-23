# 02 — Formularios de toma de datos

> Referencial. Cada formulario indica: dónde estaba, campos (★ = obligatorio), tipo de control, valores permitidos y validaciones.

## LPS — Last Planner System (`js/lookahead-detailed.js`)

Encabezado común del panel: título "Last Planner System® (LPS) — LookAhead de 6 semanas — Estándar LCI 2023", selector **Semanas** (1–8, defecto 6), botón 🖨 Imprimir (imprime la pestaña activa), botón ✕ cerrar. Semana de referencia = semana ISO actual.

### F-LPS-01 · Agregar / editar actividad del LookAhead
Ubicación: pestaña **📅 LookAhead (6 Semanas)**, botón `+ Agregar` en cada bloque semanal (formulario en línea).

| Campo | Control | Placeholder | Regla |
|---|---|---|---|
| Código | texto | `COD-001` | Opcional |
| Actividad ★ | texto | Descripción de la actividad | Si vacío, foco y no guarda |
| Responsable | texto | Nombre | |
| Gremio / Trade | texto | Especialidad | |
| Unidad | texto | m², m³… | |
| Metrado | número | 0 | `parseFloat`; vacío = null |

Acciones por fila: ✏ editar · ✕ eliminar (sin confirmación) · botón de estado ✅ Lista ⇄ 🚧 Bloqueada. Columna "Restricc." muestra 🚧 N restricciones activas vinculadas.
Debajo de las actividades LPS se listan (solo lectura) las tareas del **cronograma maestro** que caen en esa semana, con su estado CPM.

### F-LPS-02 · Importar actividades desde Excel/CSV
Botón `📥 Importar XLS` en cada semana (y en Plan Semanal). Acepta `.xlsx`, `.xls`, `.csv` (separador `,` o `;` autodetectado; primera hoja de Excel). Cabeceras reconocidas (sin distinguir mayúsculas):

| Campo destino | Cabeceras aceptadas |
|---|---|
| name ★ | actividad, activity, descripción, descripcion, nombre, name, tarea, task |
| code | código, codigo, code, cod, id, item |
| responsible | responsable, responsible, resp |
| unit | unidad, unit, und, medida |
| qty | metrado, cantidad, qty, quantity, amount |

Filas sin nombre se omiten. ⚠ No leía `gremio` ni `status`. Plantilla: `plantillas/importacion-actividades-lps.csv`.

### F-LPS-03 · Plan Semanal (WWP) — cabecera
Pestaña **📋 Plan Semanal (WWP)**. Se guardan al salir de cada campo (blur).

| Campo | Placeholder |
|---|---|
| Área | Área / Frente |
| Contratista | Contratista / Empresa |
| Turno | Día / Noche / Especial |
| Last Planner™ | Nombre del Last Planner |

Selector **Semana**: desde (semana actual − N semanas) hasta la semana actual; por defecto la semana anterior.

### F-LPS-04 · Registro de cumplimiento (PPC)
Tabla con una fila por actividad LPS de la semana + tareas CPM de esa semana:

| Columna | Control |
|---|---|
| ✓ | checkbox "hecho" (al marcar, deshabilita la causa) |
| Origen | LPS / CPM |
| Código, Actividad, Responsable/Inicio, Gremio, Unidad/% | solo lectura |
| Causa incumplimiento | lista de las 15 causas (opcional) |

Indicadores en vivo: Planificadas · Completadas · **PPC %** (semáforo). Botón `💾 Guardar PPC` → marca la semana como `saved`.
⚠ No obligaba a registrar causa en las no cumplidas.

### F-LPS-05 · Nueva / editar restricción
Pestaña **🚧 Log de Restricciones**, botón `+ Nueva restricción` (modal).

| Campo | Control | Notas |
|---|---|---|
| Descripción ★ | textarea 3 líneas | alerta "La descripción es obligatoria." |
| Tipo de restricción | lista | 9 tipos |
| Tarea vinculada | lista | tareas no resumen del cronograma (`EDT – nombre`) |
| Responsable | texto | |
| Empresa / Área Funcional | texto | |
| Número de Actividad | texto | código de actividad LPS |
| Número RFI (opcional) | texto | |
| Estado | lista | Pendiente / En proceso / Levantada |
| F. Identificada · F. Requerida · F. Prometida · F. Efectiva | fecha | |
| Comentarios | textarea 2 líneas | Notas adicionales |

Acciones por fila: rotar estado (🔒→⏳→🔓) · ✏️ editar · 🗑 eliminar (con confirmación).
Filtro de historial (`📋 Ver Historial`): **Desde** (fecha) o **Últimas N semanas** (1–52), por `dateIdentified` o `createdAt`.

### F-LPS-06 · Importar restricciones desde Excel/CSV

| Campo destino | Cabeceras aceptadas |
|---|---|
| desc ★ | descripción, descripcion, description, desc, restricción, restriccion |
| type | tipo, type, tipo_restriccion |
| responsible | responsable, responsible, resp |
| responsibleCompany | empresa, company, area, área, empresa_area |
| rfiNumber | rfi, numero_rfi, rfi_number |
| dateIdentified | fecha_identificada, fecha identificada, date_identified, fecha_id |
| requiredDate | fecha_requerida, fecha requerida, required_date (o, si falta, fecha_limite / due_date / fecha) |
| promisedDate | fecha_prometida, fecha prometida, promised_date |
| status | estado/status: contiene "levant"/"resuel"/= cleared → Levantada; "proceso"/"progress" → En proceso; resto → Pendiente |
| comments | observaciones, comentarios, comments, notas |

Fechas aceptadas: `DD/MM/AAAA`, `DD-MM-AAAA` o `AAAA-MM-DD`. ⚠ No leía `numero_actividad`. Plantilla: `plantillas/importacion-restricciones.csv`.

### F-LPS-07 · Stand-Up diario
Pestaña **🌅 Stand-Up Diario**.

| Campo | Control |
|---|---|
| Fecha | fecha (defecto hoy; al cambiarla carga lo guardado) |
| 1. ¿Qué aprendiste hoy? | textarea |
| 2. ¿Qué mejoraste hoy? | textarea |
| 3. ¿Qué haría que mañana sea mejor? | textarea |

Validación: al menos una respuesta. Botones 💾 Guardar · 🗑 Limpiar. Historial filtrable (Desde / Últimas N semanas), con eliminar por fila.

## Vista Lookahead simple (`js/lookahead.js`)
Controles: **Desde** (fecha, defecto hoy) · botones `3 sem.` / `6 sem.` · **Semanas** (1–52) · `↺ Actualizar`. Solo lectura (tareas del CPM).

## Proyecto y estructura (`index.html` → `dlg-new-item`)

| Campo | Control | Regla |
|---|---|---|
| Tipo | botones: 🗂 Portafolio · 📦 Programa · 📋 Proyecto (defecto) | |
| Nombre ★ | texto, máx. 120 | ej. "Edificio Torres del Norte" |
| Código / sigla | texto, máx. 20 | ej. "ETN-2026" |
| Pertenece a | lista (padre) | solo Programa y Proyecto; "— Sin asignar (nivel raíz) —" |
| Fecha de inicio ★ | fecha | solo Proyecto |

## Calendario (`main.js` → `dlg-calendar`)
Nombre del calendario · Días laborables (casillas Lun–Dom) · Horas por día (1–24) · Excepciones: Fecha + Descripción (ej. "Año Nuevo") + Tipo (No laborable / Laborable) + `＋ Agregar`.

## Línea base (`index.html` → `dlg-baseline`)
Nombre (ej. "LB-0 Contrato") + `💾 Guardar` (captura ES/EF actuales). Lista con ⭐ primaria, 📌 aplicar comparación, eliminar; indicador "Activa" + `✕ Limpiar`.

## Tabla EDT (`js/wbs-table.js`) — edición en celda
Nombre (clic) · Tipo (clic: tarea/hito) · Duración (días) · Inicio (fecha → genera restricción) · % avance · Predecesoras (`3FS`, `4SS+2`) · Notas (icono). Indentar/desindentar con Tab / Shift+Tab. Deshacer/Rehacer (Ctrl+Z / Ctrl+Y, 50 pasos).

## Recursos (`main.js` → `dlg-resources`)
Pestaña Catálogo: Nombre ★ · Tipo (Trabajo / Material / Equipo / Costo fijo) · Rol / Especialidad · Precio/Unidad (S/) · Unidad (material/equipo) · Disponibilidad máx. % (trabajo). Pestaña Uso de Recursos (solo lectura). Diálogo "Asignar Recursos a Actividades": tarea × recurso × unidades.

## Diccionario WBS (`js/wbs-dictionary.js`)
Por entregable: Descripción · Alcance (incluye / no incluye) · Criterios de aceptación · Responsable.

## Registro de riesgos (`js/risk-register.js`)
Título ★ · Descripción · Categoría · Estado · Probabilidad (1–5) · Impacto (1–5) · (Score calculado) · Responsable · Plan de respuesta. Vistas: Lista / Matriz 5×5.

## Monte Carlo
Iteraciones: lista predefinida o valor libre 100–50 000. Estimados de 3 puntos opcionales por tarea (optimista / más probable / pesimista); si faltan, ±15 %.

## EVM
Fecha de corte (`data_date`) editable desde el panel ("Establecer fecha"). Costos planificado y real por tarea.
