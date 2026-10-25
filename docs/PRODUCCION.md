# LPS-GT · Preparación para producción (solicitud 54)

Auditoría, correcciones aplicadas y pasos para operar con **1000 usuarios concurrentes**. Todo lo que es código ya está en el repositorio. Lo que se configura en paneles (Supabase, Sentry, GitHub) está indicado como **▶ Acción tuya**.

> **Cómo leer este documento frente al pedido original.** El pedido mencionaba tablas `projects`, `tasks`, `resource_assignments` y `wbs_nodes`, cálculos CPM/WBS, un backend en Python o Node y un frontend en TypeScript. LPS-GT no tiene esas piezas. Aplica Last Planner (planificación por compromisos, sin ruta crítica), es un aplicativo web estático (JavaScript sin compilación) y su servidor es Supabase (Postgres, autenticación, tiempo real y una Edge Function en TypeScript). Cada control se aplicó a su equivalente real:
>
> | Pedido | Equivalente en LPS-GT |
> |---|---|
> | projects | `proyectos`, `proyecto_lideres`, `hitos` |
> | tasks | `actividades` (Plan semanal y Look Ahead), `restricciones`, `cartera`, `acuerdos` |
> | resource_assignments | `actividades.responsable_id`, `ubicaciones_dia` (capacidad), `cierres` |
> | wbs_nodes | `organigrama_nodos` y la jerarquía Gerencia → Proyecto → CET / Servicio → Actividad |
> | Cálculos CPM/WBS | Indicadores PAC, capacidad, Pareto de CNC, cierre de semana e importación de Excel |
> | Backend Python/Node | Edge Function `admin-usuarios` (Deno/TypeScript) y funciones de Postgres |

---

## Etapa 1 · Seguridad de datos y RLS (migración `015_endurecimiento.sql`)

### Diagnóstico

Se auditaron en un Postgres 16 local las 29 tablas, sus 79 políticas, las 22 funciones `SECURITY DEFINER` y todo el SQL dinámico.

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | Las 29 tablas tienen RLS activo y todas las políticas filtran por `area_id = mi_area()` | — | Se mantiene. Una prueba automática falla si una tabla queda sin RLS. |
| 2 | **`proyecto_lideres` no validaba el área.** Quien podía crear proyectos podía leer o asignar líderes de proyectos de otra área. | Alto (BOLA) | Las políticas exigen que el proyecto y la persona sean del área del usuario. |
| 3 | **Referencias cruzadas por manipulación de IDs.** Una actividad, restricción, comentario, etc. podía apuntar al proyecto, persona o lista de otra área si se conocía su UUID: las claves foráneas no pasan por RLS. | Medio (BOLA) | Disparadores `tg_misma_area` (15 tablas) y `tg_items_misma_area` (ítems de plantilla): cada referencia debe ser de la misma área. Si no, se rechaza con un error 42501. |
| 4 | **Autoría suplantable.** `created_by` y `autor_id` aceptaban el valor que enviara el cliente (por ejemplo, un enlace podía quedar a nombre de otra persona). | Medio | Disparador `tg_fijar_autor`: lo fija la base con `auth.uid()` y no se puede cambiar después. |
| 5 | **Menciones a otras áreas.** Un comentario podía notificar a cualquier UUID. | Bajo | Solo se notifica a personas activas del área. |
| 6 | Funciones ejecutables por `anon` (`mi_perfil`, `puede`, `semana_cerrada`…). | Bajo | `REVOKE EXECUTE … FROM anon` en todas, también por defecto para las funciones futuras. |
| 7 | `search_path = public` en las funciones `SECURITY DEFINER`. | Bajo | `search_path = public, pg_temp` en todas (patrón recomendado por PostgreSQL). |
| 8 | SQL dinámico (`exportar_respaldo`, disparadores). | — | Sin riesgo de inyección: usa `format('%I')` sobre listas fijas y `USING` para los valores. No requiere cambios. |
| 9 | Las Edge Functions validan el JWT y vuelven a comprobar el permiso con la sesión del usuario. | — | Se mantiene. Además, los orígenes CORS se pueden restringir (ver abajo). |

### Pruebas automáticas (`supabase/tests/10_reglas.sql`)

Se crea una segunda área con su propio superadministrador y se verifica:

- No ve proyectos, actividades ni usuarios de la otra área, y viceversa.
- No puede crear o mover actividades hacia un proyecto ajeno, asignar un responsable ajeno, comentar un registro ajeno ni asignar líderes cruzados.
- Un enlace enviado "a nombre de otro" queda a nombre de quien lo creó.
- Las menciones no cruzan de área.
- Ninguna función `SECURITY DEFINER` es ejecutable por `anon`, todas tienen `search_path` fijo y no hay tablas sin RLS.

### ▶ Acción tuya: aplicar la migración en Supabase

1. Supabase → **SQL Editor** → New query.
2. Pegar el contenido de [`supabase/migrations/015_endurecimiento.sql`](../supabase/migrations/015_endurecimiento.sql) y ejecutar (**Run**).
3. Repetir con [`supabase/migrations/016_restricciones_estado_la.sql`](../supabase/migrations/016_restricciones_estado_la.sql) (matriz de compatibilidad, pedido 98): el Estado LA sigue a las restricciones aunque las levante otra persona del equipo.
4. Opcional: **Advisors → Security Advisor**. No deberían quedar avisos de RLS ni de `search_path`.

---

## Etapa 2 · Concurrencia, conexiones y caché

### Cómo se conecta LPS-GT (importante para dimensionar)

El navegador **no abre conexiones a PostgreSQL**. Habla con Supabase por HTTPS (API REST/PostgREST) y por un WebSocket de tiempo real. Las conexiones a Postgres las administra Supabase con su propio pool. El "modo Transaction" de Supavisor (puerto 6543) solo se usa con servidores que se conectan directo a Postgres, y LPS-GT no tiene ninguno: la Edge Function también usa la API HTTP. Por eso no hay sockets de base de datos que se puedan "fugar" desde el código.

### Correcciones aplicadas en el código

| Cambio | Efecto con 1000 usuarios |
|---|---|
| **Políticas con `(select f())`** (migración 015) | `auth.uid()`, `mi_area()`, `puede()`… se evalúan una vez por consulta, no una vez por fila. Es la optimización que recomienda Supabase para RLS con muchas filas. |
| **18 índices nuevos** para claves foráneas y filtros (migración 015) | Uniones de las políticas, borrados en cascada y consultas por área o semana sin recorrer tablas completas. |
| **Tiempo real filtrado por área** (`adapter-supabase.js`) | Cada suscripción pide solo los cambios de su área (`area_id=eq.…`), y el servidor ya no evalúa los cambios de otras áreas para cada usuario conectado. Los borrados se escuchan aparte porque Supabase no permite filtrarlos. |
| **Un solo cliente Supabase** por pestaña (`api.js`) | Todas las suscripciones comparten un WebSocket, y cada pantalla cierra sus canales al salir (`destruir()`). |
| **Paginación de 1000 filas** (`list()`) | Ninguna consulta pide tablas enteras de una sola vez. |
| **Copia sin conexión protegida** (`main.js`) | Las respuestas guardadas para uso sin conexión se borran al cerrar sesión o si otra persona ingresa en el mismo navegador. Antes podían quedar visibles para el siguiente usuario de una PC compartida. |

### ▶ Acción tuya: plan y parámetros de Supabase

| Recurso | Plan gratuito | Recomendado para 1000 concurrentes |
|---|---|---|
| Conexiones simultáneas de tiempo real | 200 | **Pro** (500 incluidas) y subir el límite en *Project Settings → Realtime*, o plan Team. Cada pestaña abierta usa 1 conexión. |
| Proyecto en pausa por inactividad | Sí (tras 7 días) | No se pausa en Pro. |
| Tamaño de cómputo | Nano/Micro | **Small o Medium**. El pool de PostgREST crece con el cómputo. Revisar *Reports → Database* la primera semana. |
| Copias de seguridad | No | Diarias en Pro. Se mantiene además el respaldo semanal a Google Drive. |

*Database → Settings → Connection pooling*: el aplicativo no lo necesita. Si en el futuro se conecta un servidor propio, debe usar el puerto **6543 (modo Transaction)**, `pool_size` de 15 a 20 por servidor y `prepare: false` en el driver.

Antes de tomar la decisión, verifica los límites vigentes en <https://supabase.com/pricing>: cambian con el tiempo.

### Caché en el borde (Cloudflare u otro CDN)

- **Archivos estáticos** (`index.html`, `js/`, `css/`, `vendor/`): hoy los sirve GitHub Pages con `Cache-Control: max-age=600`. El service worker ya guarda `vendor/` y fuentes en el navegador y pide el código a la red, así que cada versión publicada llega sola.
- **Respuestas de la API de Supabase: no deben cachearse en el borde.** Cada respuesta depende del usuario (RLS). Un CDN podría entregar los datos de un usuario a otro. El alivio de carga se logra en el cliente: el catálogo se carga una vez por sesión, las pantallas se actualizan por tiempo real y el service worker guarda una copia solo para uso sin conexión.
- Si en el futuro se usa un dominio propio con Cloudflare, estas son las reglas (Cache Rules):

| Regla | Coincidencia | Acción |
|---|---|---|
| Librerías | `/vendor/*`, `/img/*`, `*.css` | Cache everything · Edge TTL 30 días · Browser TTL 7 días |
| Código | `/js/*`, `/index.html`, `/sw.js`, `/config.js` | Edge TTL 5 min · `sw.js` y `config.js` sin caché de navegador |
| API | `*.supabase.co/*` | **Bypass cache** (no pasa por Cloudflare; es otro dominio) |

  Cabeceras de seguridad para esa configuración (archivo `_headers` de Cloudflare Pages o *Transform Rules*):

  ```
  /*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    X-Frame-Options: DENY
  /sw.js
    Cache-Control: no-cache
  /config.js
    Cache-Control: no-cache
  ```

---

## Etapa 3 · Monitoreo de errores (Sentry)

Ya integrado en el código y **desactivado hasta que configures la clave**.

| Dónde | Archivo | Qué captura |
|---|---|---|
| Navegador | `app/js/core/monitoreo.js` (SDK en `app/vendor/sentry.min.js`, se descarga solo si hay DSN) | Errores no controlados y promesas rechazadas, con la pantalla y la versión. Transacciones: carga de cada pantalla, indicadores del Tablero, carga del Plan, catálogo e importación de Excel. Las operaciones de más de 3 s generan un aviso "Operación lenta" con su duración. |
| Edge Function | `supabase/functions/admin-usuarios/index.ts` (`npm:@sentry/deno`) | Excepciones del alta de usuarios y del cambio de contraseña. |

**Privacidad.** No se envían correos (se reemplazan por `[correo]` en mensajes y errores), nombres, IP, cabeceras ni el contenido de los datos. El usuario se identifica solo por su id interno, su rol y su área. Las URLs de la API viajan sin parámetros de filtro. Aun así, los errores salen hacia un servicio externo: actívalo solo si la política de la empresa lo permite.

### ▶ Acción tuya (opcional)

1. Crear una cuenta en <https://sentry.io>, un proyecto *Browser JavaScript* y copiar el **DSN**.
2. GitHub → repositorio → *Settings → Secrets and variables → Actions → **Variables*** → `SENTRY_DSN` = el DSN. Se aplica en la próxima publicación.
3. Para la Edge Function: Supabase → *Edge Functions → Secrets* → `SENTRY_DSN` (puede ser otro proyecto de Sentry, tipo *Deno*).
4. Opcional, en el mismo lugar: `ORIGENES_PERMITIDOS = https://ehchavezm-hub.github.io` para que la función solo acepte llamadas desde el aplicativo.

---

## Etapa 4 · CI/CD: workflow "Listo para producción"

Archivo: [`.github/workflows/production-readiness.yml`](../.github/workflows/production-readiness.yml). Se ejecuta en cada Pull Request hacia `main` y a pedido (*Actions → Listo para producción → Run workflow*).

| Control | Herramienta | Falla si… |
|---|---|---|
| Secretos y datos de la empresa | gitleaks + verificación propia | Hay claves en el historial, una `service_role`/`sb_secret_`, `config.js` con datos, o planillas, CSV o respaldos con datos (repositorio público). |
| Librerías | `pruebas/verificar-librerias.mjs` + `npm audit` | Una librería de `app/vendor` no es idéntica a la publicada oficialmente (npm o cdn.sheetjs.com) o tiene vulnerabilidades moderadas o mayores. |
| Sintaxis y tipos | `node --check` + `deno check` | Un módulo tiene errores de sintaxis o la Edge Function tiene errores de tipos. |
| Base de datos | Postgres 16 + `supabase/tests/run.sh` | Una migración falla o se rompe una regla de seguridad o de negocio (incluidas las de aislamiento entre áreas). |
| Prueba de humo | Playwright + `pruebas/humo.mjs` | Aparece un error de JavaScript o un aviso de error en cualquiera de las 19 pantallas, con cada uno de los 9 usuarios de prueba (todos los roles). |
| Análisis de código | CodeQL | Detecta patrones inseguros (XSS, inyecciones…). |

Ya existían y se mantienen: `pruebas.yml` (en cada push a `main`), `publicar.yml`, `funciones.yml` (ahora con la versión del CLI de Supabase fija) y `respaldo.yml`.

### ▶ Acción tuya (recomendado)

GitHub → *Settings → Branches → Add rule* para `main` → **Require status checks to pass** → marcar los controles de "Listo para producción". Así no se puede fusionar nada que falle.

---

## Otras correcciones de esta revisión

| Hallazgo | Corrección |
|---|---|
| **SheetJS 0.18.5** (lectura de Excel) con dos vulnerabilidades conocidas al abrir archivos manipulados: CVE-2023-30533 (prototype pollution) y CVE-2024-22363 (ReDoS). | Actualizada a **0.20.3**. Se verificó la importación de proyectos, actividades e histórico y la exportación. El CI comprueba que el archivo sea idéntico al oficial de cdn.sheetjs.com. |
| Mensaje de error de carga de pantalla mostrado sin escapar (riesgo de inyección de HTML). | Escapado. |
| Tres pantallas sin copia para uso sin conexión (Organigrama, Importar proyectos y el módulo de monitoreo). | Agregadas al service worker. |
| Sin `.gitignore`: riesgo de subir planillas o respaldos por error. | `.gitignore` que excluye `*.xlsx`, `*.csv`, respaldos y `.env`. |
