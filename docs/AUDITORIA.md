# Compatibilización y auditoría técnica — LPS-GES

Revisión de la integración entre procesos, ventanas, flujos de datos y cálculos, más la base de datos en Supabase.
Cada corrección se probó en modo demostración (humo de 160 pantallas y pruebas de extremo a extremo) y en un Postgres
local con todas las migraciones (`supabase/tests/run.sh`). Ninguna corrección cambia los módulos de los sub-proyectos
(Plan semanal, Look Ahead, Restricciones, Cartera, Tablero, Reunión, Equipo, Reportes, Configuración, Plantillas, Mejoras y Ayuda),
salvo para que sumen los sub-proyectos cuando se elige su proyecto padre.

## Tabla resumen

| # | Hallazgo | Criticidad | Impacto | Solución | Estado |
|---|----------|-----------|---------|----------|--------|
| 1 | `get_propietarios()` (creada a mano en Supabase, fuera de las migraciones) es `SECURITY DEFINER` y la podía ejecutar **cualquiera sin iniciar sesión** (`/rest/v1/rpc/get_propietarios`) | **Crítico** | Exposición de los perfiles completos de los propietarios a internet | 027: se retira el permiso de ejecución a anon y authenticated, y se le fija el search_path. El aplicativo no la usa | ⏳ Aplicar 027 |
| 2 | Eliminar una empresa o un proyecto con historial quedaba a medias (caso WSP) | **Crítico** | Datos huérfanos; empresa imposible de borrar | 025 y 026: borrado en una sola transacción desde el servidor | ⏳ Aplicar 025 y 026 |
| 3 | Al elegir un proyecto con sub-proyectos, el **Tablero y los Reportes** filtraban solo el proyecto exacto, mientras Plan semanal y Look Ahead incluían los sub-proyectos | **Medio** (cálculo) | PAC, KPIs y restricciones distintos según la ventana; el padre mostraba 0 | Tablero y Reportes usan el mismo filtro `enProyectoSel()` | ✅ |
| 4 | La **ficha del proyecto** padre no sumaba lo de sus sub-proyectos | **Medio** (cálculo) | PAC histórico, HH y restricciones del padre en blanco | La ficha lee el padre y sus sub-proyectos | ✅ |
| 5 | Eliminar desde *Proyectos* un proyecto que tiene sub-proyectos daba un error técnico de llave foránea | **Medio** | Mensaje incomprensible | Mensaje claro: eliminar o mover primero los sub-proyectos, o eliminarlo con todo desde Administración › Estructura | ✅ |
| 6 | 14 reglas RLS evaluaban `auth.uid()` **en cada fila** | **Medio** (rendimiento) | Lentitud al crecer los datos | 027: `(select auth.uid())` y `(select es_gestor())`; misma regla, se evalúa una vez por consulta | ⏳ Aplicar 027 |
| 7 | 55 llaves foráneas sin índice | **Medio** (rendimiento) | Borrados y uniones lentos | 027: índice para cada llave foránea sin uno (verificado: quedan 0) | ⏳ Aplicar 027 |
| 8 | La consola de Administración descargaba todas las empresas en cada clic | **Medio** (rendimiento) | Lentitud percibida (pedido 19) | Datos de la plataforma en memoria 60 s (8 llamadas → 0) | ✅ |
| 9 | Código muerto en la consola: 6 paneles que leían tablas inexistentes (`listas_configurables`, `historial_delegados`, `feriados`, `semanas`) | **Bajo** | Errores si se llegaba a abrirlos; mantenimiento | Retirados (−40 % del archivo) | ✅ |
| 10 | 2 índices duplicados (comentarios, enlaces); `set_updated_at` y `tg_set_updated_at` sin search_path fijo | **Bajo** | Escrituras más lentas; advertencia de seguridad | 027 | ⏳ Aplicar 027 |
| 11 | Protección contra contraseñas filtradas desactivada en Supabase Auth | **Bajo** | Usuarios con contraseñas conocidas | Activarla en Supabase › Authentication › Policies (*Leaked password protection*); no se hace por SQL | Acción del propietario |

Revisados y conformes: `eliminar_proyecto_completo`, `eliminar_usuario` y `exportar_respaldo` validan el rol dentro de la función;
`registro_abierto` es pública a propósito (la pantalla de ingreso la necesita); las políticas `*_all` + `*_sel` duplicadas
solo afectan el rendimiento en tablas pequeñas y se dejan así para no cambiar permisos.

## Cálculos (hallazgos 3 y 4)

```js
// core/store.js — un único criterio en todas las ventanas: elegir un proyecto incluye sus sub-proyectos
export function enProyectoSel(id) {
  const sel = store.proyectoSel;
  return !sel || id === sel || (!!id && proyecto(id)?.padre_id === sel);
}
// views/tablero.js y views/reportes.js (antes: a.proyecto_id === store.proyectoSel)
... && enProyectoSel(a.proyecto_id)
// views/proyectos.js — ficha
const ids = { in: { proyecto_id: [id, ...subproyectos(id).map(s => s.id)] } };
```

## Base de datos (027, extracto)

```sql
revoke execute on function public.get_propietarios() from public, anon, authenticated;
alter policy act_upd on public.actividades
  using (area_id = (select public.mi_area()) and (responsable_id = (select auth.uid()) or (select public.es_gestor())))
  with check (...);
-- un índice por cada llave foránea sin índice (bloque DO genérico)
```

## Velocidad (pedido 21)

Medición: cada módulo en modo demostración con 200 ms de demora por llamada (lo que tarda Supabase desde Lima).
En Supabase las consultas del aplicativo tardan 1–10 ms: **la base no es el cuello de botella**; lo son la cantidad
de esperas de red encadenadas y la carga de archivos.

| Hallazgo | Criticidad | Impacto | Solución | Antes → después |
|---|---|---|---|---|
| La grilla guardaba su disposición en la base en cada carga de datos (evento `dataSorted`) y, si se adelantaba a la lectura, creaba filas duplicadas (430 escrituras, 44 duplicados) | **Crítico** | Una escritura por pantalla abierta | Solo guarda si la persona cambia columnas, orden o agrupación; 028 limpia duplicados y lo impide con un índice único | Restricciones 717 → 73 ms |
| Arranque: perfil → catálogo → datos → comentarios → vistas (5 esperas seguidas) | **Medio** | ~1 s más en cada ingreso | Catálogo en paralelo con el perfil (empresa y rol de la sesión anterior; si cambiaron, se vuelve a pedir); comentarios y vistas en paralelo con los datos | 1342 → 781 ms (2 esperas) |
| Plan semanal y Look Ahead descargaban **todos** los comentarios y enlaces (texto completo, de todas las semanas) para contarlos, y después de las actividades | **Medio** | Crece con el uso | Solo la columna `entidad_id` de la empresa, en paralelo | Plan 479 → 43 ms; Look Ahead 688 → 162 ms |
| Vistas de la grilla pedidas al final y en cada visita | **Bajo** | Una espera más por pantalla | Se piden al crear la grilla y quedan en memoria | — |
| Excel (950 KB) y gráficos (200 KB) se descargaban y procesaban en cada ingreso | **Medio** | Arranque más lento, sobre todo en equipos modestos | Se cargan la primera vez que se exporta/importa o se abre el Tablero | −1,1 MB al arrancar |
| El service worker confirmaba con GitHub Pages cada archivo del aplicativo en cada carga (~45 consultas encadenadas) | **Medio** | 0,5–1,5 s por carga | Código desde la caché de la versión; al publicar, la versión nueva se descarga sola y la página se actualiza (si la persona ya está trabajando, se le avisa) | 20 de 20 módulos sin ir a la red |
| Configuración › Usuarios y Equipo y capacidad: consultas seguidas que podían ir juntas | **Bajo** | 1–2 esperas extra | En paralelo | Usuarios 896 → 309 ms |

Para medir de nuevo: en modo demostración, `localStorage.setItem('lpsgt-latencia', 200)` simula la demora y cuenta las llamadas (`window.__llamadas`).

## Cómo aplicar 025, 026, 027 y 028

Supabase pide tu aprobación para ejecutar SQL que modifica la base. Dos opciones:
1. En Claude: Configuración › Conectores › Supabase › permitir siempre *apply_migration* / *execute_sql*, y pedirme que las aplique; o
2. En Supabase › SQL Editor: pegar y ejecutar, en este orden, `supabase/migrations/025_eliminar_empresa.sql`,
   `026_eliminar_proyecto_plataforma.sql`, `027_auditoria_seguridad_rendimiento.sql` y `028_vistas_sin_duplicados.sql`.

## Auditoría 2 (después de sub-proyectos, agregación, Desactivar y Mejoras)

Estado de la base verificado en Supabase: 025–028 y la migración de datos del pedido 14 están aplicadas (funciones de
borrado, 55 índices, índice único de vistas, `get_propietarios` cerrada, 55 CET/Servicios en GT_OT, proyecto antiguo
eliminado). Las alertas de las 14 reglas fila por fila, las 55 llaves sin índice y los índices duplicados desaparecieron.

| # | Hallazgo | Criticidad | Impacto | Solución | Estado |
|---|----------|-----------|---------|----------|--------|
| 1 | `tg_proteger_valor` quedó sin `search_path` fijo al reescribirla en 025 (no conformidad propia) | **Medio** (seguridad) | Una función de la base podría resolver nombres en otro esquema | 029 y archivo 025 del repositorio corregidos | ⏳ Aplicar 029 |
| 2 | 11 tablas con una regla «para todo» que también lee + una regla de lectura: ambas se evaluaban en cada consulta | **Bajo** (rendimiento) | Costo extra en cada lectura al crecer los datos | 029: reglas de alta, cambio y baja copiadas de la base (mismas condiciones) y la lectura solo en `*_sel`; verificado que `*_sel` cubre a quien podía escribir. Ubicaciones: cada persona sigue leyendo las suyas | ⏳ Aplicar 029 (pruebas de permisos OK en local) |
| 3 | `areas`: dos reglas de lectura | **Bajo** | Igual que 2 | 029: una sola regla (empresa propia o propietario) | ⏳ Aplicar 029 |
| 4 | Reporte «Catálogo de proyectos»: los sub-proyectos aparecían sueltos, sin su proyecto | **Bajo** (consistencia) | Lectura confusa del catálogo | Cada sub-proyecto va bajo su proyecto, con la columna «Sub-proyecto de» | ✅ |
| 5 | Super administrador de una empresa (no propietario): su «Estructura de la empresa» no tiene aún Desactivar ni «+ Sub-proyecto» (los propietarios sí) | **Bajo** (hoy no hay ese caso: ninguna empresa tiene super administrador asignado) | Diferencia de funciones entre roles | Recomendado cuando se asigne el primero: abrir la vista de dos pestañas a ese rol, limitada a su empresa | Recomendación |
| 6 | Reunión semanal no filtra por el proyecto o nivel elegido en el menú | **Bajo** (diseño) | La reunión es del equipo completo | Se mantiene así a propósito | Conforme |

Revisados y conformes: la agregación de abajo hacia arriba (sub-proyecto → proyecto → programa → portafolio → empresa) en
Plan, Look Ahead, Restricciones, Cartera, Tablero, Reportes, Resumen y PDF; los CET/Servicios heredados por los
sub-proyectos; Desactivar en cascada; Mejoras de todas las empresas (solo nombre del autor y de la empresa, sin correos).
Las alertas restantes son funciones que validan el rol por dentro o `registro_abierto` (pública a propósito).
