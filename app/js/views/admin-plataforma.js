// Consola de Administración — sección PLATAFORMA (administrador de la plataforma: profiles.es_plataforma).
// Empresas, usuarios, estructura (Empresa → Portafolio → Programa → Proyecto), propietarios, auditoría y reportes
// de TODAS las empresas. Los datos que cruzan empresas pasan solo por la Edge Function "admin-usuarios":
// en las pantallas normales cada usuario (también el de la plataforma) ve únicamente la empresa en la que trabaja.
import { api, mensajeError } from '../data/api.js';
import { store, cargarCatalogo } from '../core/store.js';
import { ROLES, COLOR_ROL } from '../data/catalogos.js';
import { esc, fmtFechaHora } from '../core/util.js';
import { ok, error, confirmar, pedirDatos, modal, badge } from '../ui/ui.js';

// ---------- Datos de la plataforma ----------
// Se guardan en memoria mientras la consola está abierta: cada panel los reutiliza y solo se vuelven a pedir
// al servidor después de un cambio (o pasado un minuto). Antes cada clic los descargaba de nuevo (pedido 19).
let datos = null, cargadosEn = 0, enCurso = null;
export async function cargarPlataforma({ forzar = false } = {}) {
  if (!forzar && datos && Date.now() - cargadosEn < 60000) return datos;
  if (!forzar && enCurso) return enCurso;
  enCurso = api.adminUsuarios('plataforma').then(d => { datos = d; cargadosEn = Date.now(); return d; }).finally(() => { enCurso = null; });
  return enCurso;
}
/** Empresas ya cargadas (para la barra superior), sin volver a pedirlas. */
export function empresasEnMemoria() { return datos?.areas || null; }
const empresa = id => datos.areas.find(a => a.id === id);
const usuariosDe = id => datos.perfiles.filter(p => p.area_id === id);
const principalDe = id => usuariosDe(id).find(p => p.es_admin_principal && !p.es_plataforma) || usuariosDe(id).find(p => p.es_admin_principal);
const proyectosDe = id => datos.proyectos.filter(p => p.area_id === id);
const lideresDe = proyId => datos.lideres.filter(l => l.proyecto_id === proyId).map(l => datos.perfiles.find(p => p.id === l.usuario_id)).filter(Boolean);
// Los niveles de abajo heredan (pedido a8): un sub-proyecto sin líderes propios usa los de su proyecto
const lideresEf = p => lideresDe(p.id).length || !p.padre_id ? lideresDe(p.id) : lideresDe(p.padre_id);
const subDe = p => datos.proyectos.filter(x => x.padre_id === p.id);
const nombreCorto = p => p ? (p.email ? p.email.split('@')[0] : p.nombre) : '';
// Administrador de cada empresa: los propietarios de la plataforma (la crean y la administran por defecto).
// Super administrador: el responsable dentro de la empresa (crea portafolios, programas y proyectos); es opcional.
const propietarios = () => datos.perfiles.filter(p => p.es_plataforma && p.activo);
const superDe = id => { const p = principalDe(id); return p && !p.es_plataforma ? p : null; };
const celdaAdministrador = () => propietarios().map(p => `<b>${esc(p.nombre)}</b><br><small class="nota">${esc(p.email || '')}</small>`).join('<br>') || '—';
const celdaSuper = (a, conBoton = true) => {
  const sa = superDe(a.id);
  return (sa ? `<b>${esc(sa.nombre)}</b><br><small class="nota">${esc(sa.email || '')}</small>` : badge('Sin asignar', '#EDC948')) +
    (conBoton ? ` <button class="btn btn-xs${sa ? '' : ' btn-azul'}" data-principal="${a.id}">${sa ? 'Cambiar' : 'Asignar'}</button>` : '');
};
const codigoEmpresa = a => String(a.id).slice(0, 8);
const activa = a => a.activa !== false;

const COLOR_EST = { activo: '#2e7d32', propuesto: '#e65100', en_pausa: '#795548', cerrado: '#546E7A', rechazado: '#b71c1c' };
const TXT_EST = { activo: 'Activo', propuesto: 'Propuesto', en_pausa: 'En pausa', cerrado: 'Cerrado', rechazado: 'Rechazado' };

function cab(titulo, sub, botones = '') {
  return `<div class="admin-panel-cab"><div><h2>${esc(titulo)}</h2>${sub ? `<p class="admin-sub" style="margin:4px 0 0">${sub}</p>` : ''}</div>
    <div class="barra-acciones">${botones}</div></div>`;
}

// Al cambiar algo de la empresa en la que se trabaja, el resto del aplicativo se actualiza
async function refrescar(areaTocada) {
  await cargarPlataforma({ forzar: true });
  if (!areaTocada || areaTocada === store.area?.id) await cargarCatalogo().catch(() => {});
}

// ════════════════════════════════════════════════════════════════
// RESUMEN DE LA PLATAFORMA
// ════════════════════════════════════════════════════════════════
export async function panelResumenPlataforma(el, ctx) {
  await cargarPlataforma();
  const act = datos.areas.filter(activa).length;
  const vivos = datos.proyectos.filter(p => !['cerrado', 'rechazado'].includes(p.estado));
  const sinAdmin = vivos.filter(p => !lideresEf(p).length).length;
  const usuarios = datos.perfiles.filter(p => p.activo && p.rol !== 'pendiente').length;
  el.innerHTML = cab('Resumen de la plataforma', 'Todas las empresas que usan este aplicativo.', `<button class="btn btn-sm" data-a="imprimir">🖨 Imprimir</button>`) +
    `<div class="admin-kpis">
      ${kpi(act, 'Empresas activas')}${kpi(datos.areas.length - act, 'Suspendidas')}${kpi(usuarios, 'Usuarios activos')}
      ${kpi(datos.portafolios.length, 'Portafolios')}${kpi(datos.programas.length, 'Programas')}${kpi(vivos.length, 'Proyectos vigentes')}
      ${kpi(sinAdmin, 'Proyectos sin administrador', sinAdmin ? 'alerta' : '')}
    </div>
    <div class="tarjeta admin-tabla-wrap"><table class="simple">
      <thead><tr><th>EMPRESA</th><th>ADMINISTRADOR</th><th>SUPER ADMINISTRADOR</th><th class="num">USUARIOS</th><th class="num">PORTAFOLIOS</th><th class="num">PROGRAMAS</th><th class="num">PROYECTOS</th><th>ESTADO</th></tr></thead>
      <tbody>${datos.areas.map(a => `<tr>
        <td><b>${esc(a.nombre)}</b>${a.id === datos.mi_area ? ' ' + badge('En uso ahora', '#1565c0') : ''}</td>
        <td>${celdaAdministrador()}</td><td>${celdaSuper(a, false)}</td>
        <td class="num">${usuariosDe(a.id).filter(p => p.activo && p.rol !== 'pendiente').length}</td>
        <td class="num">${datos.portafolios.filter(x => x.area_id === a.id).length}</td>
        <td class="num">${datos.programas.filter(x => x.area_id === a.id).length}</td>
        <td class="num">${proyectosDe(a.id).length}</td>
        <td>${activa(a) ? badge('Activa', '#2e7d32') : badge('Suspendida', '#b71c1c')}</td></tr>`).join('')}</tbody>
    </table></div>`;
  el.addEventListener('click', e => { if (e.target.closest('[data-a="imprimir"]')) ctx.imprimir(el, 'Resumen de la plataforma'); });
}
const kpi = (n, txt, cls = '') => `<div class="admin-kpi ${cls}"><span class="admin-kpi-num">${n}</span><span class="admin-kpi-txt">${esc(txt)}</span></div>`;

// ════════════════════════════════════════════════════════════════
// EMPRESAS
// ════════════════════════════════════════════════════════════════
export async function panelEmpresas(el, ctx) {
  await cargarPlataforma();
  el.innerHTML = cab('Empresas', 'Todas las empresas de la plataforma. Cada empresa es independiente: sus usuarios, proyectos y permisos no se mezclan.',
    `<button class="btn btn-sm btn-peligro-borde" data-a="eliminar-sel" disabled>Eliminar seleccionadas</button>
     <button class="btn btn-primario" data-a="nueva">+ Nueva empresa</button>`) +
    `<div class="admin-filtros">
      <input class="inp" data-f="q" placeholder="Buscar...">
      <select class="inp" data-f="estado"><option value="">Estado: todos</option><option value="activa">Activas</option><option value="suspendida">Suspendidas</option></select>
      <select class="inp" data-f="orden"><option value="creada">Orden: más antiguas primero</option><option value="nombre">Nombre: A → Z</option><option value="nombre-desc">Nombre: Z → A</option><option value="reciente">Más recientes primero</option></select>
      <span class="flex"></span><span class="nota" data-contador></span>
    </div>
    <div class="tarjeta admin-tabla-wrap"><table class="simple tabla-empresas">
      <thead><tr><th style="width:28px"><input type="checkbox" data-todas aria-label="Seleccionar todas"></th><th>EMPRESA</th><th>ADMINISTRADOR</th><th>SUPER ADMINISTRADOR</th>
        <th class="num">USUARIOS</th><th class="num">PROYECTOS</th><th>ESTADO</th><th>CREADA</th><th></th></tr></thead>
      <tbody></tbody></table></div>`;
  const tbody = el.querySelector('tbody');
  const f = k => el.querySelector(`[data-f="${k}"]`).value;
  const pintar = () => {
    const q = f('q').trim().toLowerCase();
    let lista = datos.areas.filter(a => (!q || `${a.nombre} ${codigoEmpresa(a)} ${superDe(a.id)?.nombre || ''} ${superDe(a.id)?.email || ''}`.toLowerCase().includes(q)) &&
      (!f('estado') || (f('estado') === 'activa') === activa(a)));
    const orden = f('orden');
    if (orden === 'nombre') lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (orden === 'nombre-desc') lista.sort((a, b) => b.nombre.localeCompare(a.nombre));
    if (orden === 'reciente') lista.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    el.querySelector('[data-contador]').textContent = `${lista.length} de ${datos.areas.length}`;
    tbody.innerHTML = lista.map(a => {
      const mia = a.id === datos.mi_area;
      return `<tr data-id="${a.id}">
        <td><input type="checkbox" data-sel="${a.id}" ${mia ? 'disabled title="Es la empresa en la que está trabajando"' : ''}></td>
        <td><b>${esc(a.nombre)}</b>${mia ? ' ' + badge('En uso ahora', '#1565c0') : ''}<br><small class="nota">Código ${esc(codigoEmpresa(a))}</small></td>
        <td>${celdaAdministrador()}</td>
        <td>${celdaSuper(a)}</td>
        <td class="num">${usuariosDe(a.id).filter(p => p.activo && p.rol !== 'pendiente').length} <button class="btn btn-xs" data-usuarios="${a.id}">Gestionar</button></td>
        <td class="num">${proyectosDe(a.id).length}</td>
        <td>${activa(a) ? badge('Activa', '#2e7d32') : badge('Suspendida', '#b71c1c')}</td>
        <td>${esc(fmtFechaHora(a.created_at))}</td>
        <td class="acciones-fila">
          <button class="btn btn-xs" data-abrir="${a.id}" ${mia ? 'disabled' : ''}>Abrir</button>
          <button class="btn btn-xs" data-editar="${a.id}">Editar</button>
          <button class="btn btn-xs" data-estado="${a.id}" ${mia ? 'disabled' : ''}>${activa(a) ? 'Suspender' : 'Activar'}</button>
          <button class="btn btn-xs btn-peligro-borde" data-eliminar="${a.id}" ${mia ? 'disabled' : ''}>Eliminar</button></td></tr>`;
    }).join('') || '<tr><td colspan="9" class="nota">Sin empresas con ese filtro.</td></tr>';
    actualizarSel();
  };
  const seleccionadas = () => [...el.querySelectorAll('[data-sel]:checked')].map(c => c.dataset.sel);
  const actualizarSel = () => {
    const n = seleccionadas().length;
    const b = el.querySelector('[data-a="eliminar-sel"]');
    b.disabled = !n; b.textContent = n ? `Eliminar seleccionadas (${n})` : 'Eliminar seleccionadas';
  };
  el.querySelectorAll('[data-f]').forEach(x => x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', pintar));
  el.addEventListener('change', e => {
    if (e.target.matches('[data-todas]')) el.querySelectorAll('[data-sel]:not(:disabled)').forEach(c => { c.checked = e.target.checked; });
    if (e.target.matches('[data-sel], [data-todas]')) actualizarSel();
  });
  el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    const a = t.dataset.a, d = t.dataset;
    try {
      if (a === 'nueva') { if (await nuevaEmpresa()) { await refrescar(); pintar(); } }
      if (a === 'eliminar-sel') { if (await eliminarEmpresas(seleccionadas())) { await refrescar(); pintar(); } }
      if (d.abrir) await abrirEmpresa(empresa(d.abrir));
      if (d.editar) { if (await editarEmpresa(empresa(d.editar))) { await refrescar(d.editar); pintar(); ctx.repintarCabecera(); } }
      if (d.estado) { if (await estadoEmpresa(empresa(d.estado))) { await refrescar(); pintar(); } }
      if (d.eliminar) { if (await eliminarEmpresas([d.eliminar])) { await refrescar(); pintar(); } }
      if (d.principal) { if (await cambiarPrincipal(empresa(d.principal))) { await refrescar(d.principal); pintar(); } }
      if (d.usuarios) await gestionarUsuarios(empresa(d.usuarios), () => refrescar(d.usuarios).then(pintar));
    } catch (err) { error(mensajeError(err)); }
  });
  pintar();
}

async function nuevaEmpresa() {
  const { semillaEmpresa } = await import('../data/catalogos.js');
  return pedirDatos({
    titulo: 'Nueva empresa', texto: 'Crear empresa',
    antes: `<div class="admin-quien"><span class="nota">Administrador de la empresa</span>${celdaAdministrador()}</div>
      Se crea con sus listas, parámetros y permisos iniciales y la administran los propietarios de la plataforma (para trabajar en ella use «Abrir»).
      Después puede agregarle usuarios con «Gestionar» y asignarle su <b>super administrador</b>, que creará sus portafolios, programas y proyectos.`,
    campos: [
      { name: 'nombre_empresa', label: 'Nombre de la empresa', required: true, full: true },
      { name: 'descripcion', label: 'Descripción', full: true },
    ],
    alGuardar: async d => {
      await api.adminUsuarios('crear_empresa', { ...d, semilla: semillaEmpresa() });
      ok(`Empresa "${d.nombre_empresa}" creada.`);
    },
  });
}

async function editarEmpresa(a) {
  return pedirDatos({
    titulo: `Editar empresa: ${a.nombre}`, valores: a,
    campos: [{ name: 'nombre', label: 'Nombre de la empresa', required: true, full: true }, { name: 'descripcion', label: 'Descripción', full: true }],
    alGuardar: async d => { await api.adminUsuarios('editar_empresa', { area_id: a.id, ...d }); ok('Empresa actualizada.'); },
  });
}

async function estadoEmpresa(a) {
  const activar = !activa(a);
  if (!await confirmar(activar ? `¿Activar la empresa "${a.nombre}"? Sus usuarios podrán volver a ingresar.`
    : `¿Suspender la empresa "${a.nombre}"? Sus usuarios no podrán ingresar. Sus datos se conservan y puede reactivarla cuando quiera.`,
  { titulo: activar ? 'Activar empresa' : 'Suspender empresa', texto: activar ? 'Activar' : 'Suspender', peligro: !activar })) return false;
  await api.adminUsuarios('estado_empresa', { area_id: a.id, activa: activar });
  ok(activar ? 'Empresa activada.' : 'Empresa suspendida.');
  return true;
}

async function eliminarEmpresas(ids) {
  const lista = ids.map(empresa).filter(Boolean);
  if (!lista.length) return false;
  // Elimina cualquier empresa con TODOS sus datos: se confirma escribiendo su nombre (o ELIMINAR si son varias)
  const cifras = a => {
    const ps = proyectosDe(a.id);
    return `<li><b>${esc(a.nombre)}</b>: ${usuariosDe(a.id).length} usuario(s), ${datos.portafolios.filter(x => x.area_id === a.id).length} portafolio(s),
      ${datos.programas.filter(x => x.area_id === a.id).length} programa(s), ${ps.filter(p => !p.padre_id).length} proyecto(s) y ${ps.filter(p => p.padre_id).length} sub-proyecto(s)</li>`;
  };
  const clave = lista.length === 1 ? lista[0].nombre : 'ELIMINAR';
  const d = await pedirDatos({
    titulo: lista.length > 1 ? `Eliminar ${lista.length} empresas` : `Eliminar la empresa ${lista[0].nombre}`, texto: 'Eliminar definitivamente',
    antes: `<div class="aviso error"><b>Se eliminarán por completo, con todos sus datos:</b><ul style="margin:6px 0 0 18px">${lista.map(cifras).join('')}</ul>
      También su Look Ahead, plan semanal, restricciones, cartera, historial y las cuentas de sus usuarios. <b>No se puede deshacer.</b>
      Si quiere conservar la información, use «Suspender» o descargue antes un respaldo.</div>`,
    campos: [{ name: 'confirmacion', label: `Para confirmar escriba: ${clave}`, required: true, full: true }],
  });
  if (!d) return false;
  if (String(d.confirmacion).trim().toLowerCase() !== clave.toLowerCase()) { error(`Escriba exactamente «${clave}» para confirmar.`); return false; }
  const fallas = [];
  for (const a of lista) {
    try { await api.adminUsuarios('eliminar_empresa', { area_id: a.id }); } catch (e) { fallas.push(`${a.nombre}: ${mensajeError(e)}`); }
  }
  if (fallas.length) error(fallas.join('\n')); else ok(lista.length > 1 ? 'Empresas eliminadas.' : 'Empresa eliminada.');
  return true;
}

// Trabajar en otra empresa: el aplicativo completo pasa a mostrar sus datos
export async function abrirEmpresa(a, { volverA = '#/admin' } = {}) {
  if (!a || a.id === store.area?.id) return;
  if (!await confirmar(`¿Abrir la empresa "${a.nombre}"? El aplicativo completo (plan, Look Ahead, tablero…) pasará a mostrar los datos de esa empresa.`,
    { titulo: 'Abrir empresa', texto: 'Abrir' })) return;
  await api.adminUsuarios('usar_empresa', { area_id: a.id });
  try { localStorage.removeItem('lpsgt-proyecto'); } catch { /* opcional */ }
  location.hash = volverA;
  location.reload();
}

async function cambiarPrincipal(a) {
  const candidatos = usuariosDe(a.id).filter(p => p.activo && !p.es_plataforma && p.rol !== 'pendiente');
  if (!candidatos.length) { error('La empresa todavía no tiene usuarios: la administran los propietarios. Agregue usuarios con «Gestionar» y luego designe aquí su super administrador.'); return false; }
  const actual = principalDe(a.id);
  return pedirDatos({
    titulo: `Super administrador de ${a.nombre}`, texto: superDe(a.id) ? 'Cambiar' : 'Asignar',
    antes: 'El super administrador es el responsable dentro de la empresa: crea sus portafolios, programas, proyectos y sub-proyectos, y asigna los roles de administrador y delegado. Los propietarios de la plataforma siguen siendo sus administradores.',
    valores: { usuario_id: actual && !actual.es_plataforma ? actual.id : '' },
    campos: [{ name: 'usuario_id', label: 'Usuario', type: 'select', required: true, full: true,
      options: candidatos.map(p => ({ value: p.id, label: `${p.nombre} (${p.email || '—'}) · ${ROLES[p.rol] || p.rol}` })) }],
    alGuardar: async d => { await api.adminUsuarios('cambiar_principal', { area_id: a.id, usuario_id: d.usuario_id }); ok('Super administrador asignado.'); },
  });
}

// ════════════════════════════════════════════════════════════════
// USUARIOS (de todas las empresas o de una)
// ════════════════════════════════════════════════════════════════
export async function panelUsuariosPlataforma(el) {
  await cargarPlataforma();
  el.innerHTML = cab('Usuarios de la plataforma', 'Usuarios de todas las empresas. Cada usuario pertenece a una sola empresa.',
    `<button class="btn btn-primario" data-a="nuevo">+ Nuevo usuario</button>`) +
    `<div class="admin-filtros">
      <input class="inp" data-f="q" placeholder="Buscar nombre o correo...">
      <select class="inp" data-f="empresa"><option value="">Empresa: todas</option>${datos.areas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select>
      <select class="inp" data-f="rol"><option value="">Rol: todos</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
      <select class="inp" data-f="estado"><option value="">Estado: todos</option><option value="1">Activos</option><option value="0">Inactivos</option></select>
      <span class="flex"></span><span class="nota" data-contador></span></div>
    <div class="tarjeta admin-tabla-wrap" data-tabla></div>`;
  const f = k => el.querySelector(`[data-f="${k}"]`).value;
  const pintar = () => {
    const q = f('q').trim().toLowerCase();
    const lista = datos.perfiles.filter(p => (!q || `${p.nombre} ${p.email}`.toLowerCase().includes(q)) && (!f('empresa') || p.area_id === f('empresa')) &&
      (!f('rol') || p.rol === f('rol')) && (f('estado') === '' || String(Number(!!p.activo)) === f('estado')))
      .sort((a, b) => (empresa(a.area_id)?.nombre || '').localeCompare(empresa(b.area_id)?.nombre || '') || (a.nombre || '').localeCompare(b.nombre || ''));
    el.querySelector('[data-contador]').textContent = `${lista.length} de ${datos.perfiles.length}`;
    el.querySelector('[data-tabla]').innerHTML = tablaUsuarios(lista, true);
  };
  el.querySelectorAll('[data-f]').forEach(x => x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', pintar));
  el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.a === 'nuevo') { if (await nuevoUsuario(f('empresa') || datos.mi_area)) { await refrescar(); pintar(); } }
      if (await accionUsuario(t)) { await refrescar(); pintar(); }
    } catch (err) { error(mensajeError(err)); }
  });
  pintar();
}

function tablaUsuarios(lista, conEmpresa) {
  if (!lista.length) return '<p class="nota" style="padding:12px">Sin usuarios.</p>';
  return `<table class="simple"><thead><tr><th>NOMBRE</th><th>CORREO</th>${conEmpresa ? '<th>EMPRESA</th>' : ''}<th>ROL</th><th>ESTADO</th><th></th></tr></thead>
    <tbody>${lista.map(p => `<tr>
      <td><b>${esc(p.nombre || '—')}</b>${p.es_admin_principal && !p.es_plataforma ? ' ' + badge('Principal', '#1A365D') : ''}${p.es_plataforma ? ' ' + badge('Propietario', '#B07AA1') : ''}</td>
      <td>${esc(p.email || '—')}</td>
      ${conEmpresa ? `<td>${esc(empresa(p.area_id)?.nombre || '—')}</td>` : ''}
      <td>${badge(ROLES[p.rol] || p.rol, COLOR_ROL[p.rol])}</td>
      <td>${p.activo ? badge('Activo', '#2e7d32') : badge('Inactivo', '#888')}</td>
      <td class="acciones-fila"><button class="btn btn-xs" data-rol="${p.id}">Cambiar rol</button>
        <button class="btn btn-xs" data-activo="${p.id}">${p.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}</tbody></table>`;
}

async function accionUsuario(t) {
  const u = datos.perfiles.find(p => p.id === (t.dataset.rol || t.dataset.activo));
  if (!u) return false;
  if (t.dataset.rol) {
    return pedirDatos({
      titulo: `Rol de ${u.nombre}`, valores: { rol: u.rol },
      campos: [{ name: 'rol', label: 'Rol', type: 'select', required: true, full: true, options: Object.entries(ROLES).map(([value, label]) => ({ value, label })) }],
      alGuardar: async d => { await api.adminUsuarios('usuario_plataforma', { usuario_id: u.id, rol: d.rol }); ok('Rol actualizado.'); },
    });
  }
  if (!await confirmar(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`, { texto: u.activo ? 'Desactivar' : 'Activar', peligro: u.activo })) return false;
  await api.adminUsuarios('usuario_plataforma', { usuario_id: u.id, activo: !u.activo });
  ok(u.activo ? 'Usuario desactivado.' : 'Usuario activado.');
  return true;
}

async function nuevoUsuario(areaId) {
  return pedirDatos({
    titulo: 'Nuevo usuario', texto: 'Crear',
    antes: 'Deberá cambiar la contraseña en su primer ingreso.',
    valores: { area_id: areaId, rol: 'lider' },
    campos: [
      { name: 'area_id', label: 'Empresa', type: 'select', required: true, full: true, options: datos.areas.map(a => ({ value: a.id, label: a.nombre })) },
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'email', label: 'Correo', type: 'email', required: true },
      { name: 'rol', label: 'Rol', type: 'select', required: true, options: Object.entries(ROLES).filter(([k]) => k !== 'pendiente').map(([value, label]) => ({ value, label })) },
      { name: 'clave', label: 'Contraseña temporal (mínimo 8 caracteres)', type: 'password', required: true },
    ],
    alGuardar: async d => { await api.adminUsuarios('crear', d); ok(`Usuario creado en ${empresa(d.area_id)?.nombre || 'la empresa'}.`); },
  });
}

async function gestionarUsuarios(a, alCambiar) {
  const cuerpo = document.createElement('div');
  const pintar = () => {
    cuerpo.innerHTML = `<div style="display:flex;margin-bottom:8px"><span class="flex"></span><button class="btn btn-sm btn-primario" data-a="nuevo">+ Nuevo usuario</button></div>
      ${tablaUsuarios(usuariosDe(a.id), false)}`;
  };
  cuerpo.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      const cambio = t.dataset.a === 'nuevo' ? await nuevoUsuario(a.id) : await accionUsuario(t);
      if (cambio) { await refrescar(a.id); pintar(); alCambiar?.(); }
    } catch (err) { error(mensajeError(err)); }
  });
  pintar();
  modal({ titulo: `Usuarios de ${a.nombre}`, cuerpo, ancho: 860, botones: [{ texto: 'Cerrar' }] });
}

// ════════════════════════════════════════════════════════════════
// ESTRUCTURA DE TODAS LAS EMPRESAS: Empresa → Portafolio → Programa → Proyecto
// ════════════════════════════════════════════════════════════════
let vistaEstructura = 'tabla';
const contraidos = new Set();

export async function panelEstructuraTodas(el, ctx) {
  await cargarPlataforma();
  const pintarTodo = () => {
    const vivos = datos.proyectos.filter(p => !['cerrado', 'rechazado'].includes(p.estado));
    const sinAdmin = vivos.filter(p => !lideresEf(p).length).length;
    el.innerHTML = cab('Estructura de todas las empresas', 'Empresa › Portafolio › Programa › Proyecto. Es la misma estructura que cada empresa ve en «Estructura de la empresa»: lo que cambie aquí se refleja allá.',
      `<button class="btn" data-nuevo="portafolios">+ Portafolio</button><button class="btn" data-nuevo="programas">+ Programa</button><button class="btn btn-primario" data-nuevo="proyectos">+ Proyecto</button>`) +
      `<div class="chips-cifras">
        <span class="chip-cifra"><b>${datos.areas.length}</b> Empresas</span><span class="chip-cifra"><b>${datos.portafolios.length}</b> Portafolios</span>
        <span class="chip-cifra"><b>${datos.programas.length}</b> Programas</span><span class="chip-cifra"><b>${datos.proyectos.filter(p => !p.padre_id).length}</b> Proyectos</span>
        <span class="chip-cifra"><b>${datos.proyectos.filter(p => p.padre_id).length}</b> Sub-proyectos</span>
        <span class="chip-cifra ${sinAdmin ? 'alerta' : ''}"><b>${sinAdmin}</b> Proyectos sin administrador</span></div>
      <div class="pestanas-linea"><button data-vista="tabla" class="${vistaEstructura === 'tabla' ? 'activo' : ''}">Estructura de todas las empresas</button>
        <button data-vista="arbol" class="${vistaEstructura === 'arbol' ? 'activo' : ''}">Estructura jerárquica</button></div>
      <div data-cuerpo></div>`;
    const cuerpo = el.querySelector('[data-cuerpo]');
    if (vistaEstructura === 'tabla') pintarTabla(cuerpo); else pintarOrganigrama(cuerpo);
  };

  el.addEventListener('click', async e => {
    const t = e.target.closest('button, [data-toggle], .org-caja'); if (!t) return;
    const d = t.dataset;
    try {
      if (d.vista) { vistaEstructura = d.vista; pintarTodo(); return; }
      if (d.toggle) { contraidos.has(d.toggle) ? contraidos.delete(d.toggle) : contraidos.add(d.toggle); pintarTodo(); return; }
      if (d.a === 'expandir') { contraidos.clear(); pintarTodo(); return; }
      if (d.a === 'contraer') { datos.areas.forEach(a => contraidos.add('a' + a.id)); datos.portafolios.forEach(f => contraidos.add('f' + f.id)); datos.programas.forEach(g => contraidos.add('g' + g.id)); datos.proyectos.forEach(p => contraidos.add('p' + p.id)); pintarTodo(); return; }
      let cambio = false, area = null;
      if (d.nuevo) { const r = await editarNodo(d.nuevo, null, { area: d.area, portafolio: d.portafolio, programa: d.programa, padre: d.padre }); cambio = !!r; area = r?.area_id; }
      if (d.editar) { const x = datos[d.tabla].find(r => r.id === d.editar); cambio = !!await editarNodo(d.tabla, x, {}); area = x?.area_id; }
      if (d.eliminar) { const x = datos[d.tabla].find(r => r.id === d.eliminar); cambio = await eliminarNodo(d.tabla, x); area = x?.area_id; }
      if (d.lideres) { const p = datos.proyectos.find(r => r.id === d.lideres); cambio = !!await miembrosProyecto(p); area = p?.area_id; }
      if (d.eliminarEmpresa) { cambio = await eliminarEmpresas([d.eliminarEmpresa]); }
      if (d.editarEmpresa) { const a = empresa(d.editarEmpresa); cambio = !!await editarEmpresa(a); area = a?.id; if (cambio) ctx.repintarCabecera(); }
      if (d.usuarios) { await gestionarUsuarios(empresa(d.usuarios), () => refrescar(d.usuarios).then(pintarTodo)); }
      if (cambio) { await refrescar(area); pintarTodo(); }
    } catch (err) { error(mensajeError(err)); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.org-caja')) e.target.click(); });
  el.addEventListener('input', e => { if (e.target.matches('[data-buscar]')) filtrarTabla(el); });
  el.addEventListener('change', e => { if (e.target.matches('[data-mostrar]')) filtrarTabla(el); });
  pintarTodo();
}

function pintarTabla(cuerpo) {
  const filas = [];
  const fila = (nivel, tipo, x, celdas, clave, hijos) => {
    const abierto = !contraidos.has(clave);
    filas.push(`<tr class="est-fila est-${tipo}" data-tipo="${tipo}" data-nivel="${nivel}" data-texto="${esc(celdas.buscar.toLowerCase())}">
      <td style="padding-left:${8 + nivel * 20}px">${hijos ? `<span class="est-toggle" data-toggle="${clave}" role="button" aria-label="${abierto ? 'Contraer' : 'Expandir'}">${abierto ? '▾' : '▸'}</span>` : '<span class="est-toggle est-sin-hijos"></span>'}
        ${celdas.nombre}</td>
      <td>${celdas.tipo}</td><td class="nota">${celdas.codigo}</td><td>${celdas.admin}</td><td class="acciones-fila">${celdas.acciones}</td></tr>`);
    return abierto;
  };
  const filaProyecto = (p, nivel) => {
    const lid = lideresEf(p), sub = !!p.padre_id, hijos = sub ? [] : subDe(p);
    const heredado = sub && !lideresDe(p.id).length && lid.length;
    const abierto = fila(nivel, sub ? 'subproyecto' : 'proyecto', p, {
      nombre: `<span class="est-ico">${sub ? '▫' : '📋'}</span> <span class="${sub ? 'est-n-sub' : 'est-n-proy'}">${esc(p.nombre_corto)}</span> ${p.estado !== 'activo' ? badge(TXT_EST[p.estado] || p.estado, COLOR_EST[p.estado]) : ''}`,
      tipo: sub ? badge('Sub-proyecto', '#1A365D') : badge('Proyecto', '#E8762B'), codigo: esc(p.codigo || '—'), buscar: `${p.nombre_corto} ${p.codigo} ${lid.map(nombreCorto).join(' ')}`,
      admin: lid.length ? `${esc(lid.map(nombreCorto).join(', '))}${heredado ? ' <small class="nota">(heredado)</small>' : ''} <button class="btn btn-xs" data-lideres="${p.id}">Cambiar</button>`
        : `${badge('Sin asignar', '#EDC948')} <button class="btn btn-xs btn-azul" data-lideres="${p.id}">Asignar</button>`,
      acciones: `${sub ? '' : `<button class="btn btn-xs" data-nuevo="proyectos" data-area="${p.area_id}" data-padre="${p.id}">+ Sub-proyecto</button>`}
        <button class="btn btn-xs" data-editar="${p.id}" data-tabla="proyectos">Editar</button>
        <button class="btn btn-xs" data-lideres="${p.id}">Miembros y permisos</button>
        <button class="btn btn-xs btn-peligro-borde" data-eliminar="${p.id}" data-tabla="proyectos">Eliminar</button>`,
    }, 'p' + p.id, hijos.length);
    if (abierto) hijos.forEach(h => filaProyecto(h, nivel + 1));
  };
  const filaPrograma = (g, nivel) => {
    const ps = datos.proyectos.filter(p => p.programa_id === g.id && !p.padre_id);
    if (fila(nivel, 'programa', g, {
      nombre: `<span class="est-ico">📁</span> <span class="est-n-prog">${esc(g.nombre)}</span> ${g.estado === 'inactivo' ? badge('Inactivo', '#888') : ''}`,
      tipo: badge('Programa', '#8E44AD'), codigo: esc(g.codigo || '—'), buscar: `${g.nombre} ${g.codigo || ''}`,
      admin: esc(g.responsable_id ? nombreCorto(datos.perfiles.find(u => u.id === g.responsable_id)) : ''),
      acciones: `<button class="btn btn-xs" data-nuevo="proyectos" data-area="${g.area_id}" data-programa="${g.id}">+ Proyecto</button>
        <button class="btn btn-xs" data-editar="${g.id}" data-tabla="programas">Editar</button>
        <button class="btn btn-xs btn-peligro-borde" data-eliminar="${g.id}" data-tabla="programas">Eliminar</button>`,
    }, 'g' + g.id, ps.length)) ps.forEach(p => filaProyecto(p, nivel + 1));
  };
  for (const a of datos.areas) {
    const ports = datos.portafolios.filter(f => f.area_id === a.id);
    const progSueltos = datos.programas.filter(g => g.area_id === a.id && !g.portafolio_id);
    const proySueltos = proyectosDe(a.id).filter(p => !p.portafolio_id && !p.programa_id && !p.padre_id);
    const abierta = fila(0, 'empresa', a, {
      nombre: `<span class="est-ico">🏢</span> <b>${esc(a.nombre)}</b> ${a.id === datos.mi_area ? badge('En uso ahora', '#1565c0') : ''} ${activa(a) ? '' : badge('Suspendida', '#b71c1c')}`,
      tipo: badge('Empresa', '#2e7d32'), codigo: esc(codigoEmpresa(a)), buscar: `${a.nombre} ${codigoEmpresa(a)}`,
      admin: `<small class="nota">Administrador: ${esc(propietarios().map(nombreCorto).join(', ') || '—')} · Super administrador: ${esc(superDe(a.id) ? nombreCorto(superDe(a.id)) : 'sin asignar')}</small>`,
      acciones: `<button class="btn btn-xs" data-nuevo="portafolios" data-area="${a.id}">+ Portafolio</button>
        <button class="btn btn-xs" data-nuevo="programas" data-area="${a.id}">+ Programa</button>
        <button class="btn btn-xs" data-nuevo="proyectos" data-area="${a.id}">+ Proyecto</button>
        <button class="btn btn-xs" data-usuarios="${a.id}">Usuarios</button>`,
    }, 'a' + a.id, ports.length + progSueltos.length + proySueltos.length);
    if (!abierta) continue;
    for (const f of ports) {
      const gs = datos.programas.filter(g => g.portafolio_id === f.id);
      const ps = datos.proyectos.filter(p => p.portafolio_id === f.id && !p.programa_id && !p.padre_id);
      if (fila(1, 'portafolio', f, {
        nombre: `<span class="est-ico">🗂</span> <span class="est-n-port">${esc(f.nombre)}</span> ${f.estado === 'inactivo' ? badge('Inactivo', '#888') : ''}`,
        tipo: badge('Portafolio', '#1565c0'), codigo: esc(f.codigo || '—'), buscar: `${f.nombre} ${f.codigo || ''}`,
        admin: esc(f.responsable_id ? nombreCorto(datos.perfiles.find(u => u.id === f.responsable_id)) : ''),
        acciones: `<button class="btn btn-xs" data-nuevo="programas" data-area="${a.id}" data-portafolio="${f.id}">+ Programa</button>
          <button class="btn btn-xs" data-nuevo="proyectos" data-area="${a.id}" data-portafolio="${f.id}">+ Proyecto</button>
          <button class="btn btn-xs" data-editar="${f.id}" data-tabla="portafolios">Editar</button>
          <button class="btn btn-xs btn-peligro-borde" data-eliminar="${f.id}" data-tabla="portafolios">Eliminar</button>`,
      }, 'f' + f.id, gs.length + ps.length)) { gs.forEach(g => filaPrograma(g, 2)); ps.forEach(p => filaProyecto(p, 2)); }
    }
    progSueltos.forEach(g => filaPrograma(g, 1));
    proySueltos.forEach(p => filaProyecto(p, 1));
  }
  cuerpo.innerHTML = `<div class="admin-filtros">
      <input class="inp" data-buscar placeholder="Buscar en la estructura..." style="width:260px">
      <select class="inp" data-mostrar><option value="">Mostrar: todo</option><option value="empresa">Solo empresas</option><option value="portafolio">Hasta portafolios</option>
        <option value="programa">Hasta programas</option><option value="proyecto">Hasta proyectos</option><option value="sinadmin">Proyectos sin administrador</option></select>
      <button class="btn btn-sm" data-a="expandir">Expandir todo</button><button class="btn btn-sm" data-a="contraer">Contraer todo</button></div>
    <div class="tarjeta admin-tabla-wrap"><table class="simple tabla-estructura">
      <thead><tr><th>NOMBRE</th><th>TIPO</th><th>CÓDIGO</th><th>ADMINISTRADOR</th><th></th></tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

function filtrarTabla(el) {
  const q = (el.querySelector('[data-buscar]')?.value || '').trim().toLowerCase();
  const m = el.querySelector('[data-mostrar]')?.value || '';
  const orden = ['empresa', 'portafolio', 'programa', 'proyecto', 'subproyecto'];
  el.querySelectorAll('.est-fila').forEach(tr => {
    let ver = !q || tr.dataset.texto.includes(q);
    if (m === 'sinadmin') ver = ver && ['proyecto', 'subproyecto'].includes(tr.dataset.tipo) && !!tr.querySelector('.btn-azul');
    else if (m) ver = ver && orden.indexOf(tr.dataset.tipo) <= orden.indexOf(m);
    tr.style.display = ver ? '' : 'none';
  });
}

// Organigrama (como el lienzo «Estructura de Proyectos»): cajas por nivel unidas con líneas
function pintarOrganigrama(cuerpo) {
  // Cada tarjeta se edita con un clic sobre ella (pedido 14)
  const TABLA = { portafolio: 'portafolios', programa: 'programas', proyecto: 'proyectos', subproyecto: 'proyectos' };
  const caja = (tipo, titulo, sub, id) => `<div class="org-caja org-${tipo}" role="button" tabindex="0" title="Clic para editar"
      ${tipo === 'empresa' ? `data-editar-empresa="${id}"` : `data-editar="${id}" data-tabla="${TABLA[tipo]}"`}><b>${esc(titulo)}</b><small>${esc(sub)}</small>
      ${tipo === 'empresa' && id === datos.mi_area ? '' : `<button class="org-borrar" title="Eliminar" aria-label="Eliminar ${esc(titulo)}"
        ${tipo === 'empresa' ? `data-eliminar-empresa="${id}"` : `data-eliminar="${id}" data-tabla="${TABLA[tipo]}"`}>🗑</button>`}</div>`;
  // Portafolios y programas se abren en horizontal; los proyectos (y sus sub-proyectos) se apilan en vertical (pedido 20)
  const columna = items => `<ul class="org-v">${items.join('')}</ul>`;
  const nodo = (htmlCaja, hijos, proyectos = []) => {
    const ramas = [...hijos, ...(hijos.length && proyectos.length ? [`<li class="org-grupo">${columna(proyectos)}</li>`] : [])];
    return `<li>${htmlCaja}${ramas.length ? `<ul>${ramas.join('')}</ul>` : proyectos.length ? columna(proyectos) : ''}</li>`;
  };
  const sub = p => nodo(caja('subproyecto', p.nombre_corto, 'Sub-proyecto', p.id), []);
  const proy = p => nodo(caja('proyecto', p.nombre_corto, `Proyecto${lideresDe(p.id).length ? ' · ' + lideresDe(p.id).map(nombreCorto).join(', ') : ''}`, p.id), [], subDe(p).map(sub));
  const raiz = arr => arr.filter(p => !p.padre_id);
  const prog = g => nodo(caja('programa', g.nombre, 'Programa', g.id), [], raiz(datos.proyectos.filter(p => p.programa_id === g.id)).map(proy));
  const arboles = datos.areas.map(a => {
    const hijos = [
      ...datos.portafolios.filter(f => f.area_id === a.id).map(f => nodo(caja('portafolio', f.nombre, 'Portafolio', f.id),
        datos.programas.filter(g => g.portafolio_id === f.id).map(prog),
        raiz(datos.proyectos.filter(p => p.portafolio_id === f.id && !p.programa_id)).map(proy))),
      ...datos.programas.filter(g => g.area_id === a.id && !g.portafolio_id).map(prog),
    ];
    return `<div class="org-arbol"><ul>${nodo(caja('empresa', a.nombre, 'Empresa', a.id), hijos,
      raiz(proyectosDe(a.id).filter(p => !p.portafolio_id && !p.programa_id)).map(proy))}</ul></div>`;
  });
  cuerpo.innerHTML = `<p class="nota">Haga clic en una tarjeta para editarla; 🗑 la elimina. Los proyectos se listan en columna bajo su programa, portafolio o empresa. Las cajas naranjas son proyectos (con su administrador) y las azul oscuro, sus sub-proyectos, donde se registra el LPS.</p>
    <div class="org-lienzo">${arboles.join('')}</div>`;
}

// ---------- Altas, ediciones y bajas (pasan por el servidor: pueden ser de cualquier empresa) ----------
async function editarNodo(tabla, x, { area, portafolio, programa, padre }) {
  const areaId = x?.area_id || area;
  const padreId = x?.padre_id || padre || '';
  const padreP = padreId && datos.proyectos.find(z => z.id === padreId);
  const campos = [];
  // Empresa: al crear sin empresa elegida y, en un proyecto (no sub-proyecto), también al editar para moverlo (pedido 15)
  const eligeEmpresa = !areaId || (tabla === 'proyectos' && x && !padreP);
  if (eligeEmpresa) campos.push({ name: 'area_id', label: 'Empresa', type: 'select', required: true, full: true, options: datos.areas.map(a => ({ value: a.id, label: a.nombre })) });
  const opcPort = id => datos.portafolios.filter(f => (!id || f.area_id === id) && f.estado !== 'inactivo').map(f => ({ value: f.id, label: f.nombre }));
  const opcProg = id => datos.programas.filter(g => (!id || g.area_id === id) && g.estado !== 'inactivo').map(g => {
    const f = datos.portafolios.find(z => z.id === g.portafolio_id);
    return { value: g.id, label: [f?.nombre, g.nombre].filter(Boolean).join(' › ') };
  });
  const responsables = id => datos.perfiles.filter(p => (!id || p.area_id === id) && p.activo && p.rol !== 'pendiente').map(p => ({ value: p.id, label: `${p.nombre} (${nombreCorto(p)})` }));
  if (tabla === 'proyectos') {
    campos.push({ name: 'codigo', label: 'Código', required: true }, { name: 'nombre_corto', label: 'Nombre corto (menú)', required: true },
      { name: 'nombre_completo', label: 'Nombre completo', full: true },
      // Un sub-proyecto hereda el portafolio y el programa de su proyecto
      ...(padreP ? [] : [{ name: 'portafolio_id', label: 'Portafolio', type: 'select', options: opcPort(eligeEmpresa ? null : areaId) },
        { name: 'programa_id', label: 'Programa (define el portafolio)', type: 'select', options: opcProg(eligeEmpresa ? null : areaId) }]),
      { name: 'estado', label: 'Estado', type: 'select', required: true, options: Object.entries(TXT_EST).map(([value, label]) => ({ value, label })) },
      { name: 'fecha_inicio', label: 'Inicio previsto', type: 'date' }, { name: 'fecha_fin', label: 'Fin previsto', type: 'date' });
  } else {
    campos.push({ name: 'codigo', label: 'Código' }, { name: 'nombre', label: 'Nombre', required: true });
    if (tabla === 'programas') campos.push({ name: 'portafolio_id', label: 'Portafolio', type: 'select', options: opcPort(eligeEmpresa ? null : areaId) });
    campos.push({ name: 'responsable_id', label: 'Responsable', type: 'select', options: responsables(eligeEmpresa ? null : areaId) },
      { name: 'estado', label: 'Estado', type: 'select', required: true, options: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
      { name: 'descripcion', label: 'Descripción', type: 'textarea', full: true });
  }
  const que = { portafolios: 'portafolio', programas: 'programa', proyectos: padreP ? 'sub-proyecto' : 'proyecto' }[tabla];
  let creado = null, mueveA = null;
  const promesa = pedirDatos({
    titulo: x ? `Editar ${que}: ${x.nombre || x.nombre_corto}` : padreP ? `Nuevo sub-proyecto de ${padreP.nombre_corto}` : `Nuevo ${que}${areaId ? ' en ' + (empresa(areaId)?.nombre || '') : ''}`,
    antes: padreP ? 'El sub-proyecto hereda el portafolio, el programa y los líderes de su proyecto. El Look Ahead y el Plan semanal se registran en él.' : '',
    valores: x || { estado: 'activo', portafolio_id: portafolio || '', programa_id: programa || '' },
    campos,
    alGuardar: async d => {
      const area_id = d.area_id || areaId;
      const mueve = x && tabla === 'proyectos' && area_id !== x.area_id;
      mueveA = mueve ? area_id : null;
      if (mueve) {
        const subs = subDe(x).length;
        if (!await confirmar(`¿Mover "${x.nombre_corto}"${subs ? ` y sus ${subs} sub-proyecto(s)` : ''} a la empresa "${empresa(area_id)?.nombre}"? ` +
          'Se quitan su gerencia, fase, país y líderes (son de la empresa actual) para elegirlos en la nueva. Solo se puede si todavía no tiene actividades, restricciones ni cartera.',
        { titulo: 'Mover a otra empresa', texto: 'Mover' })) throw new Error('No se movió el proyecto.');
      }
      // Un programa o portafolio elegido debe ser de la misma empresa
      for (const [k, t] of [['portafolio_id', 'portafolios'], ['programa_id', 'programas']]) {
        if (d[k] && datos[t].find(z => z.id === d[k])?.area_id !== area_id) throw new Error(`El ${k === 'portafolio_id' ? 'portafolio' : 'programa'} elegido es de otra empresa.`);
      }
      const { area_id: _, ...resto } = d;
      if (padreP) resto.padre_id = padreP.id;
      const res = await api.adminUsuarios('estructura', { tabla, id: x?.id, area_id, datos: resto });
      creado = res.registro;
      ok(mueveA ? `Proyecto movido a ${empresa(mueveA)?.nombre}.` : `${que[0].toUpperCase() + que.slice(1)} guardado.`);
    },
  });
  if (eligeEmpresa) filtrarPorEmpresa();
  const r = await promesa;
  return r ? (creado || x) : null;
}

// En el formulario: portafolios, programas y responsables solo de la empresa elegida
function filtrarPorEmpresa() {
  const form = [...document.querySelectorAll('.modal')].pop();
  const selEmp = form?.querySelector('[name="area_id"]');
  if (!selEmp) return;
  const areaDe = (campo, id) => campo === 'responsable_id' ? datos.perfiles.find(p => p.id === id)?.area_id
    : datos[campo === 'portafolio_id' ? 'portafolios' : 'programas'].find(z => z.id === id)?.area_id;
  const aplicar = () => {
    for (const campo of ['portafolio_id', 'programa_id', 'responsable_id']) {
      const sel = form.querySelector(`[name="${campo}"]`);
      if (!sel) continue;
      for (const o of sel.options) if (o.value) o.hidden = o.disabled = areaDe(campo, o.value) !== selEmp.value;
      if (sel.selectedOptions[0]?.hidden) sel.value = '';
    }
  };
  selEmp.addEventListener('change', aplicar);
  aplicar();
}

async function eliminarNodo(tabla, x) {
  if (!x) return false;
  if (tabla === 'proyectos') return eliminarProyecto(x);
  const que = tabla === 'portafolios' ? 'el portafolio' : 'el programa';
  const aviso = 'Sus programas y proyectos no se eliminan: quedan sin ' + (tabla === 'portafolios' ? 'portafolio.' : 'programa.');
  if (!await confirmar(`¿Eliminar ${que} "${x.nombre}"? ${aviso}`, { titulo: 'Eliminar', texto: 'Eliminar', peligro: true })) return false;
  await api.adminUsuarios('estructura', { tabla, op: 'eliminar', id: x.id });
  ok('Eliminado.');
  return true;
}

// Proyecto (pedido 18): sin trabajo registrado se elimina con una confirmación; con historial o sub-proyectos se muestra
// lo que se borrará y se confirma escribiendo su nombre
async function eliminarProyecto(x) {
  const h = await api.adminUsuarios('historial_proyecto', { id: x.id });
  const sub = x.padre_id ? 'sub-proyecto' : 'proyecto';
  if (!h.subproyectos && !h.actividades && !h.restricciones && !h.cartera) {
    if (!await confirmar(`¿Eliminar el ${sub} "${x.nombre_corto}"? Todavía no tiene trabajo registrado.`, { titulo: 'Eliminar', texto: 'Eliminar', peligro: true })) return false;
    await api.adminUsuarios('estructura', { tabla: 'proyectos', op: 'eliminar', id: x.id });
    ok(`${sub[0].toUpperCase() + sub.slice(1)} eliminado.`);
    return true;
  }
  const items = [h.subproyectos && `${h.subproyectos} sub-proyecto(s)`, h.actividades && `${h.actividades} actividad(es) del Look Ahead y del plan semanal`,
    h.restricciones && `${h.restricciones} restricción(es)`, h.cartera && `${h.cartera} registro(s) de cartera`].filter(Boolean);
  const d = await pedirDatos({
    titulo: `Eliminar el ${sub} ${x.nombre_corto}`, texto: 'Eliminar definitivamente',
    antes: `<div class="aviso error"><b>Se eliminará con todo su historial:</b><ul style="margin:6px 0 0 18px">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      También sus comentarios, enlaces e hitos (aunque sean de semanas cerradas). <b>No se puede deshacer.</b> Si quiere conservarlo, cámbielo a «Cerrado».</div>`,
    campos: [{ name: 'confirmacion', label: `Para confirmar escriba: ${x.nombre_corto}`, required: true, full: true }],
  });
  if (!d) return false;
  if (String(d.confirmacion).trim().toLowerCase() !== x.nombre_corto.trim().toLowerCase()) { error(`Escriba exactamente «${x.nombre_corto}» para confirmar.`); return false; }
  await api.adminUsuarios('estructura', { tabla: 'proyectos', op: 'eliminar', id: x.id, completo: true });
  ok(`${sub[0].toUpperCase() + sub.slice(1)} eliminado con su historial.`);
  return true;
}

// Administrador y miembros del proyecto = sus líderes (los permisos de cada uno los da su rol en la Matriz de permisos)
async function miembrosProyecto(p) {
  if (!p) return null;
  const actuales = lideresDe(p.id).map(u => u.id);
  const candidatos = usuariosDe(p.area_id).filter(u => u.activo && u.rol !== 'pendiente');
  return pedirDatos({
    titulo: `Miembros de ${p.nombre_corto}`, texto: 'Guardar',
    antes: `Empresa: <b>${esc(empresa(p.area_id)?.nombre || '')}</b>. Los usuarios se registran en la empresa y aquí solo se eligen: los marcados administran el proyecto (líderes).
      ${p.padre_id ? 'Si no marca a nadie, el sub-proyecto hereda los líderes de su proyecto. ' : 'Sus sub-proyectos los heredan. '}Lo que cada uno puede hacer lo define su rol en «Matriz de permisos».`,
    valores: { usuarios: actuales },
    campos: [{ name: 'usuarios', label: 'Líderes / administradores del proyecto', type: 'multiselect', full: true,
      options: candidatos.map(u => ({ value: u.id, label: `${u.nombre} · ${ROLES[u.rol] || u.rol}` })) }],
    alGuardar: async d => { await api.adminUsuarios('lideres', { proyecto_id: p.id, usuario_ids: d.usuarios || [] }); ok('Miembros actualizados.'); },
  });
}

// ════════════════════════════════════════════════════════════════
// PROPIETARIOS DE LA PLATAFORMA
// ════════════════════════════════════════════════════════════════
export async function panelPropietarios(el) {
  await cargarPlataforma();
  const pintar = () => {
    const props = datos.perfiles.filter(p => p.es_plataforma);
    el.innerHTML = cab('Propietarios de la plataforma', 'Administran todas las empresas: las crean, suspenden y eliminan, y ven su estructura. Debe haber al menos uno.',
      `<button class="btn btn-primario" data-a="agregar">+ Agregar propietario</button>`) +
      `<div class="tarjeta admin-tabla-wrap"><table class="simple"><thead><tr><th>NOMBRE</th><th>CORREO</th><th>TRABAJANDO EN</th><th></th></tr></thead>
        <tbody>${props.map(p => `<tr><td><b>${esc(p.nombre)}</b>${p.id === store.usuario.id ? ' ' + badge('Usted', '#1565c0') : ''}</td><td>${esc(p.email || '—')}</td>
          <td>${esc(empresa(p.area_id)?.nombre || '—')}</td>
          <td><button class="btn btn-xs btn-peligro-borde" data-quitar="${p.id}" ${p.id === store.usuario.id || props.length <= 1 ? 'disabled' : ''}>Quitar</button></td></tr>`).join('')}</tbody></table></div>`;
  };
  el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    try {
      if (t.dataset.a === 'agregar') {
        const r = await pedirDatos({
          titulo: 'Agregar propietario', texto: 'Agregar',
          antes: 'Tendrá acceso a la administración de TODAS las empresas. Asígnelo solo a personas de plena confianza.',
          campos: [{ name: 'usuario_id', label: 'Usuario', type: 'select', required: true, full: true,
            options: datos.perfiles.filter(p => !p.es_plataforma && p.activo).map(p => ({ value: p.id, label: `${p.nombre} (${p.email || '—'}) · ${empresa(p.area_id)?.nombre || ''}` })) }],
          alGuardar: async d => { await api.adminUsuarios('propietario', { usuario_id: d.usuario_id, es: true }); ok('Propietario agregado.'); },
        });
        if (r) { await refrescar(); pintar(); }
      }
      if (t.dataset.quitar) {
        const p = datos.perfiles.find(x => x.id === t.dataset.quitar);
        if (await confirmar(`¿Quitar a ${p.nombre} como propietario de la plataforma? Seguirá como usuario de su empresa.`, { texto: 'Quitar', peligro: true })) {
          await api.adminUsuarios('propietario', { usuario_id: p.id, es: false }); ok('Propietario quitado.'); await refrescar(); pintar();
        }
      }
    } catch (err) { error(mensajeError(err)); }
  });
  pintar();
}

// ════════════════════════════════════════════════════════════════
// AUDITORÍA Y REPORTES DE LA PLATAFORMA
// ════════════════════════════════════════════════════════════════
export async function panelAuditoriaPlataforma(el) {
  await cargarPlataforma();
  el.innerHTML = cab('Auditoría de la plataforma', 'Últimos 300 cambios registrados.') +
    `<div class="admin-filtros"><select class="inp" data-f="empresa"><option value="">Empresa: todas</option>${datos.areas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select></div>
    <div class="tarjeta admin-tabla-wrap" data-tabla><div class="admin-cargando"><span class="spinner"></span></div></div>`;
  const pintar = async () => {
    const cont = el.querySelector('[data-tabla]');
    try {
      const { registros } = await api.adminUsuarios('auditoria_plataforma', { area_id: el.querySelector('[data-f="empresa"]').value || undefined });
      const quien = id => datos.perfiles.find(p => p.id === id)?.nombre || '—';
      cont.innerHTML = registros.length ? `<table class="simple"><thead><tr><th>FECHA</th><th>EMPRESA</th><th>USUARIO</th><th>TABLA</th><th>ACCIÓN</th><th>CAMBIOS</th></tr></thead>
        <tbody>${registros.map(r => `<tr><td>${esc(fmtFechaHora(r.created_at))}</td><td>${esc(empresa(r.area_id)?.nombre || '—')}</td><td>${esc(quien(r.usuario_id))}</td>
          <td>${esc(r.tabla)}</td><td>${esc(r.accion)}</td><td><small>${esc(Object.keys(r.cambios || {}).slice(0, 6).join(', '))}</small></td></tr>`).join('')}</tbody></table>`
        : '<p class="nota" style="padding:12px">Sin registros.</p>';
    } catch (err) { cont.innerHTML = `<div class="aviso error">${esc(mensajeError(err))}</div>`; }
  };
  el.querySelector('[data-f="empresa"]').addEventListener('change', pintar);
  pintar();
}

export async function panelReportesPlataforma(el, ctx) {
  await cargarPlataforma();
  const filas = datos.areas.map(a => {
    const ps = proyectosDe(a.id);
    const cuenta = est => ps.filter(p => p.estado === est).length;
    return [a.nombre, activa(a) ? 'Activa' : 'Suspendida', usuariosDe(a.id).filter(p => p.activo && p.rol !== 'pendiente').length,
      datos.portafolios.filter(x => x.area_id === a.id).length, datos.programas.filter(x => x.area_id === a.id).length,
      cuenta('activo'), cuenta('propuesto'), cuenta('en_pausa'), cuenta('cerrado'), ps.filter(p => !['cerrado', 'rechazado'].includes(p.estado) && !lideresEf(p).length).length];
  });
  const cabs = ['Empresa', 'Estado', 'Usuarios activos', 'Portafolios', 'Programas', 'Proyectos activos', 'Propuestos', 'En pausa', 'Cerrados', 'Sin administrador'];
  el.innerHTML = cab('Reportes de la plataforma', 'Cifras por empresa.',
    `<button class="btn btn-sm" data-a="excel">⬇ Excel</button><button class="btn btn-sm" data-a="imprimir">🖨 Imprimir</button>`) +
    `<div class="tarjeta admin-tabla-wrap"><table class="simple"><thead><tr>${cabs.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map((v, i) => `<td${i > 1 ? ' class="num"' : ''}>${esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'imprimir') ctx.imprimir(el, 'Reportes de la plataforma');
    if (a === 'excel') {
      const XLSX = window.XLSX;
      if (!XLSX) return error('La librería de Excel no está disponible.');
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([cabs, ...filas]), 'Empresas');
      XLSX.writeFile(libro, 'Plataforma_empresas.xlsx');
    }
  });
}
