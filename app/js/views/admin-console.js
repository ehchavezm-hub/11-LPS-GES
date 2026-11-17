// Consola de Administración — LPS-GES
// Barra superior: ⚙ Administración › [Plataforma] › EMPRESA (selector) › PROYECTO (selector).
// Menú PLATAFORMA (propietarios de la plataforma, admin-plataforma.js) y menú EMPRESA (la empresa en la que se trabaja).
// Spec: docs/LPS-GT_Alcance_v0.7.docx sección 6.1-6.2
import { api, mensajeError } from '../data/api.js';
import { store, on, esAdmin, cargarCatalogo, etiqueta, nombre, seleccionarProyecto } from '../core/store.js';
import * as plat from './admin-plataforma.js';
import { ROLES, COLOR_ROL } from '../data/catalogos.js';
import { esc } from '../core/util.js';
import { ok, error, confirmar, pedirDatos, badge } from '../ui/ui.js';

// ---------- Estado ----------
let contenedor = null;
let panelActivo = 'resumen';
let dejarEscuchar = null;

// ---------- Menú ----------
const esPlataforma = () => !!store.usuario?.es_plataforma;
const MENU_PLATAFORMA = [
  { id: 'p-resumen',      ico: '📊', texto: 'Resumen' },
  { id: 'p-empresas',     ico: '🏢', texto: 'Empresas' },
  { id: 'p-usuarios',     ico: '👥', texto: 'Usuarios' },
  { id: 'p-estructura',   ico: '🌳', texto: 'Estructura de todas las empresas' },
  { id: 'p-propietarios', ico: '👑', texto: 'Propietarios' },
  { id: 'p-auditoria',    ico: '📜', texto: 'Auditoría' },
  { id: 'p-reportes',     ico: '📄', texto: 'Reportes' },
];
const MENU_EMPRESA = [
  { id: 'resumen',    ico: '📊', texto: 'Resumen',                 si: esAdmin },
  { id: 'usuarios',   ico: '👤', texto: 'Usuarios y roles',        si: esAdmin },
  { id: 'estructura', ico: '🌐', texto: 'Estructura de la empresa', si: esAdmin },
  { id: 'listas',     ico: '📋', texto: 'Listas',                   si: esAdmin },
  { id: 'parametros', ico: '🔧', texto: 'Parámetros',               si: esAdmin },
  { id: 'permisos',   ico: '🔐', texto: 'Permisos',                  si: esAdmin },
  { id: 'respaldo',   ico: '💾', texto: 'Respaldo',                  si: esAdmin },
  { id: 'auditoria',  ico: '🕑', texto: 'Auditoría',                 si: esAdmin },
];
const MENU_PROYECTO = [
  { id: 'proy-resumen',    ico: '📊', texto: 'Resumen del Proyecto' },
  { id: 'proy-equipo',     ico: '👥', texto: 'Equipo del proyecto' },
  { id: 'proy-grupos',     ico: '🗂️', texto: 'Grupos LPS' },
  { id: 'proy-columnas',   ico: '📐', texto: 'Columnas personalizadas' },
  { id: 'proy-parametros', ico: '🔧', texto: 'Parámetros del proyecto' },
];
const MENU_GRUPO = [
  { id: 'g-resumen',       ico: '📊', texto: 'Resumen del Grupo LPS' },
  { id: 'g-equipo',        ico: '👷', texto: 'Equipo del grupo' },
  { id: 'g-restricciones', ico: '🔒', texto: 'Restricciones activas' },
  { id: 'g-listas',        ico: '📋', texto: 'Listas del grupo' },
];
// alias legacy para no romper referencias internas
const MENU = MENU_EMPRESA;


// ---------- API pública ----------
export function showAdminConsole(panelInicial, el) {
  panelActivo = panelInicial || (esPlataforma() ? 'p-empresas' : 'resumen');
  contenedor = el;
  el.innerHTML = buildShell();
  repintarCabecera();
  el.querySelector('.admin-cerrar').addEventListener('click', cerrarConsola);
  el.querySelector('.admin-topbar').addEventListener('click', e => {
    if (e.target.closest('[data-a="plataforma"]')) navegarA('p-resumen');
  });
  el.querySelector('.admin-topbar').addEventListener('change', async e => {
    const sel = e.target;
    if (sel.matches('[data-sel="empresa"]')) {
      const destino = { id: sel.value, nombre: sel.selectedOptions[0]?.textContent };
      sel.value = store.area?.id;
      try { await plat.abrirEmpresa(destino); } catch (err) { error(mensajeError(err)); }
    }
    if (sel.matches('[data-sel="proyecto"]') && sel.value) {
      const grupo = !!store.proyectos.find(p => p.id === sel.value)?.padre_id;
      seleccionarProyecto(sel.value);
      repintarCabecera();
      ok(`${grupo ? 'Grupo LPS' : 'Proyecto'} seleccionado: el plan, el Look Ahead y los reportes se filtran por él.`);
    }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarConsola(); });
  el.querySelector('.admin-nav').addEventListener('click', e => {
    const item = e.target.closest('[data-panel]');
    if (item) navegarA(item.dataset.panel);
  });
  pintarMenu();
  renderPanel();
  const dejarCatalogo = on('catalogo', () => { pintarMenu(); });
  // Si se elige otro proyecto o Grupo LPS en el menú lateral, la barra superior lo refleja
  const dejarProyecto = on('proyecto', () => repintarCabecera());
  dejarEscuchar = () => { dejarCatalogo(); dejarProyecto(); };
  setTimeout(() => contenedor?.querySelector('#admin-contenido')?.focus(), 50);
}

export function cerrarConsola() {
  dejarEscuchar?.();
  dejarEscuchar = null;
  contenedor = null;
  location.hash = '#/tablero';
}

function buildShell() {
  return `<div class="admin-inner">
    <div class="admin-topbar">
      <span class="admin-topbar-ico">⚙</span>
      <span class="admin-topbar-titulo">Administración</span>
      <span class="admin-migas"></span>
      <span class="flex"></span>
      <button class="admin-cerrar" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
    </div>
    <div class="admin-body">
      <aside class="admin-lateral">
        <nav class="admin-nav" aria-label="Navegación de administración"></nav>
      </aside>
      <main class="admin-contenido" id="admin-contenido" tabindex="-1">
        <div class="admin-cargando"><span class="spinner"></span></div>
      </main>
    </div>
  </div>`;
}

// Migas: [Plataforma] › EMPRESA (selector) › PROYECTO o GRUPO LPS (selector)
async function repintarCabecera() {
  const migas = contenedor?.querySelector('.admin-migas');
  if (!migas) return;
  let empresas = [{ id: store.area?.id, nombre: store.area?.nombre || 'Empresa' }];
  if (esPlataforma()) {
    // Las mismas empresas que usan los paneles de la plataforma (una sola descarga)
    try { empresas = plat.empresasEnMemoria() || (await plat.cargarPlataforma()).areas || empresas; } catch { /* se muestra solo la propia */ }
  }
  const proyectos = (store.proyectos || []).filter(p => !['cerrado', 'rechazado'].includes(p.estado));
  // Cada Grupo LPS va justo debajo de su proyecto
  const ordenados = proyectos.filter(p => !p.padre_id || !proyectos.some(x => x.id === p.padre_id))
    .flatMap(p => [p, ...proyectos.filter(h => h.padre_id === p.id)]);
  const grupoSel = !!proyectos.find(p => p.id === store.proyectoSel)?.padre_id;
  migas.innerHTML = `${esPlataforma() ? `<button class="admin-miga-plat${panelActivo.startsWith('p-') ? ' activo' : ''}" data-a="plataforma">Plataforma</button><span class="admin-miga-sep">›</span>` : ''}
    <label class="admin-miga-sel"><span>EMPRESA</span><select data-sel="empresa" ${esPlataforma() ? '' : 'disabled'}>
      ${empresas.map(e => `<option value="${e.id}" ${e.id === store.area?.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
    <span class="admin-miga-sep">›</span>
    <label class="admin-miga-sel"><span>${grupoSel ? 'GRUPO LPS' : 'PROYECTO'}</span><select data-sel="proyecto"><option value="">Elegir proyecto o Grupo LPS…</option>
      ${ordenados.map(p => `<option value="${p.id}" ${p.id === store.proyectoSel ? 'selected' : ''}>${p.padre_id ? '↳ ' : ''}${esc(p.codigo)} · ${esc(p.nombre_corto)}${p.padre_id ? ' (Grupo LPS)' : ''}</option>`).join('')}</select></label>`;
}

// ---------- Navegación ----------
function pintarMenu() {
  const nav = contenedor?.querySelector('.admin-nav');
  if (!nav) return;
  const item = m => `<button class="admin-item${panelActivo === m.id ? ' activo' : ''}" data-panel="${m.id}">
      <span class="admin-ico">${m.ico}</span><span class="admin-txt">${esc(m.texto)}</span></button>`;
  const empresaItems = MENU_EMPRESA.filter(m => !m.si || m.si());
  // Separar proyecto del grupo LPS seleccionado
  const selEntry = store.proyectoSel ? (store.proyectos || []).find(p => p.id === store.proyectoSel) : null;
  const esGrupoSel = !!selEntry?.padre_id;
  const proySelObj = esGrupoSel ? (store.proyectos || []).find(p => p.id === selEntry?.padre_id) : selEntry;
  const grupoSelObj = esGrupoSel ? selEntry : null;
  const proyLabel = proySelObj ? `${esc(proySelObj.codigo)} · ${esc(proySelObj.nombre_corto)}` : 'Sin proyecto seleccionado';
  const grupoLabel = grupoSelObj ? `${esc(grupoSelObj.codigo)} · ${esc(grupoSelObj.nombre_corto)}` : 'Sin grupo seleccionado';
  nav.innerHTML =
    (esPlataforma()
      ? `<div class="admin-nav-nivel">NIVEL 1 · PLATAFORMA</div>${MENU_PLATAFORMA.map(item).join('')}`
      : '') +
    `<div class="admin-nav-nivel ${esPlataforma() ? 'admin-nav-nivel-sep' : ''}">NIVEL 2 · EMPRESA<span class="admin-nav-nivel-sub">${esc(store.area?.nombre || '')}</span></div>` +
    empresaItems.map(item).join('') +
    `<div class="admin-nav-nivel admin-nav-nivel-sep">NIVEL 3 · PROYECTO<span class="admin-nav-nivel-sub">${proyLabel}</span></div>` +
    MENU_PROYECTO.map(item).join('') +
    `<div class="admin-nav-nivel admin-nav-nivel-sep">NIVEL 4 · GRUPO LPS<span class="admin-nav-nivel-sub">${grupoLabel}</span></div>` +
    MENU_GRUPO.map(item).join('');
}

function navegarA(id) {
  panelActivo = id;
  pintarMenu();
  contenedor?.querySelector('.admin-miga-plat')?.classList.toggle('activo', id.startsWith('p-'));
  renderPanel();
}

async function renderPanel() {
  const previo = contenedor?.querySelector('#admin-contenido');
  if (!previo) return;
  const cont = document.createElement('main');
  cont.className = 'admin-contenido';
  cont.id = 'admin-contenido';
  cont.tabIndex = -1;
  cont.innerHTML = '<div class="admin-cargando"><span class="spinner"></span></div>';
  previo.replaceWith(cont);
  if (panelActivo.startsWith('p-') && !esPlataforma()) panelActivo = 'resumen';
  try {
    const ctx = { navegarA };
    const config = seccion => el => plat.panelConfiguracion(el, seccion, ctx);
    const mapa = {
      'p-resumen':     el => plat.panelResumenPlataforma(el, ctx),
      'p-empresas':    el => plat.panelEmpresas(el, ctx),
      'p-usuarios':    el => plat.panelUsuariosPlataforma(el, ctx),
      'p-estructura':  el => plat.panelEstructuraTodas(el, ctx),
      'p-propietarios': el => plat.panelPropietarios(el, ctx),
      'p-auditoria':   el => plat.panelAuditoriaPlataforma(el, ctx),
      'p-reportes':    el => plat.panelReportesPlataforma(el, ctx),
      'resumen':      panelResumen,
      'usuarios':     config('usuarios'),
      'estructura':   el => plat.panelEstructuraEmpresa(el, ctx),
      'listas':       config('listas'),
      'parametros':   config('parametros'),
      'permisos':     config('permisos'),
      'respaldo':     config('respaldo'),
      'auditoria':    config('auditoria'),
      'proy-resumen':    panelResumenProyecto,
      'proy-equipo':     panelProyEquipo,
      'proy-grupos':     panelProyGrupos,
      'proy-columnas':   panelProyColumnas,
      'proy-parametros': panelProyParametros,
      'g-resumen':       panelResumenGrupo,
      'g-equipo':        panelGrupoEquipo,
      'g-restricciones': panelGrupoRestricciones,
      'g-listas':        panelGrupoListas,
    };
    const fn = mapa[panelActivo];
    if (fn) await fn(cont);
    else cont.innerHTML = '<p class="nota" style="padding:20px">Panel en construcción.</p>';
  } catch (err) {
    cont.innerHTML = `<div class="aviso error" style="margin:20px">${mensajeError(err)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// RESUMEN EMPRESA (NIVEL 2)
// ════════════════════════════════════════════════════════════════

async function panelResumen(el) {
  const [proyectos, usuarios, perfiles] = await Promise.all([
    api.list('proyectos', { eq: { area_id: store.area.id } }),
    api.list('profiles', { eq: { area_id: store.area.id } }),
    api.list('profiles', { eq: { area_id: store.area.id, activo: true } }).catch(() => []),
  ]);
  const activos = proyectos.filter(p => p.estado === 'activo');
  const propuestos = proyectos.filter(p => p.estado === 'propuesto');
  const sinRol = usuarios.filter(u => !u.rol || u.rol === 'pendiente');
  el.innerHTML = cab('Resumen de la empresa') +
    `<div class="admin-kpis">
      <div class="admin-kpi"><span class="admin-kpi-num">${activos.length}</span><span class="admin-kpi-txt">Proyectos activos</span></div>
      <div class="admin-kpi${propuestos.length ? ' alerta' : ''}"><span class="admin-kpi-num">${propuestos.length}</span><span class="admin-kpi-txt">Propuestos</span></div>
      <div class="admin-kpi"><span class="admin-kpi-num">${perfiles.length}</span><span class="admin-kpi-txt">Usuarios activos</span></div>
      <div class="admin-kpi${sinRol.length ? ' alerta' : ''}"><span class="admin-kpi-num">${sinRol.length}</span><span class="admin-kpi-txt">Sin rol asignado</span></div>
    </div>
    ${propuestos.length ? `<div class="aviso warn"><b>${propuestos.length} proyecto(s) esperan aprobación.</b>
      <button class="btn btn-sm btn-primario" data-a="ir-proyectos" style="margin-left:12px">Ver proyectos →</button></div>` : ''}
    ${sinRol.length ? `<div class="aviso warn" style="margin-top:8px"><b>${sinRol.length} usuario(s) sin rol.</b>
      <button class="btn btn-sm" data-a="ir-usuarios" style="margin-left:12px">Ver usuarios →</button></div>` : ''}`;
  el.querySelector('[data-a="ir-proyectos"]')?.addEventListener('click', () => navegarA('estructura'));
  el.querySelector('[data-a="ir-usuarios"]')?.addEventListener('click', () => navegarA('usuarios'));
}

// ════════════════════════════════════════════════════════════════
// RESUMEN PROYECTO (NIVEL 3)
// ════════════════════════════════════════════════════════════════

async function panelResumenProyecto(el) {
  const selEntry = store.proyectoSel ? (store.proyectos || []).find(p => p.id === store.proyectoSel) : null;
  const p = selEntry?.padre_id
    ? (store.proyectos || []).find(x => x.id === selEntry.padre_id)
    : selEntry;
  if (!p) {
    el.innerHTML = '<p class="nota" style="padding:20px">Seleccione un Proyecto en la barra superior para ver su resumen.</p>';
    return;
  }
  const grupos = (store.proyectos || []).filter(x => x.padre_id === p.id);
  el.innerHTML = `<div style="padding:24px"><h2>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h2>
    <p class="nota">${grupos.length} Grupo${grupos.length !== 1 ? 's' : ''} LPS asociado${grupos.length !== 1 ? 's' : ''} a este proyecto.</p>
    <p class="nota">Los paneles de Proyecto se ampliarán en la próxima versión.</p></div>`;
}

// ════════════════════════════════════════════════════════════════
// RESUMEN GRUPO LPS (NIVEL 4)
// ════════════════════════════════════════════════════════════════

async function panelResumenGrupo(el) {
  const selEntry = store.proyectoSel ? (store.proyectos || []).find(x => x.id === store.proyectoSel) : null;
  // Solo mostrar si se seleccionó un Grupo LPS (tiene padre_id)
  const g = selEntry?.padre_id ? selEntry : null;
  if (!g) {
    el.innerHTML = '<p class="nota" style="padding:20px">Seleccione un Grupo LPS en la barra superior para ver su resumen.</p>';
    return;
  }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(g.codigo)} · ${esc(g.nombre_corto)}</h2>
    <p class="nota">Los paneles del Grupo LPS se definirán en la próxima versión.</p></div>`;
}

// ════════════════════════════════════════════════════════════════
// PANELES NIVEL 3 · PROYECTO
// ════════════════════════════════════════════════════════════════

function _proyActivo() {
  const sel = store.proyectoSel ? (store.proyectos || []).find(p => p.id === store.proyectoSel) : null;
  return sel?.padre_id ? (store.proyectos || []).find(p => p.id === sel.padre_id) : sel;
}
function _msgSinProy(el) {
  el.innerHTML = '<p class="nota" style="padding:20px">Seleccione un Proyecto en la barra superior.</p>';
}

async function panelProyEquipo(el) {
  const p = _proyActivo();
  if (!p) { _msgSinProy(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h2>
    <p class="nota">Panel <b>Equipo del proyecto</b> — próxima versión.</p></div>`;
}

async function panelProyGrupos(el) {
  const p = _proyActivo();
  if (!p) { _msgSinProy(el); return; }
  const grupos = (store.proyectos || []).filter(x => x.padre_id === p.id);
  el.innerHTML = `<div style="padding:24px"><h2>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h2>
    <p class="nota">${grupos.length} Grupo${grupos.length !== 1 ? 's' : ''} LPS en este proyecto:</p>
    ${grupos.length ? `<ul style="margin-top:8px">${grupos.map(g =>
      `<li><b>${esc(g.codigo)}</b> · ${esc(g.nombre_corto)}</li>`).join('')}</ul>` : ''}
    <p class="nota" style="margin-top:16px">Gestión completa de Grupos LPS — próxima versión.</p></div>`;
}

async function panelProyColumnas(el) {
  const p = _proyActivo();
  if (!p) { _msgSinProy(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h2>
    <p class="nota">Panel <b>Columnas personalizadas</b> del proyecto — próxima versión.</p></div>`;
}

async function panelProyParametros(el) {
  const p = _proyActivo();
  if (!p) { _msgSinProy(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(p.codigo)} · ${esc(p.nombre_corto)}</h2>
    <p class="nota">Panel <b>Parámetros del proyecto</b> — próxima versión.</p></div>`;
}

// ════════════════════════════════════════════════════════════════
// PANELES NIVEL 4 · GRUPO LPS
// ════════════════════════════════════════════════════════════════

function _grupoActivo() {
  const sel = store.proyectoSel ? (store.proyectos || []).find(p => p.id === store.proyectoSel) : null;
  return sel?.padre_id ? sel : null;
}
function _msgSinGrupo(el) {
  el.innerHTML = '<p class="nota" style="padding:20px">Seleccione un Grupo LPS en la barra superior.</p>';
}

async function panelGrupoEquipo(el) {
  const g = _grupoActivo();
  if (!g) { _msgSinGrupo(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(g.codigo)} · ${esc(g.nombre_corto)}</h2>
    <p class="nota">Panel <b>Equipo del grupo</b> — próxima versión.</p></div>`;
}

async function panelGrupoRestricciones(el) {
  const g = _grupoActivo();
  if (!g) { _msgSinGrupo(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(g.codigo)} · ${esc(g.nombre_corto)}</h2>
    <p class="nota">Panel <b>Restricciones activas</b> del grupo — próxima versión.</p></div>`;
}

async function panelGrupoListas(el) {
  const g = _grupoActivo();
  if (!g) { _msgSinGrupo(el); return; }
  el.innerHTML = `<div style="padding:24px"><h2>${esc(g.codigo)} · ${esc(g.nombre_corto)}</h2>
    <p class="nota">Panel <b>Listas del grupo</b> — próxima versión.</p></div>`;
}

// ════════════════════════════════════════════════════════════════
// PROYECTOS / PROCESOS
// ════════════════════════════════════════════════════════════════

async function panelProyectos(el) {
  const [proyectos, portafolios, programas, lideresProy] = await Promise.all([
    api.list('proyectos', { eq: { area_id: store.area.id }, order: [['codigo', true]] }),
    api.list('portafolios', { eq: { area_id: store.area.id } }).catch(() => []),
    api.list('programas', { eq: { area_id: store.area.id } }).catch(() => []),
    api.list('proyecto_lideres', {}).catch(() => []),
  ]);
  const colorEst = { activo: '#2e7d32', propuesto: '#e65100', en_pausa: '#795548', cerrado: '#546E7A', rechazado: '#b71c1c' };
  const labelEst = { activo: 'Activo', propuesto: 'Propuesto', en_pausa: 'En pausa', cerrado: 'Cerrado', rechazado: 'Rechazado' };
  const nomPort = id => portafolios.find(x => x.id === id)?.nombre || '—';
  const nomProg = id => programas.find(x => x.id === id)?.nombre || '—';
  const lidNames = p => lideresProy.filter(l => l.proyecto_id === p.id).map(l => nombre(l.usuario_id)).filter(Boolean).join(', ');
  el.innerHTML = cab('Proyectos y procesos', [
    btn('+ Nuevo proyecto', 'nuevo', 'btn-primario'),
    btn('⎙ Imprimir', 'imprimir'),
  ]) +
  tabla(
    ['CÓDIGO', 'NOMBRE', 'PORTAFOLIO', 'PROGRAMA', 'LÍDERES', 'ESTADO', ''],
    proyectos.filter(p => !p.padre_id).map(p => [
      `<b>${esc(p.codigo)}</b>`,
      esc(p.nombre_corto),
      esc(nomPort(p.portafolio_id)),
      esc(nomProg(p.programa_id)),
      esc(lidNames(p) || '—'),
      badge(labelEst[p.estado] || p.estado, colorEst[p.estado] || '#888'),
      `<button class="btn btn-xs" data-editar="${p.id}">Editar</button>
       ${p.estado === 'propuesto' ? `
         <button class="btn btn-xs btn-primario" data-aprobar="${p.id}">Aprobar</button>
         <button class="btn btn-xs btn-warn" data-rechazar="${p.id}">Rechazar</button>` : ''}
       ${['cerrado', 'rechazado', 'propuesto'].includes(p.estado) ? '' :
         `<button class="btn btn-xs btn-warn" data-estado="${p.id}" data-nuevo-est="${p.estado === 'activo' ? 'en_pausa' : 'activo'}">
           ${p.estado === 'activo' ? 'Pausar' : 'Activar'}</button>`}`,
    ])
  );
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const idEdit = e.target.closest('[data-editar]')?.dataset.editar;
    const idAprob = e.target.closest('[data-aprobar]')?.dataset.aprobar;
    const idRech = e.target.closest('[data-rechazar]')?.dataset.rechazar;
    const idEst = e.target.closest('[data-estado]')?.dataset.estado;
    const nuevoEst = e.target.closest('[data-estado]')?.dataset.nuevoEst;
    const { formularioProyecto } = await import('./proyectos.js');
    if (a === 'nuevo') { await formularioProyecto(); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Proyectos y procesos');
    if (idEdit) { await formularioProyecto(proyectos.find(p => p.id === idEdit)); await renderPanel(); }
    if (idAprob) { await cambiarEstadoProy(idAprob, 'activo', { aprobado_por: store.usuario.id, aprobado_at: new Date().toISOString() }); await cargarCatalogo(); await renderPanel(); }
    if (idRech) { await rechazarProyecto(proyectos.find(p => p.id === idRech)); await cargarCatalogo(); await renderPanel(); }
    if (idEst && nuevoEst) { await cambiarEstadoProy(idEst, nuevoEst); await cargarCatalogo(); await renderPanel(); }
  });
}

// ESTRUCTURA: EMPRESA › PORTAFOLIO › PROGRAMA › PROYECTO
async function cargarEstructura() {
  const [portafolios, programas, proyectos] = await Promise.all([
    api.list('portafolios', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
    api.list('programas', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
    api.list('proyectos', { eq: { area_id: store.area.id }, order: [['codigo', true]] }),
  ]);
  return { portafolios, programas, proyectos };
}

const estadoEst = e => e === 'inactivo' ? badge('Inactivo', '#888') : badge('Activo', '#2e7d32');

async function panelEstructura(el) {
  const [{ portafolios, programas, proyectos }, lideresProy] = await Promise.all([
    cargarEstructura(),
    api.list('proyecto_lideres', {}).catch(() => []),
  ]);
  const colorEst = { activo: '#2e7d32', propuesto: '#e65100', en_pausa: '#795548', cerrado: '#546E7A', rechazado: '#b71c1c' };
  const labelEst = { activo: 'Activo', propuesto: 'Propuesto', en_pausa: 'En pausa', cerrado: 'Cerrado', rechazado: 'Rechazado' };
  const propuestos = proyectos.filter(p => p.estado === 'propuesto');
  const lidNames = p => lideresProy.filter(l => l.proyecto_id === p.id).map(l => nombre(l.usuario_id)).filter(Boolean).join(', ');
  const itemProy = (p, filtroEst, q) => {
    const ger = etiqueta(p.gerencia_id);
    const lids = lidNames(p);
    const subs = proyectos.filter(x => x.padre_id === p.id).filter(x =>
      (!filtroEst || x.estado === filtroEst) &&
      (!q || `${x.codigo} ${x.nombre_corto}`.toLowerCase().includes(q)));
    return `<li class="est-proy" data-est="${p.estado}">
      <div class="est-proy-fila">
        <span class="est-proy-nombre"><b>${esc(p.codigo)}</b> · ${esc(p.nombre_corto)}</span>
        <span class="est-proy-meta">
          ${badge(labelEst[p.estado] || p.estado, colorEst[p.estado] || '#888')}
          ${ger ? `<small class="nota" style="margin-left:4px">${esc(ger)}</small>` : ''}
          ${lids ? `<small class="nota" style="margin-left:4px">👤 ${esc(lids)}</small>` : ''}
        </span>
        <span class="est-proy-acc">
          <button class="btn btn-xs" data-editar="${p.id}">Editar</button>
          ${p.estado === 'propuesto' ? `
            <button class="btn btn-xs btn-primario" data-aprobar="${p.id}">Aprobar</button>
            <button class="btn btn-xs btn-warn" data-rechazar="${p.id}">Rechazar</button>` : ''}
          ${['cerrado', 'rechazado', 'propuesto'].includes(p.estado) ? '' :
            `<button class="btn btn-xs btn-warn" data-estado="${p.id}" data-nuevo-est="${p.estado === 'activo' ? 'en_pausa' : 'activo'}">
              ${p.estado === 'activo' ? 'Pausar' : 'Activar'}</button>`}
        </span>
      </div>
      ${subs.length ? `<ul>${subs.map(x => itemProy(x, filtroEst, q)).join('')}</ul>` : ''}
    </li>`;
  };
  const buildArbol = (filtroEst = '', q = '') => {
    const pasaFiltro = p => {
      const ok = (!filtroEst || p.estado === filtroEst) && (!q || `${p.codigo} ${p.nombre_corto}`.toLowerCase().includes(q));
      const tieneSubs = proyectos.filter(x => x.padre_id === p.id).some(x =>
        (!filtroEst || x.estado === filtroEst) && (!q || `${x.codigo} ${x.nombre_corto}`.toLowerCase().includes(q)));
      return ok || tieneSubs;
    };
    const ramaPrograma = g => {
      const ps = proyectos.filter(p => p.programa_id === g.id && !p.padre_id).filter(pasaFiltro);
      if (!ps.length && filtroEst) return '';
      return `<li><span class="est-prog">📁 ${esc(g.nombre)}</span> ${g.estado === 'inactivo' ? estadoEst(g.estado) : ''}
        <small class="nota">${ps.length} proyecto(s)</small>${ps.length ? `<ul>${ps.map(p => itemProy(p, filtroEst, q)).join('')}</ul>` : ''}</li>`;
    };
    const ramaPortafolio = f => {
      const gs = programas.filter(g => g.portafolio_id === f.id);
      const ps = proyectos.filter(p => p.portafolio_id === f.id && !p.programa_id && !p.padre_id).filter(pasaFiltro);
      const gsConProy = gs.filter(g => proyectos.filter(p => p.programa_id === g.id && !p.padre_id).some(pasaFiltro));
      if (!ps.length && !gsConProy.length && filtroEst) return '';
      return `<li><span class="est-port">🗂 ${esc(f.nombre)}</span> ${f.estado === 'inactivo' ? estadoEst(f.estado) : ''}
        <ul>${gs.map(ramaPrograma).join('')}${ps.map(p => itemProy(p, filtroEst, q)).join('')}${!gs.length && !ps.length ? '<li class="nota">Sin programas ni proyectos</li>' : ''}</ul></li>`;
    };
    const progSueltos = programas.filter(g => !g.portafolio_id).filter(g =>
      proyectos.filter(p => p.programa_id === g.id && !p.padre_id).some(pasaFiltro));
    const proySueltos = proyectos.filter(p => !p.portafolio_id && !p.programa_id && !p.padre_id).filter(pasaFiltro);
    return `<div class="tarjeta est-arbol"><ul>
      <li><span class="est-emp">🏢 ${esc(store.area?.nombre || 'Empresa')}</span>
        <ul>${portafolios.map(ramaPortafolio).join('')}
          ${progSueltos.length ? `<li><span class="est-port nota">Programas sin portafolio</span><ul>${progSueltos.map(ramaPrograma).join('')}</ul></li>` : ''}
          ${proySueltos.length ? `<li><span class="est-port nota">Proyectos sin portafolio ni programa</span><ul>${proySueltos.map(p => itemProy(p, filtroEst, q)).join('')}</ul></li>` : ''}
        </ul></li></ul></div>`;
  };
  el.innerHTML = cab('Estructura de la empresa', [
    btn('+ Nuevo proyecto', 'nuevo', 'btn-primario'),
    btn('⎙ Imprimir', 'imprimir'),
  ]) +
  (propuestos.length ? `<div class="aviso warn" style="margin-bottom:12px"><b>${propuestos.length} proyecto(s) propuesto(s) esperan aprobación.</b></div>` : '') +
  `<div class="admin-filtros">
    <input class="inp" id="buscar-est" placeholder="Buscar por código o nombre..." style="width:220px">
    <select class="inp" id="fil-port-est"><option value="">Portafolio: todos</option>
      ${portafolios.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select>
    <select class="inp" id="fil-est-arbol"><option value="">Estado: todos</option>
      <option value="activo">Activo</option>
      <option value="propuesto">Propuesto</option>
      <option value="en_pausa">En pausa</option>
      <option value="cerrado">Cerrado</option>
      <option value="rechazado">Rechazado</option>
    </select>
  </div>
  <div id="est-arbol-cont">${buildArbol()}</div>`;
  const refrescar = () => {
    const q = (el.querySelector('#buscar-est')?.value || '').toLowerCase();
    const portFil = el.querySelector('#fil-port-est')?.value || '';
    const filtroEst = el.querySelector('#fil-est-arbol')?.value || '';
    // Si hay filtro por portafolio, filtramos proyectos con ese portafolio
    const qFinal = q;
    const estFinal = filtroEst;
    el.querySelector('#est-arbol-cont').innerHTML = buildArbol(estFinal, qFinal);
    // Ocultar portafolios que no coinciden con el filtro de portafolio
    if (portFil) {
      el.querySelectorAll('.est-arbol > ul > li > ul > li').forEach(li => {
        // Verificar si este li corresponde al portafolio seleccionado
        // No tenemos data-port en los li del árbol, así que buscamos por contenido
      });
    }
  };
  el.querySelector('#buscar-est')?.addEventListener('input', refrescar);
  el.querySelector('#fil-port-est')?.addEventListener('change', refrescar);
  el.querySelector('#fil-est-arbol')?.addEventListener('change', refrescar);
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const idEdit = e.target.closest('[data-editar]')?.dataset.editar;
    const idAprob = e.target.closest('[data-aprobar]')?.dataset.aprobar;
    const idRech = e.target.closest('[data-rechazar]')?.dataset.rechazar;
    const idEst = e.target.closest('[data-estado]')?.dataset.estado;
    const nuevoEst = e.target.closest('[data-estado]')?.dataset.nuevoEst;
    if (a === 'imprimir') { imprimirPanel(el, 'Estructura de la empresa'); return; }
    const { formularioProyecto } = await import('./proyectos.js');
    if (a === 'nuevo') { await formularioProyecto(); await cargarCatalogo(); await renderPanel(); }
    if (idEdit) { await formularioProyecto(proyectos.find(p => p.id === idEdit)); await cargarCatalogo(); await renderPanel(); }
    if (idAprob) { await cambiarEstadoProy(idAprob, 'activo', { aprobado_por: store.usuario.id, aprobado_at: new Date().toISOString() }); await cargarCatalogo(); await renderPanel(); }
    if (idRech) { await rechazarProyecto(proyectos.find(p => p.id === idRech)); await cargarCatalogo(); await renderPanel(); }
    if (idEst && nuevoEst) { await cambiarEstadoProy(idEst, nuevoEst); await cargarCatalogo(); await renderPanel(); }
  });
}

async function panelPortafolios(el) {
  const { portafolios, programas, proyectos } = await cargarEstructura();
  el.innerHTML = cab('Portafolios', [btn('+ Nuevo portafolio', 'nuevo', 'btn-primario')]) +
    `<p class="admin-sub">Agrupan programas y proyectos de la empresa.</p>` +
    tabla(['CÓDIGO', 'NOMBRE', 'RESPONSABLE', 'PROGRAMAS', 'PROYECTOS', 'ESTADO', ''], portafolios.map(f => [
      `<b>${esc(f.codigo || '—')}</b>`, esc(f.nombre), esc(f.responsable_id ? nombre(f.responsable_id) : '—'),
      programas.filter(g => g.portafolio_id === f.id).length, proyectos.filter(p => p.portafolio_id === f.id).length,
      estadoEst(f.estado),
      `<button class="btn btn-xs" data-editar="${f.id}">Editar</button>
       <button class="btn btn-xs btn-warn" data-estado="${f.id}">${f.estado === 'inactivo' ? 'Activar' : 'Desactivar'}</button>`]));
  el.addEventListener('click', async e => {
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idEst = e.target.closest('[data-estado]')?.dataset.estado;
    if (e.target.closest('[data-a="nuevo"]')) { if (await editarNodo('portafolios', null, { portafolios })) renderPanel(); }
    if (id) { if (await editarNodo('portafolios', portafolios.find(x => x.id === id), { portafolios })) renderPanel(); }
    if (idEst) { await cambiarEstadoNodo('portafolios', portafolios.find(x => x.id === idEst)); renderPanel(); }
  });
}

async function panelProgramas(el) {
  const { portafolios, programas, proyectos } = await cargarEstructura();
  const nomPort = id => portafolios.find(x => x.id === id)?.nombre || '—';
  el.innerHTML = cab('Programas', [btn('+ Nuevo programa', 'nuevo', 'btn-primario')]) +
    `<p class="admin-sub">Un programa agrupa proyectos relacionados y pertenece a un portafolio.</p>` +
    tabla(['CÓDIGO', 'NOMBRE', 'PORTAFOLIO', 'RESPONSABLE', 'PROYECTOS', 'ESTADO', ''], programas.map(g => [
      `<b>${esc(g.codigo || '—')}</b>`, esc(g.nombre), esc(nomPort(g.portafolio_id)), esc(g.responsable_id ? nombre(g.responsable_id) : '—'),
      proyectos.filter(p => p.programa_id === g.id).length, estadoEst(g.estado),
      `<button class="btn btn-xs" data-editar="${g.id}">Editar</button>
       <button class="btn btn-xs" data-proyectos="${g.id}">Proyectos→</button>
       <button class="btn btn-xs btn-warn" data-estado="${g.id}">${g.estado === 'inactivo' ? 'Activar' : 'Desactivar'}</button>`]));
  el.addEventListener('click', async e => {
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idEst = e.target.closest('[data-estado]')?.dataset.estado;
    const idProy = e.target.closest('[data-proyectos]')?.dataset.proyectos;
    if (e.target.closest('[data-a="nuevo"]')) { if (await editarNodo('programas', null, { portafolios })) renderPanel(); }
    if (id) { if (await editarNodo('programas', programas.find(x => x.id === id), { portafolios })) renderPanel(); }
    if (idEst) { await cambiarEstadoNodo('programas', programas.find(x => x.id === idEst)); renderPanel(); }
    if (idProy) { if (await asignarProyectos(programas.find(x => x.id === idProy), proyectos)) { await cargarCatalogo(); renderPanel(); } }
  });
}

async function editarNodo(tablaNodo, x, { portafolios }) {
  const esProg = tablaNodo === 'programas';
  const responsables = store.perfiles?.length ? store.perfiles : await api.list('profiles', { eq: { activo: true } }).catch(() => []);
  return pedirDatos({
    titulo: x ? `Editar ${esProg ? 'programa' : 'portafolio'}: ${x.nombre}` : esProg ? 'Nuevo programa' : 'Nuevo portafolio',
    valores: x || {},
    campos: [
      { name: 'codigo', label: 'Código' },
      { name: 'nombre', label: 'Nombre', required: true },
      ...(esProg ? [{ name: 'portafolio_id', label: 'Portafolio', type: 'select', required: true,
        options: portafolios.filter(f => f.estado !== 'inactivo' || f.id === x?.portafolio_id).map(f => ({ value: f.id, label: f.nombre })) }] : []),
      { name: 'responsable_id', label: 'Responsable', type: 'select',
        options: responsables.filter(p => p.activo && !p.eliminado && p.rol !== 'pendiente').map(p => ({ value: p.id, label: p.nombre || p.email })) },
      { name: 'descripcion', label: 'Descripción', type: 'textarea', full: true },
    ],
    alGuardar: async d => {
      const datos = { codigo: d.codigo || null, nombre: d.nombre.trim(), descripcion: d.descripcion || null, responsable_id: d.responsable_id || null };
      if (esProg) datos.portafolio_id = d.portafolio_id || null;
      if (x) await api.update(tablaNodo, x.id, datos);
      else await api.insert(tablaNodo, { ...datos, area_id: store.area.id, estado: 'activo' });
      // Los proyectos del programa siguen a su portafolio
      if (esProg && x && x.portafolio_id !== datos.portafolio_id) {
        const ps = await api.list('proyectos', { eq: { programa_id: x.id } });
        for (const p of ps) await api.update('proyectos', p.id, { portafolio_id: datos.portafolio_id });
      }
      ok(esProg ? 'Programa guardado.' : 'Portafolio guardado.');
    },
  });
}

async function cambiarEstadoNodo(tablaNodo, x) {
  if (!x) return;
  const activar = x.estado === 'inactivo';
  const que = tablaNodo === 'programas' ? 'el programa' : 'el portafolio';
  if (!await confirmar(`¿${activar ? 'Activar' : 'Desactivar'} ${que} "${x.nombre}"? ${activar ? '' : 'Sus proyectos no cambian; solo deja de ofrecerse para asignar proyectos nuevos.'}`,
    { titulo: activar ? 'Activar' : 'Desactivar', texto: activar ? 'Activar' : 'Desactivar', peligro: !activar })) return;
  try { await api.update(tablaNodo, x.id, { estado: activar ? 'activo' : 'inactivo' }); ok(activar ? 'Activado.' : 'Desactivado.'); }
  catch (err) { error(mensajeError(err)); }
}

async function asignarProyectos(g, proyectos) {
  if (!g) return null;
  const candidatos = proyectos.filter(p => !['cerrado', 'rechazado'].includes(p.estado) || p.programa_id === g.id);
  return pedirDatos({
    titulo: `Proyectos del programa ${g.nombre}`, texto: 'Guardar',
    antes: 'Marque los proyectos que pertenecen a este programa. Un proyecto marcado aquí deja el programa que tenía antes.',
    valores: { proyectos: proyectos.filter(p => p.programa_id === g.id).map(p => p.id) },
    campos: [{ name: 'proyectos', label: 'Proyectos', type: 'multiselect', full: true,
      options: candidatos.map(p => ({ value: p.id, label: `${p.codigo} · ${p.nombre_corto}` })) }],
    alGuardar: async d => {
      const marcados = new Set(d.proyectos || []);
      for (const p of candidatos) {
        if (marcados.has(p.id) && p.programa_id !== g.id) await api.update('proyectos', p.id, { programa_id: g.id, portafolio_id: g.portafolio_id || null });
        if (!marcados.has(p.id) && p.programa_id === g.id) await api.update('proyectos', p.id, { programa_id: null });
      }
      ok('Proyectos del programa actualizados.');
    },
  });
}

async function cambiarEstadoProy(id, nuevoEstado, extra = {}) {
  try {
    await api.update('proyectos', id, { estado: nuevoEstado, ...extra });
    ok(`Proyecto ${nuevoEstado === 'activo' ? 'activado' : nuevoEstado === 'en_pausa' ? 'pausado' : nuevoEstado}.`);
  } catch (err) { error(mensajeError(err)); }
}

async function rechazarProyecto(p) {
  if (!p) return;
  await pedirDatos({
    titulo: `Rechazar: ${p.codigo}`,
    campos: [{ name: 'motivo', label: 'Motivo del rechazo', required: true }],
    alGuardar: async d => {
      try {
        await api.update('proyectos', p.id, { estado: 'rechazado', motivo_rechazo: d.motivo });
        ok('Proyecto rechazado. El líder recibirá aviso.');
      } catch (err) { error(mensajeError(err)); }
    },
  });
}

function cab(titulo, botones = []) {
  const btns = botones.map(({ texto, accion, clase }) =>
    `<button class="btn btn-sm ${clase || ''}" data-a="${accion}">${texto}</button>`).join('');
  return `<div class="admin-panel-cab"><h2>${titulo}</h2><div class="barra-acciones">${btns}</div></div>`;
}
function btn(texto, accion, clase = '') { return { texto, accion, clase }; }

function tabla(cabeceras, filas) {
  if (!filas.length) return '<div class="aviso info" style="margin-top:12px">Sin registros.</div>';
  return `<div class="tarjeta admin-tabla-wrap"><table class="simple">
    <thead><tr>${cabeceras.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(celdas => `<tr>${celdas.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function imprimirPanel(el, titulo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { error('El navegador bloqueó la ventana emergente.'); return; }
  const estilos = [...document.styleSheets].map(s => {
    try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; }
  }).join('\n');
  const content = el.querySelector?.('.tarjeta, .admin-tabla-wrap, .admin-kpis');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${estilos}\n@media print{.no-imprimir,.barra-acciones{display:none!important}body{font-size:11pt}}</style>
    </head><body><h2 style="margin-bottom:12px">${esc(titulo)}</h2>${content?.outerHTML || ''}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
