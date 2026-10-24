// Arranque del aplicativo: sesión, catálogo, estructura y rutas.
import { api, modoDemo, mensajeError } from './data/api.js';
import { store, cargarPerfil, cargarCatalogo, esStaff } from './core/store.js';
import { ruta, iniciarRouter } from './core/router.js';
import { montarLayout } from './ui/layout.js';
import { mostrarLogin, mostrarPendiente, mostrarNuevaClave } from './views/login.js';
import { error } from './ui/ui.js';

const raiz = document.getElementById('raiz');

ruta('/plan', () => import('./views/plan.js'), { staff: true });
ruta('/lookahead', () => import('./views/lookahead.js'), { staff: true });
ruta('/restricciones', () => import('./views/restricciones.js'), { staff: true });
ruta('/cartera', () => import('./views/cartera.js'));
ruta('/cartera/:id', () => import('./views/cartera.js'));
ruta('/tablero', () => import('./views/tablero.js'));
ruta('/reunion', () => import('./views/reunion.js'), { staff: true });
ruta('/equipo', () => import('./views/equipo.js'), { staff: true });
ruta('/proyectos', () => import('./views/proyectos.js'));
ruta('/proyectos/:id', () => import('./views/proyectos.js'));
ruta('/proyecto/:id', () => import('./views/proyectos.js'));
ruta('/actividad/:id', () => import('./views/actividad.js'));
ruta('/restriccion/:id', () => import('./views/restricciones.js'));
ruta('/plantillas', () => import('./views/plantillas.js'), { staff: true });
ruta('/config/:seccion', () => import('./views/config.js'), { gestor: true });
ruta('/mejoras', () => import('./views/mejoras.js'));
ruta('/ayuda', () => import('./views/ayuda.js'));

async function arrancar() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  api.auth.alCambiar((evento) => {
    if (evento === 'PASSWORD_RECOVERY') mostrarNuevaClave(raiz);
    if (evento === 'SIGNED_OUT') location.reload();
  });
  if (location.hash.includes('type=recovery')) return mostrarNuevaClave(raiz);

  let usuario = null;
  try { usuario = await api.auth.usuario(); } catch (e) { console.warn(e); }
  if (!usuario) return mostrarLogin(raiz, arrancar);

  try {
    await cargarPerfil(usuario.id);
  } catch (e) {
    raiz.innerHTML = `<div class="login"><div class="login-caja"><div class="aviso error">${mensajeError(e)}</div>
      <button class="btn" onclick="location.reload()">Reintentar</button></div></div>`;
    return;
  }
  if (!store.usuario) return mostrarPendiente(raiz, 'Su perfil aún no está creado. Intente nuevamente en unos segundos.');
  if (store.usuario.rol === 'pendiente' || !store.usuario.activo) {
    return mostrarPendiente(raiz, store.usuario.activo
      ? 'Su cuenta fue registrada. El administrador debe asignarle un rol para que pueda ingresar.'
      : 'Su cuenta está desactivada. Comuníquese con el administrador.');
  }
  if (store.usuario.debe_cambiar_clave) {
    return mostrarNuevaClave(raiz, 'El administrador le asignó una contraseña temporal. Defina su propia contraseña para continuar.');
  }
  try { await cargarCatalogo(); } catch (e) { error(mensajeError(e)); }

  const contenido = montarLayout(raiz, {
    alSalir: async () => { await api.auth.salir(); location.hash = ''; location.reload(); },
  });
  iniciarRouter(contenido, {
    porDefecto: esStaff() ? '/plan' : '/tablero',
    guardia: r => {
      if (r.staff && !esStaff()) { location.hash = '#/tablero'; return false; }
      if (r.gestor && !['admin', 'delegado'].includes(store.usuario.rol)) { location.hash = '#/plan'; return false; }
      return true;
    },
  });
  if (!store.usuario.tour_visto && !modoDemo) {
    import('./views/ayuda.js').then(m => m.iniciarRecorrido());
  }
}

arrancar();
