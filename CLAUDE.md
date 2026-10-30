# CLAUDE.md — guía para continuar LPS-GES (léase completa antes de cualquier cambio)

Este archivo lo lee Claude Code al empezar. Resume cómo está hecho el aplicativo, las reglas del dueño y lo que quedó
pendiente. **Repositorio público:** aquí nunca van datos de la empresa (nombres de proyectos, personas, Excel, respaldos)
ni claves secretas. Lo privado (historial completo de la conversación, capturas, Excel, SQL con nombres reales) está en el
paquete `LPS-GES_traspaso_privado.zip` que el dueño guarda en su Google Drive privado.

## 1. Dónde vive cada cosa (no depende de la cuenta de Claude)

| Qué | Dónde | Dueño |
|---|---|---|
| Código, migraciones, pruebas, documentos | GitHub `ehchavezm-hub/11-LPS-GES` (nombre anterior `11-lps_gt`, redirige) | cuenta GitHub del dueño |
| Aplicativo publicado | GitHub Pages: <https://ehchavezm-hub.github.io/11-LPS-GES/> (se publica solo al subir a `main`, workflow `publicar.yml`) | GitHub |
| Datos (empresas, proyectos, Grupos LPS, actividades, usuarios) | Supabase, proyecto **11-LPS-GES** (ref `nyvtpmydrsaofjmfwdia`, us-east-1) | cuenta Supabase del dueño |
| Función de servidor `admin-usuarios` | Supabase Edge Functions (versión 12; fuente en `supabase/functions/admin-usuarios/index.ts`) | Supabase |
| Respaldos | Google Drive privado (workflow `respaldo.yml` semanal + «Respaldo» del aplicativo) | Drive del dueño |

Cambiar de cuenta de Claude **no mueve ni borra nada** de lo anterior: solo hay que conectar la nueva cuenta a GitHub y a
Supabase (sección 2). **Nunca tocar el proyecto Supabase «10-cronograma»** (`rduzdeojbcelfjqsuvht`): es otro aplicativo.

## 2. Primer arranque con otra cuenta de Claude

1. En la nueva cuenta de Claude: conectar **GitHub** (la misma cuenta `ehchavezm-hub`) y el conector de **Supabase**
   (la misma cuenta de Supabase; elegir el proyecto **11-LPS-GES**).
2. Abrir una sesión de Claude Code sobre el repositorio `ehchavezm-hub/11-LPS-GES` (rama `main`).
3. Pedirle a Claude: «Lee CLAUDE.md, docs/OBSERVACIONES.md y docs/TRASPASO.md, y verifica el estado de la base (solo lectura)».
4. Verificación rápida en Supabase (solo lectura): conteos de `actividades`, `proyectos`, `lista_valores` y comparar con
   la foto de `docs/TRASPASO.md`.

## 3. Reglas del dueño (siempre vigentes)

- **No perder datos.** Antes de cualquier movimiento de datos: foto de conteos + respaldo de las filas a tocar (archivo
  para el Drive privado, nunca al repositorio). Probar primero en local; en la base real, una sola transacción.
  Después, comparar conteos. Nada se borra sin preguntar.
- No romper lo que ya funciona. Tras cada cambio: verificar que **todo funcione** y que **no haya efectos colaterales**;
  si los hay, corregirlos. No decir «listo» sin haber verificado.
- Prioridad: la última observación del dueño.
- Escribir **simple y corto** al dueño (en español). Preguntar solo lo indispensable.
- Repositorio público: nada de datos de la empresa ni la clave `service_role` (solo la anon / publishable en `app/config.js`).
- No poner identificadores de modelos de IA en commits ni en archivos.
- Las migraciones SQL las ejecuta el dueño en Supabase › SQL Editor del proyecto **11-LPS-GES** (el conector puede pedir
  aprobaciones que vencen). Entregarle el archivo y luego verificar con consultas de solo lectura.
- Observaciones del dueño: se numeran (q1…, d1…, s1…) y se registran en `docs/OBSERVACIONES.md`.

## 4. Cómo está hecho

- `app/`: SPA en JavaScript (módulos ES, sin compilación). Grillas con Tabulator, Excel con SheetJS (`app/vendor/`).
  - Datos: `app/js/data/api.js` elige `adapter-supabase.js` o `adapter-demo.js` (modo demostración `?demo`, en el
    navegador; emula la base y la función `admin-usuarios`).
  - Estado: `app/js/core/store.js` (catálogo, empresa, proyecto elegido, permisos).
  - Service worker `app/sw.js`: caché por versión (la versión la pone `publicar.yml`).
- Modelo (resumen):
  - Empresa (`areas`) › Portafolio › Programa › **Proyecto** (`proyectos` sin `padre_id`) › **Grupo LPS** (`proyectos` con
    `padre_id`; antes «Sub-proyecto»).
  - Un **Grupo LPS** es un equipo de personas que aplica Last Planner; pertenece a un proyecto y atiende a varios proyectos.
  - Actividad (`actividades`): `proyecto_id` = **Grupo LPS** que la registra (el elegido en el menú; la columna está oculta
    en Plan y Look Ahead). El **Proyecto** se elige libre y se guarda en `actividades.extra.proyecto_id`; **no está
    vinculado al CET / Servicio** (pedido r1, revierte d7/d11). Filas antiguas sin `extra.proyecto_id` muestran el proyecto
    de su CET hasta que se editan (entonces se fija). Proyecto → Gerencia sí (d10).
  - Usuarios en varias empresas: `empresa_miembros` (migración 030); `profiles.area_id` = empresa activa.
  - Seguridad: RLS por empresa (`mi_area()`), roles en `profiles.rol`, propietarios de la plataforma `es_plataforma`.
- Catálogos en Configuración › Listas: «Proyectos / Procesos» y «Grupos LPS» son vistas especiales (`__proyectos`,
  `__grupos`); el resto son `listas` / `lista_valores`. Todas exportan / importan XLS (importar nunca borra).

## 5. Pruebas (correr antes de publicar)

```bash
bash supabase/tests/run.sh                      # reglas de la base en Postgres local (migraciones 001…031)
bash pruebas/e2e/correr.sh                      # pantallas en modo demo (lista de regresión); o: correr.sh d10 d9
cd pruebas && npm install && npx playwright install chromium && node humo.mjs   # recorrido de 160 pantallas
```
`correr.sh` levanta un servidor local en el puerto 8099. Las pruebas `d*.js`, `q*.js`, etc. tienen el nombre de la
observación que verifican.

## 6. Publicar

Subir a `main` publica el aplicativo (GitHub Pages). Solo publicar con las pruebas en verde.
Si cambia `supabase/functions/admin-usuarios/index.ts`, desplegar la función (conector de Supabase o `supabase functions deploy`).

## 7. Pendiente al momento del traspaso

Ver `docs/TRASPASO.md` (estado, pendientes y foto de la base). Los detalles con nombres reales están en el paquete privado.
