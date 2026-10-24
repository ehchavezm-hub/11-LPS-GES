// Estado de la sesión y catálogo en memoria (listas, parámetros, permisos, usuarios, proyectos).
import { api } from '../data/api.js';
import { PARAMETROS_INICIALES, PLANIFICADORES, AYUDA_ESTADOS } from '../data/catalogos.js';

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

export async function cargarCatalogo() {
  const u = store.usuario;
  const [areas, listas, valores, params, permisos, perfiles, proyectos, lideres, favs, columnas] = await Promise.all([
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
export function puedeEditarActividad(a) {
  return a.responsable_id === store.usuario?.id || puede('editar_actividades_otros');
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
export function nombreProyecto(id) { const p = proyecto(id); return p ? `${p.codigo} · ${p.nombre_corto}` : ''; }
export function proyectosActivos() { return store.proyectos.filter(p => p.estado === 'activo' || p.estado === 'propuesto'); }
export function opcionesProyectos() {
  return [{ value: null, label: '—' }, ...proyectosActivos().map(p => ({
    value: p.id, label: `${p.codigo} · ${p.nombre_corto}${p.estado === 'propuesto' ? ' (por aprobar)' : ''}` }))];
}
export function misProyectos() {
  const ids = new Set(store.proyectoLideres.filter(l => l.usuario_id === store.usuario?.id).map(l => l.proyecto_id));
  return store.proyectos.filter(p => ids.has(p.id));
}
export function seleccionarProyecto(id) {
  store.proyectoSel = id || '';
  localStorage.setItem('lpsgt-proyecto', store.proyectoSel);
  emit('proyecto', store.proyectoSel);
}
