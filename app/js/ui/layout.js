// Estructura general: cabecera, navegación lateral y menú de proyectos (6.3), notificaciones y usuario.
import { api, modoDemo, mensajeError } from '../data/api.js';
import { store, on, esGestor, esStaff, puede, seleccionarProyecto, misProyectos, etiqueta, cargarCatalogo, rol } from '../core/store.js';
import { ROLES } from '../data/catalogos.js';
import { esc, html, normalizar, agrupar, fmtFechaHora } from '../core/util.js';
import { ir } from '../core/router.js';
import { pedirDatos, ok, error } from './ui.js';

export const NAV = [
  { grupo: 'Planificación' },
  { ruta: '/plan', ico: '📅', texto: 'Plan semanal', si: esStaff },
  { ruta: '/lookahead', ico: '🔭', texto: 'Look Ahead', si: esStaff },
  { ruta: '/restricciones', ico: '🚧', texto: 'Restricciones', si: esStaff },
  { ruta: '/cartera', ico: '🗂', texto: 'Cartera y solicitudes', si: () => esStaff() || puede('registrar_solicitud') },
  { grupo: 'Seguimiento' },
  { ruta: '/tablero', ico: '📊', texto: 'Tablero', si: () => puede('ver_tablero') },
  { ruta: '/reunion', ico: '👥', texto: 'Reunión semanal', si: esStaff },
  { ruta: '/equipo', ico: '🧭', texto: 'Equipo y capacidad', si: esStaff },
  { ruta: '/proyectos', ico: '🏗', texto: 'Proyectos', si: () => true },
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
      <button class="btn-icono btn-menu" data-a="menu" aria-label="Menú">☰</button>
      <a class="logo" href="#/"><span>LPS<b>-GT</b></span></a>
      <span class="cab-area">${esc(store.area?.nombre || '')}</span>
      ${modoDemo ? '<span class="demo-chip" title="Datos ficticios guardados solo en este navegador">MODO DEMOSTRACIÓN</span>' : ''}
      <span class="flex"></span>
      <span class="btn-actualizar"><button class="btn-icono" data-a="actualizar" title="Actualizar la página" aria-label="Actualizar">⟳</button><button class="btn-icono btn-flecha" data-a="actualizar-menu" title="Más opciones de actualización" aria-label="Opciones de actualización">▾</button></span>
      <button class="btn-icono" data-a="ayuda" title="Ayuda y recorrido guiado" aria-label="Ayuda">❔</button>
      <button class="btn-icono" data-a="notif" title="Notificaciones" aria-label="Notificaciones">🔔<span class="contador oculto"></span></button>
      <button class="usuario-btn" data-a="usuario"><span class="avatar">${esc(iniciales)}</span><span class="nom">${esc(u.nombre)}</span></button>
    </header>
    <aside class="lateral">
      <nav class="nav" aria-label="Navegación principal"></nav>
      <section class="menu-proy" aria-label="Menú de proyectos">
        <div class="menu-proy-cab"><h3>Proyectos</h3>
          ${puede('crear_proyecto') || puede('proponer_proyecto') ? '<button class="btn btn-sm" data-a="nuevo-proy" title="Registrar o proponer un proyecto">＋</button>' : ''}</div>
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
    const it = e.target.closest('.proy-item');
    if (it) {
      seleccionarProyecto(it.dataset.id);
      document.body.classList.remove('menu-abierto');
    }
  });

  app.querySelector('.cabecera').addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'menu') document.body.classList.toggle('menu-abierto');
    if (a === 'notif') panelNotificaciones();
    if (a === 'usuario') menuUsuario(alSalir);
    if (a === 'actualizar') location.reload();
    if (a === 'actualizar-menu') menuActualizar();
    if (a === 'ayuda') import('../views/ayuda.js').then(m => m.iniciarRecorrido(true));
  });
  app.querySelector('[data-a="nuevo-proy"]')?.addEventListener('click', () => import('../views/proyectos.js').then(m => m.formularioProyecto()));

  // Notificaciones y catálogo en tiempo real
  cargarNotificaciones();
  api.subscribe(['notificaciones'], ev => {
    if (ev.fila?.usuario_id === u.id || ev.anterior?.usuario_id === u.id) cargarNotificaciones();
  });
  const recargar = debounceCatalogo();
  api.subscribe(['lista_valores', 'proyectos'], () => recargar());
  return app.querySelector('#contenido');
}

function debounceCatalogo() {
  let t;
  return () => { clearTimeout(t); t = setTimeout(() => cargarCatalogo().catch(() => {}), 800); };
}

function pintarNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const actual = location.hash.replace(/^#/, '').split('?')[0];
  nav.innerHTML = NAV.filter(n => n.grupo || n.si()).map(n => n.grupo
    ? `<div class="nav-grupo">${esc(n.grupo)}</div>`
    : `<a href="#${n.ruta}" class="${actual === n.ruta || actual.startsWith((n.prefijo || n.ruta) + '/') ? 'activo' : ''}"><span class="ico">${n.ico}</span>${esc(n.texto)}</a>`).join('');
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-abierto')));
}

function pintarProyectos() {
  const cont = document.querySelector('.proy-lista');
  if (!cont) return;
  document.querySelectorAll('.pestanas [data-p]').forEach(b => b.classList.toggle('activo', b.dataset.p === pestanaProy));
  let lista = store.proyectos.filter(p => p.estado === 'activo' || (p.estado === 'propuesto' && esStaff()));
  if (pestanaProy === 'mis') lista = misProyectos().filter(p => ['activo', 'propuesto'].includes(p.estado));
  if (pestanaProy === 'fav') lista = lista.filter(p => store.favoritos.has(p.id));
  const f = normalizar(filtroProy);
  if (f) lista = lista.filter(p => normalizar(p.codigo + ' ' + p.nombre_corto + ' ' + (p.nombre_completo || '')).includes(f));
  const grupos = agrupar(lista, p => etiqueta(p.gerencia_id) || 'Sin gerencia');
  const item = p => `<div class="proy-item${store.proyectoSel === p.id ? ' activo' : ''}" data-id="${p.id}" title="${esc(p.nombre_completo || p.nombre_corto)}">
      <span class="cod">${esc(p.codigo)}</span><span class="nom">${esc(p.nombre_corto)}${p.estado === 'propuesto' ? ' ⏳' : ''}</span>
      <button class="estrella${store.favoritos.has(p.id) ? ' si' : ''}" data-id="${p.id}" title="Favorito" aria-label="Marcar favorito">★</button></div>`;
  cont.innerHTML = `<div class="proy-item proy-todos${!store.proyectoSel ? ' activo' : ''}" data-id=""><span class="nom">Todos los proyectos</span></div>` +
    ([...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, arr]) =>
      `<div class="proy-grupo">${esc(g)}</div>${arr.map(item).join('')}`).join('') ||
      `<p class="nota" style="padding:8px">${pestanaProy === 'mis' ? 'No tiene proyectos asignados. Use la pestaña "Todos".' : pestanaProy === 'fav' ? 'Marque proyectos con ★ para verlos aquí.' : 'Sin proyectos.'}</p>`);
}

async function cargarNotificaciones() {
  try {
    store.notificaciones = await api.list('notificaciones', { eq: { usuario_id: store.usuario.id }, order: [['created_at', false]], limit: 50 });
  } catch { store.notificaciones = []; }
  const n = store.notificaciones.filter(x => !x.leida).length;
  const c = document.querySelector('.cabecera .contador');
  if (c) { c.textContent = n > 99 ? '99+' : n; c.classList.toggle('oculto', !n); }
}

// Botón actualizar: recarga normal o forzada (vacía la caché del aplicativo y del service worker).
// No borra la sesión ni los datos: solo los archivos guardados del aplicativo.
function menuActualizar() {
  if (document.querySelector('.menu-actualizar')) return cerrarFlotantes();
  cerrarFlotantes();
  const m = html(`<div class="menu-usuario menu-actualizar">
    <button data-op="normal">⟳ Actualizar página</button>
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

export async function recargaForzada() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
    if (window.caches) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
  } catch { /* si falla, igual se recarga */ }
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));   // evita la caché del navegador
  location.replace(url.toString());
}

function cerrarFlotantes() { document.querySelectorAll('.panel-notif,.menu-usuario,.menu-actualizar').forEach(x => x.remove()); }

function panelNotificaciones() {
  if (document.querySelector('.panel-notif')) return cerrarFlotantes();
  cerrarFlotantes();
  const p = html(`<div class="panel-notif" role="dialog" aria-label="Notificaciones">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--borde)">
      <b>Notificaciones</b><button class="btn btn-sm" data-a="todas">Marcar todas como leídas</button></div>
    ${store.notificaciones.length ? store.notificaciones.map(n => `<div class="item${n.leida ? '' : ' no-leida'}" data-id="${n.id}" data-ruta="${esc(n.ruta || '')}">
      ${esc(n.texto)}<small>${fmtFechaHora(n.created_at)}</small></div>`).join('') : '<p class="nota" style="padding:14px">Sin notificaciones.</p>'}</div>`);
  document.body.append(p);
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
    <button data-a="salir">Cerrar sesión</button></div>`);
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
