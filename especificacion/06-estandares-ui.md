# 06 — Estándares visuales y de interfaz

> Referencial. Fuente: `css/tokens.css`, `css/components.css`, `js/pdf-utils.js`.

## Tipografía
- **Urbanist** (400–700) para la interfaz y títulos; **IBM Plex Sans** para datos; respaldo `system-ui`.
- Impresión: Arial en el cuerpo, Urbanist en encabezado/pie/título.

## Paleta base (tema claro)
| Token | Valor | Uso |
|---|---|---|
| `--clr-bg` | `#f7f8fa` | Fondo |
| `--clr-surface` / `-2` / `-3` | `#ffffff` / `#f0f2f5` / `#e4e7ec` | Tarjetas, filas alternas, cabeceras |
| `--clr-border` | `#d1d5db` | Bordes |
| `--clr-text` / `-2` / `-3` | `#111827` / `#374151` / `#5b6270` | Texto principal / secundario / atenuado |
| `--clr-primary` | `#4f46e5` | Marca, botones primarios (theme-color) |

Hay tema oscuro conmutado con `data-theme` en `<html>` y guardado en `localStorage['app-theme']`.

## Colores de estado
| Estado | Color | Fondo |
|---|---|---|
| Normal (con holgura) | `#1976D2` | `#e3f0fd` |
| Crítica (TF ≤ 0) | `#D32F2F` | `#fdecea` |
| Casi crítica | `#FB8C00` | `#fff3e0` |
| Completada | `#388E3C` | `#e8f5e9` |
| Hito | `#F9A825` | `#fff9e6` |
| Pendiente | `#9e9e9e` | `#f5f5f5` |
| Retrasada | `#F57C00` | `#fff3e0` |
| Barra resumen | `#455a64` | |
| Línea base (Gantt) | `#6366f1` / `rgba(144,164,174,.5)` | |

**Semáforo general (LPS, EVM, DCMA):** verde `#388E3C` · naranja `#F57C00`/`#FB8C00` · rojo `#D32F2F`.
**Badge LPS:** azul `#1976D2` con fondo al 13 % (`#1976D222`). Patrón general de badges: color + mismo color con alfa `22`.
**Series de gráficos:** Planificado `#1976D2` · Real `#388E3C` · Proyectado `#F57C00` (punteado) · Línea base `#7B1FA2` (punteado) · Tendencia PPC `#1565C0` (punteado).

## Forma
Radios 4 / 8 / 12 / 16 px; sombras xs–xl suaves; paneles overlay con radio 12 px y sombra `0 12px 60px rgba(0,0,0,.3)`.

## Patrones de interfaz
- **Paneles overlay** centrados (ancho `min(900–1100px, 96–98vw)`, alto ~80–90vh), fondo oscurecido `rgba(0,0,0,.35)`, arrastrables desde la cabecera (`data-drag-handle`).
- **Cabecera de panel:** icono 20 px + título 14 px semibold + subtítulo 11 px atenuado; a la derecha `🖨 Imprimir`; botón `✕` circular 28 px fijo arriba a la derecha (obs. #51, #121).
- **Pestañas** (LPS): barra horizontal con emoji + texto; activa resaltada.
- **Barra informativa** (`lad-info-bar`): resumen de conteos a la izquierda, acciones a la derecha.
- **Caja guía**: fondo `surface-2`, borde izquierdo 3 px del color del paso, texto 11 px, referencia normativa a la derecha.
- **Tablas:** cabecera gris, filas alternas, texto 11–12 px, fechas `DD/MM/AAAA` (`es-PE`).
- **Tarjetas KPI:** valor grande coloreado por semáforo + etiqueta + subtítulo.
- **Avisos (toasts)** tipos `success`, `info`, `warn`, `error` vía evento `show-toast`.
- Accesibilidad: `aria-label` en botones de icono, `role="dialog"`, región `aria-live`.
- Atajos: Ctrl+Z / Ctrl+Y (deshacer/rehacer), Tab / Shift+Tab (indentar).
- **Móvil:** cajón lateral para el explorador + pestañas inferiores.

## Iconografía (emoji usados como convención)
📋 LPS / EDT · 📅 LookAhead · 🚧 restricción / bloqueada · ✅ lista / aprobado · 📊 métricas · 🌅 stand-up · 🖨 imprimir · 📥 importar · 💾 guardar · ✏ editar · 🗑/✕ eliminar · 🔒⏳🔓 estados de restricción · 🔴🟡🔷 alertas · ⭐ LB primaria · 📌 aplicar.

## Convenciones de impresión
Ver `03-reportes.md` → *Estándar de impresión*. Resumen: vista previa A4 vertical/horizontal, encabezado (app · proyecto · fecha-hora), pie (autor · página N de M), título centrado, nombre `Proyecto-Módulo-DDMMAAAA.pdf`, sin iconos ni botones, colores semafóricos conservados, sin páginas en blanco.
