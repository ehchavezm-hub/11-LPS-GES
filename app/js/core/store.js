// Estado de la sesión y catálogo en memoria (listas, parámetros, permisos, usuarios, proyectos).
import { api } from '../data/api.js';
import { PARAMETROS_INICIALES, PLANIFICADORES, AYUDA_ESTADOS } from '../data/catalogos.js';
import { lunes, sumarSemanas, DIAS_NOMBRE } from './util.js';

const bus = new EventTarget();

export const store = {
  usuario: null,         // perfil del usuario conectado
  area: null,
  listas: {},            // clave → { lista, valores[] }
  valores: new Map(),    // id → valor
  parametros: { ...PARAMETROS_INICIALES },
  permisos: {},          // rol → { accion → bool }
  perfiles: [],
  proyectos: [],
  portafolios: [],
  programas: [],
  proyectoLideres: [],
  favoritos: new Set(),
  columnas: [],
  proyectoSel: localStorage.getItem('lpsgt-proyecto') || '',
  notificaciones: [],
};

export function on(evento, cb) {
  const f = e => cb(e.detail);
  bus.addEventListener(evento, f);
  return () => bus.removeEventListener(evento, f);
}
export function emit(evento, detalle) { bus.dispatchEvent(new CustomEvent(evento, { detail: detalle })); }

export async function cargarPerfil(userId) {
  const [p] = await api.list('profiles', { eq: { id: userId } });
  store.usuario = p || null;
  return store.usuario;
}

/** Cantidad de comentarios y enlaces por actividad (columna 💬): solo la columna entidad_id y solo de la empresa,
 *  en lugar del texto completo de todos los comentarios. Se pide en paralelo con las actividades. */
export async function conteoColaboracion() {
  const f = { eq: { entidad: 'actividad', area_id: store.area.id }, select: 'entidad_id' };
  const n = new Map();
  try {
    const [coms, enls] = await Promise.all([api.list('comentarios', f), api.list('enlaces', f)]);
    for (const c of [...coms, ...enls]) n.set(c.entidad_id, (n.get(c.entidad_id) || 0) + 1);
  } catch { /* opcional */ }
  return n;
}

export async function cargarCatalogo() {
  const u = store.usuario;
  const [areas, listas, valores, params, permisos, perfiles, proyectos, lideres, favs, columnas, portafolios, programas] = await Promise.all([
    api.list('areas', { eq: { id: u.area_id } }),
    api.list('listas', {}),
    api.list('lista_valores', { order: [['orden', true]] }),
    api.list('parametros', { eq: { area_id: u.area_id } }),
    api.list('permisos', { eq: { area_id: u.area_id } }),
    api.list('profiles', { eq: { area_id: u.area_id }, order: [['nombre', true]] }),
    api.list('proyectos', { eq: { area_id: u.area_id }, order: [['codigo', true]] }),
    u.rol === 'consulta' ? Promise.resolve([]) : api.list('proyecto_lideres', {}),
    api.list('proyecto_favoritos', { eq: { usuario_id: u.id } }),
    api.list('columnas_personalizadas', { eq: { area_id: u.area_id }, order: [['orden', true]] }),
    // Jerarquía de la empresa (menú de proyectos en árbol): Portafolio → Programa → Proyecto
    api.list('portafolios', { eq: { area_id: u.area_id }, order: [['nombre', true]] }).catch(() => []),
    api.list('programas', { eq: { area_id: u.area_id }, order: [['nombre', true]] }).catch(() => []),
  ]);
  store.area = areas[0] || null;
  api.fijarArea?.(store.area?.id);
  store.listas = {};
  const porLista = new Map();
  for (const l of listas.filter(l => !l.area_id || l.area_id === u.area_id)) {
    store.listas[l.clave] = { lista: l, valores: [] };
    porLista.set(l.id, store.listas[l.clave]);
  }
  store.valores = new Map();
  for (const v of valores) {
    store.valores.set(v.id, v);
    porLista.get(v.lista_id)?.valores.push(v);
  }
  store.parametros = { ...PARAMETROS_INICIALES };
  for (const p of params) store.parametros[p.clave] = p.valor;
  store.permisos = {};
  for (const p of permisos) (store.permisos[p.rol] ||= {})[p.accion] = p.permitido;
  store.perfiles = perfiles;
  store.proyectos = u.rol === 'consulta'
    ? proyectos.filter(p => p.estado === 'activo' && (u.gerencia_ids || []).includes(p.gerencia_id)) : proyectos;
  store.proyectoLideres = lideres;
  store.favoritos = new Set(favs.map(f => f.proyecto_id));
  store.columnas = columnas;
  store.portafolios = portafolios;
  store.programas = programas;
  if (store.proyectoSel && !proyectos.some(p => p.id === store.proyectoSel)) seleccionarProyecto('');
  emit('catalogo');
}

// ---------- Permisos ----------
export function rol() { return store.usuario?.rol || 'anonimo'; }
export function esSuperadmin() { return rol() === 'superadmin' || !!store.usuario?.es_admin_principal; }
export function esAdmin() { return ['superadmin', 'admin'].includes(rol()); }
export function esGestor() { return ['superadmin', 'admin', 'delegado'].includes(rol()); }
export function esStaff() { return ['superadmin', 'admin', 'delegado', ...PLANIFICADORES].includes(rol()); }
export function puede(accion) {
  if (esSuperadmin()) return true;
  // El administrador usa su columna de la matriz (la edita el super administrador); sin fila, permitido
  if (rol() === 'admin') return store.permisos.admin?.[accion] ?? true;
  const propio = store.permisos[rol()]?.[accion];
  // Igual que public.puede(): un rol de planificación sin fila propia usa los permisos de "lider"
  if (propio === undefined && PLANIFICADORES.includes(rol())) return !!store.permisos.lider?.[accion];
  return !!propio;
}
/** Agregar proyectos activos al menú (administración o permiso "agregar_proyecto", pedido 100). */
export function puedeAgregarProyecto() { return esGestor(); }
/** Editar un proyecto: quien administra proyectos, quien lo agregó (si tiene el permiso) o quien lo propuso. */
export function puedeEditarProyecto(p) {
  if (!p) return false;
  const yo = store.usuario?.id;
  return esGestor() || (p.estado === 'propuesto' && p.propuesto_por === yo);
}
export function puedeEditarActividad(a) {
  return a.responsable_id === store.usuario?.id || esGestor();
}

// ---------- Listas ----------
export function valoresLista(clave, { inactivos = false } = {}) {
  return (store.listas[clave]?.valores || []).filter(v => inactivos || v.activo);
}
export function opciones(clave, { inactivos = false, vacio = true } = {}) {
  const ops = valoresLista(clave, { inactivos }).map(v => ({ value: v.id, label: v.valor }));
  return vacio ? [{ value: null, label: '—' }, ...ops] : ops;
}
export function etiqueta(id) { return id ? (store.valores.get(id)?.valor ?? '') : ''; }
export function colorValor(id) { return id ? store.valores.get(id)?.color : null; }
export function idPorCodigo(clave, codigo) { return valoresLista(clave, { inactivos: true }).find(v => v.codigo === codigo)?.id || null; }
export function valorPorCodigo(clave, codigo) { return valoresLista(clave, { inactivos: true }).find(v => v.codigo === codigo); }
/** Texto visible de un estado protegido (renombrable desde listas configurables). */
export function textoEstado(clave, codigo) { return valorPorCodigo(clave, codigo)?.valor || codigo || ''; }
export function colorEstado(clave, codigo) { return valorPorCodigo(clave, codigo)?.color || '#BAB0AC'; }
export function opcionesEstado(clave) {
  return valoresLista(clave, { inactivos: true }).map(v => ({ value: v.codigo, label: v.valor, ayuda: v.descripcion || AYUDA_ESTADOS[clave]?.[v.codigo] || '' }));
}

export function param(clave) { return store.parametros[clave] ?? PARAMETROS_INICIALES[clave]; }

// ---------- Look Ahead (pedido 110) ----------
// Configuración → Parámetros: día en que se registra el Look Ahead y si planifica esa misma semana o la siguiente.
export function configLookAhead() {
  const c = { ...PARAMETROS_INICIALES.look_ahead, ...(param('look_ahead') || {}) };
  // Varios días (pedido 111); se acepta el formato anterior de un solo día ("dia")
  const lista = (Array.isArray(c.dias) && c.dias.length ? c.dias : [c.dia ?? 5]).map(Number).filter(d => d >= 1 && d <= 7);
  const dias = [...new Set(lista.length ? lista : [5])].sort((a, b) => a - b);
  return { dias, ultimo: dias.at(-1), semana: c.semana === 'actual' ? 'actual' : 'siguiente' };
}
/** Primera semana del Look Ahead: la que se planifica y se compromete (la actual o la siguiente). */
export function semanaInicioLA() { return configLookAhead().semana === 'actual' ? lunes() : sumarSemanas(lunes(), 1); }
/** Semanas del horizonte del Look Ahead, desde semanaInicioLA(). */
export function semanasLookAhead() {
  const n = Number(param('semanas_lookahead')) || 3;
  return Array.from({ length: n }, (_, i) => sumarSemanas(semanaInicioLA(), i));
}
/** ¿La semana todavía se está planificando? Lo que se agregue al Plan cuenta como programado (no como "no programado"). */
export function semanaEnPlanificacion(semana) {
  const actual = lunes();
  if (semana > actual) return true;
  if (semana < actual || configLookAhead().semana !== 'actual') return false;
  const diaHoy = ((new Date().getDay() + 6) % 7) + 1;   // 1 = lunes … 7 = domingo
  return diaHoy <= configLookAhead().ultimo;   // hasta el último día de registro
}
/** Días de la reunión de cumplimiento del plan semanal (pedido 112); acepta el formato anterior { dia }. */
export function diasReunion() {
  const r = { ...PARAMETROS_INICIALES.reunion, ...(param('reunion') || {}) };
  const lista = (Array.isArray(r.dias) && r.dias.length ? r.dias : [r.dia ?? 5]).map(Number).filter(d => d >= 1 && d <= 7);
  return [...new Set(lista.length ? lista : [5])].sort((a, b) => a - b);
}
const unirDias = ds => { const n = ds.map(d => DIAS_NOMBRE[d - 1].toLowerCase()); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]; };
/** "viernes", "viernes y sábado"… */
export function textoDiasReunion() { return unirDias(diasReunion()); }
/** Días de cierre semanal (casillas, como el Look Ahead). Los parámetros anteriores guardaban un solo "dia". */
export function diasCierre() {
  const c = { ...PARAMETROS_INICIALES.cierre, ...(param('cierre') || {}) };
  const lista = (Array.isArray(c.dias) && c.dias.length ? c.dias : [c.dia ?? 5]).map(Number).filter(d => d >= 1 && d <= 7);
  return [...new Set(lista.length ? lista : [5])].sort((a, b) => a - b);
}
export function textoDiasCierre() { return unirDias(diasCierre()); }
/** "lunes", "lunes y martes", "lunes, martes y miércoles"… */
export function diaLookAhead() {
  const n = configLookAhead().dias.map(d => DIAS_NOMBRE[d - 1].toLowerCase());
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0];
}

// ---------- Personas ----------
export function perfil(id) { return store.perfiles.find(p => p.id === id); }
export function nombre(id) { return perfil(id)?.nombre || ''; }
export function lideres({ inactivos = false } = {}) {
  return store.perfiles.filter(p => ['superadmin', 'admin', 'delegado', ...PLANIFICADORES].includes(p.rol) && !p.eliminado && (inactivos || p.activo));
}
/** Todas las personas del equipo: administradores, delegado y roles que planifican (no consulta ni pendientes), por nombre. */
export function equipo() {
  return lideres().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
}
/** Restricción de visibilidad de consulta (en Supabase la aplica RLS; aquí también en modo demostración). */
export function visibleParaConsulta(proyectoId) {
  if (rol() !== 'consulta') return true;
  const p = store.proyectos.find(x => x.id === proyectoId);
  return !!p && (store.usuario.gerencia_ids || []).includes(p.gerencia_id);
}
export function opcionesLideres() { return lideres().map(p => ({ value: p.id, label: p.nombre })); }
export function horasDia(id) { return Number(perfil(id)?.horas_dia ?? param('horas_dia')) || 0; }

// ---------- Proyectos ----------
export function proyecto(id) { return store.proyectos.find(p => p.id === id); }
/** CET / Servicio asociado a un proyecto (columna Proyecto de la lista "CET / Servicio"), si hay uno solo. */
export function servicioDeProyecto(p) {
  if (!p) return null;
  const asociados = valoresLista('servicios').filter(v => v.extra?.proyecto_id === p.id);
  return asociados.length === 1 ? asociados[0].id : null;
}
/** Proyecto al que pertenece un CET / Servicio (columna Proyecto de la lista), o null. */
export function proyectoDeServicio(id) { return (id && store.valores.get(id)?.extra?.proyecto_id) || null; }
/**
 * Opciones de CET / Servicio para elegir: si se indica un proyecto, solo los de ese proyecto y los que no tienen proyecto
 * (si el proyecto no tiene ninguno asociado, se ofrecen todos). etiqueta(v) arma el texto de cada opción.
 */
export function opcionesServicio({ proyectoId = null, etiqueta: etq = v => (v.codigo ? `${v.codigo} · ${v.valor}` : v.valor), vacio = true } = {}) {
  let vs = valoresLista('servicios');
  if (proyectoId && vs.some(v => v.extra?.proyecto_id === proyectoId)) vs = vs.filter(v => !v.extra?.proyecto_id || v.extra.proyecto_id === proyectoId);
  const ops = vs.map(v => ({ value: v.id, label: etq(v) }));
  return vacio ? [{ value: null, label: '—' }, ...ops] : ops;
}
export function nombreProyecto(id) { const p = proyecto(id); return p ? `${p.codigo} · ${nombreConPadre(p)}` : ''; }
export function proyectosActivos() { return store.proyectos.filter(p => p.estado === 'activo' || p.estado === 'propuesto'); }
// ---------- Sub-proyectos (pedido a7) ----------
/** Sub-proyectos de un proyecto. */
export function subproyectos(id) { return id ? store.proyectos.filter(p => p.padre_id === id) : []; }
/** Un proyecto con sub-proyectos es un contenedor: el LPS se registra en sus sub-proyectos. */
export function esContenedor(p) { return !!p && store.proyectos.some(x => x.padre_id === p.id); }
/** ¿La actividad / restricción / registro del proyecto «id» entra en el proyecto elegido en el menú?
 *  Elegir un proyecto incluye sus sub-proyectos. */
export function enProyectoSel(id) {
  const sel = store.proyectoSel;
  return !sel || id === sel || (!!id && proyecto(id)?.padre_id === sel);
}
const nombreConPadre = p => { const padre = p.padre_id && proyecto(p.padre_id); return padre ? `${padre.nombre_corto} › ${p.nombre_corto}` : p.nombre_corto; };
export function opcionesProyectos() {
  // Solo proyectos sin sub-proyectos y sub-proyectos: es donde se registra el LPS
  return [{ value: null, label: '—' }, ...proyectosActivos().filter(p => !esContenedor(p)).map(p => ({
    value: p.id, label: `${p.codigo} · ${nombreConPadre(p)}${p.estado === 'propuesto' ? ' (por aprobar)' : ''}` }))];
}
export function misProyectos() {
  // Proyectos donde la persona es líder y los que ella misma agregó (pedido 100).
  // Los usuarios se registran en la empresa y los niveles de abajo los heredan (pedido a8): el líder de un proyecto
  // lo es también de sus sub-proyectos.
  const yo = store.usuario?.id;
  const ids = new Set(store.proyectoLideres.filter(l => l.usuario_id === yo).map(l => l.proyecto_id));
  return store.proyectos.filter(p => ids.has(p.id) || ids.has(p.padre_id) || (p.created_by && p.created_by === yo));
}
/** Líderes de un proyecto: los propios o, en un sub-proyecto sin líderes propios, los heredados de su proyecto. */
export function lideresHeredados(id) {
  const propios = store.proyectoLideres.filter(l => l.proyecto_id === id).map(l => l.usuario_id);
  const p = proyecto(id);
  return propios.length || !p?.padre_id ? propios : store.proyectoLideres.filter(l => l.proyecto_id === p.padre_id).map(l => l.usuario_id);
}
export function seleccionarProyecto(id) {
  store.proyectoSel = id || '';
  localStorage.setItem('lpsgt-proyecto', store.proyectoSel);
  emit('proyecto', store.proyectoSel);
}
