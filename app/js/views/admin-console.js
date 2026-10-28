// Consola de Administración — LPS-GES
// Barra superior: ⚙ Administración › [Plataforma] › EMPRESA (selector) › PROYECTO (selector).
// Menú PLATAFORMA (propietarios de la plataforma, admin-plataforma.js) y menú EMPRESA (la empresa en la que se trabaja).
// Spec: docs/LPS-GT_Alcance_v0.7.docx sección 6.1-6.2
import { api, mensajeError } from '../data/api.js';
import { store, on, esSuperadmin, esAdmin, esGestor, cargarCatalogo, etiqueta, opciones, nombre, seleccionarProyecto } from '../core/store.js';
import * as plat from './admin-plataforma.js';
import { ROLES, COLOR_ROL } from '../data/catalogos.js';
import { esc, fmtFechaHora } from '../core/util.js';
import { ok, error, confirmar, pedirDatos, modal, badge } from '../ui/ui.js';

// ---------- Estado ----------
let contenedor = null;
let panelActivo = 'resumen';
let dejarEscuchar = null;

// ---------- Menú ----------
const esPlataforma = () => !!store.usuario?.es_plataforma;
const MENU_PLATAFORMA = [
  { id: 'p-resumen',     ico: '📊', texto: 'Resumen' },
  { id: 'p-empresas',    ico: '🏢', texto: 'Empresas' },
  { id: 'p-usuarios',    ico: '👥', texto: 'Usuarios' },
  { id: 'p-estructura',  ico: '🌳', texto: 'Estructura de todas las empresas' },
  { id: 'p-propietarios', ico: '👑', texto: 'Propietarios' },
  { id: 'p-auditoria',   ico: '📜', texto: 'Auditoría' },
  { id: 'p-reportes',    ico: '📄', texto: 'Reportes' },
];
const MENU = [
  { id: 'resumen',       ico: '📊', texto: 'Resumen',                 si: esAdmin },
  { sep: true },
  { id: 'usuarios',      ico: '👤', texto: 'Usuarios y roles',        si: esAdmin },
  { id: 'delegado',      ico: '🔄', texto: 'Administrador delegado',  si: esSuperadmin },
  { id: 'permisos',      ico: '🔐', texto: 'Matriz de permisos',      si: esAdmin },
  { sep: true },
  { id: 'estructura',    ico: '🌐', texto: 'Estructura de la empresa', si: esAdmin },
  { id: 'portafolios',   ico: '🗂', texto: 'Portafolios',             si: esAdmin },
  { id: 'programas',     ico: '📁', texto: 'Programas',               si: esAdmin },
  { id: 'proyectos',     ico: '📌', texto: 'Proyectos / Procesos',    si: esAdmin },
  // Listas configurables, Parámetros y Calendario aplican a los sub-proyectos: quedan en Configuración (pedido a11)
  { sep: true },
  { id: 'auditoria',     ico: '🕑', texto: 'Auditoría',               si: esAdmin },
];

// Listas iniciales según spec sección 6.2
const LISTAS_INICIALES = [
  'Gerencias', 'CET', 'Servicios/Entregables', 'Categorías de servicio',
  'Tipos de proyecto', 'Fases', 'Estados de proyecto', 'Tipos de actividad',
  'Estados de Look Ahead', 'Estados de compromiso', 'CNC',
  'Tipos de restricción', 'Estados de restricción', 'Criticidad',
  'Tipos de cartera', 'Estados de cartera', 'Ubicaciones', 'Países',
];

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
      seleccionarProyecto(sel.value);
      ok('Proyecto seleccionado: el plan, el Look Ahead y los reportes se filtran por él.');
    }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarConsola(); });
  el.querySelector('.admin-nav').addEventListener('click', e => {
    const item = e.target.closest('[data-panel]');
    if (item) navegarA(item.dataset.panel);
  });

  pintarMenu();
  renderPanel();

  dejarEscuchar = on('catalogo', () => { pintarMenu(); });
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

// Migas: [Plataforma] › EMPRESA (selector) › PROYECTO (selector)
async function repintarCabecera() {
  const migas = contenedor?.querySelector('.admin-migas');
  if (!migas) return;
  let empresas = [{ id: store.area?.id, nombre: store.area?.nombre || 'Empresa' }];
  if (esPlataforma()) {
    try { empresas = (await api.adminUsuarios('empresas')).empresas || empresas; } catch { /* se muestra solo la propia */ }
  }
  const proyectos = (store.proyectos || []).filter(p => !['cerrado', 'rechazado'].includes(p.estado));
  migas.innerHTML = `${esPlataforma() ? `<button class="admin-miga-plat${panelActivo.startsWith('p-') ? ' activo' : ''}" data-a="plataforma">Plataforma</button><span class="admin-miga-sep">›</span>` : ''}
    <label class="admin-miga-sel"><span>EMPRESA</span><select data-sel="empresa" ${esPlataforma() ? '' : 'disabled'}>
      ${empresas.map(e => `<option value="${e.id}" ${e.id === store.area?.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
    <span class="admin-miga-sep">›</span>
    <label class="admin-miga-sel"><span>PROYECTO</span><select data-sel="proyecto"><option value="">Elegir proyecto…</option>
      ${proyectos.map(p => `<option value="${p.id}" ${p.id === store.proyectoSel ? 'selected' : ''}>${esc(p.codigo)} · ${esc(p.nombre_corto)}</option>`).join('')}</select></label>`;
}

// ---------- Navegación ----------
function pintarMenu() {
  const nav = contenedor?.querySelector('.admin-nav');
  if (!nav) return;
  const item = m => m.sep ? '<hr class="admin-nav-sep">' : `<button class="admin-item${panelActivo === m.id ? ' activo' : ''}" data-panel="${m.id}">
      <span class="admin-ico">${m.ico}</span><span class="admin-txt">${esc(m.texto)}</span></button>`;
  const empresaItems = MENU.filter(m => !m.si || m.si());
  nav.innerHTML = (esPlataforma() ? `<div class="admin-nav-grupo">Plataforma</div>${MENU_PLATAFORMA.map(item).join('')}<hr class="admin-nav-sep">` : '') +
    `<div class="admin-nav-grupo" title="${esc(store.area?.nombre || '')}">Empresa: ${esc(store.area?.nombre || '')}</div>${empresaItems.map(item).join('')}`;
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
  // Cada panel registra sus clics en el contenedor: se reemplaza para no acumular los del panel anterior
  const cont = previo.cloneNode(false);
  previo.replaceWith(cont);
  cont.innerHTML = '<div class="admin-cargando"><span class="spinner"></span></div>';
  // Secciones que ya funcionan en Configuración: se muestran aquí mismo, con los mismos datos y reglas
  const config = nombre => async el => {
    const { seccionConfig } = await import('./config.js');
    el.innerHTML = '';
    await seccionConfig(nombre, el);
  };
  const ctx = { imprimir: imprimirPanel, repintarCabecera };
  if (panelActivo.startsWith('p-') && !esPlataforma()) panelActivo = 'resumen';
  try {
    const mapa = {
      'p-resumen':     el => plat.panelResumenPlataforma(el, ctx),
      'p-empresas':    el => plat.panelEmpresas(el, ctx),
      'p-usuarios':    el => plat.panelUsuariosPlataforma(el, ctx),
      'p-estructura':  el => plat.panelEstructuraTodas(el, ctx),
      'p-propietarios': el => plat.panelPropietarios(el, ctx),
      'p-auditoria':   el => plat.panelAuditoriaPlataforma(el, ctx),
      'p-reportes':    el => plat.panelReportesPlataforma(el, ctx),
      'resumen':     panelResumen,
      'empresas':    config('empresas'),
      'usuarios':    config('usuarios'),
      'delegado':    config('usuarios'),     // Asignar / rotar el delegado y su historial están en Usuarios y roles
      'permisos':    config('permisos'),
      'estructura':  panelEstructura,
      'portafolios': panelPortafolios,
      'programas':   panelProgramas,
      'proyectos':   panelProyectos,
      'listas':      config('listas'),
      'parametros':  config('parametros'),
      'calendario':  panelCalendario,
      'auditoria':   config('auditoria'),
    };
    const fn = mapa[panelActivo];
    if (fn) await fn(cont);
    else cont.innerHTML = '<p class="nota" style="padding:20px">Panel en construcción.</p>';
  } catch (e) {
    cont.innerHTML = `<div class="aviso error" style="margin:20px">${esc(mensajeError(e))}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// RESUMEN
// ════════════════════════════════════════════════════════════════

async function panelResumen(el) {
  let perfiles = [], proyectos = [], delegados = [];
  try {
    [perfiles, proyectos] = await Promise.all([
      api.list('profiles', { eq: { activo: true } }),
      api.list('proyectos', {}),
    ]);
    delegados = perfiles.filter(p => p.rol === 'delegado');
  } catch { /* sin datos aún */ }

  const activos = proyectos.filter(p => p.estado === 'activo').length;
  const propuestos = proyectos.filter(p => p.estado === 'propuesto').length;

  const delegadoActual = delegados[0];
  const rolLabel = r => ROLES[r] || r;
  const contPorRol = Object.fromEntries(['superadmin', 'admin', 'delegado', 'lider', 'consulta'].map(r =>
    [r, perfiles.filter(p => p.rol === r).length]
  ));

  el.innerHTML = cab('Resumen del área', [btn('🖨 Imprimir', 'imprimir')]) +
  `<div class="admin-kpis">
    <div class="admin-kpi"><span class="admin-kpi-num">${perfiles.length}</span><span class="admin-kpi-txt">Usuarios activos</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${activos}</span><span class="admin-kpi-txt">Proyectos activos</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${propuestos}</span><span class="admin-kpi-txt">Por aprobar</span></div>
    <div class="admin-kpi"><span class="admin-kpi-num">${proyectos.length - activos - propuestos}</span><span class="admin-kpi-txt">En pausa / cerrados</span></div>
  </div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px">
    <div class="tarjeta" style="flex:1;min-width:260px;padding:16px">
      <h3 style="margin:0 0 10px">Usuarios por rol</h3>
      <table class="simple">
        <thead><tr><th>Rol</th><th>Cantidad</th></tr></thead>
        <tbody>
          ${Object.entries(contPorRol).map(([r, c]) => `<tr>
            <td>${badge(rolLabel(r), COLOR_ROL[r] || '#888')}</td>
            <td><b>${c}</b></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="tarjeta" style="flex:1;min-width:260px;padding:16px">
      <h3 style="margin:0 0 10px">Administrador delegado actual</h3>
      ${delegadoActual
        ? `<p><b>${esc(delegadoActual.nombre)}</b><br>
           <small style="color:var(--gris-txt)">${esc(delegadoActual.email || delegadoActual.codigo || '')}</small></p>
           <button class="btn btn-sm" data-a="ir-delegado">Gestionar delegación →</button>`
        : `<p style="color:var(--gris-txt)">Sin delegado asignado.</p>
           <button class="btn btn-sm btn-primario" data-a="ir-delegado">Asignar delegado →</button>`}
    </div>
    ${propuestos ? `<div class="tarjeta" style="flex:1;min-width:260px;padding:16px;border-left:3px solid var(--naranja)">
      <h3 style="margin:0 0 10px">⚠ Proyectos por aprobar</h3>
      <p>${propuestos} proyecto(s) propuesto(s) esperan aprobación.</p>
      <button class="btn btn-sm btn-primario" data-a="ir-proyectos">Ver proyectos →</button>
    </div>` : ''}
  </div>`;

  el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => imprimirPanel(el, 'Resumen del área'));
  el.querySelector('[data-a="ir-delegado"]')?.addEventListener('click', () => navegarA('delegado'));
  el.querySelector('[data-a="ir-proyectos"]')?.addEventListener('click', () => navegarA('proyectos'));
}

// ════════════════════════════════════════════════════════════════
// USUARIOS Y ROLES
// ════════════════════════════════════════════════════════════════

async function panelUsuarios(el) {
  let perfiles = [];
  try {
    perfiles = (await api.list('profiles', { order: [['nombre', true]] })).filter(p => !p.eliminado);
  } catch { /* */ }
  const pendientes = perfiles.filter(p => p.rol === 'pendiente' && p.activo);

  el.innerHTML = cab('Usuarios y roles', [
    btn('+ Nuevo usuario', 'nuevo', 'btn-primario'),
    btn('✉ Invitar', 'invitar'),
    btn('🖨 Imprimir', 'imprimir'),
  ]) +
  (pendientes.length ? `<div class="aviso warn" style="margin-bottom:12px"><b>${pendientes.length} usuario(s) esperan aprobación.</b> Asígneles un rol.</div>` : '') +
  `<div class="admin-filtros">
    <input class="inp" id="buscar-usr" placeholder="Buscar por nombre o correo..." style="width:220px">
    <select class="inp" id="fil-rol">
      <option value="">Todos los roles</option>
      ${Object.entries(ROLES).filter(([k]) => k !== 'pendiente').map(([k, v]) =>
        `<option value="${k}">${esc(v)}</option>`).join('')}
    </select>
    <select class="inp" id="fil-estado">
      <option value="">Estado: todos</option>
      <option value="activo">Activo</option>
      <option value="inactivo">Inactivo</option>
    </select>
  </div>` +
  tabla(['', 'Nombre', 'Código', 'Correo', 'Rol', 'Estado', ''],
    perfiles.map(p => [
      `<span class="avatar-ico" style="background:${COLOR_ROL[p.rol] || '#ccc'}">${esc((p.nombre || '?')[0].toUpperCase())}</span>`,
      `<b>${esc(p.nombre)}</b>${p.es_admin_principal ? ' ' + badge('Principal', COLOR_ROL.superadmin || '#1565c0') : ''}`,
      esc(p.codigo || ''), esc(p.email || ''),
      badge(ROLES[p.rol] || p.rol, COLOR_ROL[p.rol] || '#888'),
      p.activo ? '<span style="color:#2e7d32">Activo</span>' : '<span style="color:var(--rojo)">Inactivo</span>',
      `<button class="btn btn-xs" data-editar="${p.id}" title="Editar">✏</button>
       ${puedeRestablecer(p) ? `<button class="btn btn-xs" data-clave="${p.id}" title="Restablecer contraseña">🔑</button>` : ''}
       ${puedeEliminar(p) ? `<button class="btn btn-xs btn-peligro" data-eliminar="${p.id}" title="Eliminar">🗑</button>` : ''}`,
    ])
  );

  const filtrar = () => {
    const q = el.querySelector('#buscar-usr')?.value.toLowerCase() || '';
    const rol = el.querySelector('#fil-rol')?.value || '';
    const est = el.querySelector('#fil-estado')?.value || '';
    el.querySelectorAll('.simple tbody tr').forEach(tr => {
      const txt = tr.textContent.toLowerCase();
      const trRol = tr.querySelector('[data-editar]') ? perfiles.find(p => p.id === tr.querySelector('[data-editar]').dataset.editar)?.rol : '';
      const trActivo = txt.includes('activo') && !txt.includes('inactivo');
      const visible = (!q || txt.includes(q)) &&
        (!rol || trRol === rol) &&
        (!est || (est === 'activo' ? trActivo : !trActivo));
      tr.style.display = visible ? '' : 'none';
    });
  };
  el.querySelector('#buscar-usr')?.addEventListener('input', filtrar);
  el.querySelector('#fil-rol')?.addEventListener('change', filtrar);
  el.querySelector('#fil-estado')?.addEventListener('change', filtrar);

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

async function nuevoUsuario() {
  const clave = generarClave();
  await pedirDatos({
    titulo: 'Nuevo usuario',
    campos: [
      { name: 'nombre', label: 'Nombre completo', required: true },
      { name: 'email', label: 'Correo electrónico', type: 'email', required: true },
      { name: 'codigo', label: 'Código / iniciales' },
      { name: 'rol', label: 'Rol', type: 'select', required: true,
        opciones: Object.entries(ROLES).filter(([k]) => !['pendiente', 'propietario'].includes(k))
          .map(([k, v]) => ({ value: k, label: v })) },
      { name: 'horas_dia', label: 'Horas disponibles / día (LPS)', type: 'number', min: 0, max: 24, step: 0.5, valor: 8 },
      { name: 'clave', label: 'Contraseña temporal', required: true, valor: clave },
    ],
    alGuardar: async d => {
      try {
        const areaId = store.area?.id;
        await api.insert('profiles', { nombre: d.nombre, email: d.email, codigo: d.codigo, rol: d.rol,
          horas_dia: d.horas_dia, area_id: areaId, activo: true });
        ok(`Usuario creado. Contraseña temporal: ${d.clave}`);
      } catch (err) { error(mensajeError(err)); }
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
      { name: 'codigo', label: 'Código / iniciales' },
      { name: 'horas_dia', label: 'Horas disponibles / día', type: 'number', min: 0, max: 24, step: 0.5 },
      { name: 'rol', label: 'Rol', type: 'select', required: true,
        opciones: Object.entries(ROLES)
          .filter(([k]) => k !== 'propietario' && !(p.es_admin_principal && k === 'pendiente'))
          .map(([k, v]) => ({ value: k, label: v })) },
      { name: 'activo', label: 'Activo', type: 'checkbox' },
    ],
    alGuardar: async d => {
      try {
        await api.update('profiles', p.id, {
          nombre: d.nombre, codigo: d.codigo, horas_dia: d.horas_dia,
          rol: d.rol, activo: d.activo,
        });
        await cargarCatalogo();
        ok('Usuario actualizado.');
      } catch (err) { error(mensajeError(err)); }
    },
  });
}

async function restablecerClave(p) {
  if (!p) return;
  const clave = generarClave();
  const si = await confirmar(`¿Restablecer la contraseña de ${p.nombre}?`, { titulo: 'Restablecer', texto: 'Restablecer' });
  if (!si) return;
  try {
    await api.update('profiles', p.id, { debe_cambiar_clave: true });
    ok(`Nueva contraseña temporal: ${clave}\nComúniquela al usuario.`);
  } catch (err) { error(mensajeError(err)); }
}

async function eliminarUsuario(p) {
  if (!p) return;
  const si = await confirmar(
    `¿Dar de baja a ${p.nombre}? Su historial se conserva.`,
    { titulo: 'Dar de baja', texto: 'Dar de baja', peligro: true }
  );
  if (!si) return;
  try {
    await api.update('profiles', p.id, { eliminado: true, activo: false });
    await cargarCatalogo();
    ok('Usuario dado de baja.');
  } catch (err) { error(mensajeError(err)); }
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
    cuerpo: `<p>Envíe este enlace al nuevo usuario. Al registrarse quedará <b>pendiente</b> y usted le asigna el rol aquí.</p>
      <input class="inp" style="width:100%" readonly value="${esc(url)}">`,
    botones: [{ texto: 'Copiar enlace', clase: 'btn-primario', accion: async () => {
      await navigator.clipboard?.writeText(url).catch(() => {});
      ok('Enlace copiado.');
    }}],
  });
}

// ════════════════════════════════════════════════════════════════
// ADMINISTRADOR DELEGADO
// ════════════════════════════════════════════════════════════════

async function panelDelegado(el) {
  let perfiles = [], historial = [];
  try {
    perfiles = (await api.list('profiles', { eq: { activo: true }, order: [['nombre', true]] }))
      .filter(p => !p.eliminado);
    historial = await api.list('historial_delegados', { order: [['created_at', false]], limit: 20 }).catch(() => []);
  } catch { /* */ }

  const delegadoActual = perfiles.find(p => p.rol === 'delegado');
  const listaLideres = perfiles.filter(p => ['lider', 'delegado', 'admin', 'superadmin'].includes(p.rol));

  el.innerHTML = cab('Administrador delegado', []) +
  `<p class="admin-sub">El delegado tiene los mismos permisos que el administrador, excepto que no puede revocar el rol al administrador principal ni eliminar usuarios. La rotación queda registrada.</p>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px">
    <div class="tarjeta" style="flex:1;min-width:280px;padding:20px">
      <h3 style="margin:0 0 12px">Delegado actual</h3>
      ${delegadoActual
        ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
             <span class="avatar-ico" style="background:${COLOR_ROL.delegado||'#F4511E'};font-size:1.4em;width:40px;height:40px;line-height:40px">${esc((delegadoActual.nombre||'?')[0].toUpperCase())}</span>
             <div><b style="font-size:1.1em">${esc(delegadoActual.nombre)}</b><br>
               <small style="color:var(--gris-txt)">${esc(delegadoActual.email || delegadoActual.codigo || '')}</small>
             </div>
           </div>
           <div style="display:flex;gap:8px">
             <button class="btn btn-sm btn-primario" data-a="cambiar">Cambiar delegado</button>
             <button class="btn btn-sm btn-warn" data-a="revocar">Revocar delegación</button>
           </div>`
        : `<p style="color:var(--gris-txt);margin-bottom:16px">No hay delegado asignado actualmente.</p>
           <button class="btn btn-sm btn-primario" data-a="asignar">Asignar delegado</button>`}
    </div>
    <div class="tarjeta" style="flex:1;min-width:280px;padding:20px">
      <h3 style="margin:0 0 12px">Historial de delegaciones</h3>
      ${!historial.length
        ? '<p style="color:var(--gris-txt);font-size:.9em">Sin registros.</p>'
        : `<table class="simple" style="font-size:.87em">
             <thead><tr><th>Usuario</th><th>Desde</th><th>Hasta</th></tr></thead>
             <tbody>${historial.map(h => `<tr>
               <td>${esc(h.nombre || h.usuario_id || '—')}</td>
               <td>${h.desde ? fmtFechaHora(h.desde) : '—'}</td>
               <td>${h.hasta ? fmtFechaHora(h.hasta) : badge('Actual', '#2e7d32')}</td>
             </tr>`).join('')}</tbody>
           </table>`}
    </div>
  </div>`;

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'asignar' || a === 'cambiar') {
      await asignarDelegado(listaLideres, delegadoActual);
      await renderPanel();
    }
    if (a === 'revocar' && delegadoActual) {
      const si = await confirmar(`¿Revocar la delegación de ${delegadoActual.nombre}?`,
        { titulo: 'Revocar delegado', texto: 'Revocar', peligro: true });
      if (!si) return;
      try {
        await api.update('profiles', delegadoActual.id, { rol: 'lider' });
        await api.insert('historial_delegados', {
          usuario_id: delegadoActual.id, nombre: delegadoActual.nombre,
          desde: delegadoActual.delegado_desde, hasta: new Date().toISOString(),
        }).catch(() => {});
        await cargarCatalogo();
        ok('Delegación revocada.');
        await renderPanel();
      } catch (err) { error(mensajeError(err)); }
    }
  });
}

async function asignarDelegado(listaLideres, delegadoActual) {
  const candidatos = listaLideres.filter(p => !p.es_admin_principal && p.id !== store.usuario?.id);
  await pedirDatos({
    titulo: 'Asignar administrador delegado',
    campos: [{
      name: 'usuario_id', label: 'Nuevo administrador delegado', type: 'select', required: true,
      opciones: candidatos.map(p => ({ value: p.id, label: `${p.nombre} (${ROLES[p.rol] || p.rol})` })),
    }],
    alGuardar: async d => {
      try {
        if (delegadoActual && delegadoActual.id !== d.usuario_id) {
          await api.update('profiles', delegadoActual.id, { rol: 'lider' });
          await api.insert('historial_delegados', {
            usuario_id: delegadoActual.id, nombre: delegadoActual.nombre,
            desde: delegadoActual.delegado_desde, hasta: new Date().toISOString(),
          }).catch(() => {});
        }
        await api.update('profiles', d.usuario_id, { rol: 'delegado', delegado_desde: new Date().toISOString() });
        await cargarCatalogo();
        ok('Delegado asignado correctamente.');
      } catch (err) { error(mensajeError(err)); }
    },
  });
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
  const propuestos = proyectos.filter(p => p.estado === 'propuesto');
  const nomPort = id => portafolios.find(x => x.id === id)?.nombre || '';
  const nomProg = id => programas.find(x => x.id === id)?.nombre || '';
  const lidNames = p => lideresProy.filter(l => l.proyecto_id === p.id).map(l => nombre(l.usuario_id)).join(', ');

  el.innerHTML = cab('Proyectos y procesos', [
    btn('+ Nuevo proyecto', 'nuevo', 'btn-primario'),
    btn('🖨 Imprimir', 'imprimir'),
  ]) +
  (propuestos.length ? `<div class="aviso warn" style="margin-bottom:12px"><b>${propuestos.length} proyecto(s) propuesto(s) esperan aprobación.</b></div>` : '') +
  `<div class="admin-filtros">
    <input class="inp" id="buscar-proy" placeholder="Buscar por código o nombre..." style="width:220px">
    <select class="inp" id="fil-port"><option value="">Portafolio: todos</option>
      ${portafolios.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}<option value="-">Sin portafolio</option></select>
    <select class="inp" id="fil-est"><option value="">Estado: todos</option>
      ${Object.entries(labelEst).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
  </div>
  <div class="tarjeta admin-tabla-wrap">
    <table class="simple" id="tabla-proy">
      <thead><tr><th>CÓDIGO</th><th>NOMBRE</th><th>SUB-PROYECTO DE</th><th>PORTAFOLIO</th><th>PROGRAMA</th><th>GERENCIA</th><th>ESTADO</th><th>LÍDERES</th><th></th></tr></thead>
      <tbody>${proyectos.map(p => `<tr data-port="${p.portafolio_id || '-'}" data-est="${p.estado || ''}">
          <td><b>${esc(p.codigo || '—')}</b></td>
          <td>${esc(p.nombre_corto || '—')}</td>
          <td>${esc(proyectos.find(x => x.id === p.padre_id)?.nombre_corto || '—')}</td>
          <td>${esc(nomPort(p.portafolio_id) || '—')}</td>
          <td>${esc(nomProg(p.programa_id) || '—')}</td>
          <td>${esc(etiqueta(p.gerencia_id) || '—')}</td>
          <td>${badge(labelEst[p.estado] || p.estado, colorEst[p.estado] || '#888')}</td>
          <td><small>${esc(lidNames(p) || '—')}</small></td>
          <td>
            <button class="btn btn-xs" data-editar="${p.id}">Editar</button>
            ${p.estado === 'propuesto' ? `
              <button class="btn btn-xs btn-primario" data-aprobar="${p.id}">Aprobar</button>
              <button class="btn btn-xs btn-warn" data-rechazar="${p.id}">Rechazar</button>` : ''}
            ${['cerrado', 'rechazado', 'propuesto'].includes(p.estado) ? '' :
              `<button class="btn btn-xs btn-warn" data-estado="${p.id}" data-nuevo-est="${p.estado === 'activo' ? 'en_pausa' : 'activo'}">
                ${p.estado === 'activo' ? 'Pausar' : 'Activar'}</button>`}
          </td></tr>`).join('')}</tbody>
    </table>
    <div style="text-align:right;padding:8px;color:var(--gris-txt);font-size:.85em">${proyectos.length} registro(s)</div>
  </div>`;

  const filtrar = () => {
    const q = (el.querySelector('#buscar-proy')?.value || '').toLowerCase();
    const port = el.querySelector('#fil-port')?.value || '';
    const est = el.querySelector('#fil-est')?.value || '';
    el.querySelectorAll('#tabla-proy tbody tr').forEach(tr => {
      tr.style.display = (!q || tr.textContent.toLowerCase().includes(q)) && (!port || tr.dataset.port === port) && (!est || tr.dataset.est === est) ? '' : 'none';
    });
  };
  el.querySelector('#buscar-proy')?.addEventListener('input', filtrar);
  el.querySelector('#fil-port')?.addEventListener('change', filtrar);
  el.querySelector('#fil-est')?.addEventListener('change', filtrar);

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

// ════════════════════════════════════════════════════════════════
// ESTRUCTURA: EMPRESA → PORTAFOLIO → PROGRAMA → PROYECTO
// ════════════════════════════════════════════════════════════════

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
  const { portafolios, programas, proyectos } = await cargarEstructura();
  const vivos = proyectos.filter(p => !['cerrado', 'rechazado'].includes(p.estado));
  const subs = p => vivos.filter(x => x.padre_id === p.id);
  const itemProy = p => `<li class="est-proy"><b>${esc(p.codigo)}</b> · ${esc(p.nombre_corto)} <small class="nota">${esc(p.estado)}</small>
    ${subs(p).length ? `<ul>${subs(p).map(x => `<li class="est-proy">▫ <b>${esc(x.codigo)}</b> · ${esc(x.nombre_corto)} <small class="nota">sub-proyecto</small></li>`).join('')}</ul>` : ''}</li>`;
  const ramaPrograma = g => {
    const ps = vivos.filter(p => p.programa_id === g.id && !p.padre_id);
    return `<li><span class="est-prog">📁 ${esc(g.nombre)}</span> ${g.estado === 'inactivo' ? estadoEst(g.estado) : ''}
      <small class="nota">${ps.length} proyecto(s)</small>${ps.length ? `<ul>${ps.map(itemProy).join('')}</ul>` : ''}</li>`;
  };
  const ramaPortafolio = f => {
    const gs = programas.filter(g => g.portafolio_id === f.id);
    const ps = vivos.filter(p => p.portafolio_id === f.id && !p.programa_id && !p.padre_id);
    return `<li><span class="est-port">🗂 ${esc(f.nombre)}</span> ${f.estado === 'inactivo' ? estadoEst(f.estado) : ''}
      <ul>${gs.map(ramaPrograma).join('')}${ps.map(itemProy).join('')}${!gs.length && !ps.length ? '<li class="nota">Sin programas ni proyectos</li>' : ''}</ul></li>`;
  };
  const progSueltos = programas.filter(g => !g.portafolio_id);
  const proySueltos = vivos.filter(p => !p.portafolio_id && !p.programa_id && !p.padre_id);
  el.innerHTML = cab('Estructura de la empresa', [btn('🖨 Imprimir', 'imprimir')]) +
    `<p class="admin-sub">Cada proyecto puede pertenecer a un programa, y cada programa a un portafolio. Se asignan en
      <b>Portafolios</b>, <b>Programas</b> y en el formulario de cada proyecto.</p>
    <div class="tarjeta est-arbol"><ul>
      <li><span class="est-emp">🏢 ${esc(store.area?.nombre || 'Empresa')}</span>
        <ul>${portafolios.map(ramaPortafolio).join('')}
          ${progSueltos.length ? `<li><span class="est-port nota">Programas sin portafolio</span><ul>${progSueltos.map(ramaPrograma).join('')}</ul></li>` : ''}
          ${proySueltos.length ? `<li><span class="est-port nota">Proyectos sin portafolio ni programa (${proySueltos.length})</span><ul>${proySueltos.map(itemProy).join('')}</ul></li>` : ''}
        </ul></li></ul></div>`;
  el.addEventListener('click', e => { if (e.target.closest('[data-a="imprimir"]')) imprimirPanel(el, 'Estructura de la empresa'); });
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
       <button class="btn btn-xs" data-proyectos="${g.id}">Proyectos…</button>
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

// ════════════════════════════════════════════════════════════════
// LISTAS CONFIGURABLES
// ════════════════════════════════════════════════════════════════

async function panelListas(el) {
  let listas = [];
  try { listas = await api.list('listas_configurables', { order: [['nombre', true]] }); } catch { /* */ }

  const listasAMostrar = listas.length ? listas : LISTAS_INICIALES.map(n => ({ nombre: n, valores: [], activo: true }));
  let listaActiva = listasAMostrar[0];

  const renderListas = () => {
    el.innerHTML = cab('Listas configurables', [
      btn('+ Nueva lista', 'nueva-lista', 'btn-primario'),
      btn('🖨 Imprimir', 'imprimir'),
    ]) +
    `<p class="admin-sub">Todas las listas desplegables del aplicativo. Los valores con 🔒 son protegidos: se pueden renombrar, no eliminar (se usan en cálculos).</p>
    <div style="display:flex;gap:16px;margin-top:12px">
      <div style="width:220px;flex-shrink:0">
        ${listasAMostrar.map((l, i) => `<button class="admin-rep-btn${listaActiva === l || listaActiva?.id === l?.id ? ' activo' : ''}" data-lista="${i}" style="${l.activo === false ? 'opacity:.5' : ''}">
          ${esc(l.nombre)} ${l.activo === false ? '<small>(inactiva)</small>' : ''}
        </button>`).join('')}
      </div>
      <div style="flex:1" id="lista-detalle">
        <div class="admin-cargando"><span class="spinner"></span></div>
      </div>
    </div>`;

    renderDetallelista(el.querySelector('#lista-detalle'), listaActiva);

    el.querySelectorAll('[data-lista]').forEach(b => b.addEventListener('click', () => {
      listaActiva = listasAMostrar[+b.dataset.lista];
      el.querySelectorAll('[data-lista]').forEach(x => x.classList.toggle('activo', x === b));
      renderDetallelista(el.querySelector('#lista-detalle'), listaActiva);
    }));

    el.querySelector('[data-a="nueva-lista"]')?.addEventListener('click', async () => {
      await pedirDatos({
        titulo: 'Nueva lista configurable',
        campos: [
          { name: 'nombre', label: 'Nombre de la lista', required: true },
          { name: 'descripcion', label: 'Descripción' },
        ],
        alGuardar: async d => {
          try {
            await api.insert('listas_configurables', { ...d, area_id: store.area?.id, valores: [], activo: true });
            ok('Lista creada.');
            listas = await api.list('listas_configurables', { order: [['nombre', true]] }).catch(() => listas);
            renderListas();
          } catch (err) { error(mensajeError(err)); }
        },
      });
    });
    el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => imprimirPanel(el, 'Listas configurables'));
  };

  renderListas();
}

function renderDetallelista(cont, lista) {
  if (!cont || !lista) return;
  const valores = lista.valores || [];
  cont.innerHTML = `
    <div class="tarjeta" style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0">${esc(lista.nombre)}</h3>
        <div style="display:flex;gap:8px">
          ${lista.id ? `<button class="btn btn-sm" data-a="exportar-lista">⬇ Exportar</button>` : ''}
          <button class="btn btn-sm btn-primario" data-a="nuevo-valor">+ Agregar valor</button>
          ${lista.id && lista.activo !== false
            ? `<button class="btn btn-sm btn-warn" data-a="desactivar-lista">Desactivar lista</button>`
            : lista.id ? `<button class="btn btn-sm" data-a="activar-lista">Activar lista</button>` : ''}
        </div>
      </div>
      ${!valores.length
        ? `<p style="color:var(--gris-txt)">Sin valores. Use "Agregar valor" para comenzar.</p>`
        : `<table class="simple">
          <thead><tr><th style="width:28px"></th><th>VALOR</th><th>COLOR</th><th>ACTIVO</th><th></th></tr></thead>
          <tbody>${valores.map((v, i) => `<tr>
            <td style="cursor:move;color:var(--gris-txt)">⠿</td>
            <td>${v.protegido ? '🔒 ' : ''}${esc(v.valor || v.nombre || v)}</td>
            <td>${v.color ? `<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${esc(v.color)};vertical-align:middle"></span>` : '—'}</td>
            <td>${v.activo !== false ? '✓' : '<span style="color:var(--gris-txt)">—</span>'}</td>
            <td>
              <button class="btn btn-xs" data-editar-val="${i}">✏</button>
              ${v.protegido ? '' : `<button class="btn btn-xs ${v.activo !== false ? 'btn-warn' : ''}" data-toggle-val="${i}">${v.activo !== false ? 'Desact.' : 'Activar'}</button>`}
            </td>
          </tr>`).join('')}</tbody>
        </table>`}
    </div>`;

  cont.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const iEdit = e.target.closest('[data-editar-val]')?.dataset.editarVal;
    const iToggle = e.target.closest('[data-toggle-val]')?.dataset.toggleVal;
    if (a === 'nuevo-valor') await agregarValorLista(lista, valores, cont);
    if (a === 'exportar-lista') exportarListaCSV(lista);
    if (iEdit !== undefined) await editarValorLista(lista, valores, +iEdit, cont);
    if (iToggle !== undefined) await toggleValorLista(lista, valores, +iToggle, cont);
    if (a === 'desactivar-lista' && lista.id) {
      await api.update('listas_configurables', lista.id, { activo: false }).catch(() => {});
      lista.activo = false;
      ok('Lista desactivada.');
      renderDetallelista(cont, lista);
    }
    if (a === 'activar-lista' && lista.id) {
      await api.update('listas_configurables', lista.id, { activo: true }).catch(() => {});
      lista.activo = true;
      ok('Lista activada.');
      renderDetallelista(cont, lista);
    }
  });
}

async function agregarValorLista(lista, valores, cont) {
  await pedirDatos({
    titulo: `Agregar valor a: ${lista.nombre}`,
    campos: [
      { name: 'valor', label: 'Valor', required: true },
      { name: 'color', label: 'Color (ej: #2e7d32)', type: 'color' },
    ],
    alGuardar: async d => {
      const nuevosValores = [...valores, { valor: d.valor, color: d.color || null, activo: true }];
      if (lista.id) {
        await api.update('listas_configurables', lista.id, { valores: nuevosValores });
      } else {
        await api.insert('listas_configurables', { nombre: lista.nombre, valores: nuevosValores, area_id: store.area?.id, activo: true });
      }
      lista.valores = nuevosValores;
      ok('Valor agregado.');
      renderDetallelista(cont, lista);
    },
  });
}

async function editarValorLista(lista, valores, idx, cont) {
  const v = valores[idx];
  if (!v) return;
  await pedirDatos({
    titulo: `Editar valor`,
    valores: { valor: v.valor || v.nombre || v, color: v.color || '' },
    campos: [
      { name: 'valor', label: 'Valor', required: true },
      { name: 'color', label: 'Color', type: 'color' },
    ],
    alGuardar: async d => {
      const nuevosValores = [...valores];
      nuevosValores[idx] = { ...v, valor: d.valor, color: d.color || null };
      if (lista.id) await api.update('listas_configurables', lista.id, { valores: nuevosValores });
      lista.valores = nuevosValores;
      ok('Valor actualizado.');
      renderDetallelista(cont, lista);
    },
  });
}

async function toggleValorLista(lista, valores, idx, cont) {
  const v = valores[idx];
  if (!v || v.protegido) return;
  const nuevosValores = [...valores];
  nuevosValores[idx] = { ...v, activo: v.activo === false };
  if (lista.id) await api.update('listas_configurables', lista.id, { valores: nuevosValores }).catch(() => {});
  lista.valores = nuevosValores;
  renderDetallelista(cont, lista);
}

function exportarListaCSV(lista) {
  const filas = (lista.valores || []).map(v => `"${(v.valor || v.nombre || v).replace(/"/g, '""')}","${v.color || ''}","${v.activo !== false ? 'Activo' : 'Inactivo'}"`);
  const csv = 'Valor,Color,Estado\n' + filas.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lista_${lista.nombre.replace(/[^a-z0-9]/gi, '_')}.csv`;
  a.click();
}

// ════════════════════════════════════════════════════════════════
// PARÁMETROS
// ════════════════════════════════════════════════════════════════

async function panelParametros(el) {
  let params = {};
  try { params = (await api.list('parametros', { limit: 1 }))[0] || {}; } catch { /* */ }

  el.innerHTML = cab('Parámetros del sistema', [btn('Guardar', 'guardar', 'btn-primario')]) +
  `<p class="admin-sub">Valores que controlan el comportamiento del aplicativo. Los cambios son inmediatos para todos los usuarios.</p>
  <div class="tarjeta" style="padding:20px;margin-top:12px;max-width:560px">
    <table class="simple">
      <tbody>
        <tr><td><b>Meta de PAC (%)</b></td>
          <td><input class="inp" type="number" id="meta-pac" min="0" max="100" value="${esc(String(params.meta_pac ?? 80))}"></td></tr>
        <tr><td><b>Umbral ámbar del PAC (%)</b></td>
          <td><input class="inp" type="number" id="umbral-ambar" min="0" max="100" value="${esc(String(params.umbral_ambar ?? 60))}"></td></tr>
        <tr><td><b>Semanas de Look Ahead</b></td>
          <td><input class="inp" type="number" id="sem-la" min="1" max="12" value="${esc(String(params.semanas_la ?? 3))}"></td></tr>
        <tr><td><b>Día de cierre semanal</b></td>
          <td><select class="inp" id="dia-cierre">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((d, i) =>
              `<option value="${i+1}"${(params.dia_cierre||5) === i+1 ? ' selected' : ''}>${d}</option>`).join('')}
          </select></td></tr>
        <tr><td><b>Hora de cierre</b></td>
          <td><input class="inp" type="time" id="hora-cierre" value="${esc(params.hora_cierre || '17:00')}"></td></tr>
        <tr><td><b>Día de reunión semanal</b></td>
          <td><select class="inp" id="dia-reunion">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((d, i) =>
              `<option value="${i+1}"${(params.dia_reunion||5) === i+1 ? ' selected' : ''}>${d}</option>`).join('')}
          </select></td></tr>
        <tr><td><b>Hora de reunión</b></td>
          <td><input class="inp" type="time" id="hora-reunion" value="${esc(params.hora_reunion || '08:00')}"></td></tr>
        <tr><td><b>Días laborables</b></td>
          <td>
            ${['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map((d, i) =>
              `<label style="margin-right:8px"><input type="checkbox" class="chk-lab" value="${i+1}"
                ${((params.dias_laborables || [1,2,3,4,5]).includes(i+1)) ? 'checked' : ''}> ${d}</label>`).join('')}
          </td></tr>
        <tr><td><b>Días de anticipación de alertas</b></td>
          <td><input class="inp" type="number" id="dias-alerta" min="0" max="30" value="${esc(String(params.dias_alerta ?? 2))}"></td></tr>
      </tbody>
    </table>
  </div>`;

  el.querySelector('[data-a="guardar"]')?.addEventListener('click', async () => {
    const diasLab = [...el.querySelectorAll('.chk-lab:checked')].map(c => +c.value);
    const datos = {
      meta_pac: +el.querySelector('#meta-pac').value,
      umbral_ambar: +el.querySelector('#umbral-ambar').value,
      semanas_la: +el.querySelector('#sem-la').value,
      dia_cierre: +el.querySelector('#dia-cierre').value,
      hora_cierre: el.querySelector('#hora-cierre').value,
      dia_reunion: +el.querySelector('#dia-reunion').value,
      hora_reunion: el.querySelector('#hora-reunion').value,
      dias_laborables: diasLab,
      dias_alerta: +el.querySelector('#dias-alerta').value,
      area_id: store.area?.id,
    };
    try {
      if (params.id) await api.update('parametros', params.id, datos);
      else await api.insert('parametros', datos);
      ok('Parámetros guardados correctamente.');
    } catch (err) { error(mensajeError(err)); }
  });
}

// ════════════════════════════════════════════════════════════════
// CALENDARIO
// ════════════════════════════════════════════════════════════════

async function panelCalendario(el) {
  let semanas = [], feriados = [];
  const anioActual = new Date().getFullYear();
  let anio = anioActual;

  const cargarDatos = async () => {
    try {
      [semanas, feriados] = await Promise.all([
        api.list('semanas', { eq: { anio }, order: [['numero', true]] }).catch(() => []),
        api.list('feriados', { order: [['fecha', true]] }).catch(() => []),
      ]);
    } catch { /* */ }
  };

  await cargarDatos();

  const render = () => {
    el.innerHTML = cab('Calendario', [
      btn('+ Agregar feriado', 'nuevo-feriado'),
      btn('Generar semanas del año', 'gen-semanas', 'btn-primario'),
    ]) +
    `<div class="admin-filtros">
      <label>Año:
        <select class="inp" id="sel-anio">
          ${[anioActual - 1, anioActual, anioActual + 1, anioActual + 2].map(a =>
            `<option value="${a}"${a === anio ? ' selected' : ''}>${a}</option>`).join('')}
        </select>
      </label>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px">
      <div class="tarjeta" style="flex:1;min-width:300px;padding:16px;max-height:480px;overflow-y:auto">
        <h3 style="margin:0 0 10px">Semanas ${anio}</h3>
        ${!semanas.length
          ? `<p style="color:var(--gris-txt)">Sin semanas generadas. Use "Generar semanas del año".</p>`
          : `<table class="simple" style="font-size:.87em">
              <thead><tr><th>Semana</th><th>Lunes</th><th>Domingo</th><th>Estado</th></tr></thead>
              <tbody>${semanas.map(s => `<tr>
                <td><b>S-${String(s.numero).padStart(2, '0')}</b></td>
                <td>${s.fecha_inicio || '—'}</td>
                <td>${s.fecha_fin || '—'}</td>
                <td>${badge(s.estado || 'abierta', s.estado === 'cerrada' ? '#546E7A' : '#2e7d32')}</td>
              </tr>`).join('')}</tbody>
            </table>`}
      </div>
      <div class="tarjeta" style="flex:1;min-width:260px;padding:16px;max-height:480px;overflow-y:auto">
        <h3 style="margin:0 0 10px">Feriados y días no laborables</h3>
        ${!feriados.length
          ? `<p style="color:var(--gris-txt)">Sin feriados registrados.</p>`
          : `<table class="simple" style="font-size:.87em">
              <thead><tr><th>Fecha</th><th>Descripción</th><th></th></tr></thead>
              <tbody>${feriados.map(f => `<tr>
                <td>${esc(f.fecha || '—')}</td>
                <td>${esc(f.descripcion || '—')}</td>
                <td><button class="btn btn-xs btn-peligro" data-del-feriado="${f.id}">🗑</button></td>
              </tr>`).join('')}</tbody>
            </table>`}
      </div>
    </div>`;

    el.querySelector('#sel-anio')?.addEventListener('change', async e => {
      anio = +e.target.value;
      await cargarDatos();
      render();
    });

    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      const idDel = e.target.closest('[data-del-feriado]')?.dataset.delFeriado;
      if (a === 'nuevo-feriado') {
        await pedirDatos({
          titulo: 'Agregar feriado',
          campos: [
            { name: 'fecha', label: 'Fecha', type: 'date', required: true },
            { name: 'descripcion', label: 'Descripción', required: true },
          ],
          alGuardar: async d => {
            try {
              await api.insert('feriados', { ...d, area_id: store.area?.id });
              ok('Feriado registrado.');
              await cargarDatos();
              render();
            } catch (err) { error(mensajeError(err)); }
          },
        });
      }
      if (a === 'gen-semanas') {
        const si = await confirmar(
          `¿Generar las semanas lunes-domingo para el año ${anio}? Las semanas existentes no se sobrescriben.`,
          { titulo: 'Generar semanas', texto: 'Generar' }
        );
        if (!si) return;
        try {
          const generadas = generarSemanas(anio);
          let cont2 = 0;
          for (const s of generadas) {
            const existe = semanas.find(x => x.numero === s.numero && x.anio === anio);
            if (!existe) {
              await api.insert('semanas', { ...s, anio, area_id: store.area?.id, estado: 'abierta' });
              cont2++;
            }
          }
          ok(`${cont2} semana(s) generada(s) para el año ${anio}.`);
          await cargarDatos();
          render();
        } catch (err) { error(mensajeError(err)); }
      }
      if (idDel) {
        const si = await confirmar('¿Eliminar este feriado?', { titulo: 'Eliminar', texto: 'Eliminar', peligro: true });
        if (!si) return;
        try {
          await api.removeWhere('feriados', { eq: { id: idDel } });
          ok('Feriado eliminado.');
          await cargarDatos();
          render();
        } catch (err) { error(mensajeError(err)); }
      }
    });
  };

  render();
}

function generarSemanas(anio) {
  const semanas = [];
  let fecha = new Date(anio, 0, 1);
  const dow = fecha.getDay();
  if (dow !== 1) {
    const diff = dow === 0 ? -6 : 1 - dow;
    fecha.setDate(fecha.getDate() + diff);
  }
  let num = 1;
  while (fecha.getFullYear() <= anio || num <= 53) {
    const lunes = new Date(fecha);
    const domingo = new Date(fecha);
    domingo.setDate(domingo.getDate() + 6);
    if (lunes.getFullYear() > anio && domingo.getFullYear() > anio) break;
    semanas.push({
      numero: num,
      fecha_inicio: lunes.toISOString().slice(0, 10),
      fecha_fin: domingo.toISOString().slice(0, 10),
    });
    fecha.setDate(fecha.getDate() + 7);
    num++;
    if (num > 54) break;
  }
  return semanas;
}

// ════════════════════════════════════════════════════════════════
// AUDITORÍA
// ════════════════════════════════════════════════════════════════

async function panelAuditoria(el) {
  let registros = [];
  try { registros = await api.list('auditoria', { order: [['created_at', false]], limit: 100 }); } catch { /* */ }

  el.innerHTML = cab('Auditoría', [btn('🖨 Imprimir', 'imprimir')]) +
  `<p class="admin-sub">Registro de acciones importantes realizadas en el aplicativo (últimas 100).</p>` +
  (!registros.length
    ? '<div class="aviso info" style="margin-top:12px">Sin registros. La tabla <code>auditoria</code> debe estar configurada en la base de datos.</div>'
    : tabla(
        ['Fecha', 'Usuario', 'Acción', 'Detalle'],
        registros.map(r => [
          fmtFechaHora(r.created_at),
          esc(r.usuario_nombre || '—'),
          `<code>${esc(r.accion || '—')}</code>`,
          esc(r.detalle || '—'),
        ])
      ));

  el.querySelector('[data-a="imprimir"]')?.addEventListener('click', () => imprimirPanel(el, 'Auditoría'));
}

// ════════════════════════════════════════════════════════════════
// Utilidades compartidas
// ════════════════════════════════════════════════════════════════

function generarClave() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const n = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(n, x => c[x % c.length]).join('');
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
