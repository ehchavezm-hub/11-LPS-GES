# 01 — Modelo de datos

Cada entidad lista sus campos con tipo, valor por defecto y notas. Las plantillas JSON vacías están en [`plantillas/`](plantillas/).

**Dónde vivía cada cosa en ECM Project:**
- 🗄 **IndexedDB + Supabase** — entidades del cronograma (sincronizadas con la nube).
- 💾 **solo localStorage** — todo el módulo LPS. **No se sincronizaba ni se exportaba en el JSON del proyecto.** Es la principal brecha a corregir en LPS-GES (ver propuesta en `07-base-de-datos.sql`).

Convenciones generales:
- IDs: `crypto.randomUUID()` (entidades de cronograma); LPS usaba `Date.now().toString(36) + random` (débil, cambiar a UUID).
- Fechas: texto ISO `YYYY-MM-DD`; marcas de tiempo ISO 8601 completas.
- Borrado lógico: `deleted_at` (nunca se borra físicamente; permite deshacer y recuperar).
- Toda entidad sincronizable lleva `org_id`, `created_at`, `updated_at`, `deleted_at`.

---

## A. Módulo LPS (Last Planner System) — 💾 localStorage

Claves usadas: `ecm-lad-plan`, `ecm-lad-rest`, `ecm-lad-ppc`, `ecm-lad-meta`, `ecm-lad-standup`. Todas indexadas por `project_id`.

### A1. Actividad LPS (LookAhead) — `ecm-lad-plan[projectId][weekKey][]`
Plantilla: `plantillas/lps-actividad.json`

| Campo | Tipo | Defecto | Notas |
|---|---|---|---|
| `id` | texto | generado | |
| `code` | texto | `''` | Código de actividad (ej. `COD-001`). Se usa para vincular restricciones por número. |
| `name` | texto | — | **Obligatorio.** Descripción de la actividad. |
| `responsible` | texto | `''` | Responsable / Last Planner. |
| `trade` | texto | `''` | Gremio / especialidad / subcontrata. |
| `unit` | texto | `''` | Unidad de medida (m², m³, kg, und…). |
| `qty` | número \| null | `null` | Metrado (cantidad planificada). |
| `status` | `'ready'` \| `'blocked'` | `'ready'` | ✅ Lista / 🚧 Bloqueada. Las importadas por XLS no lo traían (se asume `ready`). |

La **semana** no es un campo: es la clave del contenedor `weekKey` en formato ISO `YYYY-WNN` (ej. `2026-W43`).

### A2. Restricción — `ecm-lad-rest[projectId][]`
Plantilla: `plantillas/lps-restriccion.json`

| Campo | Tipo | Defecto | Notas |
|---|---|---|---|
| `id` | texto | `rest-<timestamp>` | |
| `desc` | texto | — | **Obligatorio.** Descripción. |
| `type` | lista \| null | `null` | Ver catálogo *Tipos de restricción*. |
| `activityNumber` | texto \| null | `null` | Código de la actividad LPS o EDT afectada (vínculo por texto). |
| `taskId` | uuid \| null | `null` | Tarea del cronograma maestro vinculada (vínculo fuerte). |
| `responsible` | texto \| null | `null` | Persona responsable de levantarla. |
| `responsibleCompany` | texto \| null | `null` | Empresa / área funcional. |
| `rfiNumber` | texto \| null | `null` | N.º de RFI asociado. |
| `dateIdentified` | fecha \| null | `null` | F. identificada. |
| `requiredDate` | fecha \| null | `null` | F. en que **se necesita** resolver. |
| `dueDate` | fecha \| null | = `requiredDate` | Campo legado; duplicado de `requiredDate`. |
| `promisedDate` | fecha \| null | `null` | F. **prometida** de resolución. |
| `effectiveDate` | fecha \| null | `null` | F. **efectiva** de resolución. |
| `status` | `'pending'` \| `'in-progress'` \| `'cleared'` | `'pending'` | Pendiente / En proceso / Levantada. |
| `comments` | texto \| null | `null` | Observaciones. |
| `createdAt`, `updatedAt` | timestamp | ahora | |

Una restricción está **activa** si `status !== 'cleared'`. Se cuenta contra una actividad si `taskId === act.id` **o** `activityNumber === act.code`.

### A3. Registro PPC semanal — `ecm-lad-ppc[projectId][weekKey]`
Plantilla: `plantillas/lps-ppc-semana.json`

| Campo | Tipo | Notas |
|---|---|---|
| `tasks` | mapa `itemId → boolean` | `true` = completada. `itemId` = `lps-<idActividad>` o `cpm-<idTarea>`. |
| `reasons` | mapa `itemId → causa` | Causa de no cumplimiento (catálogo *Causas*). Solo para no completadas. |
| `saved` | boolean | `true` al pulsar "Guardar PPC". Solo semanas guardadas cuentan en métricas. |
| `savedAt` | timestamp | |

### A4. Metadatos del Plan Semanal (WWP) — `ecm-lad-meta[projectId]`
Plantilla: `plantillas/lps-meta-wwp.json`

| Campo | Notas |
|---|---|
| `area` | Área / frente de trabajo |
| `contratista` | Contratista / empresa |
| `turno` | Día / Noche / Especial |
| `lastPlanner` | Nombre del Last Planner™ |

⚠ Era **uno por proyecto**, no por semana ni por frente. En LPS-GES conviene que sea por semana + frente.

### A5. Stand-Up diario — `ecm-lad-standup[projectId][fecha]`
Plantilla: `plantillas/lps-standup.json`

| Campo | Notas |
|---|---|
| clave `YYYY-MM-DD` | Un registro por día (sobrescribe si se guarda de nuevo). |
| `q1` | ¿Qué aprendiste hoy? |
| `q2` | ¿Qué mejoraste hoy? |
| `q3` | ¿Qué haría que mañana sea mejor? |
| `savedAt` | timestamp |

Validación: al menos una de las tres preguntas con texto.

### A6. Catálogos LPS (valores fijos en código)

**Causas de no cumplimiento (15)** — `CAUSAS` en `lookahead-detailed.js`:
1. Mala planificación
2. Pre-requisito / trabajo previo
3. Problema de diseño / planos
4. Inspección no aprobada
5. Mano de obra no disponible
6. Materiales no disponibles
7. Equipos / herramientas no disponibles
8. Contratos / órdenes de cambio
9. Submittals / aprobaciones pendientes
10. Condiciones climáticas
11. Me olvidé
12. Sin actualización / Info. faltante
13. Permisos / autorizaciones faltantes
14. Condición no prevista
15. Otras causas

**Tipos de restricción (9):** Pre-requisito · Materiales · Mano de Obra · Equipos · Diseño / Planos · Permisos · Submittals · Contratos / CO · Otros.

**Estados de restricción:** `pending` Pendiente 🔒 (rojo) → `in-progress` En proceso ⏳ (naranja) → `cleared` Levantada 🔓 (verde). El botón de estado rota en ese ciclo.

**Estado de tarea CPM en vistas LPS:** `done` Completada (pct ≥ 100) · `critical` Crítica (TF = 0) · `progress` En Curso (pct > 0) · `todo` Pendiente.

---

## B. Estructura organizativa — 🗄

| Entidad | Campos clave | Notas |
|---|---|---|
| `organizations` | `name`, `slug` (único), `plan`='free', `settings` JSON | |
| `profiles` | `full_name`, `avatar_url`, `timezone`='America/Lima' | Espejo de `auth.users` |
| `memberships` | `org_id`, `user_id`, `role`='member' | Único (org, user) |
| `portfolios` | `org_id`, `name`, `description`, `settings` | |
| `programs` | `org_id`, `portfolio_id`, `name`, `description`, `settings` | |

Plantillas: `plantillas/portafolio.json`, `plantillas/programa.json`.

## C. Proyecto — 🗄 `projects`
Plantilla: `plantillas/proyecto.json`

| Campo | Tipo | Defecto | Notas |
|---|---|---|---|
| `code` | texto | — | Código / sigla (máx. 20 en UI). Se usa en nombres de archivo exportados. |
| `name` | texto | — | **Obligatorio** (máx. 120). |
| `description` | texto | | |
| `program_id` | uuid \| null | | Padre (Programa). |
| `sponsor_id` | uuid \| null | | |
| `calendar_id` | uuid \| null | | Un calendario por proyecto (D3). |
| `status` | texto | `'active'` | |
| `start_date` | fecha | — | **Obligatorio** al crear. Índice 0 del CPM. |
| `actual_start_date`, `actual_finish_date` | fecha | | |
| `data_date` | fecha \| null | | Fecha de corte (EVM, DCMA #12). |
| `budget`, `planned_budget` | numérico(18,2) | | |
| `currency` | texto | `'PEN'` | |
| `is_template` | boolean | `false` | |
| `settings` | JSON | `{}` | |

## D. Calendario — 🗄 `calendars` + `calendar_exceptions`
Plantillas: `plantillas/calendario.json`

| Campo | Defecto | Notas |
|---|---|---|
| `name` | 'Calendario del proyecto' | |
| `work_week` | `[1,2,3,4,5]` | 0 = Dom … 6 = Sáb |
| `hours_per_day` | 8 | 1–24 |
| `shift_label`, `shift_start`, `shift_end` | | Turno |
| `is_default` | false | |
| Excepción: `on_date`, `is_working` (false = feriado), `name`, `description` | | Único (calendario, fecha) |

## E. Tarea / actividad del cronograma maestro — 🗄 `tasks`
Plantilla: `plantillas/tarea-cpm.json`

| Campo | Tipo | Defecto | Notas |
|---|---|---|---|
| `parent_id` | uuid \| null | | Jerarquía EDT. Resumen = tarea con hijos (D5). |
| `sort_order` | int | 0 | |
| `name` | texto | — | Obligatorio. |
| `type` | `task` \| `milestone` \| `summary` | `task` | En la práctica resumen es derivado. |
| `duration_days` | int | 0 | Días laborables. Hito = 0. |
| `work_hours` | num | 0 | |
| `percent_complete` | 0–100 | 0 | |
| `actual_start`, `actual_finish` | fecha | | |
| `constraint_type` | ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO | `ASAP` | |
| `constraint_date` | fecha | | |
| `planned_cost`, `actual_cost` | num(18,2) | 0 | Base de EVM. |
| `notes` | texto | | |
| `wbs_code` | texto (calculado) | | 1, 1.1, 1.1.2… a partir de la jerarquía. |
| `wbs_description`, `wbs_scope`, `wbs_acceptance`, `wbs_owner` | texto | | Diccionario WBS (solo local). |
| `optimistic_dur`, `most_likely_dur`, `pessimistic_dur` | num | | Estimación de 3 puntos para Monte Carlo (solo local). |

Resultados CPM calculados (no se capturan): `es, ef, ls, lf, tf, ff, is_critical, is_summary, is_complete`.

## F. Dependencia — 🗄 `task_dependencies`
Plantilla: `plantillas/dependencia.json`

`pred_id`, `succ_id`, `type` (FS \| SS \| FF \| SF, defecto FS), `lag_days` (int; negativo = adelanto). Único (pred, succ, type). No se permiten ciclos ni dependencias sobre tareas resumen.

Notación en la columna "Pred." de la EDT: `3FS`, `4SS+2`, `5FF-1` (n.º de fila + tipo + lag).

## G. Recursos — 🗄 `resources` + `task_resources`
Plantillas: `plantillas/recurso.json`, `plantillas/asignacion-recurso.json`

| Recurso | Notas |
|---|---|
| `name` | Obligatorio |
| `type` | `work` Trabajo (mano de obra) · `material` · `equipment` Equipo/Maquinaria · `cost` Costo fijo |
| `role` | Rol / especialidad (ej. Ing. Civil, Operario) |
| `rate` | Precio por unidad (S/; S/h para trabajo) |
| `unit` | Unidad de medida (material/equipo) |
| `max_units` | Disponibilidad máxima % (trabajo; 100 = jornada completa) |

Asignación: `task_id`, `resource_id`, `allocation`/`units` (defecto 1.0). Único (tarea, recurso).

## H. Líneas base — 🗄 `baselines` + `baseline_tasks`
Plantilla: `plantillas/linea-base.json`

Línea base: `name` (ej. "LB-0 Contrato"; defecto `Línea base AAAA-MM-DD`), `is_primary` (⭐ plan oficial), `is_active`, `notes`.
Instantánea por tarea: `es`, `ef`, `dur` (índices CPM) — en Supabase `planned_start`, `planned_finish`, `planned_duration`, `planned_cost`.

## I. Riesgo — 🗄 store `risks` (solo IndexedDB, no en esquema Supabase)
Plantilla: `plantillas/riesgo.json`

| Campo | Notas |
|---|---|
| `title` | Obligatorio |
| `description` | |
| `category` | Técnico · Externo · Organizacional · Gestión de proyectos · Otro |
| `probability` | 1–5 (Muy baja, Baja, Media, Alta, Muy alta) |
| `impact` | 1–5 (Muy bajo, Bajo, Moderado, Alto, Muy alto) |
| `risk_score` | = probabilidad × impacto |
| `owner` | Responsable |
| `response` | Plan de respuesta |
| `status` | Abierto · En seguimiento · Cerrado · Aceptado |

## J. Infraestructura local

- `outbox`: cola de operaciones pendientes de subir a Supabase (`op`, tabla, registro, timestamp).
- `meta`: pares clave/valor (`id`, `value`).
- localStorage de preferencias: `app-theme`, `wbs-col-visibility` (columnas EDT/impresión), etiquetas de barra Gantt.
