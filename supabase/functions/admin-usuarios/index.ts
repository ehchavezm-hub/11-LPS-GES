// LPS-GT · Edge Function "admin-usuarios"
// Permite al administrador (o a quien tenga el permiso "gestionar_usuarios"):
//   - accion "crear": crear un usuario con contraseña temporal y rol asignado.
//   - accion "clave": restablecer la contraseña de un usuario.
// La clave secreta (service_role) solo existe aquí, en el servidor de Supabase: nunca en el navegador.
// El usuario debe cambiar la contraseña asignada en su siguiente ingreso (profiles.debe_cambiar_clave).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ROLES = ['resp_equipo', 'lider', 'resp_proceso', 'resp_actividad', 'consulta', 'delegado', 'admin', 'pendiente'];

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const falla = (mensaje: string, status = 400) => respuesta({ error: mensaje }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return falla('Método no permitido.', 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const autorizacion = req.headers.get('Authorization') ?? '';
  const jwt = autorizacion.replace(/^Bearer\s+/i, '');
  if (!jwt) return falla('Sesión no válida.', 401);

  const admin = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });
  // Cliente con la sesión de quien llama: las reglas de la base (RLS y disparadores) se aplican igual que en pantalla
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: sesion, error: eSesion } = await admin.auth.getUser(jwt);
    if (eSesion || !sesion?.user) return falla('Sesión no válida.', 401);
    const { data: yo } = await admin.from('profiles').select('*').eq('id', sesion.user.id).single();
    const { data: permitido } = await comoUsuario.rpc('puede', { p_accion: 'gestionar_usuarios' });
    if (!yo?.activo || !permitido) return falla('No tiene permiso para gestionar usuarios.', 403);

    const d = await req.json().catch(() => ({}));
    const clave = String(d.clave ?? '');
    if (clave.length < 8) return falla('La contraseña debe tener al menos 8 caracteres.');

    if (d.accion === 'crear') {
      const email = String(d.email ?? '').trim().toLowerCase();
      const nombre = String(d.nombre ?? '').trim();
      const rol = String(d.rol ?? 'lider');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return falla('Correo no válido.');
      if (!nombre) return falla('Indique el nombre.');
      if (!ROLES.includes(rol)) return falla('Rol no válido.');
      if (['admin', 'delegado'].includes(rol) && !yo.es_admin_principal) {
        return falla('Solo el administrador principal asigna los roles de administrador y delegado.', 403);
      }
      const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
        email, password: clave, email_confirm: true,
        user_metadata: { nombre },
        app_metadata: { creado_por: yo.id, area_id: yo.area_id },
      });
      if (eCrear) {
        return falla(/already|registered|exists/i.test(eCrear.message) ? 'Ya existe un usuario con ese correo.' : eCrear.message);
      }
      const id = creado.user.id;
      const datos: Record<string, unknown> = { nombre, rol };
      if (d.codigo) datos.codigo = String(d.codigo).trim();
      if (Array.isArray(d.gerencia_ids)) datos.gerencia_ids = d.gerencia_ids;
      if (d.horas_dia !== undefined && d.horas_dia !== null && d.horas_dia !== '') datos.horas_dia = Number(d.horas_dia);
      const { error: ePerfil } = await comoUsuario.from('profiles').update(datos).eq('id', id);
      if (ePerfil) {
        await admin.auth.admin.deleteUser(id);
        return falla(ePerfil.message);
      }
      return respuesta({ id });
    }

    if (d.accion === 'clave') {
      const { data: obj } = await admin.from('profiles').select('*').eq('id', String(d.usuario_id ?? '')).single();
      if (!obj || obj.area_id !== yo.area_id) return falla('Usuario no encontrado.', 404);
      if (obj.id !== yo.id && (obj.es_admin_principal || (['admin', 'delegado'].includes(obj.rol) && !yo.es_admin_principal))) {
        return falla('No puede restablecer la contraseña de ese usuario.', 403);
      }
      const { error: eClave } = await admin.auth.admin.updateUserById(obj.id, { password: clave });
      if (eClave) return falla(eClave.message);
      await admin.from('profiles').update({ debe_cambiar_clave: obj.id !== yo.id }).eq('id', obj.id);
      return respuesta({ ok: true });
    }

    return falla('Acción no válida.');
  } catch (e) {
    return falla(e instanceof Error ? e.message : String(e), 500);
  }
});
