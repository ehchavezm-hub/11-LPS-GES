// Consola de Administración — overlay position:fixed z-index:1500
// Estructura idéntica al módulo de administración de ECM-Project:
//   Barra superior: ⚙ Administración > [Plataforma] > EMPRESA selector > PROYECTO selector > X
//   Sidebar PLATAFORMA: Resumen, Empresas, Estructura de todas las empresas, Propietarios, Auditoría, Reportes
//   Sidebar EMPRESA: Usuarios, Datos de empresa, Permisos, Portafolios, Programas, Proyectos, Configuración
import { api, mensajeError } from '../data/api.js';
import { store, on, esPropietario, esSuperadmin, esAdmin, esGestor, cargarCatalogo, etiqueta, opciones, nombre } from '../core/store.js';
import { ROLES, COLOR_ROL } from '../data/catalogos.js';
import { esc, fmtFechaHora } from '../core/util.js';
import { ok, error, confirmar, pedirDatos, modal, badge } from '../ui/ui.js';

// ---------- Estado ----------
let overlay = null;
let panelActivo = 'resumen';
let contextoEmpresa = null;
let todasEmpresas = [];
let dejarEscuchar = null;

// ---------- Menú ----------
const MENU_PLATAFORMA = [
  { id: 'resumen',     ico: '📊', texto: 'Resumen' },
  { id: 'plat-emp',    ico: '🏢', texto: 'Empresas' },
  { id: 'plat-struct', ico: '🌐', texto: 'Estructura de todas las empresas' },
  { id: 'plat-prop',   ico: '👑', texto: 'Propietarios' },
  { id: 'plat-audit',  ico: '📋', texto: 'Auditoría' },
  { id: 'plat-rep',    ico: '📄', texto: 'Reportes' },
];

const MENU_EMPRESA = [
  { id: 'emp-usuarios',    ico: '👤', texto: 'Usuarios y roles',     si: esGestor },
  { id: 'emp-area',        ico: '🏢', texto: 'Datos de la empresa',  si: esAdmin },
  { id: 'emp-permisos',    ico: '🔐', texto: 'Matriz de permisos',   si: esAdmin },
  { sep: true },
  { id: 'str-portafolios', ico: '🗂', texto: 'Portafolios',          si: esGestor },
  { id: 'str-programas',   ico: '📁', texto: 'Programas',            si: esGestor },
  { id: 'str-proyectos',   ico: '📌', texto: 'Proyectos',            si: esGestor },
  { sep: true },
  { id: 'cfg-listas',      ico: '📋', texto: 'Listas',               si: esAdmin },
  { id: 'cfg-parametros',  ico: '🔧', texto: 'Parámetros',           si: esAdmin },
  { id: 'cfg-columnas',    ico: '▥',  texto: 'Columnas',             si: esAdmin },
  { id: 'cfg-importar',    ico: '⬆', texto: 'Importar Excel',       si: esAdmin },
  { id: 'cfg-respaldo',    ico: '💾', texto: 'Respaldo',             si: esSuperadmin },
  { id: 'cfg-auditoria',   ico: '🕑', texto: 'Auditoría',            si: esAdmin },
];

// ---------- API pública ----------
export function showAdminConsole(panelInicial) {
  if (overlay) { cerrarConsola(); return; }
  panelActivo = panelInicial || (esPropietario() ? 'resumen' : 'emp-usuarios');
  contextoEmpresa = store.area;

  overlay = document.createElement('div');
  overlay.className = 'admin-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Consola de Administración');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = buildShell();
  document.body.append(overlay);

  overlay.querySelector('.admin-cerrar').addEventListener('click', cerrarConsola);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarConsola(); });
  overlay.querySelector('.admin-nav').addEventListener('click', e => {
    const item = e.target.closest('[data-panel]');
    if (item) navegarA(item.dataset.panel);
  });

  if (esPropietario()) {
    cargarEmpresas().then(() => {
      actualizarSelectores();
      pintarMenu();
      renderPanel();
    });
  } else {
    pintarMenu();
    renderPanel();
  }

  dejarEscuchar = on('catalogo', () => { pintarMenu(); renderPanel(); });
  setTimeout(() => overlay?.querySelector('#admin-contenido')?.focus(), 50);
}

export function cerrarConsola() {
  overlay?.remove();
  overlay = null;
  dejarEscuchar?.();
  dejarEscuchar = null;
}

function buildShell() {
  return `<div class="admin-inner">
    <div class="admin-topbar">
      <span class="admin-topbar-ico">⚙</span>
      <span class="admin-topbar-titulo">Administración</span>
      ${esPropietario() ? `
        <span class="admin-topbar-sep"></span>
        <span class="admin-topbar-pill">Plataforma</span>
        <span class="admin-topbar-arrow">›</span>
        <span class="admin-topbar-label">EMPRESA</span>
        <select class="admin-topbar-sel" id="sel-empresa"><option>Cargando...</option></select>
        <span class="admin-topbar-arrow">›</span>
        <span class="admin-topbar-label">PROYECTO</span>
        <select class="admin-topbar-sel" id="sel-proyecto"><option value="">Elegir proyecto...</option></select>
      ` : ''}
      <button class="admin-cerrar" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
    </div>
    <div class="admin-body">
      <aside class="admin-lateral">
        ${esPropietario() ? '<div class="admin-nav-grupo">PLATAFORMA</div>' : ''}
        <nav class="admin-nav" aria-label="Navegación de administración"></nav>
      </aside>
      <main class="admin-contenido" id="admin-contenido" tabindex="-1">
        <div class="admin-cargando"><span class="spinner"></span></div>
      </main>
    </div>
  </div>`;
}

async function cargarEmpresas() {
  try { todasEmpresas = await api.list('areas', { order: [['nombre', true]] }); } catch { todasEmpresas = []; }
}

function actualizarSelectores() {
  const sel = overlay?.querySelector('#sel-empresa');
  const selP = overlay?.querySelector('#sel-proyecto');
  if (!sel) return;
  sel.innerHTML = todasEmpresas.map(e =>
    `<option value="${e.id}"${e.id === contextoEmpresa?.id ? ' selected' : ''}>${esc(e.nombre)}</option>`
  ).join('');
  sel.onchange = async () => {
    contextoEmpresa = todasEmpresas.find(e => e.id === sel.value) || null;
    actualizarProyectos();
    renderPanel();
  };
  actualizarProyectos();
}

function actualizarProyectos() {
  const sel = overlay?.querySelector('#sel-proyecto');
  if (!sel) return;
  const proyectos = contextoEmpresa
    ? store.proyectos.filter(p => p.area_id === contextoEmpresa.id)
    : store.proyectos;
  sel.innerHTML = '<option value="">Elegir proyecto...</option>' +
    proyectos.map(p => `<option value="${p.id}">${esc(p.codigo + ' · ' + p.nombre_corto)}</option>`).join('');
}

// ---------- Navegación ----------
function pintarMenu() {
  const nav = overlay?.querySelector('.admin-nav');
  if (!nav) return;
  const menu = esPropietario() ? MENU_PLATAFORMA : MENU_EMPRESA.filter(m => !m.si || m.si());
  nav.innerHTML = menu.map(m => {
    if (m.sep) return '<hr class="admin-nav-sep">';
    return `<button class="admin-item${panelActivo === m.id ? ' activo' : ''}" data-panel="${m.id}">
      <span class="admin-ico">${m.ico}</span><span class="admin-txt">${esc(m.texto)}</span>
    </button>`;
  }).join('');
}

function navegarA(id) {
  panelActivo = id;
  pintarMenu();
  renderPanel();
}

async function renderPanel() {
  const cont = overlay?.querySelector('#admin-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="admin-cargando"><span class="spinner"></span></div>';
  try {
    const mapa = {
      'resumen':        panelResumen,
      'plat-emp':       panelEmpresas,
      'plat-struct':    panelEstructura,
      'plat-prop':      panelPropietarios,
      'plat-audit':     panelAuditoria,
      'plat-rep':       panelReportes,
      'emp-usuarios':   panelUsuarios,
      'emp-area':       panelAreaEmpresa,
      'emp-permisos':   c => configSeccion(c, 'permisos'),
      'str-portafolios':panelPortafolios,
      'str-programas':  panelProgramas,
      'str-proyectos':  panelProyectos,
      'cfg-listas':     c => configSeccion(c, 'listas'),
      'cfg-parametros': c => configSeccion(c, 'parametros'),
      'cfg-columnas':   c => configSeccion(c, 'columnas'),
      'cfg-importar':   c => configSeccion(c, 'importar'),
      'cfg-respaldo':   c => configSeccion(c, 'respaldo'),
      'cfg-auditoria':  c => configSeccion(c, 'auditoria'),
    };
    const fn = mapa[panelActivo];
    if (fn) await fn(cont);
    else cont.innerHTML = '<p class="nota" style="padding:20px">Panel en construcción.</p>';
  } catch (e) {
    cont.innerHTML = `<div class="aviso error" style="margin:20px">${esc(mensajeError(e))}</div>`;
  }
}

async function configSeccion(cont, seccion) {
  const m = await import('./config.js');
  await m.render(cont, { seccion, query: new URLSearchParams() });
}

// ══════════════════════════════════════════════════
// PLATAFORMA
// ══════════════════════════════════════════════════

async function panelResumen(el) {
  await cargarEmpresas();
  let totalUsuarios = 0, totalProyectos = 0;
  try {
    const [u, p] = await Promise.all([api.list('profiles', {}), api.list('proyectos', {})]);
    totalUsuarios = u.length;
    totalProyectos = p.length;
  } catch { /* */ }
  const act = todasEmpresas.filter(e => e.activo !== false).length;

  el.innerHTML = cab('Resumen de plataforma', [btn('🖨 Imprimir / PDF A4', 'imprimir')]) +
  `<div class="admin-kpis">
    <div class="admin-kpi"><span class="admin-kpi-num">${act}</span><span class="admin-kpi-txt">Empresas activas</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${todasEmpresas.length - act}</span><span class="admin-kpi-txt">Suspendidas</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${totalUsuarios}</span><span class="admin-kpi-txt">Usuarios registrados</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${totalProyectos}</span><span class="admin-kpi-txt">Proyectos</span></div>
  </div>
  <h3 style="margin:20px 0 10px">Actividad reciente</h3>
  <div class="aviso info">Sin registros de auditoría disponibles.</div>`;

  el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => imprimirPanel(el, 'Resumen de plataforma'));
}

async function panelEmpresas(el) {
  await cargarEmpresas();

  el.innerHTML = cab('Empresas', [
    btn('Eliminar seleccionadas', 'eliminar-sel', 'btn-peligro'),
    btn('+ Nueva empresa', 'nuevo', 'btn-primario'),
  ]) + `<p class="admin-sub">Todas las empresas de la plataforma. Cada empresa es independiente: sus usuarios, proyectos y permisos no se mezclan.</p>
  <div class="admin-filtros">
    <input class="inp" id="buscar-emp" placeholder="Buscar..." style="width:200px">
    <select class="inp" id="fil-estado">
      <option value="">Estado: todos</option>
      <option value="activa">Activa</option>
      <option value="suspendida">Suspendida</option>
    </select>
  </div>
  <div class="tarjeta admin-tabla-wrap">
    <table class="simple" id="tabla-empresas">
      <thead><tr>
        <th style="width:32px"><input type="checkbox" id="chk-all"></th>
        <th>EMPRESA</th><th>SUPER ADMIN</th><th>USUARIOS</th><th>PROYECTOS</th><th>ESTADO</th><th>CREADA</th><th></th>
      </tr></thead>
      <tbody>${todasEmpresas.map(e => `<tr data-id="${e.id}">
        <td><input type="checkbox" class="chk-emp"></td>
        <td><b>${esc(e.nombre)}</b><br><small style="color:var(--gris-txt)">Código ${esc(e.codigo || '—')}</small>
          ${contextoEmpresa?.id === e.id ? ' ' + badge('En uso ahora', '#1565c0') : ''}</td>
        <td>${esc(e.superadmin_nombre || '—')} <button class="btn btn-xs" data-cambiar-sa="${e.id}">Cambiar</button></td>
        <td>— <button class="btn btn-xs" data-gestionar="${e.id}">Gestionar</button></td>
        <td>—</td>
        <td>${badge(e.activo !== false ? 'Activa' : 'Suspendida', e.activo !== false ? '#2e7d32' : '#888')}</td>
        <td>${e.created_at ? fmtFechaHora(e.created_at) : '—'}</td>
        <td>
          <button class="btn btn-xs" data-abrir="${e.id}">Abrir</button>
          <button class="btn btn-xs btn-warn" data-suspender="${e.id}">${e.activo !== false ? 'Suspender' : 'Activar'}</button>
          <button class="btn btn-xs btn-peligro" data-eliminar="${e.id}">Eliminar</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
    <div style="text-align:right;padding:8px;color:var(--gris-txt);font-size:.85em">${todasEmpresas.length} de ${todasEmpresas.length}</div>
  </div>`;

  overlay.querySelector('#chk-all')?.addEventListener('change', e => {
    el.querySelectorAll('.chk-emp').forEach(c => c.checked = e.target.checked);
  });
  el.querySelector('#buscar-emp')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    el.querySelectorAll('#tabla-empresas tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const idAbrir = e.target.closest('[data-abrir]')?.dataset.abrir;
    const idSusp = e.target.closest('[data-suspender]')?.dataset.suspender;
    const idElim = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    const idSa = e.target.closest('[data-cambiar-sa]')?.dataset.cambiarSa;
    const idGest = e.target.closest('[data-gestionar]')?.dataset.gestionar;
    if (a === 'nuevo') { await editarEmpresa(null); await cargarEmpresas(); await renderPanel(); }
    if (idAbrir) abrirEmpresa(todasEmpresas.find(x => x.id === idAbrir));
    if (idSusp) { await suspenderEmpresa(todasEmpresas.find(x => x.id === idSusp)); await cargarEmpresas(); await renderPanel(); }
    if (idElim) { await eliminarEmpresa(todasEmpresas.find(x => x.id === idElim)); await cargarEmpresas(); await renderPanel(); }
    if (idSa) { await cambiarSuperAdmin(todasEmpresas.find(x => x.id === idSa)); }
    if (idGest) gestionarUsuariosEmpresa(todasEmpresas.find(x => x.id === idGest));
  });
}

async function editarEmpresa(e) {
  await pedirDatos({
    titulo: e ? `Editar: ${e.nombre}` : 'Nueva empresa',
    valores: e || {},
    campos: [
      { name: 'nombre', label: 'Nombre de la empresa', required: true },
      { name: 'codigo', label: 'Código corto' },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'pais', label: 'País' },
      { name: 'zona_horaria', label: 'Zona horaria (ej: America/Lima)' },
    ],
    alGuardar: async d => {
      if (e) await api.update('areas', e.id, d);
      else await api.insert('areas', d);
      ok(e ? 'Empresa actualizada.' : 'Empresa creada.');
    },
  });
}

function abrirEmpresa(e) {
  if (!e) return;
  contextoEmpresa = e;
  actualizarSelectores();
  navegarA('emp-usuarios');
}

async function suspenderEmpresa(e) {
  if (!e) return;
  const activar = e.activo === false;
  const si = await confirmar(`¿${activar ? 'Activar' : 'Suspender'} la empresa "${e.nombre}"?`,
    { titulo: activar ? 'Activar' : 'Suspender', texto: activar ? 'Activar' : 'Suspender', peligro: !activar });
  if (!si) return;
  try { await api.update('areas', e.id, { activo: activar }); ok(`Empresa ${activar ? 'activada' : 'suspendida'}.`); }
  catch (err) { error(mensajeError(err)); }
}

async function eliminarEmpresa(e) {
  if (!e) return;
  const si = await confirmar(`¿Eliminar la empresa "${e.nombre}"? Se eliminarán todos sus datos.`,
    { titulo: 'Eliminar empresa', texto: 'Eliminar definitivamente', peligro: true });
  if (!si) return;
  try { await api.removeWhere('areas', { eq: { id: e.id } }); ok('Empresa eliminada.'); }
  catch (err) { error(mensajeError(err)); }
}

async function cambiarSuperAdmin(empresa) {
  if (!empresa) return;
  let perfiles = [];
  try { perfiles = await api.list('profiles', { eq: { area_id: empresa.id, activo: true }, order: [['nombre', true]] }); } catch { /* */ }
  await pedirDatos({
    titulo: `Super admin de: ${empresa.nombre}`,
    campos: [{ name: 'sa_id', label: 'Nuevo super administrador', type: 'select', required: true,
      opciones: perfiles.map(p => ({ value: p.id, label: `${p.nombre} (${p.email || p.codigo || '?'})` })) }],
    alGuardar: async d => {
      await api.update('profiles', d.sa_id, { rol: 'superadmin', es_admin_principal: true });
      ok('Super administrador asignado.');
    },
  });
}

function gestionarUsuariosEmpresa(empresa) {
  if (!empresa) return;
  contextoEmpresa = empresa;
  actualizarSelectores();
  navegarA('emp-usuarios');
}

async function panelEstructura(el) {
  await cargarEmpresas();
  let portafolios = [], programas = [], proyectos = [];
  try {
    [portafolios, programas, proyectos] = await Promise.all([
      api.list('portafolios', { order: [['nombre', true]] }),
      api.list('programas', { order: [['nombre', true]] }),
      api.list('proyectos', { order: [['codigo', true]] }),
    ]);
  } catch { /* */ }

  const sinAdmin = proyectos.filter(p => !p.admin_id).length;
  const colorTipo = { empresa: '#1A365D', portafolio: '#E8762B', programa: '#4E79A7', proyecto: '#59A14F' };

  const filaProyecto = (p, indent) => `<tr class="struct-row">
    <td style="padding-left:${indent}px"><span class="struct-ico">📌</span> ${esc(p.nombre_corto)}</td>
    <td>${badge('Proyecto', colorTipo.proyecto)}</td>
    <td><small>${esc(p.codigo || '—')}</small></td>
    <td>${p.admin_id ? `${esc(nombre(p.admin_id))} <button class="btn btn-xs" data-cambiar-admin="${p.id}">Cambiar</button>`
      : `<span style="color:var(--rojo)">Sin asignar</span> <button class="btn btn-xs" data-cambiar-admin="${p.id}">Asignar</button>`}</td>
    <td><button class="btn btn-xs" data-editar-proy="${p.id}">Editar</button>
        <button class="btn btn-xs" data-miembros-proy="${p.id}">Miembros y permisos</button>
        <button class="btn btn-xs btn-peligro" data-del-proy="${p.id}">Eliminar</button></td>
  </tr>`;

  el.innerHTML = cab('Estructura de todas las empresas', [
    btn('+ Portafolio', 'nuevo-port'),
    btn('+ Programa', 'nuevo-prog'),
    btn('+ Proyecto', 'nuevo-proy', 'btn-primario'),
  ]) + `<p class="admin-sub">Empresa › Portafolio › Programa › Proyecto. Lo que cambies aquí se refleja en el lienzo de proyectos.</p>
  <div class="admin-chips">
    <span class="chip">${todasEmpresas.length} Empresa${todasEmpresas.length !== 1 ? 's' : ''}</span>
    <span class="chip">${portafolios.length} Portafolio${portafolios.length !== 1 ? 's' : ''}</span>
    <span class="chip">${programas.length} Programa${programas.length !== 1 ? 's' : ''}</span>
    <span class="chip">${proyectos.length} Proyecto${proyectos.length !== 1 ? 's' : ''}</span>
    ${sinAdmin ? `<span class="chip chip-warn">${sinAdmin} Proyectos sin administrador</span>` : ''}
  </div>
  <div class="admin-filtros">
    <input class="inp" id="buscar-struct" placeholder="Buscar en la estructura..." style="width:260px">
    <button class="btn btn-sm" id="btn-expandir">Expandir todo</button>
    <button class="btn btn-sm" id="btn-contraer">Contraer todo</button>
  </div>
  <div class="tarjeta admin-tabla-wrap">
    <table class="simple struct-tabla">
      <thead><tr><th>NOMBRE</th><th>TIPO</th><th>CÓDIGO</th><th>ADMINISTRADOR</th><th></th></tr></thead>
      <tbody>${todasEmpresas.map(empresa => {
        const emPorts = portafolios.filter(p => p.area_id === empresa.id);
        const emProysSinPort = proyectos.filter(p => p.area_id === empresa.id && !p.portafolio_id && !p.programa_id);
        return `<tr class="struct-row struct-empresa">
          <td><b>${esc(empresa.nombre)}</b></td>
          <td>${badge('Empresa', colorTipo.empresa)}</td>
          <td><small>${esc(empresa.codigo || '—')}</small></td>
          <td><span style="color:var(--gris-txt);font-size:.85em">Super admin: ver Usuarios</span></td>
          <td>
            <button class="btn btn-xs" data-add-port="${empresa.id}">+ Portafolio</button>
            <button class="btn btn-xs" data-add-prog="${empresa.id}">+ Programa</button>
            <button class="btn btn-xs" data-add-proy="${empresa.id}">+ Proyecto</button>
            <button class="btn btn-xs" data-usuarios="${empresa.id}">Usuarios</button>
          </td>
        </tr>
        ${emPorts.map(port => {
          const portProgs = programas.filter(g => g.portafolio_id === port.id);
          const portProysSinProg = proyectos.filter(p => p.portafolio_id === port.id && !p.programa_id);
          return `<tr class="struct-row struct-portafolio">
            <td style="padding-left:28px">🗂 ${esc(port.nombre)}</td>
            <td>${badge('Portafolio', colorTipo.portafolio)}</td>
            <td><small>${esc(port.codigo || '—')}</small></td>
            <td>—</td>
            <td>
              <button class="btn btn-xs" data-add-prog-port="${port.id}">+ Programa</button>
              <button class="btn btn-xs" data-add-proy-port="${port.id}">+ Proyecto</button>
              <button class="btn btn-xs" data-edit-port="${port.id}">Editar</button>
              <button class="btn btn-xs btn-peligro" data-del-port="${port.id}">Eliminar</button>
            </td>
          </tr>
          ${portProgs.map(prog => `<tr class="struct-row struct-programa">
            <td style="padding-left:52px">📁 ${esc(prog.nombre)}</td>
            <td>${badge('Programa', colorTipo.programa)}</td>
            <td><small>${esc(prog.codigo || '—')}</small></td>
            <td>—</td>
            <td>
              <button class="btn btn-xs" data-add-proy-prog="${prog.id}">+ Proyecto</button>
              <button class="btn btn-xs" data-edit-prog="${prog.id}">Editar</button>
              <button class="btn btn-xs btn-peligro" data-del-prog="${prog.id}">Eliminar</button>
            </td>
          </tr>
          ${proyectos.filter(p => p.programa_id === prog.id).map(p => filaProyecto(p, 76)).join('')}
          `).join('')}
          ${portProysSinProg.map(p => filaProyecto(p, 52)).join('')}
          `;
        }).join('')}
        ${emProysSinPort.map(p => filaProyecto(p, 28)).join('')}
        `;
      }).join('')}</tbody>
    </table>
  </div>`;

  el.querySelector('#btn-expandir')?.addEventListener('click', () => {/* expandir */ });
  el.querySelector('#btn-contraer')?.addEventListener('click', () => {/* contraer */ });
  el.querySelector('#buscar-struct')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    el.querySelectorAll('.struct-tabla tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  el.addEventListener('click', async ev => {
    const addPort = ev.target.closest('[data-add-port]')?.dataset.addPort;
    const addProg = ev.target.closest('[data-add-prog]')?.dataset.addProg;
    const addProgPort = ev.target.closest('[data-add-prog-port]')?.dataset.addProgPort;
    const editPort = ev.target.closest('[data-edit-port]')?.dataset.editPort;
    const delPort = ev.target.closest('[data-del-port]')?.dataset.delPort;
    const editProg = ev.target.closest('[data-edit-prog]')?.dataset.editProg;
    const delProg = ev.target.closest('[data-del-prog]')?.dataset.delProg;
    const usrs = ev.target.closest('[data-usuarios]')?.dataset.usuarios;
    if (addPort) { await editarPortafolio(null, addPort); await renderPanel(); }
    if (addProg) { await editarPrograma(null, null, addProg, []); await renderPanel(); }
    if (addProgPort) { await editarPrograma(null, addProgPort, null, []); await renderPanel(); }
    if (editPort) { const p = portafolios.find(x => x.id === editPort); await editarPortafolio(p, p?.area_id); await renderPanel(); }
    if (delPort) { await eliminarReg('portafolios', portafolios.find(x => x.id === delPort)); await renderPanel(); }
    if (editProg) { const p = programas.find(x => x.id === editProg); await editarPrograma(p, p?.portafolio_id, p?.area_id, portafolios.filter(x => x.area_id === p?.area_id)); await renderPanel(); }
    if (delProg) { await eliminarReg('programas', programas.find(x => x.id === delProg)); await renderPanel(); }
    if (usrs) gestionarUsuariosEmpresa(todasEmpresas.find(x => x.id === usrs));
  });
}

async function panelPropietarios(el) {
  let propietarios = [];
  try { propietarios = await api.list('profiles', { eq: { es_propietario: true }, order: [['nombre', true]] }); } catch { /* */ }

  el.innerHTML = cab('Propietarios', [btn('+ Designar co-propietario', 'nuevo', 'btn-primario')]) +
  `<p class="admin-sub">El propietario controla toda la plataforma. El co-propietario lo reemplaza en su ausencia, con los mismos permisos.</p>
  <div class="tarjeta admin-tabla-wrap" style="margin-top:16px">
    <table class="simple"><thead><tr><th>PERSONA</th><th>ROL</th><th></th></tr></thead>
    <tbody>${propietarios.map(p => `<tr>
      <td><span class="avatar-ico" style="background:${COLOR_ROL.propietario}">${esc((p.nombre || '?')[0].toUpperCase())}</span>
        <b>${esc(p.nombre)}</b><br><small>${esc(p.email || '')}</small></td>
      <td>${badge(p.id === store.usuario?.id ? 'Propietario' : 'Co-propietario', COLOR_ROL.propietario)}</td>
      <td>${p.id !== store.usuario?.id
        ? `<button class="btn btn-xs btn-peligro" data-revocar="${p.id}">Revocar</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>
    <div style="padding:8px;text-align:right;color:var(--gris-txt);font-size:.85em">${propietarios.length} de ${propietarios.length}</div>
  </div>`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const idRev = e.target.closest('[data-revocar]')?.dataset.revocar;
    if (a === 'nuevo') { await asignarCoPropietario(); await renderPanel(); }
    if (idRev) { await revocarPropietario(propietarios.find(p => p.id === idRev)); await renderPanel(); }
  });
}

async function asignarCoPropietario() {
  let perfiles = [];
  try { perfiles = await api.list('profiles', { eq: { activo: true }, order: [['nombre', true]] }); } catch { /* */ }
  await pedirDatos({
    titulo: 'Designar co-propietario de plataforma',
    campos: [{ name: 'usuario_id', label: 'Usuario', type: 'select', required: true,
      opciones: perfiles.filter(p => !p.es_propietario).map(p => ({ value: p.id, label: `${p.nombre} (${p.email || p.codigo || '?'})` })) }],
    alGuardar: async d => { await api.update('profiles', d.usuario_id, { es_propietario: true }); ok('Co-propietario designado.'); },
  });
}

async function revocarPropietario(p) {
  if (!p) return;
  const si = await confirmar(`¿Revocar acceso de propietario a ${p.nombre}?`,
    { titulo: 'Revocar', texto: 'Revocar', peligro: true });
  if (!si) return;
  try { await api.update('profiles', p.id, { es_propietario: false }); ok('Revocado.'); }
  catch (e) { error(mensajeError(e)); }
}

async function panelAuditoria(el) {
  let registros = [];
  try { registros = await api.list('auditoria', { order: [['created_at', false]], limit: 100 }); } catch { /* */ }

  el.innerHTML = cab('Auditoría', [btn('🖨 Imprimir', 'imprimir')]) +
  `<p class="admin-sub">Registro de acciones realizadas en la plataforma.</p>` +
  (!registros.length
    ? '<div class="aviso info" style="margin-top:12px">Sin registros de auditoría. Asegúrese de que exista la tabla <code>auditoria</code> en la base de datos.</div>'
    : tabla(['Fecha', 'Usuario', 'Empresa', 'Acción', 'Detalle'],
        registros.map(r => [fmtFechaHora(r.created_at), esc(r.usuario_nombre || '—'), esc(r.empresa_nombre || '—'),
          `<code>${esc(r.accion || '—')}</code>`, esc(r.detalle || '—')])));

  el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => imprimirPanel(el, 'Auditoría'));
}

async function panelReportes(el) {
  const reportes = [
    { id: 'resumen', ico: '📊', nombre: 'Resumen de plataforma' },
    { id: 'lista-emp', ico: '🏢', nombre: 'Lista de empresas' },
    { id: 'actividad', ico: '📋', nombre: 'Actividad reciente' },
  ];
  let rActivo = reportes[0];

  const renderPrev = async () => {
    const prev = el.querySelector('#reporte-preview');
    if (!prev) return;
    await cargarEmpresas();
    if (rActivo.id === 'resumen') {
      const act = todasEmpresas.filter(e => e.activo !== false).length;
      prev.innerHTML = `<div style="text-align:center;padding:16px">
        <h2 style="margin-bottom:4px">Resumen de plataforma</h2>
        <p style="color:var(--gris-txt);font-size:.85em">Plataforma · ${new Date().toLocaleString('es-PE')}</p>
        <div class="admin-kpis" style="margin:16px 0">
          <div class="admin-kpi"><span class="admin-kpi-num">${act}</span><span class="admin-kpi-txt">Empresas activas</span></div>
          <div class="admin-kpi"><span class="admin-kpi-num">${todasEmpresas.length - act}</span><span class="admin-kpi-txt">Suspendidas</span></div>
        </div>
      </div>`;
    } else if (rActivo.id === 'lista-emp') {
      prev.innerHTML = tabla(['Empresa', 'Código', 'Estado', 'Creada'],
        todasEmpresas.map(e => [esc(e.nombre), esc(e.codigo || '—'),
          e.activo !== false ? 'Activa' : 'Suspendida', e.created_at ? fmtFechaHora(e.created_at) : '—']));
    } else {
      prev.innerHTML = '<p style="padding:16px;color:var(--gris-txt)">Sin registros de actividad.</p>';
    }
  };

  el.innerHTML = cab('Reportes', [btn('🖨 Imprimir / PDF A4', 'imprimir', 'btn-primario')]) +
  `<p class="admin-sub">Selecciona un reporte para ver su vista previa e imprimirlo en PDF.</p>
  <div style="display:flex;gap:16px;margin-top:12px">
    <div style="width:220px;flex-shrink:0">
      ${reportes.map(r => `<button class="admin-rep-btn${rActivo.id === r.id ? ' activo' : ''}" data-rep="${r.id}">${r.ico} ${esc(r.nombre)}</button>`).join('')}
    </div>
    <div class="tarjeta" style="flex:1;min-height:400px;padding:16px" id="reporte-preview">
      <div class="admin-cargando"><span class="spinner"></span></div>
    </div>
  </div>`;

  await renderPrev();
  el.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', async () => {
    rActivo = reportes.find(r => r.id === b.dataset.rep) || rActivo;
    el.querySelectorAll('[data-rep]').forEach(x => x.classList.toggle('activo', x === b));
    await renderPrev();
  }));
  el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => {
    const prev = el.querySelector('#reporte-preview');
    if (prev) {
      const fake = { querySelector: s => prev.querySelector(s), innerHTML: prev.innerHTML };
      imprimirPanel(fake, rActivo.nombre);
    }
  });
}

// ══════════════════════════════════════════════════
// EMPRESA
// ══════════════════════════════════════════════════

async function panelUsuarios(el) {
  const areaId = contextoEmpresa?.id || store.area?.id;
  const perfiles = areaId
    ? (await api.list('profiles', { eq: { area_id: areaId }, order: [['nombre', true]] })).filter(p => !p.eliminado)
    : [];
  const pendientes = perfiles.filter(p => p.rol === 'pendiente' && p.activo);

  el.innerHTML = cab('Usuarios y roles', [
    btn('+ Nuevo usuario', 'nuevo', 'btn-primario'),
    btn('✉ Invitar', 'invitar'),
    btn('🖨 Imprimir', 'imprimir'),
  ]) + (pendientes.length ? `<div class="aviso warn" style="margin-bottom:12px"><b>${pendientes.length} usuario(s) esperan aprobación.</b> Asígneles un rol.</div>` : '') +
  tabla(['', 'Nombre', 'Código', 'Correo', 'Rol', 'Estado', ''],
    perfiles.map(p => [
      `<span class="avatar-ico" style="background:${COLOR_ROL[p.rol] || '#ccc'}">${esc((p.nombre || '?')[0].toUpperCase())}</span>`,
      `<b>${esc(p.nombre)}</b>${p.es_admin_principal ? ' ' + badge('Principal', '#E8762B') : ''}`,
      esc(p.codigo || ''), esc(p.email || ''),
      badge(ROLES[p.rol] || p.rol, COLOR_ROL[p.rol]),
      p.activo ? 'Activo' : '<span style="color:var(--rojo)">Inactivo</span>',
      `<button class="btn btn-xs" data-editar="${p.id}">Editar</button>
       ${puedeRestablecer(p) ? `<button class="btn btn-xs" data-clave="${p.id}">🔑</button>` : ''}
       ${puedeEliminar(p) ? `<button class="btn btn-xs btn-peligro" data-eliminar="${p.id}">🗑</button>` : ''}`,
    ])
  );

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idClave = e.target.closest('[data-clave]')?.dataset.clave;
    const idElim = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    if (a === 'nuevo') { await nuevoUsuario(); await renderPanel(); }
    if (a === 'invitar') mostrarInvitacion();
    if (a === 'imprimir') imprimirPanel(el, 'Usuarios y roles');
    if (id) { await editarUsuario(perfiles.find(p => p.id === id)); await renderPanel(); }
    if (idClave) await restablecerClave(perfiles.find(p => p.id === idClave));
    if (idElim) { await eliminarUsuario(perfiles.find(p => p.id === idElim)); await renderPanel(); }
  });
}

async function panelAreaEmpresa(el) {
  const a = contextoEmpresa || store.area;
  el.innerHTML = cab('Datos de la empresa', [btn('Editar', 'editar', 'btn-primario')]) +
  `<div class="tarjeta"><table class="simple">
    <tr><th style="width:160px">Campo</th><th>Valor</th></tr>
    <tr><td>Nombre</td><td>${esc(a?.nombre || '—')}</td></tr>
    <tr><td>Código</td><td>${esc(a?.codigo || '—')}</td></tr>
    <tr><td>Descripción</td><td>${esc(a?.descripcion || '—')}</td></tr>
    <tr><td>País</td><td>${esc(a?.pais || '—')}</td></tr>
    <tr><td>Zona horaria</td><td>${esc(a?.zona_horaria || '—')}</td></tr>
  </table></div>`;

  el.querySelector('[data-a="editar"]')?.addEventListener('click', async () => {
    await pedirDatos({
      titulo: 'Editar empresa',
      valores: a,
      campos: [
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'codigo', label: 'Código corto' },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'pais', label: 'País' },
        { name: 'zona_horaria', label: 'Zona horaria' },
      ],
      alGuardar: async d => { await api.update('areas', a.id, d); await cargarCatalogo(); ok('Actualizado.'); await renderPanel(); },
    });
  });
}

// ══════════════════════════════════════════════════
// ESTRUCTURA
// ══════════════════════════════════════════════════

async function panelPortafolios(el) {
  const areaId = contextoEmpresa?.id || store.area?.id;
  let lista = [];
  try { lista = await api.list('portafolios', { eq: { area_id: areaId }, order: [['nombre', true]] }); } catch { /* */ }
  el.innerHTML = cab('Portafolios', [btn('+ Nuevo', 'nuevo', 'btn-primario'), btn('🖨 Imprimir', 'imprimir')]) +
  (!lista.length ? '<div class="aviso info">Sin portafolios. Use "+ Nuevo" para crear el primero.</div>' : '') +
  tabla(['Código', 'Nombre', 'Responsable', 'Estado', ''],
    lista.map(p => [esc(p.codigo || ''), `<b>${esc(p.nombre)}</b>`, esc(nombre(p.responsable_id) || '—'),
      badge(p.estado || 'activo', p.estado === 'inactivo' ? '#aaa' : '#2e7d32'),
      `<button class="btn btn-xs" data-editar="${p.id}">Editar</button>
       <button class="btn btn-xs btn-peligro" data-eliminar="${p.id}">🗑</button>`]));
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idE = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    if (a === 'nuevo') { await editarPortafolio(null, areaId); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Portafolios');
    if (id) { await editarPortafolio(lista.find(x => x.id === id), areaId); await renderPanel(); }
    if (idE) { await eliminarReg('portafolios', lista.find(x => x.id === idE)); await renderPanel(); }
  });
}

async function editarPortafolio(p, areaId) {
  await pedirDatos({
    titulo: p ? `Editar: ${p.nombre}` : 'Nuevo portafolio',
    valores: p || { estado: 'activo' },
    campos: [
      { name: 'codigo', label: 'Código' },
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'responsable_id', label: 'Responsable', type: 'select', opciones: optsPersonas(areaId) },
      { name: 'estado', label: 'Estado', type: 'select', opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
    ],
    alGuardar: async d => {
      if (p) await api.update('portafolios', p.id, d);
      else await api.insert('portafolios', { ...d, area_id: areaId || store.area.id });
      ok(p ? 'Actualizado.' : 'Portafolio creado.');
    },
  });
}

async function panelProgramas(el) {
  const areaId = contextoEmpresa?.id || store.area?.id;
  let lista = [], ports = [];
  try {
    [lista, ports] = await Promise.all([
      api.list('programas', { eq: { area_id: areaId }, order: [['nombre', true]] }),
      api.list('portafolios', { eq: { area_id: areaId }, order: [['nombre', true]] }),
    ]);
  } catch { /* */ }
  const portMap = new Map(ports.map(p => [p.id, p.nombre]));
  el.innerHTML = cab('Programas', [btn('+ Nuevo', 'nuevo', 'btn-primario'), btn('🖨 Imprimir', 'imprimir')]) +
  (!lista.length ? '<div class="aviso info">Sin programas registrados.</div>' : '') +
  tabla(['Código', 'Nombre', 'Portafolio', 'Responsable', 'Estado', ''],
    lista.map(p => [esc(p.codigo || ''), `<b>${esc(p.nombre)}</b>`, esc(portMap.get(p.portafolio_id) || '—'),
      esc(nombre(p.responsable_id) || '—'),
      badge(p.estado || 'activo', p.estado === 'inactivo' ? '#aaa' : '#1565c0'),
      `<button class="btn btn-xs" data-editar="${p.id}">Editar</button>
       <button class="btn btn-xs btn-peligro" data-eliminar="${p.id}">🗑</button>`]));
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idE = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    if (a === 'nuevo') { await editarPrograma(null, null, areaId, ports); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Programas');
    if (id) { await editarPrograma(lista.find(x => x.id === id), null, areaId, ports); await renderPanel(); }
    if (idE) { await eliminarReg('programas', lista.find(x => x.id === idE)); await renderPanel(); }
  });
}

async function editarPrograma(p, portId, areaId, ports) {
  if (!ports) {
    try { ports = await api.list('portafolios', { eq: { area_id: areaId || store.area?.id }, order: [['nombre', true]] }); } catch { ports = []; }
  }
  await pedirDatos({
    titulo: p ? `Editar: ${p.nombre}` : 'Nuevo programa',
    valores: p || { estado: 'activo', portafolio_id: portId || null },
    campos: [
      { name: 'codigo', label: 'Código' },
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'portafolio_id', label: 'Portafolio', type: 'select',
        opciones: [{ value: null, label: '— Sin portafolio —' }, ...ports.map(x => ({ value: x.id, label: x.nombre }))] },
      { name: 'responsable_id', label: 'Responsable', type: 'select', opciones: optsPersonas(areaId) },
      { name: 'estado', label: 'Estado', type: 'select', opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
    ],
    alGuardar: async d => {
      if (p) await api.update('programas', p.id, d);
      else await api.insert('programas', { ...d, area_id: areaId || store.area.id });
      ok(p ? 'Actualizado.' : 'Programa creado.');
    },
  });
}

async function panelProyectos(el) {
  const areaId = contextoEmpresa?.id || store.area?.id;
  const proyectos = areaId ? store.proyectos.filter(p => p.area_id === areaId) : store.proyectos;
  let ports = [], progs = [];
  try {
    [ports, progs] = await Promise.all([
      api.list('portafolios', { eq: { area_id: areaId }, order: [['nombre', true]] }),
      api.list('programas', { eq: { area_id: areaId }, order: [['nombre', true]] }),
    ]);
  } catch { /* */ }
  const portMap = new Map(ports.map(p => [p.id, p.nombre]));
  const progMap = new Map(progs.map(p => [p.id, p.nombre]));
  const colorEst = { activo: '#2e7d32', propuesto: '#e65100', en_pausa: '#aaa', cerrado: '#4E79A7', rechazado: '#b71c1c' };

  el.innerHTML = cab('Proyectos', [btn('+ Nuevo proyecto', 'nuevo', 'btn-primario'), btn('🖨 Imprimir', 'imprimir')]) +
  tabla(['Código', 'Nombre', 'Portafolio', 'Programa', 'Estado', ''],
    proyectos.map(p => [
      `<b>${esc(p.codigo)}</b>`, esc(p.nombre_corto),
      esc(portMap.get(p.portafolio_id) || '—'),
      esc(progMap.get(p.programa_id) || '—'),
      badge(p.estado, colorEst[p.estado] || '#666'),
      `<button class="btn btn-xs" data-vincular="${p.id}">Vincular</button>`,
    ])
  );

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const idVinc = e.target.closest('[data-vincular]')?.dataset.vincular;
    if (a === 'imprimir') imprimirPanel(el, 'Proyectos');
    if (idVinc) {
      const p = proyectos.find(x => x.id === idVinc);
      if (!p) return;
      await pedirDatos({
        titulo: `Vincular proyecto: ${p.codigo}`,
        valores: p,
        campos: [
          { name: 'portafolio_id', label: 'Portafolio', type: 'select',
            opciones: [{ value: null, label: '— Sin portafolio —' }, ...ports.map(x => ({ value: x.id, label: x.nombre }))] },
          { name: 'programa_id', label: 'Programa', type: 'select',
            opciones: [{ value: null, label: '— Sin programa —' }, ...progs.map(x => ({ value: x.id, label: x.nombre }))] },
        ],
        alGuardar: async d => { await api.update('proyectos', idVinc, d); await cargarCatalogo(); ok('Vinculado.'); await renderPanel(); },
      });
    }
  });
}

// ══════════════════════════════════════════════════
// Usuarios — helpers
// ══════════════════════════════════════════════════

async function nuevoUsuario() {
  const clave = generarClave();
  await pedirDatos({
    titulo: 'Nuevo usuario',
    campos: [
      { name: 'nombre', label: 'Nombre completo', required: true },
      { name: 'email', label: 'Correo electrónico', type: 'email', required: true },
      { name: 'codigo', label: 'Código corto (iniciales)' },
      { name: 'rol', label: 'Rol', type: 'select', required: true,
        opciones: Object.entries(ROLES).filter(([k]) => !['pendiente', 'propietario'].includes(k)).map(([k, v]) => ({ value: k, label: v })) },
      { name: 'clave', label: 'Contraseña temporal', required: true, valor: clave },
    ],
    alGuardar: async d => {
      ok(`Usuario registrado. Contraseña temporal: ${d.clave}`);
    },
  });
}

async function editarUsuario(p) {
  if (!p) return;
  await pedirDatos({
    titulo: `Editar: ${p.nombre}`,
    valores: p,
    campos: [
      { name: 'nombre', label: 'Nombre completo', required: true },
      { name: 'codigo', label: 'Código corto' },
      { name: 'cargo_id', label: 'Cargo', type: 'select', opciones: opciones('cargos') },
      { name: 'horas_dia', label: 'Horas disponibles / día', type: 'number', min: 0, max: 24, step: 0.5 },
      { name: 'rol', label: 'Rol', type: 'select', required: true,
        opciones: Object.entries(ROLES).filter(([k]) => k !== 'propietario').map(([k, v]) => ({ value: k, label: v })) },
      { name: 'activo', label: 'Activo', type: 'checkbox' },
    ],
    alGuardar: async d => { await api.update('profiles', p.id, d); await cargarCatalogo(); ok('Actualizado.'); },
  });
}

async function restablecerClave(p) {
  if (!p) return;
  const clave = generarClave();
  const si = await confirmar(`¿Restablecer la contraseña de ${p.nombre}?`, { titulo: 'Restablecer', texto: 'Restablecer' });
  if (!si) return;
  try { await api.update('profiles', p.id, { debe_cambiar_clave: true }); ok(`Contraseña temporal: ${clave}`); }
  catch (e) { error(mensajeError(e)); }
}

async function eliminarUsuario(p) {
  if (!p) return;
  const si = await confirmar(`¿Eliminar a ${p.nombre}?`, { titulo: 'Eliminar usuario', texto: 'Eliminar', peligro: true });
  if (!si) return;
  try { await api.update('profiles', p.id, { eliminado: true, activo: false }); await cargarCatalogo(); ok('Eliminado.'); }
  catch (e) { error(mensajeError(e)); }
}

function puedeRestablecer(p) {
  return p.id !== store.usuario?.id && !p.es_admin_principal &&
    (esSuperadmin() || !['superadmin', 'admin', 'delegado'].includes(p.rol));
}
function puedeEliminar(p) {
  return esAdmin() && p.id !== store.usuario?.id && !p.es_admin_principal &&
    (esSuperadmin() || !['superadmin', 'admin'].includes(p.rol));
}

function mostrarInvitacion() {
  const url = location.origin + location.pathname;
  modal({
    titulo: 'Invitar usuarios',
    ancho: 560,
    cuerpo: `<p>Envíe este enlace. Al registrarse quedan <b>pendientes</b> y usted les asigna el rol aquí.</p>
      <input class="inp" style="width:100%" readonly value="${esc(url)}">`,
    botones: [{ texto: 'Copiar enlace', clase: 'btn-primario', accion: async () => { await navigator.clipboard?.writeText(url).catch(() => {}); ok('Enlace copiado.'); } }],
  });
}

// ══════════════════════════════════════════════════
// Utilidades
// ══════════════════════════════════════════════════

function optsPersonas(areaId) {
  const perfs = store.perfiles.filter(p => !p.eliminado && p.activo && (!areaId || p.area_id === areaId));
  return [{ value: null, label: '—' }, ...perfs.map(p => ({ value: p.id, label: p.nombre }))];
}

function generarClave() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const n = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(n, x => c[x % c.length]).join('');
}

async function eliminarReg(tabla, rec) {
  if (!rec) return;
  const si = await confirmar(`¿Eliminar "${esc(rec.nombre)}"?`, { titulo: 'Eliminar', texto: 'Eliminar', peligro: true });
  if (!si) return;
  try { await api.removeWhere(tabla, { eq: { id: rec.id } }); ok('Eliminado.'); }
  catch (e) { error(mensajeError(e)); }
}

function cab(titulo, botones = []) {
  const btns = botones.map(({ texto, accion, clase }) =>
    `<button class="btn btn-sm ${clase || ''}" data-a="${accion}">${texto}</button>`).join('');
  return `<div class="admin-panel-cab"><h2>${titulo}</h2><div class="barra-acciones">${btns}</div></div>`;
}
function btn(texto, accion, clase = '') { return { texto, accion, clase }; }

function tabla(cabeceras, filas) {
  if (!filas.length) return '';
  return `<div class="tarjeta admin-tabla-wrap"><table class="simple">
    <thead><tr>${cabeceras.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(celdas => `<tr>${celdas.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function imprimirPanel(el, titulo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { error('El navegador bloqueó la ventana emergente.'); return; }
  const estilos = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  const content = el.querySelector?.('.tarjeta, .admin-tabla-wrap, .admin-kpis');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${estilos}\n@media print{.no-imprimir,.barra-acciones{display:none!important}body{font-size:11pt}}</style>
    </head><body><h2 style="margin-bottom:12px">${esc(titulo)}</h2>${content?.outerHTML || ''}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
