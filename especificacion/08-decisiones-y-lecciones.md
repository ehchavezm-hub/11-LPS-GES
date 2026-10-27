# 08 — Decisiones de arquitectura y lecciones aprendidas

> Referencial. Fuente: `DECISIONES.md`, `CONTRIBUTING.md` e historial de commits (observaciones Obs/Issues 17–94) de ECM Project.

## Decisiones de arquitectura heredables

| Id | Decisión | Por qué |
|---|---|---|
| D1 | Días como índices enteros laborables, fin exclusivo (`ES=0, dur=3 → EF=3`) | Aritmética de dependencias simple, sin fechas en el cálculo |
| D3 | Un calendario por proyecto | Simplicidad |
| D4 | ES nunca < 0: se recorta y se avisa `INICIO_RECORTADO` | El proyecto no empieza antes de su inicio |
| D5 | Resúmenes derivados (tarea con hijos), sin dependencias propias | Coherencia del árbol |
| D7 | CPM siempre en cliente; columnas `calc_*` en BD solo caché | Funciona offline, cálculo determinístico |
| D9 | Solo `anon key` en el código; `service_role` nunca en el repo | Seguridad vía RLS |
| D13 | Tareas al 100 % → TF nulo, no críticas, en verde | Una tarea terminada no tiene riesgo |
| D15 | Web Worker con respaldo síncrono | No bloquear la UI |
| — | Patrón comando + deshacer/rehacer (50 pasos); toda modificación vía `dispatch(cmd)` | Reversibilidad y trazabilidad |
| — | Borrado lógico (`deleted_at`) en todo | Recuperación y sincronización |
| — | Offline-first: IndexedDB + outbox → Supabase, last-write-wins por `updated_at` | Trabajo en obra sin conexión |

Metas de rendimiento definidas: CPM 1 000 tareas < 100 ms; render 500 filas < 50 ms; sincronización inicial < 2 s; primera carga < 2 s.

## Lecciones de las observaciones corregidas

**Impresión / PDF (Obs 51, 57–58, 60–69, 80–88, 92)**
- Usar una **única** función de impresión con encabezado/pie estándar en todos los módulos; los PDFs ad hoc producían páginas en blanco, iconos impresos y colores perdidos.
- Nombre de archivo estandarizado `PROYECTO-Proceso-Fecha` y editable antes de guardar.
- Vista previa A4 con orientación seleccionable; los gráficos en canvas se imprimían borrosos → generar SVG/vector o alta resolución.
- Mostrar KPIs en una sola fila (6) y conservar colores semafóricos al imprimir.
- En la app de escritorio (Electron), las ventanas emergentes de impresión requieren manejador propio.

**Interfaz (Obs 51, 107–112, 121)**
- Botón ✕ siempre arriba a la derecha y botón Imprimir en posición fija en todos los paneles; evitar solapamientos.
- Eliminar botones duplicados entre barras (EVM, DCMA, Histograma, etc.).
- Paneles con scroll interno: contenedor `flex:1; min-height:0`.
- Eventos `input` inmediatos en filtros (no esperar a perder foco).

**LPS (Issues 17–20, #97–#115)**
- Se agregaron por iteraciones: campo Código, importación XLS, semanas personalizadas, estado Lista/Bloqueada, gremio, historial filtrable de restricciones y stand-up, textos guía LCI §7/§9. Conviene diseñarlo completo desde el inicio en LPS-GES (ver brechas en `05-flujo-lps.md`).

**Datos y sincronización (Obs 87–94, #93–#94)**
- Sanear campos UUID antes de enviar a Supabase (errores 400).
- Al borrar un proyecto: limpiar también la URL (`?p=`), y no "resucitar" el proyecto demo al refrescar.
- Versionar caché del service worker junto con los recursos (`?v=NN`) para que los usuarios reciban la última versión.

**Rendimiento (#116)**
- Índices en BD por `project_id` / `updated_at`, caché multinivel, cola asíncrona y pruebas de carga (k6).
