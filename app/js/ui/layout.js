// Estructura general: cabecera, navegación lateral y menú de proyectos (6.3), notificaciones y usuario. v1.1
import { api, modoDemo, mensajeError } from '../data/api.js';
import { store, on, esGestor, esStaff, esAdmin, puede, seleccionarProyecto, misProyectos, etiqueta, cargarCatalogo, rol } from '../core/store.js';
import { ROLES } from '../data/catalogos.js';
import { esc, html, normalizar, agrupar, fmtFechaHora } from '../core/util.js';
import { ir } from '../core/router.js';
import { pedirDatos, ok, error, arrastrable } from './ui.js';

export const NAV = [
  { grupo: 'Administración' },
  { ruta: '/admin', ico: '⚙', texto: 'Administración', si: esAdmin, prefijo: '/admin' },
  { grupo: 'Planificación' },
  { ruta: '/plan', ico: '📅', texto: 'Plan semanal', si: esStaff },
  { ruta: '/lookahead', ico: '🔭', texto: 'Look Ahead', si: esStaff },
  { ruta: '/restricciones', ico: '🚧', texto: 'Restricciones', si: esStaff },
  { ruta: '/cartera', ico: '🗂', texto: 'Cartera y solicitudes', si: () => esStaff() || puede('crear_solicitud') },
  { grupo: 'Seguimiento' },
  { ruta: '/tablero', ico: '📊', texto: 'Tablero', si: () => puede('ver_indicadores') },
  { ruta: '/reunion', ico: '👥', texto: 'Reunión semanal', si: esStaff },
  { ruta: '/equipo', ico: '🧭', texto: 'Equipo y capacidad', si: esStaff },
  { ruta: '/reportes', ico: '🖨', texto: 'Reportes', si: () => esStaff() || puede('ver_indicadores') },
  { grupo: 'Más' },
  { ruta: '/config/usuarios', ico: '⚙', texto: 'Configuración', si: esGestor, prefijo: '/config' },
  { ruta: '/plantillas', ico: '🧩', texto: 'Plantillas', si: esStaff },
  { ruta: '/mejoras', ico: '💡', texto: 'Mejoras del aplicativo', si: () => true },
  { ruta: '/ayuda', ico: '❔', texto: 'Ayuda', si: () => true },
];

let pestanaProy = localStorage.getItem('lpsgt-pestana-proy') || '';
let filtroProy = '';

export function montarLayout(raiz, { alSalir }) {
  const u = store.usuario;
  const iniciales = (u.codigo || u.nombre || '?').slice(0, 2).toUpperCase();
  raiz.innerHTML = '';
  const app = html(`<div id="app">
    <header class="cabecera">
      <button class="btn-icono btn-menu" data-a="menu" aria-label="Contraer o expandir el menú" title="Contraer / expandir el menú lateral">☰</button>
      <a class="logo" href="#/"><span>LPS<b>-GES</b></span></a>
      <span class="cab-area">${esc(store.area?.nombre || '')}</span>
      ${modoDemo ? '<span class="demo-chip" title="Datos ficticios guardados solo en este navegador">MODO DEMOSTRACIÓN</span>' : ''}
      <span class="flex"></span>
      <span class="tam-letra" title="Tamaño de letra y de las filas"><button data-a="letra-normal" aria-label="Letra normal">A</button><button data-a="letra-grande" aria-label="Letra grande">A+</button></span>
      <span class="btn-actualizar"><button class="btn-texto-cab" data-a="actualizar" title="Actualizar la página">Actualizar</button><button class="btn-icono btn-flecha" data-a="actualizar-menu" title="Más opciones de actualización" aria-label="Opciones de actualización">▾</button></span>
      <button class="btn-icono" data-a="ayuda" title="Ayuda y recorrido guiado" aria-label="Ayuda">❔</button>
      <button class="btn-icono" data-a="notif" title="Notificaciones" aria-label="Notificaciones">🔔<span class="contador oculto"></span></button>
      <button class="usuario-btn" data-a="usuario"><span class="avatar">${esc(iniciales)}</span><span class="nom">${esc(u.nombre)}</span></button>
    </header>
    <aside class="lateral"><div class="lateral-tirador" title="Arrastre para cambiar el ancho del menú (doble clic: ancho normal)"></div>
      <nav class="nav" aria-label="Navegación principal"></nav>
      <section class="menu-proy" aria-label="Menú de proyectos">
        <div class="menu-proy-cab"><h3>Proyectos</h3>
          ${esGestor() || puede('crear_cartera') ? `<button class="btn btn-sm btn-primario btn-agregar-proy" data-a="nuevo-proy" title="Agregar un proyecto nuevo (lo verá todo el equipo)">＋ ${esGestor() ? 'Agregar' : 'Proponer'}</button>` : ''}</div>
        <div class="pestanas" role="tablist">
          ${esStaff() ? '<button data-p="mis">Mis</button>' : ''}<button data-p="todos">Todos</button><button data-p="fav">★ Favoritos</button>
        </div>
        <input type="search" placeholder="Buscar código o nombre…" aria-label="Buscar proyecto">
        <div class="proy-lista"></div>
      </section>
    </aside>
    <main class="contenido" id="contenido" tabindex="-1"></main>
  </div>`);
  raiz.append(app);
  if (!pestanaProy) pestanaProy = esGestor() || !misProyectos().length ? 'todos' : 'mis';
  if (!esStaff() && pestanaProy === 'mis') pestanaProy = 'todos';

  pintarNav();
  pintarProyectos();
  aplicarPreferencias({});
  tiradorLateral(app);
  document.addEventListener('ruta', pintarNav);
  on('catalogo', () => { pintarProyectos(); });
  on('proyecto', () => pintarProyectos());

  app.querySelector('.menu-proy input').addEventListener('input', e => { filtroProy = e.target.value; pintarProyectos(); });
  app.querySelector('.pestanas').addEventListener('click', e => {
    const p = e.target.closest('[data-p]')?.dataset.p;
    if (!p) return;
    pestanaProy = p;
    localStorage.setItem('lpsgt-pestana-proy', p);
    pintarProyectos();
  });
  app.querySelector('.proy-lista').addEventListener('click', async e => {
    const est = e.target.closest('.estrella');
    if (est) {
      e.stopPropagation();
      const id = est.dataset.id;
      try {
        if (store.favoritos.has(id)) { await api.removeWhere('proyecto_favoritos', { eq: { usuario_id: u.id, proyecto_id: id } }); store.favoritos.delete(id); }
        else { await api.insert('proyecto_favoritos', { usuario_id: u.id, proyecto_id: id }); store.favoritos.add(id); }
      } catch (err) { error(mensajeError(err)); }
      pintarProyectos();
      return;
    }
    const r = e.target.closest('[data-rama]');
    if (r && (r.dataset.rama !== 'empresa' || e.target.closest('[data-solo-rama]'))) { alternarRama(r.dataset.rama); return; }
    const it = e.target.closest('.proy-item, .arbol-emp');
    if (it) {
      seleccionarProyecto(it.dataset.id);
      document.body.classList.remove('menu-abierto');
    }
  });

  app.querySelector('.cabecera').addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'menu') {
      if (matchMedia('(max-width: 900px)').matches) document.body.classList.toggle('menu-abierto');
      else aplicarPreferencias({ contraido: !preferencias.contraido });
    }
    if (a === 'letra-normal' || a === 'letra-grande') aplicarPreferencias({ letraGrande: a === 'letra-grande' });
    if (a === 'notif') panelNotificaciones();
    if (a === 'usuario') menuUsuario(alSalir);
    if (a === 'actualizar') location.reload();
    if (a === 'actualizar-menu') menuActualizar();
    if (a === 'ayuda') import('../views/ayuda.js').then(m => m.iniciarRecorrido(true));
  });
  app.querySelector('[data-a="nuevo-proy"]')?.addEventListener('click', () => import('../views/proyectos.js').then(m => m.formularioProyecto()));

  try {
    const previa = sessionStorage.getItem('lpsgt-recarga-forzada');
    if (previa !== null) {
      sessionStorage.removeItem('lpsgt-recarga-forzada');
      const actual = versionApp();
      ok(previa === actual ? `Caché vaciada. Ya tenía la última versión publicada (${actual}).` : `Aplicativo actualizado a la versión ${actual}.`);
    }
  } catch { /* opcional */ }

  cargarNotificaciones();
  api.subscribe(['notificaciones'], ev => {
    if (ev.fila?.usuario_id === u.id || ev.anterior?.usuario_id === u.id) cargarNotificaciones();
  });
  const recargar = debounceCatalogo();
  api.subscribe(['lista_valores', 'proyectos', 'portafolios', 'programas'], () => recargar());
  return app.querySelector('#contenido');
}

function debounceCatalogo() {
  let t;
  return () => { clearTimeout(t); t = setTimeout(() => cargarCatalogo().catch(() => {}), 800); };
}

const preferencias = (() => {
  try { return { ancho: 260, contraido: false, letraGrande: false, ...JSON.parse(localStorage.getItem('lpsgt-vista') || '{}') }; }
  catch { return { ancho: 260, contraido: false, letraGrande: false }; }
})();

function aplicarPreferencias(cambios) {
  Object.assign(preferencias, cambios);
  try { localStorage.setItem('lpsgt-vista', JSON.stringify(preferencias)); } catch { /* sin almacenamiento */ }
  const app = document.getElementById('app');
  if (app) app.style.setProperty('--lateral', preferencias.contraido ? '60px' : `${preferencias.ancho}px`);
  document.body.classList.toggle('lateral-contraido', !!preferencias.contraido);
  document.documentElement.classList.toggle('letra-grande', !!preferencias.letraGrande);
  document.querySelectorAll('.tam-letra button').forEach(b => b.classList.toggle('activo', (b.dataset.a === 'letra-grande') === !!preferencias.letraGrande));
  clearTimeout(aplicarPreferencias.t);
  aplicarPreferencias.t = setTimeout(() => (window.Tabulator?.findTable?.('.tabulator') || []).forEach(t => t.redraw(true)), 80);
}

function tiradorLateral(app) {
  const tirador = app.querySelector('.lateral-tirador');
  tirador.addEventListener('dblclick', () => aplicarPreferencias({ ancho: 260, contraido: false }));
  tirador.addEventListener('mousedown', e => {
    e.preventDefault();
    const x0 = e.clientX, a0 = preferencias.contraido ? 60 : preferencias.ancho;
    document.body.classList.add('arrastrando-lateral');
    const mover = ev => {
      const ancho = Math.round(Math.min(460, Math.max(60, a0 + ev.clientX - x0)));
      aplicarPreferencias(ancho < 150 ? { contraido: true } : { contraido: false, ancho });
    };
    const soltar = () => { document.body.classList.remove('arrastrando-lateral'); removeEventListener('mousemove', mover); removeEventListener('mouseup', soltar); };
    addEventListener('mousemove', mover); addEventListener('mouseup', soltar);
  });
}

function pintarNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const actual = location.hash.replace(/^#/, '').split('?')[0];
  nav.innerHTML = NAV.filter(n => n.grupo || n.si()).map(n => n.grupo
    ? `<div class="nav-grupo">${esc(n.grupo)}</div>`
    : `<a href="#${n.ruta}" title="${esc(n.texto)}" class="${actual === n.ruta || actual.startsWith((n.prefijo || n.ruta) + '/') ? 'activo' : ''}"><span class="ico">${n.ico}</span><span class="txt">${esc(n.texto)}</span></a>`).join('');
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-abierto')));
}

// Ramas contraídas del árbol de proyectos (por computadora)
const contraidosProy = (() => { try { return new Set(JSON.parse(localStorage.getItem('lpsgt-arbol-proy') || '[]')); } catch { return new Set(); } })();
function alternarRama(clave) {
  contraidosProy.has(clave) ? contraidosProy.delete(clave) : contraidosProy.add(clave);
  try { localStorage.setItem('lpsgt-arbol-proy', JSON.stringify([...contraidosProy])); } catch { /* opcional */ }
  pintarProyectos();
}

// Menú de proyectos en árbol: Empresa → Portafolio → Programa → Proyecto
function pintarProyectos() {
  const cont = document.querySelector('.proy-lista');
  if (!cont) return;
  document.querySelectorAll('.pestanas [data-p]').forEach(b => b.classList.toggle('activo', b.dataset.p === pestanaProy));
  let lista = store.proyectos.filter(p => p.estado === 'activo' || (p.estado === 'propuesto' && esStaff()));
  if (pestanaProy === 'mis') lista = misProyectos().filter(p => ['activo', 'propuesto'].includes(p.estado));
  if (pestanaProy === 'fav') lista = lista.filter(p => store.favoritos.has(p.id));
  const f = normalizar(filtroProy);
  if (f) lista = lista.filter(p => normalizar(p.codigo + ' ' + p.nombre_corto + ' ' + (p.nombre_completo || '')).includes(f));
  // Con búsqueda o en Mis / Favoritos solo se muestran las ramas que tienen proyectos (y se abren)
  const soloConProyectos = !!f || pestanaProy !== 'todos';
  const abierta = clave => soloConProyectos || !contraidosProy.has(clave);
  const portafolios = (store.portafolios || []).filter(x => x.estado !== 'inactivo');
  const programas = (store.programas || []).filter(x => x.estado !== 'inactivo');
  const idsPort = new Set(portafolios.map(x => x.id)), idsProg = new Set(programas.map(x => x.id));

  const item = (p, nivel) => `<div class="proy-item arbol-n${nivel}${store.proyectoSel === p.id ? ' activo' : ''}" data-id="${p.id}" title="${esc(`${p.codigo} · ${p.nombre_completo || p.nombre_corto}`)}">
      <span class="arbol-ico">📋</span><span class="nom">${esc(p.nombre_corto)}${p.estado === 'propuesto' ? ' ⏳' : ''}</span>
      <button class="estrella${store.favoritos.has(p.id) ? ' si' : ''}" data-id="${p.id}" title="Favorito" aria-label="Marcar favorito">★</button></div>`;
  const rama = (clave, nivel, ico, nombre, codigo, n, hijos, clase) => {
    if (soloConProyectos && !n) return '';
    const ab = abierta(clave);
    return `<div class="arbol-rama arbol-n${nivel} ${clase}" data-rama="${clave}" role="button" aria-expanded="${ab}" title="${esc(nombre)}">
        <span class="arbol-flecha">${ab ? '▾' : '▸'}</span><span class="arbol-ico">${ico}</span>
        <span class="nom">${esc(nombre)} <small>(${n})</small></span><span class="cod">${esc(codigo || '')}</span></div>
      ${ab ? (hijos || `<div class="arbol-vacio arbol-n${nivel + 1}">Sin contenido</div>`) : ''}`;
  };
  const deProg = g => lista.filter(p => p.programa_id === g.id);
  const ramaProg = (g, nivel) => { const ps = deProg(g); return rama('g' + g.id, nivel, '📁', g.nombre, g.codigo, ps.length, ps.map(p => item(p, nivel + 1)).join(''), 'arbol-prog'); };
  const ramasPort = portafolios.map(fp => {
    const gs = programas.filter(g => g.portafolio_id === fp.id);
    const directos = lista.filter(p => p.portafolio_id === fp.id && !idsProg.has(p.programa_id));
    const n = gs.reduce((s, g) => s + deProg(g).length, 0) + directos.length;
    return rama('f' + fp.id, 1, '🗂', fp.nombre, fp.codigo, n, gs.map(g => ramaProg(g, 2)).join('') + directos.map(p => item(p, 2)).join(''), 'arbol-port');
  }).join('');
  const progSueltos = programas.filter(g => !idsPort.has(g.portafolio_id)).map(g => ramaProg(g, 1)).join('');
  const sueltos = lista.filter(p => !idsPort.has(p.portafolio_id) && !idsProg.has(p.programa_id)).map(p => item(p, 1)).join('');
  const cuerpo = ramasPort + progSueltos + sueltos;
  const empresa = store.area?.nombre || 'Empresa';
  const abiertaEmp = abierta('empresa');
  cont.innerHTML = `<div class="arbol-rama arbol-n0 arbol-emp proy-todos${!store.proyectoSel ? ' activo' : ''}" data-rama="empresa" data-id="" role="button" aria-expanded="${abiertaEmp}"
      title="Todos los proyectos de ${esc(empresa)}"><span class="arbol-flecha" data-solo-rama>${abiertaEmp ? '▾' : '▸'}</span><span class="arbol-ico">🏢</span>
      <span class="nom">${esc(empresa)} <small>· todos (${lista.length})</small></span></div>` +
    (abiertaEmp ? (cuerpo || `<p class="nota" style="padding:8px">${pestanaProy === 'mis' ? 'No tiene proyectos asignados. Use la pestaña "Todos".' : pestanaProy === 'fav' ? 'Marque proyectos con ★ para verlos aquí.' : f ? 'Sin resultados.' : 'Sin proyectos.'}</p>`) : '');
}

async function cargarNotificaciones() {
  try {
    store.notificaciones = await api.list('notificaciones', { eq: { usuario_id: store.usuario.id }, order: [['created_at', false]], limit: 50 });
  } catch { store.notificaciones = []; }
  const n = store.notificaciones.filter(x => !x.leida).length;
  const c = document.querySelector('.cabecera .contador');
  if (c) { c.textContent = n > 99 ? '99+' : n; c.classList.toggle('oculto', !n); }
}

function menuActualizar() {
  if (document.querySelector('.menu-actualizar')) return cerrarFlotantes();
  cerrarFlotantes();
  const m = html(`<div class="menu-usuario menu-actualizar">
    <button data-op="normal">↳ Actualizar página</button>
    <button data-op="forzado">🧹 Vaciar caché y volver a cargar de manera forzada</button></div>`);
  const r = document.querySelector('[data-a="actualizar-menu"]').getBoundingClientRect();
  m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  document.body.append(m);
  m.addEventListener('click', async e => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (op === 'normal') location.reload();
    if (op === 'forzado') await recargaForzada();
  });
  setTimeout(() => document.addEventListener('click', function f(e) {
    if (!e.target.closest('.menu-actualizar,[data-a="actualizar-menu"]')) { cerrarFlotantes(); document.removeEventListener('click', f); }
  }), 0);
}

export function versionApp() { return window.LPSGT_VERSION || 'local'; }

export async function recargaForzada() {
  cerrarFlotantes();
  const aviso = html('<div class="recarga-forzada"><div><span class="spinner"></span> Vaciando caché y descargando la última versión…</div></div>');
  document.body.append(aviso);
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
    if (window.caches) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    const base = new URL('./', location.href).href;
    const archivos = new Set([base, base + 'index.html', base + 'config.js', base + 'sw.js']);
    for (const r of performance.getEntriesByType('resource')) {
      const u = new URL(r.name);
      if (u.href.startsWith(base) && !u.pathname.includes('/rest/v1/')) archivos.add(u.origin + u.pathname);
    }
    await Promise.all([...archivos].map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
  } catch { /* si algo falla, igual se recarga */ }
  try { sessionStorage.setItem('lpsgt-recarga-forzada', versionApp()); } catch { /* opcional */ }
  location.reload();
}

function cerrarFlotantes() { document.querySelectorAll('.panel-notif,.menu-usuario,.menu-actualizar').forEach(x => x.remove()); }

function panelNotificaciones() {
  if (document.querySelector('.panel-notif')) return cerrarFlotantes();
  cerrarFlotantes();
  const p = html(`<div class="panel-notif" role="dialog" aria-label="Notificaciones">
    <div class="notif-cab" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--borde)">
      <b>Notificaciones</b><button class="btn btn-sm" data-a="todas">Marcar todas como leídas</button></div>
    ${store.notificaciones.length ? store.notificaciones.map(n => `<div class="item${n.leida ? '' : ' no-leida'}" data-id="${n.id}" data-ruta="${esc(n.ruta || '')}">
      ${esc(n.texto)}<small>${fmtFechaHora(n.created_at)}</small></div>`).join('') : '<p class="nota" style="padding:14px">Sin notificaciones.</p>'}</div>`);
  document.body.append(p);
  arrastrable(p, p.querySelector('.notif-cab'));
  p.addEventListener('click', async e => {
    if (e.target.closest('[data-a="todas"]')) {
      await Promise.all(store.notificaciones.filter(n => !n.leida).map(n => api.update('notificaciones', n.id, { leida: true }).catch(() => {})));
      await cargarNotificaciones(); cerrarFlotantes(); return;
    }
    const it = e.target.closest('.item');
    if (!it) return;
    api.update('notificaciones', it.dataset.id, { leida: true }).then(cargarNotificaciones).catch(() => {});
    cerrarFlotantes();
    if (it.dataset.ruta) location.hash = it.dataset.ruta;
  });
  setTimeout(() => document.addEventListener('click', function f(e) {
    if (!e.target.closest('.panel-notif,[data-a="notif"]')) { cerrarFlotantes(); document.removeEventListener('click', f); }
  }), 0);
}

function menuUsuario(alSalir) {
  if (document.querySelector('.menu-usuario')) return cerrarFlotantes();
  cerrarFlotantes();
  const u = store.usuario;
  const m = html(`<div class="menu-usuario">
    <div style="padding:8px 10px"><b>${esc(u.nombre)}</b><div class="nota">${esc(u.email || '')}</div><div class="nota">${esc(ROLES[rol()] || rol())}</div></div>
    <hr style="border:none;border-top:1px solid var(--borde)">
    <button data-a="perfil">Mi perfil</button>
    ${modoDemo ? '<button data-a="cambiar">Cambiar de usuario de demostración</button><button data-a="reiniciar">Reiniciar datos de demostración</button>'
      : '<button data-a="clave">Cambiar contraseña</button>'}
    <button data-a="salir">Cerrar sesión</button>
    <div class="nota" style="padding:6px 10px 2px;border-top:1px solid var(--borde);margin-top:4px">Versión ${esc(versionApp())}</div></div>`);
  document.body.append(m);
  m.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    cerrarFlotantes();
    if (a === 'salir' || a === 'cambiar') alSalir();
    if (a === 'reiniciar') { api.reiniciar(); alSalir(); }
    if (a === 'perfil') {
      await pedirDatos({
        titulo: 'Mi perfil', valores: u,
        campos: [
          { name: 'nombre', label: 'Nombre', required: true },
          { name: 'codigo', label: 'Código corto (iniciales)' },
          { name: 'horas_dia', label: 'Horas disponibles por día', type: 'number', min: 0, max: 24, step: 0.5, help: 'Para la capacidad semanal. Vacío = valor del área.' },
        ],
        alGuardar: async d => { Object.assign(store.usuario, await api.update('profiles', u.id, d)); ok('Perfil actualizado.'); },
      });
    }
    if (a === 'clave') {
      await pedirDatos({
        titulo: 'Cambiar contraseña',
        campos: [{ name: 'p1', label: 'Nueva contraseña', type: 'password', required: true }, { name: 'p2', label: 'Repetir contraseña', type: 'password', required: true }],
        alGuardar: async d => {
          if (d.p1.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
          if (d.p1 !== d.p2) throw new Error('Las contraseñas no coinciden.');
          await api.auth.cambiarClave(d.p1); ok('Contraseña actualizada.');
        },
      });
    }
  });
  setTimeout(() => document.addEventListener('click', function f(e) {
    if (!e.target.closest('.menu-usuario,[data-a="usuario"]')) { cerrarFlotantes(); document.removeEventListener('click', f); }
  }), 0);
}

export function irA(hash) { ir(hash); }
