# LPS-GT

Aplicativo web para aplicar el **Last Planner System®** a la gestión de un área funcional (Gerencia Técnica):
Look Ahead de 3 semanas, plan semanal con compromisos, cierre con PAC y causas de no cumplimiento (CNC),
restricciones, cartera y solicitudes de otras gerencias, tablero de indicadores, reunión semanal guiada,
capacidad del equipo y reportes PDF. Alcance aprobado: [`docs/LPS-GT_Alcance_v0.7.docx`](docs/LPS-GT_Alcance_v0.7.docx).

- **Pruébelo sin instalar nada:** abra el aplicativo publicado y agregue `?demo` a la dirección (datos ficticios que se guardan solo en su navegador).
- Funciona en PC y celular; se puede instalar como aplicación (PWA).
- Repositorio **público**: aquí no se guardan datos de la empresa, personas ni respaldos. Los datos viven en Supabase y los respaldos en Google Drive.

## Contenido

| Carpeta | Qué contiene |
|---|---|
| [`app/`](app/) | Aplicativo web (HTML + JavaScript sin compilación; librerías incluidas en `app/vendor/`). |
| [`supabase/migrations/`](supabase/migrations/) | Base de datos: tablas, reglas de seguridad por rol (RLS), reglas de negocio y datos iniciales. |
| [`supabase/tests/`](supabase/tests/) | Pruebas automáticas de las reglas de seguridad (`bash supabase/tests/run.sh`). |
| [`.github/workflows/`](.github/workflows/) | Publicación en GitHub Pages, respaldo semanal en Google Drive y pruebas. |
| [`docs/`](docs/) | Documento de alcance y [decisiones de desarrollo](docs/DECISIONES-DESARROLLO.md). |
| [`especificacion/`](especificacion/00-indice.md) | Catálogo **referencial** tomado de ECM Project (solo plantillas, sin datos). |

## Puesta en marcha (una sola vez, ~30 minutos)

### 1. Base de datos (Supabase, plan gratuito)
1. Cree una cuenta en <https://supabase.com> y un proyecto nuevo (región: São Paulo o la más cercana). Guarde la contraseña de la base de datos.
2. En **SQL Editor**, ejecute en orden el contenido de:
   `001_esquema.sql`, `002_seguridad.sql`, `003_datos_iniciales.sql`, `004_permisos_funciones.sql`, `005_usuarios_admin.sql`, `006_eliminar_usuarios.sql`, `007_roles_planificadores.sql`, `008_grupos_listas.sql`, `009_super_administrador.sql`, `010_cet_servicio.sql`, `011_eliminar_proyectos.sql`, `012_eliminar_proyecto_completo.sql`.
3. **Cierre automático de semanas** (viernes 17:00): en **Database → Extensions** active `pg_cron` y ejecute en el SQL Editor:
   ```sql
   select cron.schedule('lpsgt-cierre', '5 * * * *', 'select public.cerrar_semanas_vencidas()');
   ```
   (Revisa cada hora; solo cierra las semanas cuyo plazo ya venció. El respaldo de GitHub también lo ejecuta.)
4. **Authentication → Providers → Email**: activado. Recomendado: *Confirm email* activado.
5. **Authentication → URL Configuration**: *Site URL* = la dirección del aplicativo en GitHub Pages (paso 2), p. ej. `https://ehchavezm-hub.github.io/11-LPS_GT/`.
6. **Project Settings → API**: copie la *Project URL* y la *anon / publishable key*. **Nunca** use la *service_role / secret key* en el aplicativo.

7. **Alta de usuarios por el administrador** (crear usuarios con contraseña y restablecerlas). Instale la función `admin-usuarios` de una de estas dos formas:
   - **Desde Supabase (sin herramientas):** *Edge Functions → Deploy a new function → Via Editor*, nombre **`admin-usuarios`**,
     pegue el contenido de [`supabase/functions/admin-usuarios/index.ts`](supabase/functions/admin-usuarios/index.ts) y pulse *Deploy function*.
     Luego, en *Details* de la función, desactive **Verify JWT with legacy secret** (la función valida la sesión por sí misma).
   - **Desde GitHub:** cree los secrets `SUPABASE_ACCESS_TOKEN` (token de <https://supabase.com/dashboard/account/tokens>) y `SUPABASE_PROJECT_REF`
     (el texto `xxxx` de `https://xxxx.supabase.co`) y ejecute **Actions → Funciones Supabase → Run workflow**.

   Sin esta función, los usuarios igual pueden registrarse solos con el enlace de invitación.

### 2. Publicación (GitHub Pages)
1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: cree `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los valores del paso 1.6.
3. **Actions → Publicar aplicativo → Run workflow** (también se publica solo en cada cambio de `app/` en `main`).
   Sin esas variables se publica en modo demostración.

### 3. Primer ingreso
1. Abra el aplicativo y use **Crear cuenta**. **El primer usuario registrado queda como Super administrador (administrador principal).**
2. Configuración → Usuarios → **＋ Nuevo usuario**: cree a cada persona con su rol y una contraseña temporal (se genera sola);
   el aplicativo muestra los datos de acceso para copiarlos y entregarlos. Al ingresar, la persona define su propia contraseña.
   Con el botón **🔑** se restablece la contraseña de cualquier usuario y con **🗑** se elimina (solo el administrador). Desde ahí también se rota el delegado.
   Alternativa: enviar el enlace (**✉ Invitar**); quien se registra solo queda *Pendiente* hasta que se le asigne rol.
3. Configuración → Importar: cargue el catálogo de proyectos y el histórico de PAC desde los Excel anteriores
   (se procesan en el navegador y van directo a la base de datos).

### 4. Respaldo semanal en Google Drive y mantenimiento
El flujo **Respaldo y mantenimiento** corre lunes y jueves (mantiene activo el proyecto gratuito de Supabase, que se pausa tras 7 días sin uso)
y el viernes por la noche genera el respaldo completo (JSON comprimido) y lo sube a Google Drive. Conserva un año.

1. Instale [rclone](https://rclone.org/drive/) en su PC y ejecute `rclone config` → nuevo remoto llamado **`gdrive`**, tipo *Google Drive*, alcance *drive.file*.
2. Copie el contenido del archivo `rclone.conf` (`rclone config file` muestra la ruta).
3. **Settings → Secrets and variables → Actions → Secrets**: cree
   - `SUPABASE_URL` — Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — *service_role / secret key* (solo aquí, como secreto).
   - `RCLONE_CONF` — contenido de `rclone.conf`.
4. Opcional: variable `GDRIVE_CARPETA` (por defecto `LPS-GT/respaldos`).
5. Pruebe con **Actions → Respaldo y mantenimiento → Run workflow**.

El administrador también puede descargar un respaldo (JSON o Excel) en cualquier momento desde Configuración → Respaldo.

## Desarrollo local
```bash
cd app && python3 -m http.server 8080      # abrir http://localhost:8080/?demo
bash supabase/tests/run.sh                  # pruebas de la base de datos (requiere PostgreSQL 16)
```
Los módulos están en `app/js/` (`core/` estado y rutas, `data/` acceso a datos Supabase/demo, `ui/` grilla tipo Excel y componentes,
`services/` indicadores, PDF, importación, `views/` pantallas). Para agregar una pantalla: crear `views/x.js` con `render(el)` y registrarla en `main.js` y `ui/layout.js`.
Al cambiar archivos de `app/`, el service worker se actualiza solo al publicar (versión = commit).

## Seguridad
- La clave pública (anon) solo permite lo que las reglas RLS autorizan a cada rol; las funciones de respaldo y mantenimiento no se pueden llamar con ella.
- El aplicativo se niega a funcionar si `config.js` contiene una clave secreta, y la publicación también la rechaza.
- No suba Excel, respaldos ni datos reales al repositorio.
