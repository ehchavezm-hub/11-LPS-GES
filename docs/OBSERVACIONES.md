# LPS-GES · Seguimiento de las observaciones

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
| 1 | Inicio del proyecto LPS-GES | ✅ | — | ✅ Repositorio activo |
| 2 | ¿Hay acceso de lectura a ECM Project? | ✅ Respondida | — | — |
| 3 | Tomar de ECM las plantillas, tomas de datos y reportes, **sin los datos** | ✅ | Revisión: el repositorio no tiene datos de la empresa | ✅ Sin Excel ni respaldos en el repositorio; control automático *gitleaks* |
| 4 | Todo el proyecto vive en `ehchavezm-hub/11-LPS-GES` | ✅ | — | ✅ |
| 5 | Lo de ECM solo es referencial | ✅ | — | — |
| 6 | Definir el alcance en Word (LPS en un área funcional, 10 líderes, administración) | ✅ v0.1 | Revisión del documento | ✅ `docs/LPS-GES_Alcance_v0.1.docx` |
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
| 99 | Pasar los PDF de Tablero y de Equipo y capacidad al formato de anchos fijos | ✅ | `pdf99.js` | ✅ Tablas con anchos fijos, barras y colores; humo sin errores |
| 99-b | Que Claude aplique todo en Supabase (aprobando solo lo necesario) | ✅ Conector de Supabase: migraciones 016 y 017 aplicadas y función `admin-usuarios` instalada (no lo estaba) | Consultas en la base: disparador activo y 0 funciones de disparador expuestas | ✅ Asesor de seguridad de Supabase revisado |
| 99-c | Crear un usuario nuevo en la versión real | ✅ Funciona. Se corrigió que el usuario creado por el administrador no quedaba obligado a cambiar su contraseña temporal y que llegaban avisos falsos de «Nuevo usuario por aprobar» | Prueba del usuario y consulta en la base | ✅ Función versión 2 instalada; usuario de prueba corregido y 3 avisos falsos retirados |
| 100 | Los líderes pueden agregar proyectos y CET / Servicio (los proyectos son únicos y los ve todo el equipo) | ✅ Permisos nuevos «Agregar proyectos» y «Agregar CET / Servicio» (migración 018, aplicada en Supabase); ＋ en el menú de proyectos y clic derecho en el título CET o Servicio | `lider100.js` (11 verificaciones) y pruebas de base de datos | ✅ Regresión completa, humo y base de datos sin errores |
| 110 | Elegir en Configuración el día en que se registra el Look Ahead (los lunes, para esa misma semana) | ✅ Configuración → Parámetros: «Día de registro del Look Ahead» y «Semana que planifica el Look Ahead». Se aplica en el Look Ahead, Comprometer, Plan, Cartera, Reunión, Reportes y Ayuda; tu proyecto quedó en lunes / misma semana | `la110.js` (9 verificaciones) | ✅ Regresión completa y humo sin errores |
| 111 | Días de registro del Look Ahead como casillas (varios días, p. ej. lunes y martes) | ✅ Siete casillas en Configuración → Parámetros; lo agregado al Plan cuenta como programado hasta el último día marcado | `la110.js` (lunes y martes) | ✅ Humo sin errores |
| 112 | Días de la reunión de cumplimiento del plan semanal como casillas (p. ej. viernes, sábado o domingo) | ✅ Siete casillas en Configuración → Parámetros; se pueden marcar varios días; la Ayuda los muestra | `reu112.js` (5 verificaciones) | ✅ Humo sin errores |
| 114 | Configuración → Parámetros: al inicio Días laborables, Trabajo en sábado y domingo y Horas disponibles por día | ✅ | Captura de la pantalla | ✅ Pruebas de parámetros sin errores |
| 115 | Integrar lo trabajado desde la otra cuenta y laptop (nombre LPS-GES, matriz de permisos PPT v5 con 4 roles, cajas de texto que crecen) | ✅ Integrado sin perder nada. Para aplicarlo se corrigió: el super administrador conserva todos sus accesos, la regla de líderes por proyecto vuelve a separar por área y se mantienen los mensajes del cierre | Pruebas de base de datos ajustadas a PPT v5 | ✅ Base de datos y humo (160 pantallas) sin errores |
| 116 | Días de cierre semanal como casillas, igual que los días de registro del Look Ahead | ✅ Siete casillas en Configuración → Parámetros; el cierre automático espera hasta el último día marcado | `cierre_dias.js` (4 verificaciones) | ✅ Humo sin errores |
| 117 | Comentario del Plan semanal no crecía al escribir (Actividad sí, y en el Look Ahead ambos) | ✅ Las vistas guardadas antes también guardaban el editor de una sola línea y lo reponían al abrir la pantalla; ahora la vista solo guarda orden, ancho, visibilidad y fijación | `crece_com7.js` (falla en la versión anterior, pasa en la nueva) | ✅ |
| 118 (a1) | Empresas en la consola de Administración, con portafolios, programas y proyectos | ✅ Menú Plataforma (Empresas, Usuarios, Estructura de todas las empresas, Propietarios, Auditoría, Reportes) y menú Empresa (Estructura, Portafolios, Programas, Proyectos con portafolio y programa). Supabase: 022 (empresas) y 023 (portafolios y programas aislados por empresa; antes cualquier usuario veía y modificaba todos) aplicadas; Elmer Chavez es propietario de la plataforma | `plat.js` (empresa nueva, portafolio, programa, proyecto, miembros, organigrama, abrir empresa) | ✅ Humo (160 pantallas) y pruebas de base de datos sin errores |
| 119 | Consola publicada desde la otra cuenta con paneles que no funcionaban con la base real (usuarios, delegado, listas, proyectos) | ✅ Usan las secciones de Configuración que ya funcionan; Proyectos con columnas reales; Calendario sigue pendiente (sus tablas no existen) | `plat.js` | ✅ |
| 120 (a3) | Manejo de empresas igual o mejor que el otro aplicativo (capturas) | ✅ Barra Plataforma › Empresa › Proyecto; Empresas con búsqueda, filtros, selección múltiple, Cambiar super admin, Gestionar usuarios, Abrir / Suspender / Eliminar; estructura en árbol (expandir, contraer, buscar, cifras) y organigrama. Mejor: eliminar exige escribir ELIMINAR y solo procede sin historial (si no, se suspende); los datos de varias empresas pasan solo por el servidor | Capturas `plat_*.png` | ✅ |
| 121 (a4) | Las empresas las crean solo los propietarios (o copropietarios), que las administran por defecto; sin pedir credenciales | ✅ «Nueva empresa» pide solo nombre y descripción; el super administrador propio de la empresa es opcional («Cambiar»), mientras tanto figuran los Propietarios. Se corrigió «Cosapi S.A.», que había quedado a medias (el navegador autocompletó un correo ya existente), y el deshacer de una creación fallida | `plat.js` | ✅ |
| 122 (a5) | Menú PROYECTOS como árbol Empresa → Portafolio → Programa → Proyecto | ✅ Ramas con conteo y código, abrir/cerrar (se recuerda), «Sin contenido» en ramas vacías; Mis / Todos / Favoritos y la búsqueda muestran solo las ramas con resultados; clic en la empresa = todos los proyectos | `arbol.js` | ✅ |
| 123 (a6) | Quitar del menú de proyectos las opciones Mis, Todos y Favoritos | ✅ El árbol muestra siempre todos los proyectos de la empresa; se retiraron también las estrellas de favorito (solo servían para esa pestaña). La búsqueda se mantiene | `arbol.js` | ✅ |
| 124 (a7) | El LPS funciona en los sub-proyectos: Empresa → Portafolio → Programa → Proyecto → Sub-proyecto | ✅ Migración 024 (`proyectos.padre_id`): dos niveles, el sub-proyecto hereda portafolio y programa (y sigue a su padre). Look Ahead, Plan, restricciones y cartera registran en el proyecto o sub-proyecto «hoja»; elegir un proyecto en el menú incluye sus sub-proyectos. Consola: «+ Sub-proyecto», organigrama y menú lateral con sub-proyectos | `sub.js`; pruebas de base de datos 024 | ✅ |
| 125 (a8) | Usuarios registrados solo en la empresa; los niveles de abajo los heredan | ✅ Portafolios, programas, proyectos y sub-proyectos solo eligen usuarios de la empresa; un sub-proyecto sin líderes propios hereda los de su proyecto (y «Mis proyectos» lo incluye) | `sub.js` | ✅ |
| 126 (a8) | Los módulos de Planificación, Seguimiento y Más funcionan: no modificarlos (son para un sub-proyecto) | ✅ Sin cambios de comportamiento. Solo reconocen sub-proyectos cuando existan: elegir un proyecto incluye sus sub-proyectos y las actividades se registran en el sub-proyecto | Humo 160 pantallas sin errores | ✅ |
| 127 (a9) | Una empresa recién creada (WSP) no se podía eliminar | ✅ Sus listas tienen valores protegidos (p. ej. «Completado») que la regla de protección no dejaba borrar, y el borrado era por partes (quedó a medias). Migración 025: `eliminar_empresa()` elimina cualquier empresa con todos sus datos en una sola transacción, solo desde el servidor; el aplicativo pide escribir el nombre de la empresa | Pruebas de base de datos 025 (empresa con proyectos, sub-proyectos, semana cerrada y restricciones); `adm10.js` | ⏳ Falta aplicar en Supabase (pendiente de tu aprobación) |
| 128 (a10) | Empresas: mostrar nombre y correo del administrador; «Administrador» (propietario) separado de «Super administrador» (de la empresa, crea portafolios y hacia abajo) | ✅ Columnas ADMINISTRADOR (propietarios, con nombre y correo) y SUPER ADMINISTRADOR (Sin asignar → Asignar / Cambiar); el formulario «Nueva empresa» muestra quién será su administrador | `adm10.js` | ✅ |
| 129 (a11) | Administración: quitar Listas configurables, Parámetros y Calendario (solo aplican a los sub-proyectos) | ✅ Retirados del menú de Administración; Listas y Parámetros siguen en Configuración | Humo sin errores | ✅ |
| 130 (14) | Organigrama: editar cada tarjeta con un clic sobre ella | ✅ Empresa, portafolio, programa, proyecto y sub-proyecto abren su formulario (también con Enter); tras guardar se queda en el organigrama | `tarjeta.js` | ✅ |
| 131 (15) | Al editar un proyecto (tarjeta) elegir su empresa | ✅ Campo Empresa en el formulario; portafolio, programa y responsable se filtran por la empresa elegida. Mover lleva sus sub-proyectos y quita lo que es de la empresa anterior (gerencia, fase, país, líderes); solo si aún no tiene actividades, restricciones ni cartera (si tiene, se explica y no se mueve). admin-usuarios v7 | `mover.js`; prueba de base de datos de traslado | ✅ |
| 132 (16) | Administración: quitar Usuarios y roles, Administrador delegado y Matriz de permisos (son de los sub-proyectos) | ✅ Retirados del menú de Administración; siguen sin cambios en Configuración | Humo sin errores | ✅ |
| 133 (17) | La observación 15 aún no funcionaba | ✅ Se probó antes de que terminara de publicarse; con Ctrl+F5 aparece el campo Empresa. Puente Demo Río Azul ya se movió a JJC | Captura del usuario | ✅ |
| 134 (18) | Eliminar proyectos | ✅ 🗑 en cada tarjeta del organigrama (y Eliminar en la tabla). Sin trabajo registrado: una confirmación. Con historial o sub-proyectos: muestra cuánto se borra y pide escribir su nombre (migración 026, una sola transacción, solo desde el servidor). admin-usuarios v8 | `borrar.js`; pruebas de base de datos 026 | ⏳ Con historial: falta aplicar 026 en Supabase |
| 135 (19) | Todo está muy lento comparado con el otro aplicativo | ⏳ Diagnóstico: no es GitHub. Ambos aplicativos tienen su base en EE. UU. (este en us-east-1, el otro en us-east-2), así que la región no explica la diferencia. La consola de Administración volvía a descargar todas las empresas en cada clic: ahora las guarda en memoria (8 llamadas al servidor → 0 al recorrer 8 paneles). Pendiente: 14 reglas de la base sin optimizar e índices (requiere aplicar SQL en Supabase) | `llamadas.js` | Parcial |
| 136 | Compatibilización y auditoría | ✅ Ver `docs/AUDITORIA.md`: 11 hallazgos. Corregidos en el aplicativo: cálculos con sub-proyectos (Tablero, Reportes, ficha), eliminar un proyecto con sub-proyectos, código muerto de la consola. En la base, migración 027: seguridad (get_propietarios), reglas RLS optimizadas, 55 índices | Humo 160 pantallas; `aud.js`, `sub.js`, `plat.js`, `borrar.js`, `tarjeta.js`, `mover.js`, `arbol.js`, `a11.js`, `rep89.js`; pruebas de base de datos | ⏳ Falta aplicar 025, 026 y 027 en Supabase |
| 137 (20) | En el organigrama, los proyectos deben verse en vertical | ✅ Los proyectos se apilan en columna bajo su programa, portafolio o empresa (y los sub-proyectos bajo su proyecto); portafolios y programas siguen en horizontal | `sub.js`, `plat.js`, `mixto.js` (capturas) | ✅ |
| 138 (21) | Revisar cada módulo para validar la velocidad: está muy lento | ✅ La base responde en 1–10 ms por consulta: lo lento eran las esperas de red encadenadas y archivos que se volvían a pedir. Ver `docs/AUDITORIA.md` › Velocidad. Con 200 ms por llamada: arranque 1342 → 781 ms, Look Ahead 688 → 162, Restricciones 717 → 73, Plan 479 → 43, Usuarios 896 → 309. Librerías de Excel y gráficos solo cuando se usan (−1,1 MB al arrancar); el código sale de la caché del navegador y se actualiza solo al publicar | `velocidad.js`, `linea.js`, `swver.js`, `graf.js`, `xlsxexp.js`, `excel2.js`; humo 160 pantallas y 18 pruebas de módulos | ⏳ 028 (vistas duplicadas) con 025–027 en Supabase |
| 139 (Q1) | No se puede eliminar la empresa WSP (sin uso): «Could not find the function public.eliminar_empresa» | ✅ La función 025 aún no está instalada en la base. La Edge Function admin-usuarios v9 elimina la empresa completa ella misma en una transacción (todo o nada), también los valores protegidos de sus listas; igual con los proyectos con historial (026). Cuando se instalen 025/026 las usa automáticamente | Prueba en Postgres local en el mismo estado que la base real: reproduce el error y luego elimina solo esa empresa; la otra queda intacta y protegida | ✅ |
| 140 (Q2) | Falta el nivel Sub-proyecto (donde va el LPS) | ✅ Ya existía en la tabla; ahora también: botón «+ Sub-proyecto» arriba (se elige el proyecto), «+» en cada proyecto del organigrama, sub-proyectos corridos bajo su proyecto, y la ruta Empresa › Portafolio › Programa › Proyecto › Sub-proyecto | `q2.js` (los dos caminos; el sub-proyecto aparece para registrar el LPS) | ✅ |
| 141 (q5) | Agregación de abajo hacia arriba (Sub-proyecto → Empresa) | ✅ En el árbol PROYECTOS ahora también se eligen Portafolio y Programa (clic en el nombre; la flecha abre o cierra). Todos los módulos (Plan, Look Ahead, Restricciones, Cartera, Tablero, Reunión, Reportes, Resumen y PDF) suman lo que hay debajo | `q5.js`: Sub-proyecto 14 ⊂ Proyecto 47 ⊂ Programa 47 ⊂ Portafolio 96 ⊂ Empresa 358 | ✅ |
| 142 (q5) | Migrar la data LPS al sub-proyecto | ⏳ En la base no hay actividades vigentes (las 25 que hubo se borraron desde el aplicativo; están en la auditoría). Lo que sí hay: 55 CET/Servicios de GT ligados al proyecto «0000001 GT-OT», hoy en la empresa Cumbra. Pendiente: confirmar el sub-proyecto de destino | Consulta a la base | Pendiente de respuesta |
| 143 (q5 bis) | Administración: «Plataforma (Propietario)» y «Empresa (nombre de la empresa)» | ✅ | `a11.js` | ✅ |
| 144 (q6) | Subir la sección PROYECTOS debajo de Administración | ✅ Menú: Administración → PROYECTOS (árbol con su propio desplazamiento) → Planificación, Seguimiento y Más. Sin Administración, PROYECTOS queda arriba | `q6.js`; humo 160 pantallas | ✅ |

## Lo que encontró la reconfirmación

| Hallazgo | Acción |
|---|---|
| Error de la grilla. Si llegaba una recarga en segundo plano (el eco de un guardado o un cambio de otro usuario) mientras alguien editaba una celda, la fila se redibujaba, se perdía lo que se estaba escribiendo y aparecía un error interno | **Corregido**: la fila en edición ya no se redibuja hasta terminar la edición. Vuelto a probar sin errores |
| La ficha del proyecto mostraba "Líderes" en pantalla, pero no en el PDF | **Corregido**: la pantalla y el PDF muestran los mismos datos (Gerencia, Fase, País, Fechas y Estado) |
| 15 pruebas antiguas buscaban textos o ventanas que pedidos posteriores cambiaron (por ejemplo "CET / Servicio" o el PDF en otra ventana) | Se actualizaron al requisito vigente y pasan. No eran defectos del aplicativo |
| PDF de Tablero (PAC por líder) y de Equipo y capacidad sin anchos fijos | Sigue pendiente de tu confirmación (ver `docs/REPORTES.md`) |
