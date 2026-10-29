// LPS-GES · Edge Function "admin-usuarios"
// Permite al administrador (o a quien tenga el permiso "gestionar_usuarios"):
//   - accion "crear": crear un usuario con contraseña temporal y rol asignado.
//   - accion "clave": restablecer la contraseña de un usuario.
// Y al administrador de la plataforma (profiles.es_plataforma, pedido 113):
//   - accion "empresas": lista de empresas con sus cifras.
//   - accion "crear_empresa": empresa nueva con sus listas, parámetros y permisos iniciales (la administran los propietarios).
//   - accion "estado_empresa": activar o desactivar una empresa.
//   - acciones de la consola de plataforma: "plataforma" (datos de todas las empresas), "editar_empresa",
//     "eliminar_empresa" (cualquier empresa, con todos sus datos), "usar_empresa" (trabajar en otra empresa), "cambiar_principal",
//     "estructura" (portafolios, programas y proyectos de cualquier empresa), "lideres", "propietario",
//     "usuario_plataforma" y "auditoria_plataforma".
// Lo que cruza empresas pasa solo por aquí: en las pantallas normales cada usuario ve únicamente su empresa.
// La clave secreta (service_role) solo existe aquí, en el servidor de Supabase: nunca en el navegador.
// El usuario debe cambiar la contraseña asignada en su siguiente ingreso (profiles.debe_cambiar_clave).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import postgres from 'npm:postgres@3.4.5';

// Borrados completos en UNA transacción directa a la base (conexión SUPABASE_DB_URL del servidor), para cuando las
// funciones de las migraciones 025/026 aún no están instaladas. Con ellas instaladas se usan esas funciones.
const funcionFaltante = (e: { message?: string } | null) => !!e && /Could not find the function|schema cache/i.test(e.message ?? '');
async function enTransaccion<T>(trabajo: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const url = Deno.env.get('SUPABASE_DB_URL');
  if (!url) throw new Error('Falta instalar la migración de borrado en la base (025/026).');
  const sql = postgres(url, { max: 1, prepare: false });
  try { return await sql.begin(trabajo) as T; } finally { await sql.end({ timeout: 5 }); }
}
// Mismo orden que public.eliminar_empresa (migración 025)
const BORRADO_EMPRESA = [
  'delete from public.restricciones where area_id = $1', 'delete from public.acuerdos where area_id = $1',
  'delete from public.reuniones where area_id = $1', 'delete from public.hitos where area_id = $1',
  'delete from public.actividades where area_id = $1', 'delete from public.cartera where area_id = $1',
  'delete from public.cierres where area_id = $1', 'delete from public.pac_historico where area_id = $1',
  'delete from public.ubicaciones_dia where area_id = $1', 'delete from public.comentarios where area_id = $1',
  'delete from public.enlaces where area_id = $1', 'delete from public.solicitudes_cambio where area_id = $1',
  `delete from public.plantilla_items where plantilla_id in (select id from public.plantillas where area_id = $1)
     or proyecto_id in (select id from public.proyectos where area_id = $1)`,
  'delete from public.plantillas where area_id = $1',
  'delete from public.proyecto_lideres where proyecto_id in (select id from public.proyectos where area_id = $1)',
  'delete from public.proyecto_favoritos where proyecto_id in (select id from public.proyectos where area_id = $1)',
  'delete from public.proyectos where area_id = $1 and padre_id is not null', 'delete from public.proyectos where area_id = $1',
  'delete from public.programas where area_id = $1', 'delete from public.portafolios where area_id = $1',
  'delete from public.vistas where area_id = $1', 'delete from public.columnas_personalizadas where area_id = $1',
  'delete from public.organigrama_nodos where area_id = $1', 'delete from public.delegado_historial where area_id = $1',
  'delete from public.permisos where area_id = $1', 'delete from public.parametros where area_id = $1',
  'delete from public.notificaciones where usuario_id in (select id from public.profiles where area_id = $1)',
  'delete from public.profiles where area_id = $1',
  'delete from public.lista_valores where lista_id in (select id from public.listas where area_id = $1)',
  'delete from public.listas where area_id = $1', 'delete from public.auditoria where area_id = $1',
  'delete from public.areas where id = $1',
];
async function eliminarEmpresaDirecto(area: string) {
  await enTransaccion(async tx => {
    await tx`select set_config('lpsgt.eliminando_empresa', 'on', true), set_config('lpsgt.cierre_en_curso', 'on', true)`;
    // Los valores protegidos (p. ej. «Completado») no se pueden borrar uno a uno; al eliminar la empresa completa sí.
    // Solo dentro de esta transacción: si algo falla, todo vuelve atrás, también esta regla.
    await tx.unsafe('alter table public.lista_valores disable trigger trg_proteger_valor');
    for (const q of BORRADO_EMPRESA) await tx.unsafe(q, [area]);
    await tx.unsafe('alter table public.lista_valores enable trigger trg_proteger_valor');
  });
}
// Mismo orden que public.eliminar_proyecto_plataforma (migración 026)
async function eliminarProyectoDirecto(id: string) {
  return await enTransaccion(async tx => {
    await tx`select set_config('lpsgt.cierre_en_curso', 'on', true)`;
    const ids = (await tx`select id from public.proyectos where id = ${id} or padre_id = ${id}`).map(r => r.id);
    const acts = (await tx`select id from public.actividades where proyecto_id = any(${ids}::uuid[])`).map(r => r.id);
    const rests = (await tx`select id from public.restricciones where proyecto_id = any(${ids}::uuid[]) or actividad_id = any(${acts}::uuid[])`).map(r => r.id);
    const cart = (await tx`select id from public.cartera where proyecto_id = any(${ids}::uuid[])`).map(r => r.id);
    for (const t of ['comentarios', 'enlaces']) {
      await tx.unsafe(`delete from public.${t} where (entidad = 'actividad' and entidad_id = any($1::uuid[]))
        or (entidad = 'restriccion' and entidad_id = any($2::uuid[])) or (entidad = 'cartera' and entidad_id = any($3::uuid[]))
        or (entidad = 'proyecto' and entidad_id = any($4::uuid[]))`, [acts, rests, cart, ids]);
    }
    await tx`delete from public.restricciones where id = any(${rests}::uuid[])`;
    await tx`update public.actividades set cartera_id = null where cartera_id = any(${cart}::uuid[])`;
    await tx`delete from public.actividades where id = any(${acts}::uuid[])`;
    await tx`delete from public.cartera where id = any(${cart}::uuid[])`;
    await tx`delete from public.plantilla_items where proyecto_id = any(${ids}::uuid[])`;
    await tx`update public.lista_valores set extra = extra - 'proyecto_id' where extra ->> 'proyecto_id' = any(${ids.map(String)}::text[])`;
    await tx`delete from public.proyecto_lideres where proyecto_id = any(${ids}::uuid[])`;
    await tx`delete from public.proyecto_favoritos where proyecto_id = any(${ids}::uuid[])`;
    await tx`delete from public.hitos where proyecto_id = any(${ids}::uuid[])`;
    await tx`delete from public.proyectos where padre_id = ${id}`;
    await tx`delete from public.proyectos where id = ${id}`;
    return { subproyectos: ids.length - 1, actividades: acts.length, restricciones: rests.length, cartera: cart.length };
  });
}

// Monitoreo opcional: secreto SENTRY_DSN de la función (supabase secrets set SENTRY_DSN=...).
// Sin datos personales: no se envían correos, contraseñas ni el cuerpo de la solicitud.
const DSN = Deno.env.get('SENTRY_DSN');
const Sentry = DSN ? await import('npm:@sentry/deno@11.9.0') : null;
Sentry?.init({
  dsn: DSN,
  environment: Deno.env.get('SENTRY_ENTORNO') ?? 'produccion',
  tracesSampleRate: 0.2,
  defaultIntegrations: false,
  beforeSend(evento) {
    delete evento.request; delete evento.user;
    for (const ex of evento.exception?.values ?? []) ex.value = ex.value?.replace(/[\w.%+-]+@[\w.-]+\.\w{2,}/g, '[correo]');
    return evento;
  },
});

// Orígenes permitidos (secreto ORIGENES_PERMITIDOS, separados por comas; p. ej. https://usuario.github.io).
// Sin configurar se acepta cualquiera: la seguridad real es el token de sesión que se valida en cada llamada.
const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '').split(',').map(o => o.trim()).filter(Boolean);
const origenPermitido = (origen: string | null) =>
  !ORIGENES.length ? '*' : (origen && ORIGENES.includes(origen) ? origen : ORIGENES[0]);
const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const ROLES = ['lider', 'consulta', 'delegado', 'admin', 'superadmin', 'pendiente'];   // matriz PPT v5 (migración 021)
const GESTORES = ['superadmin', 'admin', 'delegado'];

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const falla = (mensaje: string, status = 400) => respuesta({ error: mensaje }, status);

Deno.serve(async (req) => {
  const r = await atender(req);
  r.headers.set('Access-Control-Allow-Origin', origenPermitido(req.headers.get('Origin')));
  return r;
});

async function atender(req: Request): Promise<Response> {
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
    const d = await req.json().catch(() => ({}));
    // Mejoras del aplicativo (pedido q7): las ven todos los usuarios de todas las empresas; las gestionan los propietarios
    if (d.accion === 'mejoras' || d.accion === 'gestionar_mejora') {
      if (!yo?.activo || yo.rol === 'pendiente' || yo.eliminado) return falla('No autorizado.', 403);
      return await mejoras(admin, yo, d);
    }
    // Usuarios de varias empresas (migración 030): ver sus empresas y cambiar de empresa activa
    if (d.accion === 'mis_empresas' || d.accion === 'cambiar_empresa') {
      if (!yo || yo.eliminado) return falla('No autorizado.', 403);
      if (d.accion === 'mis_empresas') {
        const { data: ms, error: e } = await admin.from('empresa_miembros').select('area_id, rol, activo').eq('usuario_id', yo.id).eq('activo', true);
        if (e) return respuesta({ empresas: [] });
        const ids = [...new Set([...(ms ?? []).map((m: any) => m.area_id), yo.area_id].filter(Boolean))];
        const { data: areas } = await admin.from('areas').select('id, nombre, activa').in('id', ids);
        return respuesta({ actual: yo.area_id, empresas: (areas ?? []).map((a: any) => ({ id: a.id, nombre: a.nombre, activa: a.activa !== false,
          rol: (ms ?? []).find((m: any) => m.area_id === a.id)?.rol ?? yo.rol })) });
      }
      const destino = String(d.area_id ?? '');
      if (destino === yo.area_id) return respuesta({ ok: true });
      const { error: e } = await admin.rpc('cambiar_empresa_activa', { p_usuario: yo.id, p_area: destino });
      return e ? falla(e.message) : respuesta({ ok: true });
    }
    const { data: permitido } = await comoUsuario.rpc('puede', { p_accion: 'gestionar_usuarios' });
    if (!yo?.activo || !permitido) return falla('No tiene permiso para gestionar usuarios.', 403);

    const clave = String(d.clave ?? '');
    const accionesEmpresa = ['empresas', 'crear_empresa', 'estado_empresa', 'plataforma', 'editar_empresa', 'eliminar_empresa',
      'usar_empresa', 'cambiar_principal', 'estructura', 'lideres', 'propietario', 'usuario_plataforma', 'auditoria_plataforma',
      'historial_proyecto'];
    if (accionesEmpresa.includes(d.accion)) {
      if (!yo.es_plataforma) return falla('Solo el administrador de la plataforma gestiona empresas.', 403);
      return await empresas(admin, yo, d, clave);
    }
    if (clave.length < 8) return falla('La contraseña debe tener al menos 8 caracteres.');

    if (d.accion === 'crear') {
      const email = String(d.email ?? '').trim().toLowerCase();
      const nombre = String(d.nombre ?? '').trim();
      const rol = String(d.rol ?? 'lider');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return falla('Correo no válido.');
      if (!nombre) return falla('Indique el nombre.');
      if (!ROLES.includes(rol)) return falla('Rol no válido.');
      const soySuper = yo.rol === 'superadmin' || yo.es_admin_principal;
      if (GESTORES.includes(rol) && !soySuper) {
        return falla('Solo el super administrador asigna los roles de super administrador, administrador y delegado.', 403);
      }
      // El administrador de la plataforma puede crear el usuario en otra empresa
      const areaDestino = yo.es_plataforma && d.area_id ? String(d.area_id) : yo.area_id;
      const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
        email, password: clave, email_confirm: true,
        user_metadata: { nombre },
        app_metadata: { creado_por: yo.id, area_id: areaDestino },
      });
      if (eCrear) {
        if (!/already|registered|exists/i.test(eCrear.message)) return falla(eCrear.message);
        // La persona ya tiene cuenta (en otra empresa): un propietario la agrega a esta empresa con el rol elegido
        if (!yo.es_plataforma) return falla('Ya existe un usuario con ese correo en otra empresa. Pida a un propietario de la plataforma que lo agregue a esta empresa.');
        const { data: existente } = await admin.from('profiles').select('id, area_id, eliminado, es_plataforma').ilike('email', email).maybeSingle();
        if (!existente || existente.eliminado) return falla('Ya existe una cuenta con ese correo, pero no está disponible.');
        if (existente.es_plataforma) return falla('Esa cuenta es de un propietario de la plataforma: ya administra todas las empresas.');
        const { data: ya } = await admin.from('empresa_miembros').select('usuario_id').eq('usuario_id', existente.id).eq('area_id', areaDestino).maybeSingle();
        if (ya || existente.area_id === areaDestino) return falla('Ya existe un usuario con ese correo en esta empresa.');
        const { error: eM } = await admin.from('empresa_miembros').insert({ usuario_id: existente.id, area_id: areaDestino, rol, activo: true });
        if (eM) return falla(/empresa_miembros/.test(eM.message) ? 'Falta aplicar en la base la migración 030 (usuarios en varias empresas).' : eM.message);
        return respuesta({ id: existente.id, agregado: true });
      }
      const id = creado.user.id;
      // Supabase guarda app_metadata después de insertar la cuenta: el disparador de alta la deja en la primera
      // empresa. Se fija aquí la empresa de quien la crea (antes de que su sesión, limitada a su empresa, la edite).
      await admin.from('profiles').update({ area_id: areaDestino }).eq('id', id);
      const datos: Record<string, unknown> = { nombre, rol };
      if (d.codigo) datos.codigo = String(d.codigo).trim();
      if (d.cargo_id) datos.cargo_id = String(d.cargo_id);
      if (Array.isArray(d.gerencia_ids)) datos.gerencia_ids = d.gerencia_ids;
      if (d.horas_dia !== undefined && d.horas_dia !== null && d.horas_dia !== '') datos.horas_dia = Number(d.horas_dia);
      const { error: ePerfil } = await (areaDestino === yo.area_id ? comoUsuario : admin).from('profiles').update(datos).eq('id', id);
      if (ePerfil) {
        await admin.auth.admin.deleteUser(id);
        return falla(ePerfil.message);
      }
      // Supabase guarda app_metadata (creado_por) después de insertar el usuario, así que el disparador de alta
      // lo trata como un registro propio: aquí se fija el cambio obligatorio de contraseña y se retira
      // el aviso "Nuevo usuario por aprobar" (el administrador ya lo creó con su rol)
      await admin.from('profiles').update({ debe_cambiar_clave: true }).eq('id', id);
      await admin.from('notificaciones').delete().eq('tipo', 'usuario_nuevo').eq('texto', `Nuevo usuario por aprobar: ${email}`);
      return respuesta({ id });
    }

    if (d.accion === 'clave') {
      const { data: obj } = await admin.from('profiles').select('*').eq('id', String(d.usuario_id ?? '')).single();
      if (!obj || obj.area_id !== yo.area_id) return falla('Usuario no encontrado.', 404);
      if (obj.id !== yo.id && (obj.es_admin_principal || (GESTORES.includes(obj.rol) && !(yo.rol === 'superadmin' || yo.es_admin_principal)))) {
        return falla('No puede restablecer la contraseña de ese usuario.', 403);
      }
      const { error: eClave } = await admin.auth.admin.updateUserById(obj.id, { password: clave });
      if (eClave) return falla(eClave.message);
      await admin.from('profiles').update({ debe_cambiar_clave: obj.id !== yo.id }).eq('id', obj.id);
      return respuesta({ ok: true });
    }

    return falla('Acción no válida.');
  } catch (e) {
    if (Sentry) { Sentry.captureException(e); await Sentry.flush(2000); }
    return falla(e instanceof Error ? e.message : String(e), 500);
  }
}

// ---------- Mejoras del aplicativo de todas las empresas ----------
// deno-lint-ignore no-explicit-any
async function mejoras(admin: any, yo: any, d: any): Promise<Response> {
  if (d.accion === 'mejoras') {
    const { data: items, error: e } = await admin.from('solicitudes_cambio').select('*').order('created_at', { ascending: false }).limit(500);
    if (e) return falla(e.message);
    const autores = [...new Set((items ?? []).map((s: any) => s.autor_id).filter(Boolean))];
    const [{ data: perfiles }, { data: areas }] = await Promise.all([
      autores.length ? admin.from('profiles').select('id, nombre').in('id', autores) : Promise.resolve({ data: [] }),
      admin.from('areas').select('id, nombre'),
    ]);
    const nom = new Map((perfiles ?? []).map((p: any) => [p.id, p.nombre]));
    const emp = new Map((areas ?? []).map((a: any) => [a.id, a.nombre]));
    // Solo lo necesario para la lista: sin correos ni otros datos de las personas
    return respuesta({ gestiona: !!yo.es_plataforma, mejoras: (items ?? []).map((s: any) => ({ ...s,
      autor_nombre: nom.get(s.autor_id) ?? '', empresa: emp.get(s.area_id) ?? '' })) });
  }
  if (!yo.es_plataforma) return falla('Solo los propietarios de la plataforma gestionan las mejoras de todas las empresas.', 403);
  const ESTADOS_MEJORA = ['recibida', 'en_analisis', 'aprobada', 'en_desarrollo', 'entregada', 'descartada'];
  const cambios: Record<string, unknown> = {};
  if (d.estado !== undefined) { if (!ESTADOS_MEJORA.includes(String(d.estado))) return falla('Estado no válido.'); cambios.estado = String(d.estado); }
  if (d.prioridad !== undefined) { if (!['alta', 'media', 'baja'].includes(String(d.prioridad))) return falla('Prioridad no válida.'); cambios.prioridad = String(d.prioridad); }
  if (d.respuesta !== undefined) cambios.respuesta = d.respuesta ? String(d.respuesta).slice(0, 4000) : null;
  const { data: x, error: e } = await admin.from('solicitudes_cambio').update(cambios).eq('id', String(d.id ?? '')).select().maybeSingle();
  if (e) return falla(e.message);
  return x ? respuesta({ registro: x }) : falla('Solicitud no encontrada.', 404);
}

// ---------- Empresas (administrador de la plataforma) ----------
// deno-lint-ignore no-explicit-any
async function empresas(admin: any, yo: any, d: any, _clave: string): Promise<Response> {
  const otras = ['plataforma', 'editar_empresa', 'eliminar_empresa', 'usar_empresa', 'cambiar_principal', 'estructura', 'lideres',
    'propietario', 'usuario_plataforma', 'auditoria_plataforma', 'historial_proyecto'];
  if (otras.includes(d.accion)) return await plataforma(admin, yo, d);
  if (d.accion === 'empresas') {
    const { data: areas, error: e } = await admin.from('areas').select('id, nombre, descripcion, activa, created_at').order('created_at');
    if (e) return falla(e.message);
    const { data: perfiles } = await admin.from('profiles').select('id, area_id, rol, activo, eliminado, es_admin_principal, es_plataforma, nombre, email');
    const { data: proys } = await admin.from('proyectos').select('area_id');
    const { data: miembros } = await admin.from('empresa_miembros').select('usuario_id, area_id, activo');
    const lista = (areas ?? []).map((a: any) => {
      // Personas de la empresa: con ella como empresa activa o como membresía (usuarios de varias empresas)
      const ids = new Set((miembros ?? []).filter((m: any) => m.area_id === a.id && m.activo).map((m: any) => m.usuario_id));
      const ps = (perfiles ?? []).filter((p: any) => (p.area_id === a.id || ids.has(p.id)) && !p.eliminado);
      const principal = ps.find((p: any) => p.es_admin_principal && !p.es_plataforma) || ps.find((p: any) => p.es_admin_principal);
      return { ...a, codigo: String(a.id).slice(0, 8), usuarios: ps.filter((p: any) => p.activo && p.rol !== 'pendiente').length,
        proyectos: (proys ?? []).filter((p: any) => p.area_id === a.id).length,
        administrador: principal ? `${principal.nombre} (${principal.email})` : '', mia: a.id === yo.area_id };
    });
    return respuesta({ empresas: lista });
  }

  if (d.accion === 'estado_empresa') {
    const id = String(d.area_id ?? '');
    if (id === yo.area_id && d.activa === false) return falla('No puede desactivar su propia empresa.');
    const { error: e } = await admin.from('areas').update({ activa: !!d.activa }).eq('id', id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  // crear_empresa: la crea un propietario de la plataforma. Los propietarios la administran por defecto; no se crea
  // ningún usuario (después se agregan con «Gestionar» y, si se quiere, se designa su super administrador).
  const nombreEmpresa = String(d.nombre_empresa ?? '').trim();
  if (!nombreEmpresa) return falla('Indique el nombre de la empresa.');
  const { data: existe } = await admin.from('areas').select('id').ilike('nombre', nombreEmpresa).maybeSingle();
  if (existe) return falla('Ya existe una empresa con ese nombre.');

  const { data: area, error: eArea } = await admin.from('areas').insert({ nombre: nombreEmpresa, descripcion: d.descripcion || null }).select().single();
  if (eArea) return falla(eArea.message);
  // Listas, parámetros y permisos iniciales en una sola transacción: si algo falla no queda nada a medias
  const { error: eSemilla } = await admin.rpc('inicializar_empresa', { p_area: area.id, p_semilla: d.semilla ?? {} });
  if (eSemilla) {
    await admin.from('areas').delete().eq('id', area.id);
    return falla(eSemilla.message);
  }
  return respuesta({ area_id: area.id });
}

// ---------- Consola de plataforma: datos y estructura de todas las empresas ----------
const TABLAS_ESTRUCTURA = ['portafolios', 'programas', 'proyectos'];
const CAMPOS: Record<string, string[]> = {
  portafolios: ['codigo', 'nombre', 'descripcion', 'responsable_id', 'estado'],
  programas: ['codigo', 'nombre', 'descripcion', 'responsable_id', 'estado', 'portafolio_id'],
  proyectos: ['codigo', 'nombre_corto', 'nombre_completo', 'estado', 'portafolio_id', 'programa_id', 'padre_id', 'gerencia_id', 'fase_id',
    'pais_id', 'fecha_inicio', 'fecha_fin', 'observaciones'],
};

// Mueve un proyecto y sus sub-proyectos a otra empresa. Solo si aún no tienen trabajo registrado: sus listas (gerencia,
// fase, país…) y sus líderes son de la empresa de origen, así que se quitan para elegirlos en la nueva.
// Devuelve una respuesta de error, o null si lo movió.
// deno-lint-ignore no-explicit-any
async function moverProyecto(admin: any, actual: any, area: string, datos: Record<string, unknown>): Promise<Response | null> {
  if (actual.padre_id) return falla('Un sub-proyecto se mueve junto con su proyecto: mueva el proyecto.');
  const { data: destino } = await admin.from('areas').select('id').eq('id', area).maybeSingle();
  if (!destino) return falla('Empresa no encontrada.', 404);
  const { data: subs } = await admin.from('proyectos').select('id, codigo').eq('padre_id', actual.id);
  const ids = [actual.id, ...(subs ?? []).map((x: any) => x.id)];
  for (const [t, texto] of [['actividades', 'actividades'], ['restricciones', 'restricciones'], ['cartera', 'registros de cartera']]) {
    const { count } = await admin.from(t).select('id', { count: 'exact', head: true }).in('proyecto_id', ids);
    if (count) return falla(`No se puede mover: el proyecto${subs?.length ? ' o sus sub-proyectos' : ''} ya tiene ${count} ${texto} en esta empresa. Mantenga su historial aquí o cree el proyecto en la otra empresa.`);
  }
  const codigos = [actual.codigo, ...(subs ?? []).map((x: any) => x.codigo)];
  const { data: rep } = await admin.from('proyectos').select('codigo').eq('area_id', area).in('codigo', codigos);
  if (rep?.length) return falla(`En la empresa de destino ya existe el código ${rep.map((x: any) => x.codigo).join(', ')}. Cámbielo antes de mover.`);
  // Lo que pertenece a la empresa de origen
  await admin.from('proyecto_lideres').delete().in('proyecto_id', ids);
  await admin.from('proyecto_favoritos').delete().in('proyecto_id', ids);
  await admin.from('plantilla_items').update({ proyecto_id: null }).in('proyecto_id', ids);
  const limpio = { area_id: area, gerencia_id: null, cet_id: null, fase_id: null, pais_id: null, tipo_id: null };
  // Los sub-proyectos se separan un momento y se vuelven a unir ya en la nueva empresa
  if (subs?.length) await admin.from('proyectos').update({ padre_id: null }).in('id', subs.map((x: any) => x.id));
  const { error: e1 } = await admin.from('proyectos').update({ ...datos, ...limpio, padre_id: null }).eq('id', actual.id);
  if (e1) {
    if (subs?.length) await admin.from('proyectos').update({ padre_id: actual.id }).in('id', subs.map((x: any) => x.id));
    return falla(e1.message);
  }
  const { data: padre } = await admin.from('proyectos').select('portafolio_id, programa_id').eq('id', actual.id).single();
  if (subs?.length) {
    const { error: e2 } = await admin.from('proyectos').update({ ...limpio, padre_id: actual.id, portafolio_id: padre.portafolio_id, programa_id: padre.programa_id })
      .in('id', subs.map((x: any) => x.id));
    if (e2) return falla(e2.message);
  }
  await admin.from('hitos').update({ area_id: area }).in('proyecto_id', ids);
  return null;
}

// deno-lint-ignore no-explicit-any
async function plataforma(admin: any, yo: any, d: any): Promise<Response> {
  const area = String(d.area_id ?? '');
  // deno-lint-ignore no-explicit-any
  const existeArea = async (id: string) => !!id && !!(await admin.from('areas').select('id').eq('id', id).maybeSingle()).data;

  if (d.accion === 'plataforma') {
    const { data: miembros } = await admin.from('empresa_miembros').select('usuario_id, area_id, rol, activo, es_admin_principal');
    const [areas, perfiles, portafolios, programas, proyectos, lideres] = await Promise.all([
      admin.from('areas').select('id, nombre, descripcion, activa, created_at').order('created_at'),
      admin.from('profiles').select('id, area_id, nombre, email, codigo, rol, activo, eliminado, es_admin_principal, es_plataforma, created_at'),
      admin.from('portafolios').select('*'),
      admin.from('programas').select('*'),
      admin.from('proyectos').select('id, area_id, codigo, nombre_corto, nombre_completo, estado, portafolio_id, programa_id, padre_id, gerencia_id, fecha_inicio, fecha_fin, created_at'),
      admin.from('proyecto_lideres').select('proyecto_id, usuario_id'),
    ]);
    const error = [areas, perfiles, portafolios, programas, proyectos, lideres].find(r => r.error)?.error;
    if (error) return falla(error.message);
    return respuesta({ areas: areas.data, perfiles: (perfiles.data ?? []).filter((p: any) => !p.eliminado), portafolios: portafolios.data,
      programas: programas.data, proyectos: proyectos.data, lideres: lideres.data, miembros: miembros ?? [], mi_area: yo.area_id });
  }

  if (d.accion === 'historial_proyecto') {
    // Lo que se perdería al eliminar el proyecto (y sus sub-proyectos)
    const id = String(d.id ?? '');
    const { data: subs } = await admin.from('proyectos').select('id').eq('padre_id', id);
    const ids = [id, ...(subs ?? []).map((x: any) => x.id)];
    const cuenta = async (t: string) => (await admin.from(t).select('id', { count: 'exact', head: true }).in('proyecto_id', ids)).count ?? 0;
    return respuesta({ subproyectos: ids.length - 1, actividades: await cuenta('actividades'), restricciones: await cuenta('restricciones'), cartera: await cuenta('cartera') });
  }

  if (d.accion === 'editar_empresa') {
    const nombre = String(d.nombre ?? '').trim();
    if (!nombre) return falla('Indique el nombre de la empresa.');
    const { data: otra } = await admin.from('areas').select('id').ilike('nombre', nombre).neq('id', area).maybeSingle();
    if (otra) return falla('Ya existe una empresa con ese nombre.');
    const { error: e } = await admin.from('areas').update({ nombre, descripcion: d.descripcion || null }).eq('id', area);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  if (d.accion === 'eliminar_empresa') {
    if (area === yo.area_id) return falla('No puede eliminar la empresa en la que está trabajando. Abra otra empresa primero.');
    if (!await existeArea(area)) return falla('Empresa no encontrada.', 404);
    // Cuentas de acceso de sus usuarios: se borran después de eliminar la empresa (la base solo borra los perfiles)
    const { data: usuarios } = await admin.from('profiles').select('id').eq('area_id', area);
    // Todo en una transacción (public.eliminar_empresa, migración 025): o se elimina completa, con todos sus datos,
    // o no cambia nada. El aplicativo pide escribir el nombre de la empresa para confirmar.
    const { error: e } = await admin.rpc('eliminar_empresa', { p_area: area });
    if (funcionFaltante(e)) {
      const { count: plat } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('area_id', area).eq('es_plataforma', true);
      if (plat) return falla('Un propietario de la plataforma está trabajando en esa empresa. Que abra otra empresa primero.');
      try { await eliminarEmpresaDirecto(area); } catch (err) { return falla((err as Error).message); }
    } else if (e) return falla(e.message);
    // Cuentas de acceso: solo de quienes ya no tienen perfil (los que pertenecen a otra empresa pasaron a ella)
    for (const u of usuarios ?? []) {
      const { data: sigue } = await admin.from('profiles').select('id').eq('id', u.id).maybeSingle();
      if (!sigue) await admin.auth.admin.deleteUser(u.id);
    }
    return respuesta({ ok: true });
  }

  if (d.accion === 'usar_empresa') {
    if (!await existeArea(area)) return falla('Empresa no encontrada.', 404);
    const { error: e } = await admin.from('profiles').update({ area_id: area }).eq('id', yo.id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  if (d.accion === 'cambiar_principal') {
    const { data: nuevo } = await admin.from('profiles').select('id, area_id, activo, eliminado').eq('id', String(d.usuario_id ?? '')).maybeSingle();
    if (!nuevo || nuevo.eliminado) return falla('El usuario no pertenece a esa empresa.');
    const { data: miembro } = await admin.from('empresa_miembros').select('usuario_id').eq('usuario_id', nuevo.id).eq('area_id', area).maybeSingle();
    if (nuevo.area_id !== area && !miembro) return falla('El usuario no pertenece a esa empresa.');
    // Un solo super administrador principal por empresa (en los perfiles activos en ella y en las membresías)
    await admin.from('profiles').update({ es_admin_principal: false }).eq('area_id', area).eq('es_plataforma', false).neq('id', nuevo.id);
    await admin.from('empresa_miembros').update({ es_admin_principal: false }).eq('area_id', area).neq('usuario_id', nuevo.id);
    if (nuevo.area_id === area) {
      const { error: e } = await admin.from('profiles').update({ es_admin_principal: true, rol: 'superadmin', activo: true }).eq('id', nuevo.id);
      if (e) return falla(e.message);
    } else {
      const { error: e } = await admin.from('empresa_miembros').update({ es_admin_principal: true, rol: 'superadmin', activo: true }).eq('usuario_id', nuevo.id).eq('area_id', area);
      if (e) return falla(e.message);
    }
    return respuesta({ ok: true });
  }

  if (d.accion === 'estructura') {
    const tabla = String(d.tabla ?? '');
    if (!TABLAS_ESTRUCTURA.includes(tabla)) return falla('Tabla no válida.');
    if (d.op === 'eliminar') {
      const { data: x } = await admin.from(tabla).select('id').eq('id', String(d.id ?? '')).maybeSingle();
      if (!x) return falla('Registro no encontrado.', 404);
      if (tabla === 'proyectos' && d.completo) {
        // Con su historial y sus sub-proyectos, en una transacción (public.eliminar_proyecto_plataforma, migración 026)
        const { data: r, error: e } = await admin.rpc('eliminar_proyecto_plataforma', { p_proyecto: x.id });
        if (funcionFaltante(e)) {
          try { return respuesta({ ok: true, eliminado: await eliminarProyectoDirecto(x.id) }); } catch (err) { return falla((err as Error).message); }
        }
        return e ? falla(e.message) : respuesta({ ok: true, eliminado: r });
      }
      if (tabla === 'proyectos') {
        const { count: hijos } = await admin.from('proyectos').select('id', { count: 'exact', head: true }).eq('padre_id', x.id);
        if (hijos) return falla(`El proyecto tiene ${hijos} sub-proyecto(s): elimínelos o muévalos primero.`);
        const { count } = await admin.from('actividades').select('id', { count: 'exact', head: true }).eq('proyecto_id', x.id);
        if (count) return falla(`El proyecto tiene ${count} actividades: confirme la eliminación con su historial.`);
        await admin.from('proyecto_lideres').delete().eq('proyecto_id', x.id);
        await admin.from('proyecto_favoritos').delete().eq('proyecto_id', x.id);
      }
      const { error: e } = await admin.from(tabla).delete().eq('id', x.id);
      return e ? falla(/foreign key/i.test(e.message) ? 'No se puede eliminar: tiene información relacionada.' : e.message) : respuesta({ ok: true });
    }
    const datos: Record<string, unknown> = {};
    for (const k of CAMPOS[tabla]) if (k in (d.datos ?? {})) datos[k] = d.datos[k] === '' ? null : d.datos[k];
    if (tabla === 'proyectos' && datos.programa_id) {
      const { data: g } = await admin.from('programas').select('portafolio_id').eq('id', datos.programa_id).maybeSingle();
      if (g?.portafolio_id) datos.portafolio_id = g.portafolio_id;
    }
    if (d.id && tabla === 'proyectos' && area) {
      // Mover un proyecto (con sus sub-proyectos) a otra empresa (pedido 15)
      const { data: actual } = await admin.from('proyectos').select('id, area_id, padre_id, codigo').eq('id', String(d.id)).maybeSingle();
      if (actual && actual.area_id !== area) {
        const r = await moverProyecto(admin, actual, area, datos);
        if (r) return r;
        const { data: x } = await admin.from('proyectos').select('*').eq('id', actual.id).single();
        return respuesta({ registro: x });
      }
    }
    if (d.id) {
      const { data: x, error: e } = await admin.from(tabla).update(datos).eq('id', String(d.id)).select().single();
      return e ? falla(e.message) : respuesta({ registro: x });
    }
    if (!await existeArea(area)) return falla('Empresa no encontrada.', 404);
    if (tabla === 'proyectos') {
      if (!datos.codigo || !datos.nombre_corto) return falla('Indique el código y el nombre del proyecto.');
      const { data: rep } = await admin.from('proyectos').select('id').eq('area_id', area).eq('codigo', datos.codigo).maybeSingle();
      if (rep) return falla('Ya existe un proyecto con ese código en la empresa.');
      datos.estado ??= 'activo';
      datos.created_by = yo.id;
    } else if (!datos.nombre) return falla('Indique el nombre.');
    const { data: x, error: e } = await admin.from(tabla).insert({ ...datos, area_id: area }).select().single();
    return e ? falla(e.message) : respuesta({ registro: x });
  }

  if (d.accion === 'lideres') {
    const { data: p } = await admin.from('proyectos').select('id, area_id').eq('id', String(d.proyecto_id ?? '')).maybeSingle();
    if (!p) return falla('Proyecto no encontrado.', 404);
    const ids: string[] = Array.isArray(d.usuario_ids) ? d.usuario_ids.map(String) : [];
    const { data: validos } = await admin.from('profiles').select('id').eq('area_id', p.area_id).in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const { data: miembrosP } = await admin.from('empresa_miembros').select('usuario_id').eq('area_id', p.area_id).eq('activo', true).in('usuario_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const ok = new Set([...(validos ?? []).map((x: any) => x.id), ...(miembrosP ?? []).map((x: any) => x.usuario_id)]);
    await admin.from('proyecto_lideres').delete().eq('proyecto_id', p.id);
    const filas = ids.filter(i => ok.has(i)).map(usuario_id => ({ proyecto_id: p.id, usuario_id }));
    if (filas.length) {
      const { error: e } = await admin.from('proyecto_lideres').insert(filas);
      if (e) return falla(e.message);
    }
    return respuesta({ ok: true });
  }

  if (d.accion === 'propietario') {
    const id = String(d.usuario_id ?? '');
    const es = !!d.es;
    if (!es) {
      if (id === yo.id) return falla('No puede quitarse a sí mismo. Otro propietario debe hacerlo.');
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('es_plataforma', true);
      if ((count ?? 0) <= 1) return falla('Debe quedar al menos un propietario de la plataforma.');
    }
    const { error: e } = await admin.from('profiles').update({ es_plataforma: es }).eq('id', id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  if (d.accion === 'usuario_plataforma') {
    const { data: u } = await admin.from('profiles').select('id, area_id, es_plataforma, es_admin_principal').eq('id', String(d.usuario_id ?? '')).maybeSingle();
    if (!u) return falla('Usuario no encontrado.', 404);
    // Usuario de varias empresas: su rol y estado en una empresa que no es la activa están en su membresía
    if (area && u.area_id !== area) {
      const { data: m } = await admin.from('empresa_miembros').select('es_admin_principal').eq('usuario_id', u.id).eq('area_id', area).maybeSingle();
      if (!m) return falla('El usuario no pertenece a esa empresa.');
      if (d.quitar) {
        if (m.es_admin_principal) return falla('Es el super administrador principal de esa empresa: designe antes a otro.');
        await admin.from('proyecto_lideres').delete().eq('usuario_id', u.id).in('proyecto_id',
          ((await admin.from('proyectos').select('id').eq('area_id', area)).data ?? []).map((x: any) => x.id).concat(['00000000-0000-0000-0000-000000000000']));
        const { error: e } = await admin.from('empresa_miembros').delete().eq('usuario_id', u.id).eq('area_id', area);
        return e ? falla(e.message) : respuesta({ ok: true });
      }
      const cm: Record<string, unknown> = {};
      if (d.rol !== undefined) {
        if (!ROLES.includes(String(d.rol))) return falla('Rol no válido.');
        if (m.es_admin_principal && d.rol !== 'superadmin') return falla('El administrador principal de una empresa es super administrador. Cambie antes el principal.');
        cm.rol = String(d.rol);
      }
      if (d.activo !== undefined) cm.activo = !!d.activo;
      const { error: e } = await admin.from('empresa_miembros').update(cm).eq('usuario_id', u.id).eq('area_id', area);
      return e ? falla(e.message) : respuesta({ ok: true });
    }
    if (d.quitar) {
      // Es su empresa activa: si pertenece a otra, pasa a ella; si no, se usa «Eliminar usuario»
      const { data: otras } = await admin.from('empresa_miembros').select('area_id').eq('usuario_id', u.id).neq('area_id', u.area_id).eq('activo', true);
      if (!otras?.length) return falla('Esta es la única empresa de la persona: para quitarla use «Eliminar usuario» en la configuración de la empresa.');
      if (u.es_admin_principal) return falla('Es el super administrador principal de esa empresa: designe antes a otro.');
      const viejo = u.area_id;
      const { error: e1 } = await admin.rpc('mover_a_otra_empresa', { p_usuario: u.id, p_dejar: viejo });
      if (e1) return falla(e1.message);
      await admin.from('empresa_miembros').delete().eq('usuario_id', u.id).eq('area_id', viejo);
      return respuesta({ ok: true });
    }
    const cambios: Record<string, unknown> = {};
    if (d.rol !== undefined) {
      if (!ROLES.includes(String(d.rol))) return falla('Rol no válido.');
      if (u.es_admin_principal && d.rol !== 'superadmin') return falla('El administrador principal de una empresa es super administrador. Cambie antes el principal.');
      cambios.rol = String(d.rol);
    }
    if (d.activo !== undefined) {
      if (u.id === yo.id && !d.activo) return falla('No puede desactivarse a sí mismo.');
      cambios.activo = !!d.activo;
    }
    const { error: e } = await admin.from('profiles').update(cambios).eq('id', u.id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  // auditoria_plataforma
  let q = admin.from('auditoria').select('*').order('created_at', { ascending: false }).limit(Math.min(Number(d.limite) || 300, 1000));
  if (area) q = q.eq('area_id', area);
  const { data: regs, error: e } = await q;
  return e ? falla(e.message) : respuesta({ registros: regs });
}
