// Capa de datos única. Usa Supabase si config.js tiene URL y clave; si no, el modo demostración
// (datos ficticios guardados solo en este navegador).
import { crearAdaptadorSupabase } from './adapter-supabase.js';
import { crearAdaptadorDemo } from './adapter-demo.js';

const cfg = window.LPSGT_CONFIG || {};
// Protección: nunca operar con una clave secreta en el navegador
if (claveSecreta(cfg.supabaseAnonKey)) {
  cfg.supabaseAnonKey = '';
  setTimeout(() => alert('config.js contiene una clave SECRETA de Supabase (service_role). Retírela de inmediato, regenérela en Supabase y use la anon key.'), 0);
}
function claveSecreta(k) {
  if (!k) return false;
  if (k.startsWith('sb_secret_')) return true;
  try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
}
const forzarDemo = new URLSearchParams(location.search).has('demo') || localStorage.getItem('lpsgt-modo') === 'demo';

export const modoDemo = forzarDemo || !cfg.supabaseUrl || !cfg.supabaseAnonKey;

export const api = modoDemo ? crearAdaptadorDemo() : crearAdaptadorSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);

export const supabaseConfigurado = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

export function usarModo(modo) {
  if (modo === 'demo') localStorage.setItem('lpsgt-modo', 'demo');
  else localStorage.removeItem('lpsgt-modo');
  location.href = location.pathname;
}

/** Traduce los errores de la base de datos a mensajes comprensibles. */
export function mensajeError(e) {
  const m = String(e?.message || e || 'Error desconocido');
  if (/row-level security|permission denied|violates row-level/i.test(m)) return 'No tiene permiso para realizar esta acción.';
  if (/duplicate key/i.test(m)) return 'Ya existe un registro con esos datos.';
  if (/violates foreign key/i.test(m)) return 'El registro está siendo usado en otra parte y no puede modificarse así.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor. Intente nuevamente.';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Debe confirmar su correo antes de ingresar (revise su bandeja de entrada).';
  return m;
}
