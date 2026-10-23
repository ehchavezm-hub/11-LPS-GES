# 03 — Reportes, impresión y exportaciones

> Referencial.

## Estándar de impresión (aplica a todos los reportes) — `js/pdf-utils.js` → `printToPdf(modulo, html)`

Abre una ventana de **vista previa A4** con barra de herramientas:
- `🖨 Guardar PDF` (usa la impresión del navegador) · Orientación **Vertical / Horizontal** · campo **Archivo** editable · `✕ Cerrar`.

Diseño de página:
- **Encabezado** (fijo, 26 px, línea inferior): `ECM Project V1.00.01` | nombre del proyecto | `DD-MM-AAAA, HH:MM`.
- **Pie** (fijo, 22 px, línea superior): `By EHCM` | — | `Página N de M`.
- **Título del módulo** centrado (Urbanist 14 pt, `#1A365D`).
- Márgenes `@page`: 26 px arriba, 10 mm lados, 22 px abajo. Tablas con borde `#ccc`, cabecera `#f4f5f7`, celdas 12 px.
- Se ocultan iconos y botones de la UI. Colores semafóricos se conservan (`print-color-adjust: exact`).

**Nombre de archivo:** `<Proyecto>-<Módulo>-<DDMMAAAA>.pdf` (ej. `Torre A-Plan Semanal WWP - LCI §9-23102026.pdf`).

## Reportes del módulo LPS

### R-LPS-01 · Lookahead Detallado — Planificación N semanas
Título: "Lookahead Detallado — Planificación N semanas". Una sección por semana (`Sem N · DD/MM–DD/MM (AAAA)`):

| Origen | Actividad | Responsable | Unidad | Metrado |
|---|---|---|---|---|

Para filas CPM: Origen=CPM, Actividad, Inicio–Fin, %, Estado. "Sin actividades." si la semana está vacía.

### R-LPS-02 · Plan de Trabajo Semanal (WWP) — LCI §9
Cabecera (tabla 2×4): Proyecto · N.º Proyecto · Área · Contratista · Turno · Last Planner™ · Semana · Fin de semana.
Resumen: `Planificadas: N | Completadas: N | PPC: N%`.

| ID Actividad | Descripción Compromiso | Last Planner | F. Inicio | Cuadrilla (L-D) | ¿HECHO? (SÍ/NO verde/rojo) | Razón de Varianza | Notas |
|---|---|---|---|---|---|---|---|

⚠ "F. Inicio" y "Cuadrilla (L-D)" salían vacías para actividades LPS (no había campos para ellos).

### R-LPS-03 · Log de Restricciones — LCI §8
Cabecera: Proyecto · N.º Proyecto · Responsable (Last Planner) · F. Actualización (hoy). Conteo total.

| #Restricción | #Actividad | Descripción | #RFI | Responsable | Empresa / Área | F. Identificada | F. Necesita Resolución | F. Prometida Resolución | F. Resolución Efectiva |
|---|---|---|---|---|---|---|---|---|---|

⚠ El impreso no incluía Estado, Tipo ni Comentarios (la pantalla sí mostraba Estado).

### R-LPS-04 · Métricas LPS / PPC (Dashboard)
En pantalla:
- **4 tarjetas KPI:** PPC Promedio (semanas con datos) · Tareas en Lookahead · Tareas Críticas (TF=0) · Restricciones Pendientes (+ levantadas).
- **Gráfico de barras PPC** últimas max(N,4) semanas (S1…Sn) con banda 75–90 %, línea de referencia 75 % (meta LCI) y 90 % (óptimo LCI), línea de tendencia punteada.
- **Tabla histórica:** Semana # · Fin de semana · # Planificadas · # Completadas · PPC · Promedio acumulado · No completadas.
- **Razones de Varianza — §12 LCI:** barras horizontales (Pareto) con cantidad y % por causa, acumulado de todas las semanas guardadas.
- **Resumen Lookahead actual:** Planificadas · Completadas · Atrasadas · En progreso/pendiente.
- **Últimas 5 restricciones:** Descripción · Tipo · Responsable · F. Identificada · F. Requerida · Estado.

Impreso ("Lookahead — Dashboard"): tabla Semana/Planificadas/Completadas/PPC + tabla de todas las restricciones (Descripción, Tipo, Responsable, F. Identificada, Estado). ⚠ No imprimía los gráficos ni el Pareto de causas.

### R-LPS-05 · Stand-Up Diario — Registro LPS §10
Proyecto + n.º de registros. Tabla: Fecha · ¿Qué aprendiste hoy? · ¿Qué mejoraste hoy? · ¿Qué haría que mañana sea mejor? (más reciente primero).

### R-LA-01 · Vista Lookahead (CPM)
Título "Vista Lookahead — N semanas desde DD/MM/AAAA", n.º de tareas.

| Tarea | Inicio | Fin | Avance | Estado (Pendiente/En Curso/Completada/Atrasada) | Holgura (roja si 0) |
|---|---|---|---|---|---|

## Otros reportes de ECM Project

| Reporte | Contenido principal |
|---|---|
| Alertas | Tipo (🔴 Atrasada / 🟡 Próxima / 🔷 Crítica) · Estado · Tarea · Avance · Detalle (días) |
| Curva S | SVG 760×340 (Planificado azul, Real verde, Proyectado naranja punteado, Línea Base morado) + tabla de ~10 puntos: Fecha · % de cada serie |
| EVM | 6 KPIs en fila (BAC, SV, CV, SPI, CPI, EAC/VAC) con semáforo + curva PV/EV/AC + tabla por actividad: BAC · PV · EV · AC · SV · CV · SPI · CPI |
| DCMA 14 puntos | Puntaje global %, aprobados/total, tabla de 14 chequeos con métrica, valor, meta, ✔/✖ y N/A |
| Registro de riesgos | Título · Categoría · Prob. · Impacto · Score · Nivel · Responsable · Estado (+ matriz 5×5) |
| Monte Carlo | P50 / P80 / P90 de fin de proyecto, histograma, top 10 tareas con mayor incertidumbre (P80−P50), sensibilidad |
| Nivelación de recursos | Sobreasignaciones (recurso, día, carga vs capacidad) y retrasos propuestos por tarea |
| Calendario | Días laborables, horas/día, tabla de excepciones |
| Línea base | Lista de LB y varianzas ΔI / ΔF / ΔD (+N d atrasado rojo, −N d adelantado verde) |
| Tabla EDT | Columnas elegibles: EDT, Nombre, Tipo, Duración, Inicio, Fin, % Avance, HT, HL, Pred., Alertas (A4 horizontal) |
| Gantt | SVG vectorial del Gantt |
| **Informe ejecutivo PDF** | Portada · Resumen Ejecutivo (KPIs) · EDT · Ruta Crítica · Gantt |

## Exportaciones / importaciones de archivos (`js/io.js`)

| Formato | Contenido | Nombre |
|---|---|---|
| JSON | Proyecto completo (proyecto, tareas, dependencias, calendario). ⚠ **No incluía datos LPS** | |
| CSV (UTF-8 con BOM) | `EDT, ID, Nombre, Tipo, Duración (d), Inicio, Fin, % Avance, HT (d), HL (d), Predecesoras, Restricción` | `<código>_actividades.csv` |
| MS Project XML | Importable en MS Project 2010+ | |
| SVG | Diagrama Gantt | |
| Importar JSON | Proyecto exportado | |
| Importar XER | Primavera P6 (proyecto, tareas, dependencias, calendario) | |
