# Traspaso — estado al 30/10/2026 (07:04 UTC)

Documento público: sin nombres de la empresa. Los detalles con nombres reales (lista de actividades, capturas, Excel,
historial completo de la conversación) están en el paquete privado `LPS-GES_traspaso_privado.zip` (Drive del dueño).

## 1. Estado

- Último cambio publicado: d10 / d11 (Proyecto ↔ Gerencia ↔ CET en Look Ahead y Plan semanal). Ver `docs/OBSERVACIONES.md`
  filas 136–159.
- Base de datos: migraciones 001–030 aplicadas en Supabase **11-LPS-GES**. **031 pendiente** (ver 3.1).
- Función `admin-usuarios`: versión 12 desplegada (igual a `supabase/functions/admin-usuarios/index.ts`).
- Pruebas: base (`supabase/tests/run.sh`) en verde; 24 pruebas de pantalla de la lista de regresión
  (`pruebas/e2e/correr.sh`) en verde; recorrido `pruebas/humo.mjs` (9 usuarios, 160 pantallas) sin errores.
- Pruebas antiguas que fallan **desde antes** (esperan textos de pedidos ya cambiados; no son defectos):
  `superadmin.js`, `roles.js`, `emp113.js`, `proyform.js`, `cetserv.js`, `plat.js` (solo avisos de fuentes bloqueadas).

## 2. Foto de la base (para comparar al retomar; solo lectura)

| Tabla | Filas | | Tabla | Filas |
|---|---|---|---|---|
| actividades | 54 | | lista_valores | 456 |
| proyectos (proyectos + Grupos LPS) | 52 | | listas | 92 |
| portafolios | 11 | | ubicaciones_dia | 154 |
| programas | 17 | | vistas | 21 |
| areas (empresas) | 5 | | permisos | 300 |
| profiles (usuarios) | 7 | | parametros | 68 |
| empresa_miembros | 10 | | auditoria | 2159 |
| plantillas / plantilla_items | 2 / 2 | | notificaciones | 6 |
| organigrama_nodos | 6 | | delegado_historial | 1 |

En 0: acuerdos, cartera, cierres, columnas_personalizadas, comentarios, enlaces, hitos, pac_historico, proyecto_favoritos,
proyecto_lideres, restricciones, reuniones, solicitudes_cambio.

Consulta para repetir la foto:
```sql
select c.relname as tabla, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int as filas
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1;
```

## 3. Pendientes

1. **Migración 031** (`supabase/migrations/031_grupo_lps.sql`): solo cambia dos mensajes de error a «Grupo LPS». El dueño
   la ejecuta en SQL Editor de 11-LPS-GES. Verificar:
   `select position('Grupo LPS' in prosrc) > 0 from pg_proc where proname = 'tg_subproyecto';` → `true`.
2. **17 actividades sin Grupo LPS asignado** (8 sin grupo y 9 en proyectos): el dueño dirá a qué grupo va cada una
   (lista con descripción en el paquete privado). Respaldar antes de moverlas; verificar conteos después.
3. **2 actividades que salieron de un Grupo LPS** el 30/10 (05:35 y 05:37 UTC, por edición del dueño en la columna
   anterior). Preguntar si se devuelven a su grupo (detalle en el paquete privado y en `auditoria`).
4. **Lista vacía «Grupo LPS»** (clave `grupo_lps`) creada a mano por el dueño: quedó reemplazada por el catálogo
   «👥 Grupos LPS». Preguntar si se elimina (está vacía).
5. **d4 — árbol del menú «GRUPOS LPS»** con los proyectos que atiende cada grupo: en pausa por decisión del dueño.
   Preguntas abiertas: forma del árbol; cómo se definen los proyectos de un grupo (a mano, por los CET de sus actividades
   o ambos); qué filtra el clic en un proyecto bajo un grupo.
6. **s47 — parpadeo en Configuración › Proyectos**: no se pudo reproducir (ni en demo ni hay bucles en la base). Faltan
   datos del dueño: pantalla exacta, cuándo ocurre, qué parpadea, navegador.
7. Recomendación de seguridad: en Supabase › Authentication, «Minimum password length» = 8 (la protección de contraseñas
   filtradas es solo del plan Pro).
8. `SESION_HANDOFF.md` (de la otra cuenta) contiene nombres reales; el dueño decidió dejarlo como está.

## 4. Historial de decisiones recientes (d1–d11)

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
