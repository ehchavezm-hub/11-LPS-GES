# Ventanas del aplicativo LPS-GT

Inventario al 24/10/2026 (versión publicada en `main`).

## Solicitud 45: ventanas emergentes movibles con el mouse

Todas las ventanas emergentes se mueven **arrastrando su barra de título** (también con el dedo en el celular). No salen de la pantalla y la ✕ sigue cerrándolas.
Como todas usan la misma ventana base (`ui/ui.js → modal()`), la mejora llega a todas a la vez, incluidas las que se agreguen en el futuro.

**Estado: ✅ completada**: 52 ventanas emergentes movibles de 52.

### Ventanas emergentes (52)

| # | Pantalla | Ventana | Movible |
|---|---|---|:-:|
| 1 | General (cabecera) | Notificaciones | ✅ |
| 2 | General (cabecera) | Mi perfil | ✅ |
| 3 | General (cabecera) | Cambiar contraseña | ✅ |
| 4 | General (Ayuda) | Recorrido guiado | ✅ |
| 5 | Grillas (todas) | Pegar filas desde Excel | ✅ |
| 6 | Grillas (todas) | Valores nuevos en las listas | ✅ |
| 7 | Grillas (todas) | Columnas visibles | ✅ |
| 8 | Grillas (todas) | Vistas de la grilla | ✅ |
| 9 | Grillas (todas) | Confirmar eliminación de filas | ✅ |
| 10 | Plan semanal | Traer del Look Ahead | ✅ |
| 11 | Plan semanal | Actividades recurrentes | ✅ |
| 12 | Plan semanal | Arrastrar no completadas | ✅ |
| 13 | Plan semanal | Marcar estado de compromisos | ✅ |
| 14 | Plan semanal | No se puede cerrar todavía | ✅ |
| 15 | Plan semanal | Cerrar semana | ✅ |
| 16 | Plan semanal | Arrastre a la semana siguiente | ✅ |
| 17 | Plan semanal | Reabrir semana | ✅ |
| 18 | Plan semanal / Tablero | Resumen semanal | ✅ |
| 19 | Look Ahead | Aplicar plantilla de servicio | ✅ |
| 20 | Look Ahead | Crear actividades desde la cartera | ✅ |
| 21 | Plan / Look Ahead | Restricciones de la actividad | ✅ |
| 22 | Plan / Look Ahead | Nueva restricción | ✅ |
| 23 | Plan / Look Ahead | Restricciones pendientes (comprometer igual) | ✅ |
| 24 | Plan / Look Ahead / Restricciones / Cartera | Detalle: comentarios, menciones y enlaces | ✅ |
| 25 | Cartera y solicitudes | Nueva solicitud de servicio | ✅ |
| 26 | Cartera y solicitudes | Aceptar solicitud | ✅ |
| 27 | Cartera y solicitudes | Rechazar solicitud | ✅ |
| 28 | Cartera y solicitudes | Documento de la solicitud | ✅ |
| 29 | Proyectos | Nuevo / Editar / Proponer proyecto | ✅ |
| 30 | Proyectos | Líderes del proyecto | ✅ |
| 31 | Proyectos | Rechazar proyecto | ✅ |
| 32 | Proyectos | Desactivar proyecto | ✅ |
| 33 | Proyectos | Eliminar proyecto (1 de 2 y 2 de 2) | ✅ |
| 34 | Proyectos | Proyecto con historial | ✅ |
| 35 | Proyectos | Eliminar proyecto con su historial | ✅ |
| 36 | Proyectos | Nuevo hito | ✅ |
| 37 | Proyectos | Importar proyectos (vista previa) | ✅ |
| 38 | Plantillas | Nueva plantilla de servicio / recurrente | ✅ |
| 39 | Mejoras del aplicativo | Nueva solicitud de mejora | ✅ |
| 40 | Mejoras del aplicativo | Gestionar solicitud | ✅ |
| 41 | Configuración → Usuarios | Nuevo usuario | ✅ |
| 42 | Configuración → Usuarios | Editar usuario | ✅ |
| 43 | Configuración → Usuarios | Restablecer contraseña | ✅ |
| 44 | Configuración → Usuarios | Datos de acceso (credenciales) | ✅ |
| 45 | Configuración → Usuarios | Eliminar usuario | ✅ |
| 46 | Configuración → Usuarios | Administrador delegado | ✅ |
| 47 | Configuración → Usuarios | Invitar usuarios | ✅ |
| 48 | Configuración → Listas | Nueva lista / Grupo de la lista | ✅ |
| 49 | Configuración → Importar | Importar histórico de Excel | ✅ |
| 50 | Configuración → Usuarios (Organigrama) | Agregar / editar unidad o persona | ✅ |
| 51 | Configuración → Usuarios (Organigrama) | Quitar del organigrama | ✅ |
| 52 | Configuración → Usuarios (Organigrama) | Generar desde usuarios | ✅ |

Los menús desplegables (clic derecho, menú de usuario, menú Actualizar) no son ventanas: se cierran al hacer clic fuera, por eso no se mueven.

## Pantallas (24)

| # | Pantalla | Dónde |
|---|---|---|
| 1 | Ingreso (login, registro, recuperar contraseña) | Inicio |
| 2 | Cambio de contraseña obligatorio | Primer ingreso |
| 3 | Plan semanal | Menú |
| 4 | Look Ahead | Menú |
| 5 | Restricciones | Menú |
| 6 | Cartera y solicitudes | Menú |
| 7 | Tablero | Menú |
| 8 | Reunión semanal (6 pasos) | Menú |
| 9 | Equipo y capacidad | Menú |
| 10 | Plantillas | Menú |
| 11 | Mejoras del aplicativo | Menú |
| 12 | Ayuda | Menú |
| 13 | Ficha del proyecto | Desde Proyectos |
| 14 | Detalle de actividad | Enlace directo |
| 15–22 | Configuración: Usuarios y roles, Listas, Parámetros, Permisos, Columnas personalizadas, Importar Excel, Respaldo, Auditoría | Menú → Configuración |
| 23 | Proyectos / Procesos (tres ventanas: Activos, En pausa, Cerrados) | Configuración → Listas |
| 24 | Pendiente de aprobación / cuenta desactivada | Al ingresar |

**Total: 24 pantallas y 52 ventanas emergentes.** Además, la sección Usuarios y roles incluye el *Organigrama del equipo* (lienzo con pantalla completa).
