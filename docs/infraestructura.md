# Infraestructura de LPS-GES: riesgos, latido (keep-alive), alertas y runbook

Revisado el 08/11/2026; respaldos actualizados el 09/11/2026. Presupuesto: **solo gratuito**. Alertas: **correo** (notificaciones de GitHub Actions).
Entorno: solo producción (no hay staging). Documento público: sin datos de la empresa ni claves.

## 1. Inventario y límites

Fuentes oficiales consultadas el 08/11/2026 (se citan al pie). Las cifras de cuota del proveedor pueden cambiar: la
revisión trimestral (sección 6) las vuelve a verificar.

| Componente / servicio | Plan actual | Política de inactividad | Reactivación | Riesgo de pérdida de datos | Cuotas y vencimientos críticos | Riesgo |
|---|---|---|---|---|---|---|
| **Supabase — base de datos Postgres** (proyecto `11-LPS-GES`, us-east-1) | Free | Se **pausa** si hay poca actividad de base de datos durante **7 días** [S1]. «Unas pocas consultas diarias a la base» bastan [S1]. Se apaga todo el proyecto (base, API, Auth, funciones) | **Manual**: Dashboard › *Restore project*; unos minutos. Restaurable desde el panel por un tiempo limitado [S1][S2] | Medio: los datos se conservan mientras está pausado; pasado el plazo de restauración solo queda descargar el respaldo y migrar a un proyecto nuevo [S1][S3]. **El plan gratuito no da respaldos descargables diarios** | Base 500 MB por proyecto (hoy **18 MB = 3,6 %**); disco fijo de 2 GB, a 95 % pasa a **solo lectura** [S4][S5]; egreso 5 GB/mes [S6]; superar cuotas → restricción de «uso justo» (respuestas 402) [S5] | **Alto** (inactividad) |
| **Supabase — Auth** (ingreso de usuarios) | Free | La misma del proyecto | La misma | Igual que la base | Usuarios activos mensuales: muy por debajo del límite (7 usuarios) | Alto (va con la base) |
| **Supabase — Edge Function `admin-usuarios`** (v12) | Free | La misma del proyecto | La misma | El código está en el repositorio (`supabase/functions/`) | Invocaciones: uso muy bajo frente a la cuota [S7] | Bajo |
| **GitHub Pages** (aplicativo publicado) | Gratis, repositorio público | **No tiene** pausa por inactividad [S8] | — | Ninguno: se vuelve a publicar desde el repositorio | 100 GB/mes de ancho de banda (límite blando), sitio ≤ 1 GB, despliegue ≤ 10 min [S8] | Bajo |
| **GitHub Actions** (publicar, pruebas, respaldo, latido) | Gratis, repositorio público | Los **workflows programados se desactivan** tras **60 días sin actividad** en un repositorio público [S9] | Manual (Actions › workflow › *Enable workflow*) o por API | Ninguno | Minutos gratis en repositorios públicos | Medio |
| **Google Drive** (destino de respaldos, vía rclone) | Cuenta del dueño | No aplica | — | — | **Hoy no recibe respaldos automáticos**: faltan los secrets del workflow (ver sección 5) | Alto (sin respaldo externo) |
| **Google Fonts** (tipografía del aplicativo) | Gratis | No aplica | — | Ninguno (si falla, el navegador usa otra fuente) | — | Bajo |
| **Dominio / DNS / certificado** | `*.github.io` de GitHub | No aplica | — | — | No hay dominio propio: GitHub renueva el certificado; no hay vencimientos a cargo del dueño | Bajo |
| **Claves y tokens** | Clave publicable de Supabase (pública por diseño, en `app/config.js`) | — | — | — | La clave publicable **no vence**. El repositorio **no tiene secrets** configurados (ni `service_role`, ni token de Supabase, ni `RCLONE_CONF`) | Bajo |

Fuentes:
[S1] Supabase, *Project Pausing*: <https://supabase.com/docs/guides/platform/free-project-pausing> ·
[S2] Supabase changelog, *Paused Free Plan projects are restorable for 90 days*: <https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days> ·
[S3] Supabase, *How to restore a project paused for more than 1 year*: <https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause> ·
[S4] Supabase, *Manage Disk size usage*: <https://supabase.com/docs/guides/platform/manage-your-usage/disk-size> ·
[S5] Supabase, *Understanding Database and Disk Size*: <https://supabase.com/docs/guides/platform/database-size> ·
[S6] Supabase, *Manage Egress usage*: <https://supabase.com/docs/guides/platform/manage-your-usage/egress> ·
[S7] Supabase, *Edge Functions pricing*: <https://supabase.com/docs/guides/functions/pricing> ·
[S8] GitHub, *GitHub Pages limits*: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits> ·
[S9] GitHub, *Disabling and enabling a workflow* / *Events that trigger workflows* (schedule):
<https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow>

Nota: el plazo para restaurar un proyecto pausado aparece distinto según la página de Supabase (90 días en el changelog
de 2024; páginas más recientes hablan de hasta 1 año). Se toma el **más corto (90 días)** por prudencia.

## 2. Diagnóstico de estado (08/11/2026, con evidencia)

| Servicio | Estado | Evidencia |
|---|---|---|
| Supabase proyecto `11-LPS-GES` | `ACTIVE_HEALTHY`, Postgres 17 | API de administración de Supabase (conector), 08/11/2026 |
| Base de datos | 18 MB (3,6 % de 500 MB); última edición de actividades 06/11/2026 | Consulta de solo lectura `pg_database_size` |
| API REST de la base | HTTP 200 | [Latido, ejecución 1](https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/42492293877) |
| Auth | HTTP 200 (`/auth/v1/health`) | Latido, ejecución 1 |
| Edge Function `admin-usuarios` | `ACTIVE`, versión 12 | API de Supabase (conector) |
| GitHub Pages | HTTP 200, `config.js` apunta a Supabase | Latido, ejecución 1 |
| Workflows | Todos `active` | API de GitHub (lista de workflows) |
| **Mantenimiento previo (`respaldo.yml`)** | **No hacía nada**: corre, pero sus pasos se saltan por falta de secrets. Supabase **no** tenía latido real | Ejecución <https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/41522433606> (pasos «skipped») |
| Cierre automático de semanas (`cerrar_semanas_vencidas`) | **No corre**: depende de los mismos secrets; la base no tiene `pg_cron` | Misma ejecución; extensiones instaladas: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault |

Nada estaba pausado ni suspendido: no hubo que reactivar nada.

## 3. Matriz de riesgo: acción tomada, verificación y estado

| Plataforma | Riesgo | Acción tomada | Cómo se verificó | Estado | Evidencia |
|---|---|---|---|---|---|
| Supabase (pausa por 7 días sin actividad) | Alto | Workflow **`latido.yml`** cada 2 días (≤ 1/3 del umbral): consulta `GET /rest/v1/areas?select=id&limit=1` que llega a Postgres, con la clave publicable (RLS devuelve `[]`; no lee ni cambia datos). También revisa Auth. Tiempo límite 20 s, 4 reintentos con espera de 15 s | Ejecución real a mano: base HTTP 200 `[]`, Auth HTTP 200 | ✅ Activo | [ejecución 1](https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/42492293877): base `HTTP 200 · []`, Auth `HTTP 200`, aplicativo `HTTP 200`, habilitar `HTTP 204` ×2 |
| GitHub Actions (programados se apagan a los 60 días) | Medio | En cada latido se vuelve a habilitar por la API a `latido.yml` y `respaldo.yml` (`PUT …/actions/workflows/{id}/enable`, permiso `actions: write` limitado a este repositorio). Sin commits de relleno | Ejecución real: HTTP 204 en ambos | ✅ Activo | [ejecución 1](https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/42492293877): base `HTTP 200 · []`, Auth `HTTP 200`, aplicativo `HTTP 200`, habilitar `HTTP 204` ×2 |
| GitHub Pages | Bajo | Solo control de salud en el latido (HTTP 200 y que `config.js` apunte a Supabase, no al modo demostración) | Ejecución real: HTTP 200 | ✅ Activo | [ejecución 1](https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/42492293877): base `HTTP 200 · []`, Auth `HTTP 200`, aplicativo `HTTP 200`, habilitar `HTTP 204` ×2 |
| Alerta de falla | — | Si un control falla, el job termina en rojo → GitHub envía **correo** al dueño; el resumen de la ejecución trae los pasos para restaurar | Ejecución de prueba contra una URL inválida (`url_prueba`) | ✅ La ejecución falla y queda en rojo. ⚠ **Falta que confirmes que te llegó el correo** (no lo puedo ver) | [ejecución 2](https://github.com/ehchavezm-hub/11-LPS-GES/actions/runs/42492296517): 5 intentos con espera de 15 s (`curl: (6) Could not resolve host`), `##[error]Supabase base de datos respondió HTTP 000`, resumen con los pasos para restaurar; la re-habilitación corrió igual (`HTTP 204`) |
| Pérdida por error del aplicativo o de una migración | Alto (desarrollo en paralelo al uso) | **Foto diaria completa dentro de Supabase** (migración 032): todas las tablas, en el esquema aparte `respaldo` que la API no ve; pg_cron todos los días 23:37 Lima; no se borran solas. Además, la tabla `auditoria` guarda la fila completa de cada borrado y el antes/después de cada cambio | Foto real tomada el 09/11/2026 12:32 UTC: conteos idénticos a los de antes (129 actividades, 62 proyectos, 541 valores…); permisos: anon/authenticated sin acceso (consultado) | ✅ Activo | Consultas de solo lectura del 09/11/2026 |
| Respaldo fuera del proveedor | Alto | `respaldo.yml` ahora es **diario**, exporta **todas** las tablas (`respaldo_completo`, solo con la clave secreta), lo **cifra** (AES-256) y lo guarda como artefacto 90 días (y en Drive si hay `RCLONE_CONF`). Controla también que la foto interna tenga < 36 h. **Falta que cargues 2 secrets** (sección 5); hasta entonces falla a diario a propósito, para que no quede en silencio | Cifrado/descifrado probado en local | ⏳ Esperando tus secrets | — |
| Cuotas (base, disco, egreso) | Bajo hoy (3,6 %) | Revisión trimestral (sección 6). Un aviso automático al 80 % necesitaría un token de administración de Supabase (sección 4) | Consulta de solo lectura | 📄 Documentado | — |
| Google Fonts, dominio, certificado | Bajo | Solo documentado | — | 📄 Documentado | — |

## 4. Límites residuales (lo que la automatización no cubre)

1. **Restaurar una pausa es manual.** Si el latido fallara varios días seguidos (por ejemplo, GitHub caído) y Supabase
   pausara el proyecto, alguien debe pulsar *Restore project*. Solución definitiva: **Supabase Pro, unos US$ 25/mes**
   (no se pausa e incluye respaldos diarios) [S1].
2. **Sin respaldo externo automático** hasta que apruebes la sección 5. Mientras tanto: Configuración › Respaldo del
   aplicativo, a mano, y guardarlo en tu Drive privado.
3. **Aviso de cuotas ≥ 80 %**: con solo la clave pública no se puede leer el tamaño de la base. Para automatizarlo hace falta
   un **token personal de Supabase** (`SUPABASE_ACCESS_TOKEN`) como secret de GitHub. Ese token tiene permisos de
   administración amplios, por eso **no se configuró sin tu permiso**. Hoy el uso es 3,6 %: la revisión trimestral basta.
4. **Planificador de respaldo externo** (por ejemplo, un monitor de uptime gratuito que llame a la API cada pocas horas):
   **no se recomienda por ahora**. Exige crear una cuenta en otro servicio, y el latido de GitHub más la re-habilitación
   automática ya cubren el riesgo. Reconsiderarlo si GitHub Actions falla más de una vez.
5. **El correo de alerta depende de tu configuración de notificaciones de GitHub** (Settings › Notifications › Actions:
   «Email» y «Only notify for failed workflows»). Se envía al usuario que creó o cambió el horario del workflow
   (`ehchavezm-hub`).
6. **Cierre automático de semanas vencidas**: hoy no corre (necesita la clave `service_role`; ver sección 5). Es lógica del
   negocio: no se cambió.

## 5. Respaldos: qué hay y qué falta

**Ya activo (no necesita nada tuyo):**
- **Foto diaria interna** (migración `032_respaldo_interno.sql`): `respaldo.tomar_foto('diaria')` todos los días a las
  23:37 Lima (pg_cron, job `respaldo-diario`). Guarda todas las tablas de `public` en `respaldo.fotos` (unos 0,5 MB por
  foto ≈ 15 MB/mes; la base usa 18 MB de 500 MB). Antes de cada cambio a la base o publicación, Claude toma una foto
  con motivo `antes de <cambio>` (regla en `CLAUDE.md`). **Las fotos no se borran solas**; la revisión trimestral vigila el
  espacio y, si hace falta, te propondrá conservar por ejemplo los últimos 90 días.
- **Auditoría**: cada alta, cambio y baja de actividades, proyectos, listas, cartera, restricciones, permisos, perfiles…
  queda en `auditoria` con la fila completa (bajas) o el antes/después (cambios).

**Falta (respaldo fuera de Supabase, diario y cifrado):** carga en GitHub › Settings › Secrets and variables › Actions ›
*New repository secret*:

| Secret | Qué poner |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API Keys › clave **secreta** (`service_role` / `sb_secret_…`). Nunca va al código |
| `RESPALDO_CLAVE` | Una contraseña larga que tú inventes. **Guárdala también en tu gestor de contraseñas o Drive**: sin ella el respaldo no se puede abrir |
| `RCLONE_CONF` (opcional) | Para copiar además a tu Google Drive: en tu PC, `rclone config` → remoto `gdrive` (Google Drive); pegar el contenido de `rclone.conf` |

Luego: Actions › **Respaldo y mantenimiento** › *Run workflow* → debe quedar en verde con el artefacto
`respaldo-cifrado-…`. El cierre automático de semanas **sigue apagado** (es lógica del negocio): se activa solo si creas la
variable `CIERRE_AUTOMATICO = si`.

**Cómo abrir un respaldo cifrado** (en tu PC, con OpenSSL):
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in lpsges_respaldo_FECHA.json.gz.enc -out respaldo.json.gz   # pide RESPALDO_CLAVE
gunzip respaldo.json.gz     # queda un JSON con todas las tablas
```

## 6. Revisión trimestral

Programada como tarea de Claude cada 3 meses (1 de febrero, mayo, agosto y noviembre): vuelve a leer las políticas de
inactividad y cuotas de Supabase y GitHub, mide el tamaño de la base, revisa las últimas ejecuciones del latido y avisa
por correo si algo cambió. Primera ejecución: 01/02/2027. Se administra en claude.ai › Tareas programadas
(«LPS-GES: revisión trimestral de infraestructura»). Límite: la tarea no tiene conectores guardados; si no puede leer
Supabase lo dirá en su resumen, y entonces la medición del tamaño de la base se hace a mano (Supabase › *Usage*).

## 7. Runbook: qué hacer si llega una alerta

### Correo «Latido y salud — failed» con «Supabase no responde»
1. Abrir <https://supabase.com/dashboard/project/nyvtpmydrsaofjmfwdia>.
2. Si dice **Paused**: pulsar **Restore project** y esperar a que diga *Healthy* (unos minutos). Los datos se conservan.
3. Si no está pausado: revisar <https://status.supabase.com> (caída del proveedor) y *Usage* del proyecto (cuota excedida →
   respuestas 402).
4. GitHub › Actions › **Latido y salud** › *Run workflow* → debe quedar en verde.
5. Abrir el aplicativo y entrar con un usuario para confirmar.

### Correo con «El aplicativo publicado no responde bien»
1. GitHub › Actions › **Publicar aplicativo**: ver si la última ejecución falló; *Run workflow* para volver a publicar.
2. Settings › Pages: la fuente debe ser «GitHub Actions».
3. Si el aviso dice «modo demostración», revisar `app/config.js` (URL y clave publicable de Supabase).
4. Estado de GitHub: <https://www.githubstatus.com>.

### Un workflow programado aparece desactivado
1. GitHub › Actions › seleccionar el workflow › **Enable workflow**.
2. Ejecutar **Latido y salud** a mano: vuelve a habilitar los demás.

### Base en solo lectura o con error 402 (cuota)
1. Supabase › *Usage*: ver qué cuota se superó.
2. Disco ≥ 95 %: la guía [S4] explica cómo liberar espacio. **No borrar datos sin decisión del dueño.**
3. Si el uso real creció, evaluar Supabase Pro (unos US$ 25/mes).

### Recuperar datos borrados o cambiados por error
1. **No volver a editar** las filas afectadas. Avisar a Claude con la hora aproximada y la pantalla.
2. Primero se busca en `auditoria` (fila completa de lo borrado; antes/después de lo cambiado) y en `respaldo.fotos` (foto
   del día anterior o la tomada «antes de» un cambio). Solo lectura.
3. Se prepara un SQL que devuelve solo esas filas (con respaldo previo y conteos antes/después), en una transacción. El
   dueño lo aprueba antes de ejecutarlo.

### Falla el respaldo diario
1. Ver el log de **Respaldo y mantenimiento**. Si el error es de Drive, el token de rclone pudo vencer: volver a ejecutar
   `rclone config reconnect gdrive:` en tu PC y actualizar el secret `RCLONE_CONF`.
2. Mientras tanto, respaldo manual desde el aplicativo (Configuración › Respaldo).
