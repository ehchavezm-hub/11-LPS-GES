// Consola de Administración — overlay de pantalla completa (posición fija, z-index 1500).
// Cubre tres ámbitos: Empresa (usuarios, roles, área), Estructura (portafolios, programas, proyectos) y Configuración.
// Se abre llamando showAdminConsole(); puede recibir un panel inicial como parámetro.
import { api, mensajeError, modoDemo } from '../data/api.js';
import { store, on, esSuperadmin, esAdmin, esGestor, cargarCatalogo, etiqueta, opciones, nombre } from '../core/store.js';
import { ROLES, COLOR_ROL } from '../data/catalogos.js';
import { esc, html, fmtFechaHora, fmtFecha, normalizar } from '../core/util.js';
import { ok, error, confirmar, pedirDatos, modal, badge, toast } from '../ui/ui.js';

// ---------- Estado local ----------
let overlay = null;
let panelActivo = 'empresa-usuarios';
let dejarEscuchar = null;

// ---------- Menú lateral de la consola ----------
const MENU = [
  { grupo: 'Empresa' },
  { id: 'empresa-usuarios',   ico: '👤', texto: 'Usuarios y roles',       si: () => esGestor() },
  { id: 'empresa-area',       ico: '🏢', texto: 'Datos del área',          si: () => esAdmin() },
  { id: 'empresa-permisos',   ico: '🔐', texto: 'Matriz de permisos',      si: () => esAdmin() },
  { grupo: 'Estructura' },
  { id: 'struct-portafolios', ico: '🗂', texto: 'Portafolios',             si: () => esGestor() },
  { id: 'struct-programas',   ico: '📁', texto: 'Programas',               si: () => esGestor() },
  { id: 'struct-proyectos',   ico: '📌', texto: 'Proyectos',               si: () => esGestor() },
  { grupo: 'Configuración' },
  { id: 'cfg-listas',         ico: '📋', texto: 'Listas configurables',    si: () => esAdmin() },
  { id: 'cfg-parametros',     ico: '🔧', texto: 'Parámetros',              si: () => esAdmin() },
  { id: 'cfg-columnas',       ico: '▥',  texto: 'Columnas personalizadas', si: () => esAdmin() },
  { id: 'cfg-importar',       ico: '⬆', texto: 'Importar Excel',          si: () => esAdmin() },
  { id: 'cfg-respaldo',       ico: '💾', texto: 'Respaldo',                si: () => esSuperadmin() },
  { id: 'cfg-auditoria',      ico: '🕑', texto: 'Auditoría',               si: () => esAdmin() },
];

// ---------- Punto de entrada público ----------
export function showAdminConsole(panelInicial) {
  if (overlay) { cerrarConsola(); return; }
  if (panelInicial) panelActivo = panelInicial;

  overlay = html(`<div class="admin-overlay" role="dialog" aria-label="Consola de Administración" aria-modal="true">
    <div class="admin-inner">
      <aside class="admin-lateral">
        <div class="admin-logo">
          <span>⚙</span><span class="admin-logo-txt">Administración</span>
          <button class="admin-cerrar" title="Cerrar consola" aria-label="Cerrar consola">✕</button>
        </div>
        <nav class="admin-nav" aria-label="Navegación de administración"></nav>
      </aside>
      <main class="admin-contenido" id="admin-contenido" tabindex="-1">
        <div class="admin-cargando"><span class="spinner"></span></div>
      </main>
    </div>
  </div>`);
  document.body.append(overlay);
  pintarMenuLateral();

  overlay.querySelector('.admin-cerrar').addEventListener('click', cerrarConsola);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarConsola(); });
  overlay.querySelector('.admin-nav').addEventListener('click', e => {
    const item = e.target.closest('[data-panel]');
    if (item) navegarA(item.dataset.panel);
  });

  dejarEscuchar = on('catalogo', () => renderPanel());
  navegarA(panelActivo);
  setTimeout(() => overlay?.querySelector('.admin-contenido')?.focus(), 50);
}

export function cerrarConsola() {
  overlay?.remove();
  overlay = null;
  dejarEscuchar?.();
  dejarEscuchar = null;
}

function pintarMenuLateral() {
  const nav = overlay?.querySelector('.admin-nav');
  if (!nav) return;
  nav.innerHTML = MENU.filter(m => m.grupo || m.si()).map(m => m.grupo
    ? `<div class="admin-grupo">${esc(m.grupo)}</div>`
    : `<button class="admin-item${panelActivo === m.id ? ' activo' : ''}" data-panel="${m.id}">
         <span class="admin-ico">${m.ico}</span><span class="admin-txt">${esc(m.texto)}</span>
       </button>`).join('');
}

function navegarA(id) {
  panelActivo = id;
  pintarMenuLateral();
  renderPanel();
}

async function renderPanel() {
  const cont = overlay?.querySelector('#admin-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="admin-cargando"><span class="spinner"></span></div>';
  try {
    const paneles = {
      'empresa-usuarios':   panelUsuarios,
      'empresa-area':       panelArea,
      'empresa-permisos':   panelPermisos,
      'struct-portafolios': panelPortafolios,
      'struct-programas':   panelProgramas,
      'struct-proyectos':   panelProyectos,
      'cfg-listas':         () => importarConfig(cont, 'listas'),
      'cfg-parametros':     () => importarConfig(cont, 'parametros'),
      'cfg-columnas':       () => importarConfig(cont, 'columnas'),
      'cfg-importar':       () => importarConfig(cont, 'importar'),
      'cfg-respaldo':       () => importarConfig(cont, 'respaldo'),
      'cfg-auditoria':      () => importarConfig(cont, 'auditoria'),
    };
    const fn = paneles[panelActivo];
    if (fn) await fn(cont);
    else cont.innerHTML = '<p class="nota" style="padding:20px">Panel no disponible.</p>';
  } catch (e) {
    cont.innerHTML = `<div class="aviso error" style="margin:20px">${esc(mensajeError(e))}</div>`;
  }
}

// Reutiliza las secciones de config.js para listas, parámetros, columnas, etc.
async function importarConfig(cont, seccion) {
  const m = await import('./config.js');
  await m.render(cont, { seccion, query: new URLSearchParams() });
}

// ---------- Panel: Usuarios y roles ----------
async function panelUsuarios(el) {
  const perfiles = (await api.list('profiles', { eq: { area_id: store.area.id }, order: [['nombre', true]] })).filter(p => !p.eliminado);
  const pendientes = perfiles.filter(p => p.rol === 'pendiente' && p.activo);

  el.innerHTML = `
    <div class="admin-panel-cab">
      <h2>👤 Usuarios y roles</h2>
      <div class="barra barra-acciones">
        <button class="btn btn-sm btn-primario" data-a="nuevo">＋ Nuevo usuario</button>
        <button class="btn btn-sm" data-a="invitar">✉ Invitar</button>
        <button class="btn btn-sm" data-a="imprimir" title="Imprimir / exportar PDF">🖨 Imprimir</button>
      </div>
    </div>
    ${pendientes.length ? `<div class="aviso warn" style="margin:0 0 14px"><b>${pendientes.length} usuario(s) esperan aprobación.</b> Asígneles un rol para que puedan ingresar.</div>` : ''}
    <div class="tarjeta admin-tabla-wrap">
      <table class="simple">
        <thead><tr><th>Nombre</th><th>Código</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>${perfiles.map(p => filaUsuario(p)).join('')}</tbody>
      </table>
    </div>`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idClave = e.target.closest('[data-clave]')?.dataset.clave;
    const idEliminar = e.target.closest('[data-eliminar]')?.dataset.eliminar;

    if (a === 'nuevo') { await nuevoUsuario(); await renderPanel(); }
    if (a === 'invitar') mostrarInvitacion();
    if (a === 'imprimir') imprimirPanel(el, 'Usuarios y roles');
    if (id) { await editarUsuario(perfiles.find(p => p.id === id)); await renderPanel(); }
    if (idClave) await restablecerClave(perfiles.find(p => p.id === idClave));
    if (idEliminar) { await eliminarUsuario(perfiles.find(p => p.id === idEliminar)); await renderPanel(); }
  });
}

function filaUsuario(p) {
  const puedeClave = puedeRestablecer(p);
  const puedeElim = puedeEliminar(p);
  return `<tr>
    <td><b>${esc(p.nombre)}</b>${p.es_admin_principal ? ' ' + badge('Principal', '#E8762B') : ''}</td>
    <td>${esc(p.codigo || '')}</td>
    <td>${esc(p.email || '')}</td>
    <td>${badge(ROLES[p.rol] || p.rol, COLOR_ROL[p.rol])}</td>
    <td>${p.activo ? 'Activo' : '<span style="color:var(--rojo)">Inactivo</span>'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-sm" data-editar="${p.id}">Editar</button>
      ${puedeClave ? `<button class="btn btn-sm" data-clave="${p.id}" title="Restablecer contraseña">🔑</button>` : ''}
      ${puedeElim ? `<button class="btn btn-sm" data-eliminar="${p.id}" title="Eliminar">🗑</button>` : ''}
    </td></tr>`;
}

function puedeRestablecer(p) {
  if (p.id === store.usuario.id) return false;
  if (p.es_admin_principal) return false;
  return esSuperadmin() || !['superadmin', 'admin', 'delegado'].includes(p.rol);
}

function puedeEliminar(p) {
  return esAdmin() && p.id !== store.usuario.id && !p.es_admin_principal &&
    (esSuperadmin() || !['superadmin', 'admin'].includes(p.rol));
}

async function nuevoUsuario() {
  if (modoDemo) { error('En modo demostración no se pueden crear usuarios reales.'); return; }
  const clave = generarClave();
  await pedirDatos({
    titulo: 'Nuevo usuario',
    campos: [
      { name: 'nombre', label: 'Nombre completo', required: true },
      { name: 'email', label: 'Correo electrónico', type: 'email', required: true },
      { name: 'codigo', label: 'Código corto (iniciales)' },
      { name: 'rol', label: 'Rol', type: 'select', opciones: Object.entries(ROLES).filter(([k]) => k !== 'pendiente').map(([k, v]) => ({ value: k, label: v })), required: true },
      { name: 'clave', label: 'Contraseña temporal', required: true, valor: clave, help: 'Se le pedirá cambiarla al ingresar.' },
    ],
    alGuardar: async d => {
      const { error: authErr, data } = await api.auth.crearUsuario(d.email, d.clave);
      if (authErr) throw new Error(authErr.message || 'No se pudo crear el usuario.');
      const uid = data?.user?.id;
      if (!uid) throw new Error('No se obtuvo el ID del usuario creado.');
      await api.insert('profiles', { id: uid, nombre: d.nombre, email: d.email, codigo: d.codigo || null, rol: d.rol, area_id: store.area.id, activo: true, debe_cambiar_clave: true });
      ok(`Usuario creado. Contraseña temporal: ${d.clave}`);
    },
  });
}

async function editarUsuario(p) {
  if (!p) return;
  const camposRol = esSuperadmin() || (esAdmin() && !['superadmin'].includes(p.rol));
  await pedirDatos({
    titulo: `Editar: ${p.nombre}`,
    valores: p,
    campos: [
      { name: 'nombre', label: 'Nombre completo', required: true },
      { name: 'codigo', label: 'Código corto' },
      { name: 'cargo_id', label: 'Cargo', type: 'select', opciones: opciones('cargos') },
      { name: 'horas_dia', label: 'Horas disponibles / día', type: 'number', min: 0, max: 24, step: 0.5 },
      ...(camposRol ? [{ name: 'rol', label: 'Rol', type: 'select', opciones: Object.entries(ROLES).map(([k, v]) => ({ value: k, label: v })), required: true }] : []),
      { name: 'activo', label: 'Activo', type: 'checkbox' },
    ],
    alGuardar: async d => {
      await api.update('profiles', p.id, d);
      await cargarCatalogo();
      ok('Usuario actualizado.');
    },
  });
}

async function restablecerClave(p) {
  if (!p) return;
  const clave = generarClave();
  const si = await confirmar(`¿Restablecer la contraseña de ${p.nombre}? Se le asignará una contraseña temporal y deberá cambiarla al ingresar.`,
    { titulo: 'Restablecer contraseña', texto: 'Restablecer' });
  if (!si) return;
  try {
    await api.rpc('restablecer_clave', { usuario_id: p.id, nueva_clave: clave });
    await api.update('profiles', p.id, { debe_cambiar_clave: true });
    ok(`Contraseña restablecida. Contraseña temporal: ${clave}`);
  } catch (e) { error(mensajeError(e)); }
}

async function eliminarUsuario(p) {
  if (!p) return;
  const si = await confirmar(`¿Eliminar a ${p.nombre}? Perderá el acceso de inmediato. Si registró datos, su nombre se conserva en los registros históricos.`,
    { titulo: 'Eliminar usuario', texto: 'Eliminar', peligro: true });
  if (!si) return;
  try {
    await api.update('profiles', p.id, { eliminado: true, activo: false });
    await cargarCatalogo();
    ok('Usuario eliminado.');
  } catch (e) { error(mensajeError(e)); }
}

function mostrarInvitacion() {
  const url = location.origin + location.pathname;
  modal({
    titulo: 'Invitar usuarios',
    ancho: 560,
    cuerpo: `<p>Envíe este enlace a las personas que deben usar LPS-GES. Al registrarse quedan <b>pendientes</b> y usted les asigna el rol aquí.</p>
      <p><input class="inp" style="width:100%" readonly value="${esc(url)}"></p>`,
    botones: [{ texto: 'Copiar enlace', clase: 'btn-primario', accion: async () => { await navigator.clipboard?.writeText(url).catch(() => {}); ok('Enlace copiado.'); } }],
  });
}

function generarClave() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const n = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(n, x => c[x % c.length]).join('');
}

// ---------- Panel: Datos del área ----------
async function panelArea(el) {
  const area = store.area;
  el.innerHTML = `
    <div class="admin-panel-cab">
      <h2>🏢 Datos del área</h2>
      <button class="btn btn-sm btn-primario" id="btn-editar-area">Editar</button>
    </div>
    <div class="tarjeta">
      <table class="simple">
        <tr><th>Campo</th><th>Valor</th></tr>
        <tr><td>Nombre</td><td>${esc(area?.nombre || '—')}</td></tr>
        <tr><td>Código</td><td>${esc(area?.codigo || '—')}</td></tr>
        <tr><td>Descripción</td><td>${esc(area?.descripcion || '—')}</td></tr>
        <tr><td>País</td><td>${esc(area?.pais || '—')}</td></tr>
        <tr><td>Zona horaria</td><td>${esc(area?.zona_horaria || '—')}</td></tr>
      </table>
    </div>`;

  el.querySelector('#btn-editar-area')?.addEventListener('click', async () => {
    await pedirDatos({
      titulo: 'Editar datos del área',
      valores: area,
      campos: [
        { name: 'nombre', label: 'Nombre del área / empresa', required: true },
        { name: 'codigo', label: 'Código corto' },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'pais', label: 'País' },
        { name: 'zona_horaria', label: 'Zona horaria (ej: America/Lima)' },
      ],
      alGuardar: async d => {
        await api.update('areas', area.id, d);
        await cargarCatalogo();
        ok('Datos del área actualizados.');
        await renderPanel();
      },
    });
  });
}

// ---------- Panel: Matriz de permisos (redirige a config.js) ----------
async function panelPermisos(el) {
  return importarConfig(el, 'permisos');
}

// ---------- Panel: Portafolios ----------
async function panelPortafolios(el) {
  let portafolios = [];
  try { portafolios = await api.list('portafolios', { eq: { area_id: store.area.id }, order: [['nombre', true]] }); } catch { /* tabla puede no existir aún */ }

  el.innerHTML = `
    <div class="admin-panel-cab">
      <h2>🗂 Portafolios</h2>
      <div class="barra barra-acciones">
        <button class="btn btn-sm btn-primario" data-a="nuevo">＋ Nuevo portafolio</button>
        <button class="btn btn-sm" data-a="imprimir">🖨 Imprimir</button>
      </div>
    </div>
    ${!portafolios.length ? `<div class="aviso info">Sin portafolios registrados. Use "＋ Nuevo portafolio" para agregar uno.</div>` : ''}
    ${portafolios.length ? `<div class="tarjeta admin-tabla-wrap">
      <table class="simple">
        <thead><tr><th>Código</th><th>Nombre</th><th>Responsable</th><th>Estado</th><th></th></tr></thead>
        <tbody>${portafolios.map(p => `<tr>
          <td>${esc(p.codigo || '')}</td>
          <td><b>${esc(p.nombre)}</b></td>
          <td>${esc(nombre(p.responsable_id))}</td>
          <td>${badge(p.estado || 'activo', p.estado === 'inactivo' ? '#aaa' : '#2e7d32')}</td>
          <td><button class="btn btn-sm" data-editar="${p.id}">Editar</button>
              <button class="btn btn-sm" data-eliminar="${p.id}" title="Eliminar">🗑</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idEliminar = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    if (a === 'nuevo') { await editarPortafolio(null); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Portafolios');
    if (id) { await editarPortafolio(portafolios.find(p => p.id === id)); await renderPanel(); }
    if (idEliminar) { await eliminarRegistro('portafolios', portafolios.find(p => p.id === idEliminar)); await renderPanel(); }
  });
}

async function editarPortafolio(p) {
  const camposLideres = [{ value: null, label: '—' }, ...store.perfiles.filter(x => !x.eliminado && x.activo).map(x => ({ value: x.id, label: x.nombre }))];
  await pedirDatos({
    titulo: p ? `Editar: ${p.nombre}` : 'Nuevo portafolio',
    valores: p || {},
    campos: [
      { name: 'codigo', label: 'Código' },
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'responsable_id', label: 'Responsable', type: 'select', opciones: camposLideres },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'estado', label: 'Estado', type: 'select', opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
    ],
    alGuardar: async d => {
      if (p) await api.update('portafolios', p.id, d);
      else await api.insert('portafolios', { ...d, area_id: store.area.id });
      ok(p ? 'Portafolio actualizado.' : 'Portafolio creado.');
    },
  });
}

// ---------- Panel: Programas ----------
async function panelProgramas(el) {
  let programas = [], portafolios = [];
  try {
    [programas, portafolios] = await Promise.all([
      api.list('programas', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
      api.list('portafolios', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
    ]);
  } catch { /* tablas pueden no existir aún */ }
  const portMap = new Map(portafolios.map(p => [p.id, p]));

  el.innerHTML = `
    <div class="admin-panel-cab">
      <h2>📁 Programas</h2>
      <div class="barra barra-acciones">
        <button class="btn btn-sm btn-primario" data-a="nuevo">＋ Nuevo programa</button>
        <button class="btn btn-sm" data-a="imprimir">🖨 Imprimir</button>
      </div>
    </div>
    ${!programas.length ? `<div class="aviso info">Sin programas registrados.</div>` : ''}
    ${programas.length ? `<div class="tarjeta admin-tabla-wrap">
      <table class="simple">
        <thead><tr><th>Código</th><th>Nombre</th><th>Portafolio</th><th>Responsable</th><th>Estado</th><th></th></tr></thead>
        <tbody>${programas.map(p => `<tr>
          <td>${esc(p.codigo || '')}</td>
          <td><b>${esc(p.nombre)}</b></td>
          <td>${esc(portMap.get(p.portafolio_id)?.nombre || '—')}</td>
          <td>${esc(nombre(p.responsable_id))}</td>
          <td>${badge(p.estado || 'activo', p.estado === 'inactivo' ? '#aaa' : '#1565c0')}</td>
          <td><button class="btn btn-sm" data-editar="${p.id}">Editar</button>
              <button class="btn btn-sm" data-eliminar="${p.id}" title="Eliminar">🗑</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    const idEliminar = e.target.closest('[data-eliminar]')?.dataset.eliminar;
    if (a === 'nuevo') { await editarPrograma(null, portafolios); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Programas');
    if (id) { await editarPrograma(programas.find(p => p.id === id), portafolios); await renderPanel(); }
    if (idEliminar) { await eliminarRegistro('programas', programas.find(p => p.id === idEliminar)); await renderPanel(); }
  });
}

async function editarPrograma(p, portafolios) {
  const optsPort = [{ value: null, label: '— Sin portafolio —' }, ...portafolios.map(x => ({ value: x.id, label: x.nombre }))];
  const optsLider = [{ value: null, label: '—' }, ...store.perfiles.filter(x => !x.eliminado && x.activo).map(x => ({ value: x.id, label: x.nombre }))];
  await pedirDatos({
    titulo: p ? `Editar: ${p.nombre}` : 'Nuevo programa',
    valores: p || {},
    campos: [
      { name: 'codigo', label: 'Código' },
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'portafolio_id', label: 'Portafolio', type: 'select', opciones: optsPort },
      { name: 'responsable_id', label: 'Responsable', type: 'select', opciones: optsLider },
      { name: 'descripcion', label: 'Descripción' },
      { name: 'estado', label: 'Estado', type: 'select', opciones: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] },
    ],
    alGuardar: async d => {
      if (p) await api.update('programas', p.id, d);
      else await api.insert('programas', { ...d, area_id: store.area.id });
      ok(p ? 'Programa actualizado.' : 'Programa creado.');
    },
  });
}

// ---------- Panel: Proyectos ----------
async function panelProyectos(el) {
  const proyectos = store.proyectos;
  let portafolios = [], programas = [];
  try {
    [portafolios, programas] = await Promise.all([
      api.list('portafolios', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
      api.list('programas', { eq: { area_id: store.area.id }, order: [['nombre', true]] }),
    ]);
  } catch { /* opcional */ }
  const portMap = new Map(portafolios.map(p => [p.id, p]));
  const progMap = new Map(programas.map(p => [p.id, p]));

  const estados = [
    { value: 'activo', label: 'Activo' }, { value: 'propuesto', label: 'Propuesto' },
    { value: 'inactivo', label: 'Inactivo' }, { value: 'cancelado', label: 'Cancelado' },
  ];

  el.innerHTML = `
    <div class="admin-panel-cab">
      <h2>📌 Proyectos</h2>
      <div class="barra barra-acciones">
        <button class="btn btn-sm btn-primario" data-a="nuevo">＋ Nuevo proyecto</button>
        <button class="btn btn-sm" data-a="imprimir">🖨 Imprimir</button>
      </div>
    </div>
    <div class="tarjeta admin-tabla-wrap">
      <table class="simple">
        <thead><tr><th>Código</th><th>Nombre</th><th>Portafolio</th><th>Programa</th><th>Gerencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>${proyectos.map(p => `<tr>
          <td><b>${esc(p.codigo)}</b></td>
          <td>${esc(p.nombre_corto)}</td>
          <td>${esc(portMap.get(p.portafolio_id)?.nombre || '—')}</td>
          <td>${esc(progMap.get(p.programa_id)?.nombre || '—')}</td>
          <td>${esc(etiqueta(p.gerencia_id))}</td>
          <td>${badge(p.estado, { activo: '#2e7d32', propuesto: '#e65100', inactivo: '#aaa', cancelado: '#b71c1c' }[p.estado] || '#666')}</td>
          <td><button class="btn btn-sm" data-editar="${p.id}">Editar</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const id = e.target.closest('[data-editar]')?.dataset.editar;
    if (a === 'nuevo') { await import('./proyectos.js').then(m => m.formularioProyecto()); await renderPanel(); }
    if (a === 'imprimir') imprimirPanel(el, 'Proyectos');
    if (id) {
      const p = proyectos.find(x => x.id === id);
      if (!p) return;
      await pedirDatos({
        titulo: `Vincular: ${p.codigo}`,
        valores: p,
        campos: [
          { name: 'portafolio_id', label: 'Portafolio', type: 'select', opciones: [{ value: null, label: '— Sin portafolio —' }, ...portafolios.map(x => ({ value: x.id, label: x.nombre }))] },
          { name: 'programa_id', label: 'Programa', type: 'select', opciones: [{ value: null, label: '— Sin programa —' }, ...programas.map(x => ({ value: x.id, label: x.nombre }))] },
        ],
        alGuardar: async d => {
          await api.update('proyectos', id, d);
          await cargarCatalogo();
          ok('Proyecto actualizado.');
          await renderPanel();
        },
      });
    }
  });
}

// ---------- Utilidades ----------
async function eliminarRegistro(tabla, rec) {
  if (!rec) return;
  const si = await confirmar(`¿Eliminar "${rec.nombre}"? Esta acción no se puede deshacer.`,
    { titulo: 'Eliminar', texto: 'Eliminar', peligro: true });
  if (!si) return;
  try {
    await api.removeWhere(tabla, { eq: { id: rec.id } });
    ok('Eliminado correctamente.');
  } catch (e) { error(mensajeError(e)); }
}

function imprimirPanel(el, titulo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { error('El navegador bloqueó la ventana emergente. Permita ventanas emergentes para imprimir.'); return; }
  const estilos = [...document.styleSheets].map(s => {
    try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; }
  }).join('\n');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${estilos}\n@media print{.no-imprimir{display:none!important}body{font-size:11pt}.admin-overlay,.admin-lateral{display:none!important}.tarjeta{box-shadow:none!important}}</style>
    </head><body><h2 style="margin-bottom:12px">${esc(titulo)}</h2>${el.querySelector('.tarjeta')?.outerHTML || el.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
