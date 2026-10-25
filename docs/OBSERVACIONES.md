# LPS-GT · Seguimiento de las observaciones

Estado de cada observación al 25/10/2026.

**Qué significa cada columna**
- **Levantada**: el cambio está hecho y publicado. Para una consulta, la respuesta ya se entregó.
- **Verificada**: la prueba que se hizo al levantarla. Casi siempre es una prueba automática en el navegador, en modo demo.
- **Reconfirmada (25/10)**: el 25/10/2026 se volvieron a correr todas las pruebas sobre la versión actual, para confirmar que cada levantamiento sigue funcionando. La batería completa tiene más de 60 pruebas de pantalla, la prueba de humo (20 rutas × 9 usuarios = 160 pantallas) y la prueba de la base de datos (migraciones 001–015 y reglas de seguridad). Todo pasó.

**Sobre la numeración**
- Los números **1–15, 17–21, 24, 28, 29, 34 y 55–71** no venían en el mensaje. Se asignaron por el orden en que llegaron los mensajes. Por ejemplo, entre el 54 y el 72 hubo exactamente 17 mensajes, sobre la conexión a Supabase y el ingreso.
- Los números **92** y **93** se usaron dos veces. Aparecen como 92-a/92-b y 93-a/93-b.
- Tres consultas sin número están en la fila de la observación a la que se refieren (50, 42 y 82).
- Cuando un pedido posterior cambió lo que pedía uno anterior, se reconfirmó lo que vale ahora y la nota lo dice. Ejemplo: el 27 unió CET y Servicio, y el 52 los volvió a separar en dos columnas.

## 1. Alcance, puesta en marcha y publicación (1–15)

| N° | Observación | Levantada | Verificada | Reconfirmada (25/10) |
|---|---|---|---|---|
| 1 | Inicio del proyecto LPS-GT | ✅ | — | ✅ Repositorio activo |
| 2 | ¿Hay acceso de lectura a ECM Project? | ✅ Respondida | — | — |
| 3 | Tomar de ECM las plantillas, tomas de datos y reportes, **sin los datos** | ✅ | Revisión: el repositorio no tiene datos de la empresa | ✅ Sin Excel ni respaldos en el repositorio; control automático *gitleaks* |
| 4 | Todo el proyecto vive en `ehchavezm-hub/11-LPS_GT` | ✅ | — | ✅ |
| 5 | Lo de ECM solo es referencial | ✅ | — | — |
| 6 | Definir el alcance en Word (LPS en un área funcional, 10 líderes, administración) | ✅ v0.1 | Revisión del documento | ✅ `docs/LPS-GT_Alcance_v0.1.docx` |
| 7 | v0.2: registro flexible tipo Excel y sección de proyectos como menú | ✅ v0.3 | Revisión del documento | ✅ Grilla tipo Excel y menú de proyectos en la app |
| 8 | v0.4: compatibilizar y proponer mejoras | ✅ v0.5 | Revisión del documento | ✅ |
| 9 | v0.6: actualizar | ✅ v0.7 | Revisión del documento | ✅ |
| 10 | Implementar el aplicativo según la v0.7 | ✅ | Pruebas de todas las pantallas y roles; base de datos en Postgres local | ✅ Humo (160 pantallas) y base de datos sin errores |
| 11 | Completar todo el desarrollo; aprobar lo que haga falta | ✅ | Ídem | ✅ |
| 12 | ¿Dónde está el link del app? | ✅ | Publicación en GitHub Pages | ✅ Enlace en el README |
| 13 | Ejecutar los pasos 1, 2 y 3 de la puesta en marcha | ✅ | Despliegue correcto | ✅ |
| 14 | Configurar Pages (rama main, origen GitHub Actions) | ✅ | Despliegue correcto | ✅ |
| 15 | El Gerente Técnico crea usuarios sin invitación, con clave, y puede restablecerla | ✅ | `usuarios.js` | ✅ `usuarios.js` |

## 2. Usuarios, listas y proyectos (16–54)

| N° | Observación | Levantada | Verificada | Reconfirmada (25/10) |
|---|---|---|---|---|
| 16 | Botón Actualizar con la opción "Vaciar caché y volver a cargar de manera forzada" | ✅ | `actualizar.js` | ✅ `actualizar.js` |
| 17 | Cambiar el ícono por el texto "Actualizar" | ✅ | Captura | ✅ El botón dice "Actualizar ▾" (humo) |
| 18 | La opción de abajo (recarga forzada) no funcionaba | ✅ | `forzado.js` | ✅ `forzado.js`: la recarga forzada trae la versión nueva y conserva la sesión |
| 19 | Eliminar usuarios | ✅ | `eliminar.js` | ✅ `eliminar.js` |
| 20 | Roles nuevos; "Líder de proceso" pasa a "Líder de especialidad" | ✅ | `roles.js` | ✅ `roles.js` |
| 21 | ¿Dónde se agregan o editan Gerencias, Proyectos y Servicios? | ✅ Respondida e implementada: clic derecho en el título de la columna | `accesos.js` | ✅ Gerencia y Servicio abren su lista |
| 22 | Agrupar las listas (Gerencias/Proyectos/Servicios, Configuración general, Detalle…) | ✅ | `grupos.js` | ✅ Cuatro grupos; el primero tiene Proyectos y CET / Servicio |
| 23 | Proyecto: quitar CET y Tipo; todos los líderes en una sola columna | ✅ | `proyform.js` | ✅ Sin CET ni Tipo. Los líderes salieron del formulario por el pedido 46 |
| 24 | Rol Super administrador, que puede editar las funciones del administrador | ✅ | `superadmin.js` | ✅ `superadmin.js` |
| 25 | Quitar las columnas Líderes y Observaciones | ✅ | Prueba de columnas | ✅ No aparecen en la grilla de proyectos |
| 26 | Quitar Descripción y Color; agregar Proyecto seleccionable | ✅ | `cet.js` | ✅ Lista: Proyecto · CET · Servicio |
| 27 | Unir "Servicios/Entregables" y "CET" sin perder los datos | ✅ | `cetserv.js` | ✅ Una sola lista con 10 valores conservados. En las grillas, el 52 los volvió a separar |
| 28 | Pegar desde Excel copiaba solo dos columnas; pegar la tabla completa | ✅ | `pegaproy.js`, `pegaproy2.js` | ✅ Filas completas; una gerencia nueva se agrega a su lista |
| 29 | ¿Eliminar o desactivar proyectos? | ✅ Las dos: se elimina si no tiene historial y se desactiva si lo tiene | `borrarproy.js` | ✅ `borrarproy.js` |
| 30 | Orden Proyecto, CET, Servicio; el combo de proyectos se actualiza al instante | ✅ | `cetsync.js` | ✅ Orden correcto; el proyecto creado en otra pestaña aparece en el combo |
| 31 | No funcionaba "Importar desde Excel" | ✅ | `importproy.js`, `imp.js` | ✅ |
| 32 | Estados del proyecto: Activo, En pausa y Cerrado, en tres ventanas; al cambiar el estado, el proyecto cambia de ventana | ✅ | `estadosproy.js`, `ventanas.js` | ✅ Al pasar a Cerrado cambia de ventana al instante |
| 33 | Botón Eliminar proyecto con doble confirmación | ✅ | `borrartodo.js` | ✅ Con un código incorrecto no elimina nada |
| 34 | ¿Por qué tardas tanto? | ✅ Respondida | — | — |
| 35 | No se veían las ventanas En pausa ni Cerrados | ✅ | `ventanas2.js` | ✅ Tres ventanas visibles, una debajo de otra |
| 36 | Al importar un proyecto que ya existe, actualizar la base de datos | ✅ | `importact.js` | ✅ La vista previa indica cuáles se actualizan |
| 37 | Poder eliminar proyectos de prueba | ✅ | `borrartodo.js` | ✅ |
| 38 | Las dos ventanas de abajo "bailaban" | ✅ | `saltos.js` | ✅ Altos estables |
| 39 | En Capacidad no aparecían todos los usuarios | ✅ | `equipo.js` | ✅ Aparecen todos, incluidos los administradores |
| 40 | Habilitar trabajo en sábado y domingo | ✅ | `finde.js` | ✅ Suma capacidad, y el Plan muestra S y D |
| 41 | Heredar los datos de la semana anterior | ✅ | `heredar.js` | ✅ |
| 42 | Proyectos solo en Configuración → Listas, no en la barra lateral (consulta incluida: "¿no eran iguales las dos vistas?") | ✅ | `catconf.js` | ✅ Fuera del menú lateral; el catálogo se abre dentro de Configuración |
| 43 | Columna Cargo y lista editable de cargos | ✅ | `cargos.js` | ✅ Lista Cargos en "Equipo y organización"; columna Cargo en Usuarios |
| 44 | Organigrama del equipo en Usuarios y roles | ✅ | `organigrama.js` | ✅ 8 tarjetas en pantalla y en el PDF |
| 45 | Ventanas emergentes movibles con el mouse, con checklist | ✅ | `mover.js` | ✅ |
| 46 | Formulario (+) de proyecto sin "Líderes asignados" | ✅ | `mover.js` | ✅ Tampoco aparecen en la ficha del proyecto, ni en pantalla ni en el PDF (ajuste del 25/10) |
| 47 | Plan semanal y Look Ahead: quitar Resp. 2 | ✅ | Prueba de columnas | ✅ |
| 48 | El periodo de arriba no coincidía con las fechas de las columnas | ✅ | `semanas.js` | ✅ Al avanzar, retroceder y volver a hoy, el periodo empieza siempre en lunes |
| 49 | Código a la derecha de Nombre | ✅ | `colusu.js` | ✅ Nombre · Código · Cargo |
| 50 | Columna Semana junto a Resp. 1 (consulta incluida: "¿olvidaste la 50?") | ✅ | `colsem.js` | ✅ |
| 51 | Cambiar "Código CET" por "CET" | ✅ | `cetsync.js` | ✅ |
| 52 | Columnas CET y Servicio separadas en el Plan y el Look Ahead | ✅ | `col52.js` | ✅ CET a la izquierda de Servicio en las dos grillas |
| 53 | La Semana seguía a la izquierda; pasarla a la derecha | ✅ | `colsem.js` | ✅ Orden Semana · Resp. 1 |
| 54 | Auditoría activa y endurecimiento para producción (matriz, RLS, concurrencia, Sentry, CI) | ✅ | `chk54.js`, pruebas de base de datos, `production-readiness.yml` | ✅ Base de datos: todas las reglas pasan (incluidos los intentos entre áreas) |

## 3. Conexión con Supabase e ingreso (55–71)

| N° | Observación | Levantada | Verificada | Reconfirmada (25/10) |
|---|---|---|---|---|
| 55 | ¿Corregiste todas las incidencias encontradas? | ✅ Respondida | `docs/MATRIZ-DIAGNOSTICO.md` | ✅ |
| 56 | ¿El app funciona perfectamente? | ✅ Respondida | Humo y base de datos | ✅ Sin errores |
| 57 | Falta configurar la conexión a Supabase | ✅ | Conexión verificada al publicar | ✅ La publicación comprueba la conexión |
| 58 | En ECM Project bastó dar un código de Supabase | ✅ Respondida: se usa la clave publicable | — | — |
| 59 | Captura: SQL ejecutado con éxito | ✅ | — | — |
| 60 | ¿Dónde está Project Settings → API? | ✅ Respondida | — | — |
| 61 | URL y clave publicable entregadas | ✅ Configuradas en `config.js` (la clave pública, nunca la secreta) | Conexión verificada | ✅ |
| 62 | Pide correo y contraseña; ¿con qué cuenta entro? | ✅ Respondida | — | — |
| 63 | "No sé qué pasa" | ✅ Respondida | — | — |
| 64 | No veo los tres puntos | ✅ Respondida | — | — |
| 65 | ¿Dónde está "Confirm email"? | ✅ Desactivado y cuenta confirmada | Ingreso correcto | ✅ |
| 66 | Desapareció mi información: restituirla | ✅ Estaba en el modo demo de ese navegador; se agregó "Traer datos del modo demostración" | `traerui.js` | ✅ `traerui.js` |
| 67 | ¿Dónde está el link del proyecto? | ✅ | — | ✅ README |
| 68 | Quiero entrar al aplicativo | ✅ | Ingreso correcto | ✅ |
| 69 | Ya entré: ¿cómo recupero la data? | ✅ Configuración → Respaldo → Traer datos | `traerui.js` | ✅ |
| 70 | Con el mismo usuario, una laptop muestra los proyectos y la otra no | ✅ Respondida: los datos estaban solo en el navegador de una laptop. Al salir se limpia la caché local | — | ✅ |
| 71 | No aparece "MODO DEMOSTRACIÓN" | ✅ Respondida: se entra con `?demo` | Humo | ✅ El aviso aparece en modo demo |

## 4. Plan semanal, Look Ahead, reportes y auditoría (72–98)

| N° | Observación | Levantada | Verificada | Reconfirmada (25/10) |
|---|---|---|---|---|
| 72 | CET y Servicio van juntos: elegir uno completa el otro | ✅ | `cet72.js` | ✅ Funciona en los dos sentidos y se guarda |
| 73 | Columnas de días angostas, con títulos L M X J V; la L es el lunes de la semana | ✅ | `dias73.js` | ✅ 46 px; S-44 empieza el lunes 26/10 |
| 74 | La celda Actividad admite varias líneas | ✅ | `multi74.js` | ✅ La fila crece y el salto de línea (Alt+Enter) se guarda |
| 75 | ¿Qué significan Pendiente, Con restricción, Lista, Trasladada y Cancelada? | ✅ Respondida | — | — |
| 76 | Mostrar el significado de cada opción al pasar el mouse | ✅ | `ayuda76.js` | ✅ |
| 77 | La caja de texto crece hacia abajo mientras se escribe (Actividad en Look Ahead y Plan) | ✅ | `crece77.js` | ✅ 25 → 76 px mientras se escribe; Enter guarda |
| 78 | Las filas nuevas sin datos desaparecían al actualizar | ✅ | `filas78.js` | ✅ Siguen después de F5 |
| 79 | Al elegir la semana, la actividad pasa a su semana | ✅ | `grupo79.js` | ✅ |
| 80 | Texto ajustado al ancho y en varias líneas (Actividad y Comentario) | ✅ | `edit80.js`, `tras81.js` | ✅ |
| 81 | ¿Cómo pasan las actividades del Look Ahead al Plan? | ✅ Respondida; además, "Trasladada" a mano compromete la actividad | `tras81.js` | ✅ |
| 82 | El texto seguía en una sola fila (consultas incluidas: cómo se compromete una actividad y cómo registrar trabajo no planificado, que va como "No programada") | ✅ | `fila82.js` | ✅ |
| 83 | ¿Qué hace la opción Plantillas? | ✅ Respondida | — | — |
| 84 | Plantillas con las mismas columnas que el Look Ahead | ✅ | `plant84.js`, `aplicar84.js` | ✅ Columnas iguales; aplicar una plantilla crea las filas |
| 85 | Dividir en dos subventanas: Look Ahead y Carga vs capacidad | ✅ | `tabs85.js` | ✅ |
| 86 | Link del aplicativo en GitHub, como en ECM Project | ✅ | README | ✅ |
| 87 | No entraba al app | ✅ Era la red del usuario (error SSL); el servicio estaba operativo | Ingreso correcto | ✅ |
| 88 | El PDF del Look Ahead no respetaba los anchos de la pantalla; corregir en todos los reportes | ✅ | `pdf88.js` | ✅ Mismas columnas y anchos iguales entre tablas, en las 5 grillas |
| 89 | Módulo Reportes con árbol y presentación preliminar, como ECM | ✅ | `rep89.js` | ✅ 15 reportes |
| 90 | Consulta: cómo facilitar el registro a usuarios poco tecnológicos | ✅ Respondida con propuestas (se implementaron en el 93-a) | — | — |
| 91 | El PDF no era igual a la ventana, no salía el organigrama y los anchos eran un caos | ✅ | `org91.js` | ✅ Tabla igual a la pantalla y organigrama con 8 tarjetas |
| 92-a | Papeles: quitar Carta y Oficio; agregar A6, A5, A3, A2, A1 y A0 | ✅ | `papel92.js` | ✅ A6 a A0 con su tamaño real |
| 92-b | Nombre del archivo: GT-LPS_Usuario_Reporte_Fecha | ✅ | `nombre93.js` | ✅ PDF desde Reportes y desde la pantalla, y Excel |
| 93-a | Tamaño de letra A/A+, panel lateral ajustable y botón ☰ para contraerlo | ✅ | `vista93.js` | ✅ Se recuerda al recargar |
| 93-b | La impresión desde cada pantalla, igual a la de Reportes | ✅ | `vista94.js` | ✅ 10 pantallas con la misma vista previa y ninguna ventana emergente |
| 94 | Pestañas Look Ahead / Carga vs capacidad a la derecha de "Todo el equipo" | ✅ | `tabs85.js` | ✅ |
| 95 | No se veía la corrección del 93; corregir todas las impresiones | ✅ La captura era anterior a la publicación | `vista94.js` | ✅ |
| 96 | Revisar cada módulo y hacer una tabla de todos los reportes | ✅ | `docs/REPORTES.md` | ✅ 40 salidas |
| 97 | Tabla de las 96 observaciones: levantada, verificada y reconfirmada | ✅ | Este documento | ✅ |
| 98 | Matriz de diagnóstico y compatibilidad de todo el aplicativo; corregir las incompatibilidades (manda la observación más reciente) | ✅ 16 incompatibilidades y 3 defectos de presentación corregidos | `compat98.js` (16 verificaciones), base de datos (migración 016) | ✅ Batería completa, humo (160 pantallas) y base de datos sin errores · `docs/MATRIZ-DIAGNOSTICO.md` |

## Lo que encontró la reconfirmación

| Hallazgo | Acción |
|---|---|
| Error de la grilla. Si llegaba una recarga en segundo plano (el eco de un guardado o un cambio de otro usuario) mientras alguien editaba una celda, la fila se redibujaba, se perdía lo que se estaba escribiendo y aparecía un error interno | **Corregido**: la fila en edición ya no se redibuja hasta terminar la edición. Vuelto a probar sin errores |
| La ficha del proyecto mostraba "Líderes" en pantalla, pero no en el PDF | **Corregido**: la pantalla y el PDF muestran los mismos datos (Gerencia, Fase, País, Fechas y Estado) |
| 15 pruebas antiguas buscaban textos o ventanas que pedidos posteriores cambiaron (por ejemplo "CET / Servicio" o el PDF en otra ventana) | Se actualizaron al requisito vigente y pasan. No eran defectos del aplicativo |
| PDF de Tablero (PAC por líder) y de Equipo y capacidad sin anchos fijos | Sigue pendiente de tu confirmación (ver `docs/REPORTES.md`) |
