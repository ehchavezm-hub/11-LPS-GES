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

## Cómo aplicar 025, 026 y 027

Supabase pide tu aprobación para ejecutar SQL que modifica la base. Dos opciones:
1. En Claude: Configuración › Conectores › Supabase › permitir siempre *apply_migration* / *execute_sql*, y pedirme que las aplique; o
2. En Supabase › SQL Editor: pegar y ejecutar, en este orden, `supabase/migrations/025_eliminar_empresa.sql`,
   `026_eliminar_proyecto_plataforma.sql` y `027_auditoria_seguridad_rendimiento.sql`.
