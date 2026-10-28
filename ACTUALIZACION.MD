# LPS-GES — Registro de desarrollo

## ¿Qué es este proyecto?

SPA (Single Page Application) para gestión de proyectos bajo metodología LPS (Last Planner System). Sin framework JS, ES modules, Supabase como backend, desplegada en GitHub Pages.

- **Repo:** `ehchavezm-hub/11-LPS-GES` (rama `main`)
- **URL producción:** `https://ehchavezm-hub.github.io/11-LPS-GES`
- **Hash router:** las rutas son `#/tablero`, `#/plan`, `#/admin`, etc.

---

## Arquitectura

```
app/
  index.html          ← punto de entrada, carga app.js y admin.css
  js/
    main.js           ← rutas (ruta()), bootstrap (arrancar())
    core/
      router.js       ← ruta(), iniciarRouter()
      store.js        ← estado global, roles: esSuperadmin, esAdmin, esGestor, esStaff
      util.js         ← esc(), fmtFechaHora()
    data/
      api.js          ← cliente Supabase (api.list, api.insert, api.update...)
      catalogos.js    ← ROLES, COLOR_ROL
    ui/
      layout.js       ← montarLayout() — sidebar + área de contenido
      ui.js           ← ok(), error(), confirmar(), pedirDatos(), modal(), badge()
    views/
      admin-console.js  ← consola de administración
      login.js
      tablero.js
      plan.js
      ... (una vista por módulo)
  css/
    app.css
    admin.css         ← estilos exclusivos de la consola admin
```

### Roles disponibles (store.js)
- `esSuperadmin()` — superadmin
- `esAdmin()` — superadmin o admin o delegado
- `esGestor()` — superadmin, admin, delegado o lider
- `esStaff()` — cualquier rol activo
- **NO existe** `esPropietario` — fue eliminado

### Cómo registrar una ruta
```js
ruta('/ruta', () => import('./views/mi-vista.js'), { staff: true });
// Guards disponibles: staff, gestor, admin
```

---

## Estado actual del módulo Administración

La consola de admin (`#/admin`) está **completamente funcional** como página de navegación completa (no overlay/modal).

### Paneles implementados
| Panel | Descripción |
|-------|-------------|
| Resumen | KPIs: usuarios activos, proyectos activos/propuestos/cerrados |
| Usuarios y roles | CRUD usuarios, invitación, restablecimiento de clave |
| Administrador delegado | Asignar/revocar/historial de delegados |
| Proyectos / Procesos | CRUD proyectos, aprobar/rechazar propuestas |
| Listas configurables | Gestión de listas desplegables del sistema |
| Parámetros | Meta PAC, semanas Look Ahead, días laborables, etc. |
| Calendario | Semanas por año, feriados |
| Auditoría | Últimas 100 acciones registradas |

### Acceso
- Solo usuarios con rol `admin`, `delegado` o `superadmin` pueden acceder
- Guard en `main.js`: `if (r.admin && !esAdmin()) { location.hash = '#/tablero'; return false; }`

---

## Bugs corregidos (historial)

| Commit | Bug | Fix |
|--------|-----|-----|
| `dc91494c` | "Página no encontrada" en `#/admin` | Se agregó la ruta `/admin` en `main.js` |
| `224a3a30` | `esPropietario is not defined` | Se eliminó del import en `admin-console.js` |
| `a37b43dc` + `0ef6f060` | Consola sin estilos | Se creó `admin.css` y se enlazó en `index.html` |
| `52dab511` | Después de cerrar, click en Administración no hacía nada | `cerrarConsola()` redirige a `#/tablero` |
| `9d2e217f` | Consola aparecía como ventana flotante | Convertida de overlay a página completa inline |

---

## Patrón de renderizado de vistas

Cada vista exporta `render(el)` donde `el` es el contenedor del router. La consola de admin usa:

```js
// main.js
ruta('/admin', () => import('./views/admin-console.js').then(m => ({
  render(el) { el.innerHTML = ''; m.showAdminConsole(undefined, el); },
})), { admin: true });

// admin-console.js
export function showAdminConsole(panelInicial, el) {
  contenedor = el;
  el.innerHTML = buildShell();
  // ... event listeners, pintarMenu(), renderPanel()
}

export function cerrarConsola() {
  dejarEscuchar?.();
  dejarEscuchar = null;
  contenedor = null;
  location.hash = '#/tablero';
}
```

---

## Pendiente / próximas tareas

_(Actualizar esta sección con cada sesión de desarrollo)_

- [ ] Verificar funcionamiento en producción post-fix c5
- [ ] Completar integración Supabase en paneles de admin (tabla `parametros`, `listas_configurables`, etc.)
- [ ] Resto de módulos del sistema según spec LPS-GT

---

## Cómo continuar el desarrollo

1. Clonar el repo: `git clone https://github.com/ehchavezm-hub/11-LPS-GES.git`
2. Leer este archivo para entender el estado actual
3. Ver historial: `git log --oneline` para ver qué cambió y cuándo
4. El punto de entrada es `app/js/main.js`
