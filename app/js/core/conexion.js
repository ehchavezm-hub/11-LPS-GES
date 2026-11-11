// Monitor de conexión con Supabase.
// Detecta pérdida de red de forma proactiva (ping cada 30 s) y reactiva (cuando un guardado falla).
// Emite evento 'conexion' con { ok: true/false } en el bus de store.
// layout.js escucha el evento y muestra/oculta el banner rojo de aviso.

import { emit } from './store.js';

let _conectado = true;
let _url = '';
let _key = '';
let _timer = null;
let _verif = null; // promesa de verificación en curso para no solapar

export function iniciarMonitor(url, key) {
  _url = url;
  _key = key;
  window.addEventListener('online',  () => verificar());
  window.addEventListener('offline', () => _marcar(false));
  // Verificar al arrancar y luego cada 30 s
  verificar();
  _timer = setInterval(verificar, 30_000);
}

/** Llamar desde adapter-supabase cuando un write falla por red. */
export function notificarErrorRed() { _marcar(false); }

/** Llamar desde adapter-supabase cuando un write tiene éxito. */
export function notificarOk() { _marcar(true); }

export function estaConectado() { return _conectado; }
export function forzarVerificacion() { _verif = null; verificar(); }

async function verificar() {
  if (_verif) return; // ya hay una verificación en curso
  _verif = _ping().finally(() => { _verif = null; });
  await _verif;
}

async function _ping() {
  if (!_url) return;
  if (!navigator.onLine) { _marcar(false); return; }
  try {
    const r = await fetch(`${_url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: _key, Authorization: `Bearer ${_key}` },
      signal: AbortSignal.timeout(8000),
    });
    // 2xx o 4xx = el servidor respondió = hay conexión (aunque RLS rechace la lectura)
    _marcar(r.status < 500);
  } catch {
    _marcar(false);
  }
}

function _marcar(ok) {
  if (_conectado === ok) return; // sin cambio
  _conectado = ok;
  emit('conexion', { ok });
  // Si se recuperó la conexión, forzar una verificación limpia en 5 s para confirmar
  if (ok) setTimeout(verificar, 5_000);
}
