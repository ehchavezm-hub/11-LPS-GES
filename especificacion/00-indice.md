# 00 — Índice del catálogo extraído de ECM Project

> **Origen:** repositorio `ehchavezm-hub/10-cronograma` (ECM Project v1.0.0, build v86–v99).
> **Alcance:** plantillas, formularios de toma de datos, reportes, cálculos, flujos y estándares visuales.
> **Excluido a propósito:** datos de proyectos reales, datos demo (`js/demo-data.js`, `sql/seed.sql`) y credenciales (`js/config.js`).
> **Fecha de extracción:** 2026-10-23.

## Cómo usar esta carpeta

> ⚠ **Todo este contenido es REFERENCIAL.** LPS-GT solo adoptará *algunas* plantillas de ECM Project. La selección se marca en la lista de [`05-flujo-lps.md`](05-flujo-lps.md#plantillas-candidatas-para-lps-gt-marcar-las-que-se-usarán); lo no marcado queda solo como consulta.

Cada archivo describe *qué* hacía ECM Project y *cómo* lo hacía (campos, reglas, fórmulas), con referencia al archivo fuente original para consultar el detalle.

| Archivo | Contenido |
|---|---|
| [`01-modelo-datos.md`](01-modelo-datos.md) | Todas las entidades, campos, tipos, valores por defecto y dónde se guardaban |
| [`plantillas/`](plantillas/) | Plantillas JSON vacías de cada entidad + cabeceras CSV para importación |
| [`02-toma-de-datos.md`](02-toma-de-datos.md) | Cada formulario/captura: campos, listas desplegables, validaciones |
| [`03-reportes.md`](03-reportes.md) | Cada reporte imprimible/PDF y exportación: columnas, KPIs, encabezado, nombre de archivo |
| [`04-calculos.md`](04-calculos.md) | Fórmulas: PPC, semanas ISO, CPM, EVM, Curva S, DCMA 14, Monte Carlo, nivelación, alertas, riesgos |
| [`05-flujo-lps.md`](05-flujo-lps.md) | Flujo Last Planner (LCI 2023) tal como estaba implementado + brechas detectadas |
| [`06-estandares-ui.md`](06-estandares-ui.md) | Paleta, semáforos, tipografía, layout de paneles, convenciones de impresión |
| [`07-base-de-datos.sql`](07-base-de-datos.sql) | Esquema Supabase (sin datos) + **propuesta** de tablas LPS que en ECM vivían solo en el navegador |
| [`08-decisiones-y-lecciones.md`](08-decisiones-y-lecciones.md) | Decisiones de arquitectura y lecciones de las observaciones corregidas |

## Mapa de módulos de ECM Project

### Navegación principal
- **Barra superior:** logo + versión, nombre del proyecto activo, `↺ Actualizar` (vaciar caché), `Auto-calc` (recalcular CPM automáticamente), duración del proyecto, tema claro/oscuro.
- **Explorador (izquierda):** lista de proyectos (`＋ Nuevo`, `↩ Importar` JSON/XER, `🗂` recuperar eliminados) y sección **Vistas**.
- **Barra de filtros:** Recursos · Calendario · Línea base · Comparar LB · Historial · Curva S · Alertas · Dic. WBS · Reporte PDF · Filtros (Todas / Ruta crítica / En progreso) · menú Exportar.
- **Barra EDT:** Deshacer/Rehacer · ＋Tarea · ◆Hito · Indentar/Desindentar · Enlace FS · Zoom Gantt · Etiquetas de barra · Columnas · **grupo Lookahead / LPS**.
- **Barra de estado:** modo de sincronización, créditos, cantidad de alertas CPM.
- **Móvil:** pestañas inferiores Proyectos / EDT / Gantt / KPIs.

### Vistas y paneles

| # | Módulo | Archivo fuente | Tipo | Relevancia para LPS-GT |
|---|---|---|---|---|
| 1 | **Last Planner System (LPS)** — 5 pestañas | `js/lookahead-detailed.js` | Panel overlay | ★★★ núcleo |
| 2 | Vista Lookahead 3/6 semanas (desde CPM) | `js/lookahead.js` | Panel overlay | ★★★ |
| 3 | Alertas (atrasadas / próximas / críticas) | `js/notifications.js` | Panel overlay | ★★ |
| 4 | EDT (tabla WBS editable) | `js/wbs-table.js` | Panel principal | ★★ (programa maestro) |
| 5 | Gantt (canvas + SVG vectorial) | `js/gantt-canvas.js`, `js/gantt-svg.js` | Panel principal | ★★ |
| 6 | Motor CPM (worker) | `js/cpm.js`, `js/workers/cpm.worker.js` | Cálculo | ★★ |
| 7 | Calendario del proyecto + excepciones | `js/calendar.js`, `main.js` (dlg-calendar) | Diálogo | ★★ |
| 8 | Líneas base + comparación | `js/baseline.js`, `js/baseline-compare.js` | Diálogo | ★ |
| 9 | Curva S (Plan / Real / Proyectado / LB) | `js/curva-s.js` | Panel overlay | ★★ |
| 10 | Valor Ganado (EVM) | `js/evm.js` | Panel | ★ |
| 11 | DCMA 14 puntos | `js/dcma.js` | Panel | ★ |
| 12 | Recursos: catálogo, asignación, uso | `main.js` (dlg-resources, dlg-res-assign) | Diálogo | ★ |
| 13 | Histograma de recursos | `js/resource-histogram.js` | Panel inferior | ★ |
| 14 | Nivelación de recursos | `js/resource-leveling.js` | Panel overlay | ★ |
| 15 | Monte Carlo (PERT) | `js/monte-carlo.js`, worker | Diálogo | ★ |
| 16 | Registro de riesgos (lista + matriz 5×5) | `js/risk-register.js` | Panel overlay | ★★ |
| 17 | Diccionario WBS | `js/wbs-dictionary.js` | Panel overlay | ★ |
| 18 | Historial de cambios (sesión) | `js/change-log.js` | Panel | ★ |
| 19 | Estructura de proyectos (portafolio → programa → proyecto) | `main.js` (dlg-org-chart) | Diálogo | ★ |
| 20 | Red CPM (diagrama de precedencias) | `main.js` (dlg-cpm-network) | Diálogo | ★ |
| 21 | Informe ejecutivo PDF | `js/pdf-report.js` | Reporte | ★★ |
| 22 | Impresión estándar (vista previa A4) | `js/pdf-utils.js`, `js/print.js` | Utilidad | ★★★ (todos los reportes) |
| 23 | Exportar JSON / CSV / MS Project XML / SVG | `js/io.js` | Utilidad | ★★ |
| 24 | Importar JSON / XER Primavera P6 | `js/io.js`, `js/xer-import.js` | Utilidad | ★ |
| 25 | Sincronización offline-first con Supabase | `js/sync.js`, `js/storage.js` | Infraestructura | ★★ |

## Stack técnico de ECM Project (referencia)

- HTML + CSS + JavaScript ES Modules **sin bundler** (`@ts-check` en cada módulo). Publicado en GitHub Pages; empaquetado de escritorio con Electron.
- Persistencia local: **IndexedDB** (16 stores) + **localStorage** (todo el módulo LPS).
- Nube opcional: **Supabase** (Postgres + RLS + Realtime), estrategia last-write-wins por `updated_at`.
- Web Workers para CPM y Monte Carlo (con respaldo síncrono).
- Excel: SheetJS 0.18.5 cargado bajo demanda desde cdnjs.
- PWA: `manifest.json` + `sw.js` (caché versionada `?v=NN`).
