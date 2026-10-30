# Handoff de sesión – LPS-GES (GT)

> Repositorio: `ehchavezm-hub/11-LPS-GES`  
> Branch de trabajo: `main` (GitHub Pages)  
> Clone local en la sesión anterior: `/tmp/lps-ges-clone/`  
> Última sesión: 2026-10-30  

---

## Resumen de fixes aplicados y pusheados a main

### s41 — Actividad desaparece al cambiar Proyecto/Proceso
**Síntoma:** Al cambiar el campo "Proyecto / Proceso" en Look Ahead, la fila desaparecía.  
**Causa:** En `grid.js → aplicarRemoto`, el check de "echo" (ignorar mis propios updates) corría DESPUÉS del check de `pertenece`. El echo no se disparaba y la fila era borrada.  
**Fix:** Reordenar echo check ANTES del pertenece check.  
**Archivo:** `app/js/ui/grid.js`  
**Commit:** `c1880df`

---

### s42 — `invalid input syntax for type uuid: ''` / filas desaparecen / proyectos no aparecen en dropdown
**Síntoma:** Errores UUID al guardar; filas que desaparecen; proyectos configurados no visibles en el dropdown.  
**Causa:** Campos tipo lista devuelven `""` (string vacío) al limpiarlos; Supabase no acepta `""` como UUID.  
**Fix:**
- `grid.js → camposDB()`: normaliza `""` → `null` para campos no-texto antes de enviar a la BD.
- `columnas.js → derivarProyectoServicio()`: añadir `|| null` para el campo `_cet`.  
**Archivos:** `app/js/ui/grid.js`, `app/js/services/columnas.js`  
**Commit:** incluido con `c1880df`

---

### s45/s46 — Nueva actividad en sub-proyecto "Gestión" se mueve a Cerro Verde / Templo de Iquitos
**Síntoma:** Al crear una actividad en el sub-proyecto "Gestión" y elegir un CET de "Cerro Verde", la actividad aparecía bajo "Cerro Verde" en lugar de quedarse en "Gestión".

**Causa raíz (código viejo):**
```js
// lookahead.js y plan.js — nuevaFila() — ANTES:
const p = store.proyectoSel && !esContenedor(proyecto(store.proyectoSel))
  ? proyecto(store.proyectoSel) : null;
// Como esContenedor(Gestión) = true (tiene ConstruIA hijo), p = null → proyecto_id = null
```
Con `proyecto_id = null`, la función `derivarProyectoServicio` (en `columnas.js`) auto-llenaba el proyecto desde el CET elegido (Cerro Verde), moviendo la actividad.

**Fix:** Eliminar el check `!esContenedor`:
```js
// DESPUÉS:
const p = store.proyectoSel ? proyecto(store.proyectoSel) : null;
// → proyecto_id = Gestión.id siempre → guard !fila.proyecto_id en derivarProyectoServicio no activa
```
**Archivos:** `app/js/views/lookahead.js` (línea 79), `app/js/views/plan.js` (línea 135)  
**Commit:** `e59c4f8`

**Regla de negocio confirmada:**
> La actividad pertenece al sub-proyecto donde fue creada (ej. "Gestión").  
> Elegir un CET/Servicio de otro proyecto (Cerro Verde, Iquitos) NO cambia el `proyecto_id`.  
> El sub-proyecto "Gestión" ATIENDE a proyectos externos sin moverse a ellos.

---

### s49 — Actividades "perdidas" / invisibles tras el fix s45/s46
**Síntoma:** Actividades creadas ANTES del fix s45/s46 (cuando `nuevaFila` ponía `proyecto_id = null`) eran invisibles en todas las vistas.

**Causa:** `enProyectoSel(null)` devolvía `false`:
```js
// ANTES (store.js línea 281):
if (sel) return id === sel || (!!id && proyecto(id)?.padre_id === sel);
// null === sel → false, !!null → false → resultado: false
```

**Fix:** Cuando `id = null` y el proyecto seleccionado es contenedor, devolver `true`:
```js
// DESPUÉS:
if (sel) {
  if (!id) return esContenedor(proyecto(sel));  // null → visible en contenedores
  return id === sel || proyecto(id)?.padre_id === sel;
}
```
**Archivo:** `app/js/core/store.js` (línea 279)  
**Commit:** `9e63b32`

---

## Estado actual de los datos en BD

- **Actividades con `proyecto_id = null`**: Creadas antes del fix en "Gestión". Con el fix s49 son visibles. Tienen el `proyecto_id` correcto conceptualmente (Gestión), pero el campo en BD es `NULL`. Para limpiarlos en el futuro, cambiarles el campo "Proyecto / Proceso" a "GT-OT-001 · GT_OT › Gestión" desde la vista.

- **Actividades con `proyecto_id = Cerro Verde` o `proyecto_id = Templo de Iquitos`**: Creadas durante el período buggy. Son las que aparecen en las vistas de esos proyectos. Para recuperarlas en "Gestión": navegar a Cerro Verde/Templo de Iquitos → cambiar "Proyecto / Proceso" a "GT-OT-001 · GT_OT › Gestión".

---

## Issue pendiente: s47 — "Luces de Navidad" (flickering en Configuración → Proyectos)

**Síntoma:** La página de Configuración → Proyectos parpadea constantemente (se prende y apaga).

**Investigación realizada (no completada):**
- `proyectos.js` define 3 grillas ("ventanas"): activos, propuestos, inactivos.
- `redistribuir()` (líneas 74–87): recarga catálogo y llama `g.setDatos(nuevos)` con check de `firma`.
- `alCambioRemoto` (configuración de la grilla): `() => { clearTimeout(configGrilla.t); configGrilla.t = setTimeout(redistribuir, 600); }` — **posible bug**: `configGrilla.t` es una propiedad de la función, compartida entre las 3 instancias de ventana → el debounce puede no funcionar correctamente.
- `alGuardar`: `() => { cargarCatalogo(); pintarCuentas(); }` → `cargarCatalogo()` → `emit('catalogo')` → `pintarProyectos()` en sidebar → re-render del sidebar.
- NO hay `api.subscribe` para la tabla `proyectos` → `alCambioRemoto` solo se activa desde `alEditar` (cambio de estado).

**Posible causa del flickering:**
El `configGrilla.t` es compartido entre las 3 ventanas de la grilla. Si una ventana dispara `alCambioRemoto`, pone el timer. Luego otra ventana lo dispara, cancela el primero y pone otro. Esto puede crear un loop de redistribución continua.

**Archivos relevantes:**
- `app/js/views/proyectos.js` (función `redistribuir`, `configGrilla`)
- `app/js/ui/layout.js` (función `pintarProyectos`)
- `app/js/ui/grid.js` (función `aplicarRemoto`)

**Fix sugerido (no implementado):** Dar a cada ventana su propio timer en lugar de compartir `configGrilla.t`:
```js
// En lugar de: configGrilla.t = setTimeout(...)
// Usar un timer por instancia: cfg._timer = setTimeout(...)
```

---

## Estructura de proyectos / sub-proyectos (para contexto)

```
OBRAS INDUSTRIALES (área)
├── GT_OT (programa, contenedor)
│   ├── GT_POR (portafolio)
│   │   └── GT_OT (proyecto contenedor)
│   │       ├── Gestión          ← sub-proyecto (esContenedor=true porque tiene ConstruIA)
│   │       └── ConstruIA        ← sub-proyecto hijo de Gestión
├── Cerro verde (C314200)        ← proyecto standalone
└── Templo de Iquitos (C314500)  ← proyecto standalone
```

**Nomenclatura (aclaración del usuario):**
- "Sub-proyecto" = nodos del sidebar: "Gestión", "ConstruIA"
- "Proyecto" = valores en la columna: "GT-OT-001·Gestión", "HT-OT-001·ConstruIA", "C314200·Cerro verde", "C314500·Templo de Iquitos"

---

## Archivos modificados en este proyecto (resumen)

| Archivo | Qué se cambió |
|---|---|
| `app/js/ui/grid.js` | Echo check antes de pertenece en `aplicarRemoto`; `camposDB` normaliza `""` → `null` |
| `app/js/services/columnas.js` | `|| null` en `derivarProyectoServicio` para `_cet` |
| `app/js/views/lookahead.js` | `nuevaFila`: eliminado `!esContenedor` check (línea 79) |
| `app/js/views/plan.js` | `nuevaFila`: eliminado `!esContenedor` check (línea 135) |
| `app/js/core/store.js` | `enProyectoSel`: `null` proyecto_id visible en contenedores (línea 279) |

---

## Cómo continuar en una nueva sesión

1. Clonar el repo: `git clone https://github.com/ehchavezm-hub/11-LPS-GES.git`
2. El branch de trabajo es `main` (GitHub Pages sirve desde ahí)
3. Leer este archivo para contexto completo
4. El issue pendiente más importante es **s47 (flickering en Configuración → Proyectos)**
5. Leer `app/js/views/proyectos.js` completo y `app/js/ui/grid.js` para el fix del timer compartido

---

## Commits clave

```
9e63b32  fix(s49): recuperar actividades con proyecto_id nulo en vista Gestión
e59c4f8  fix(s45/s46): nuevaFila siempre usa proyectoSel sin check esContenedor
c1880df  fix(s41/s42): echo check antes de pertenece; camposDB normaliza strings vacíos
```
