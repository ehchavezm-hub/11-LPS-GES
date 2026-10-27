# 05 — Flujo Last Planner System (como estaba en ECM Project)

> Referencial. Base: estándar LCI 2023 (secciones §7–§12 citadas en la UI de ECM Project).

## Flujo implementado

```
Cronograma maestro (CPM/Gantt)
        │  tareas que caen en cada semana (solo lectura)
        ▼
[1] LookAhead 6 semanas  ── "CAN occur" (LCI §7)
        │  registrar actividades por semana (manual o Excel)
        │  marcar ✅ Lista / 🚧 Bloqueada
        ▼
[2] Log de Restricciones ── (LCI §8)
        │  identificar → responsable → F. requerida / prometida → levantar
        │  vínculo a actividad por código o a tarea CPM
        ▼
[3] Plan Semanal (WWP)   ── "WILL occur" (LCI §9)
        │  comprometer solo actividades Listas
        │  cierre de semana: ✓ hecho / causa de no cumplimiento
        ▼
[4] Métricas LPS / PPC   ── (LCI §11–§12)
        │  PPC semanal, promedio, tendencia, Pareto de causas
        ▼
[5] Stand-Up Diario      ── aprendizaje (LCI §10)
           3 preguntas diarias
```

Textos guía que la UI mostraba en cada paso:
- **Paso 1 de 3 — LookAhead (CAN occur):** "Registra aquí las actividades que *pueden* ejecutarse en las próximas semanas. Luego levanta sus restricciones en 'Log de Restricciones'. Solo las actividades con estado ✅ Lista (sin restricciones pendientes) deben pasar al 'Plan Semanal'."
- **Paso 3 de 3 — Plan Semanal / WWP (WILL occur):** "Marca las actividades que tu equipo *se compromete* a ejecutar esta semana. Solo incluye actividades que estén ✅ Listas. Al finalizar la semana, registra los incumplimientos con su causa → se calcula el PPC. Meta PPC: 75–90 %."

## Brechas detectadas (oportunidades para LPS-GES)

| # | Brecha en ECM Project | Impacto |
|---|---|---|
| 1 | Datos LPS solo en localStorage del navegador: no se sincronizan, no van en el JSON exportado, se pierden al limpiar el navegador | Alto |
| 2 | No existe nivel **Master / Phase Schedule (Pull Planning)** (LCI §5–6); el LookAhead parte directo del CPM | Alto |
| 3 | El estado Lista/Bloqueada es manual; no se deriva de las restricciones activas | Medio |
| 4 | El Plan Semanal no distingue "comprometido" de "planificado": toma todas las actividades de la semana + las tareas CPM | Alto (distorsiona el PPC) |
| 5 | No obliga a registrar causa en lo no cumplido | Medio |
| 6 | Cabecera WWP (área, contratista, turno, Last Planner) es única por proyecto, no por semana ni frente | Medio |
| 7 | Sin campos de **cuadrilla, días L–D, fecha de inicio** de la actividad (el impreso WWP las tiene vacías) | Medio |
| 8 | Sin métricas de restricciones (% liberadas a tiempo, atraso promedio, restricciones por tipo) | Medio |
| 9 | Sin **TA / TMR** (Tasks Anticipated / Tasks Made Ready), ni PPC por responsable / gremio / frente | Medio |
| 10 | Importación de actividades no lee gremio ni estado; la de restricciones no lee n.º de actividad | Bajo |
| 11 | IDs débiles (timestamp + aleatorio); eliminación de actividades sin confirmación ni papelera | Bajo |
| 12 | Stand-Up: un registro por día y proyecto, sin autor ni frente | Bajo |
| 13 | El impreso del Dashboard no incluye gráficos ni Pareto; el del Log no incluye estado | Bajo |
| 14 | Sin acta de reunión semanal (asistentes, acuerdos, compromisos) | Medio |

## Plantillas candidatas para LPS-GES (marcar las que se usarán)

> El usuario indicó que solo se usarán **algunas** plantillas. Marcar con `[x]`.

**Toma de datos**
- [ ] F-LPS-01 Actividad del LookAhead
- [ ] F-LPS-02 Importación Excel de actividades
- [ ] F-LPS-03 Cabecera Plan Semanal (WWP)
- [ ] F-LPS-04 Registro de cumplimiento PPC + causas
- [ ] F-LPS-05 Restricción
- [ ] F-LPS-06 Importación Excel de restricciones
- [ ] F-LPS-07 Stand-Up diario
- [ ] Proyecto / Calendario / Tareas CPM (cronograma maestro)
- [ ] Recursos · Riesgos · Diccionario WBS

**Reportes**
- [ ] R-LPS-01 LookAhead por semanas
- [ ] R-LPS-02 Plan Semanal WWP
- [ ] R-LPS-03 Log de Restricciones
- [ ] R-LPS-04 Métricas PPC (KPIs, histórico, Pareto)
- [ ] R-LPS-05 Stand-Up
- [ ] R-LA-01 Vista Lookahead (CPM)
- [ ] Alertas · Curva S · EVM · DCMA · Riesgos · Informe ejecutivo

**Catálogos**
- [ ] 15 causas de no cumplimiento
- [ ] 9 tipos de restricción
- [ ] Semáforo PPC 60 / 75 / 90

**Estándares**
- [ ] Formato de impresión (encabezado, pie, nombre de archivo)
- [ ] Paleta de colores y semáforos
