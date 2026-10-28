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
    const { data: permitido } = await comoUsuario.rpc('puede', { p_accion: 'gestionar_usuarios' });
    if (!yo?.activo || !permitido) return falla('No tiene permiso para gestionar usuarios.', 403);

    const d = await req.json().catch(() => ({}));
    const clave = String(d.clave ?? '');
    const accionesEmpresa = ['empresas', 'crear_empresa', 'estado_empresa', 'plataforma', 'editar_empresa', 'eliminar_empresa',
      'usar_empresa', 'cambiar_principal', 'estructura', 'lideres', 'propietario', 'usuario_plataforma', 'auditoria_plataforma'];
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
        return falla(/already|registered|exists/i.test(eCrear.message) ? 'Ya existe un usuario con ese correo.' : eCrear.message);
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

// ---------- Empresas (administrador de la plataforma) ----------
// deno-lint-ignore no-explicit-any
async function empresas(admin: any, yo: any, d: any, _clave: string): Promise<Response> {
  const otras = ['plataforma', 'editar_empresa', 'eliminar_empresa', 'usar_empresa', 'cambiar_principal', 'estructura', 'lideres',
    'propietario', 'usuario_plataforma', 'auditoria_plataforma'];
  if (otras.includes(d.accion)) return await plataforma(admin, yo, d);
  if (d.accion === 'empresas') {
    const { data: areas, error: e } = await admin.from('areas').select('id, nombre, descripcion, activa, created_at').order('created_at');
    if (e) return falla(e.message);
    const { data: perfiles } = await admin.from('profiles').select('id, area_id, rol, activo, eliminado, es_admin_principal, es_plataforma, nombre, email');
    const { data: proys } = await admin.from('proyectos').select('area_id');
    const lista = (areas ?? []).map((a: any) => {
      const ps = (perfiles ?? []).filter((p: any) => p.area_id === a.id && !p.eliminado);
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
      programas: programas.data, proyectos: proyectos.data, lideres: lideres.data, mi_area: yo.area_id });
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
    if (e) return falla(e.message);
    for (const u of usuarios ?? []) await admin.auth.admin.deleteUser(u.id);
    return respuesta({ ok: true });
  }

  if (d.accion === 'usar_empresa') {
    if (!await existeArea(area)) return falla('Empresa no encontrada.', 404);
    const { error: e } = await admin.from('profiles').update({ area_id: area }).eq('id', yo.id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  if (d.accion === 'cambiar_principal') {
    const { data: nuevo } = await admin.from('profiles').select('id, area_id, activo, eliminado').eq('id', String(d.usuario_id ?? '')).maybeSingle();
    if (!nuevo || nuevo.area_id !== area || nuevo.eliminado) return falla('El usuario no pertenece a esa empresa.');
    await admin.from('profiles').update({ es_admin_principal: false }).eq('area_id', area).eq('es_plataforma', false).neq('id', nuevo.id);
    const { error: e } = await admin.from('profiles').update({ es_admin_principal: true, rol: 'superadmin', activo: true }).eq('id', nuevo.id);
    return e ? falla(e.message) : respuesta({ ok: true });
  }

  if (d.accion === 'estructura') {
    const tabla = String(d.tabla ?? '');
    if (!TABLAS_ESTRUCTURA.includes(tabla)) return falla('Tabla no válida.');
    if (d.op === 'eliminar') {
      const { data: x } = await admin.from(tabla).select('id').eq('id', String(d.id ?? '')).maybeSingle();
      if (!x) return falla('Registro no encontrado.', 404);
      if (tabla === 'proyectos') {
        const { count: hijos } = await admin.from('proyectos').select('id', { count: 'exact', head: true }).eq('padre_id', x.id);
        if (hijos) return falla(`El proyecto tiene ${hijos} sub-proyecto(s): elimínelos o muévalos primero.`);
        const { count } = await admin.from('actividades').select('id', { count: 'exact', head: true }).eq('proyecto_id', x.id);
        if (count) return falla(`El proyecto tiene ${count} actividades: ciérrelo en lugar de eliminarlo para conservar su historial.`);
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
    const ok = new Set((validos ?? []).map((x: any) => x.id));
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
    const { data: u } = await admin.from('profiles').select('id, es_plataforma, es_admin_principal').eq('id', String(d.usuario_id ?? '')).maybeSingle();
    if (!u) return falla('Usuario no encontrado.', 404);
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
