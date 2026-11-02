# Traspaso — estado al 02/11/2026 (pedidos hasta 173)

Documento público: sin nombres de la empresa. Los detalles con nombres reales (historial completo de la conversación,
capturas, Excel, SQL) están en el paquete privado `LPS-GES_traspaso_privado.zip` (Drive del dueño).

## 1. Estado

- Todo el código está en GitHub `main` (= aplicativo publicado) y en la rama `claude/cool-feynman-br5fpv` (mismo commit).
  No hay cambios sin subir. Las ramas `claude/exciting-pascal-dxit5d` y `exciting` son antiguas (no se usan).
- Últimos cambios publicados (ver `docs/OBSERVACIONES.md` filas 161–173):
  Grupos LPS en Look Ahead / Plan, guardado seguro de la grilla (168), Backlog (169), fechas con calendario del
  navegador (170), Grupo LPS activo y sección elegida del menú en naranja (171–172), Tablero para todos (173).
- Base de datos: migraciones 001–031 aplicadas en Supabase **11-LPS-GES**. Función `admin-usuarios`: versión 12.
- Pruebas: base (`supabase/tests/run.sh`) en verde; lista de regresión (`pruebas/e2e/correr.sh`, 31 pruebas) en verde;
  recorrido `pruebas/humo.mjs` (9 usuarios, 168 pantallas) sin errores.
- Pruebas antiguas que fallan **desde antes** (esperan textos de pedidos ya cambiados o el Excel privado; no son defectos):
  `superadmin.js`, `roles.js`, `emp113.js`, `proyform.js`, `cetserv.js`, `plat.js`, `cet.js`, `cetsync.js`, `imp*.js`, `lista.js`.
- El workflow `respaldo.yml` corre pero termina en segundos: faltan sus secrets (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `RCLONE_CONF`), así que **no** sube respaldos al Drive. Respaldo manual: aplicativo ›
  Configuración › Respaldo (descargar y guardar en el Drive privado).

## 2. Foto de la base al 02/11/2026 22:30 UTC (para comparar al retomar; solo lectura)

| Tabla | Filas | | Tabla | Filas |
|---|---|---|---|---|
| actividades | 92 | | lista_valores | 540 |
| proyectos (proyectos + Grupos LPS) | 62 | | listas | 92 |
| portafolios | 11 | | ubicaciones_dia | 154 |
| programas | 17 | | vistas | 30 |
| areas (empresas) | 5 | | permisos | 300 |
| profiles (usuarios) | 7 | | parametros | 68 |
| empresa_miembros | 10 | | auditoria | 2827 |
| plantillas / plantilla_items | 3 / 2 | | notificaciones | 6 |
| organigrama_nodos | 6 | | delegado_historial | 1 |
| cartera (Backlog) | 1 | | | |

En 0: acuerdos, cierres, columnas_personalizadas, comentarios, enlaces, hitos, pac_historico, proyecto_favoritos,
proyecto_lideres, restricciones, reuniones, solicitudes_cambio.

Consulta para repetir la foto:
```sql
select c.relname as tabla, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int as filas
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1;
```

## 3. Pendientes (esperan decisión del dueño)

1. **No modificar** las actividades registradas por los usuarios del equipo sin pedido expreso del dueño
   (el SQL `aplicar_pendientes_30oct.sql` quedó **anulado**).
2. **17 actividades sin Grupo LPS** de la semana del 26/10 (lista en el paquete privado): el dueño dirá si se mueven.
3. **Dos cuentas del dueño** (con y sin tilde en el nombre): confunden el filtro «Resp. 1». Propuesto unificarlas;
   antes, mostrarle qué tiene cada una. No hacer nada sin su visto bueno.
4. **3 filas repetidas** sin comprometer en el Look Ahead del 02/11 (misma descripción, creadas en 1 minuto): el dueño decide.
5. Propuestas sin respuesta: actualizar solo el aplicativo cuando hay versión nueva y el usuario no está editando;
   aviso «Registrando en: <Grupo LPS>».
6. **Respaldo automático**: configurar los secrets de `respaldo.yml` (o seguir con el respaldo manual).
7. **d4 — árbol del menú** con los proyectos que atiende cada grupo: en pausa.
8. **s47 — parpadeo en Configuración › Proyectos**: no reproducido; faltan datos.
9. **s40 — tabla `supervisiones`**: nunca se creó su migración.
10. Seguridad: en Supabase › Authentication, «Minimum password length» = 8.

## 4. Historial de decisiones (d1–d11; las siguientes en OBSERVACIONES.md)

| Pedido | Qué se hizo |
|---|---|
| d1 | Estructura jerárquica sin tarjetas traslapadas |
| d3 | «Sub-proyecto» → «Grupo LPS» en todo el aplicativo (031 para los mensajes de la base) |
| d5 | Catálogo propio «👥 Grupos LPS», separado de «Proyectos / Procesos» (sin mover datos) |
| d7 | Actividad → CET → Proyecto: columna «Proyecto» = proyecto del CET, de la lista de Proyectos |
| d8 | Columna «Grupo LPS» oculta (solo visual) en Plan y Look Ahead |
| d9 | Exportar / importar XLS en todas las listas (botones verdes; importar nunca borra) |
| d10 | Proyecto → su Gerencia; Gerencia → solo sus proyectos; el proyecto sin CET se guarda (`extra.proyecto_id`) |
| d11 | Proyecto → solo sus CET; CET → su proyecto |
