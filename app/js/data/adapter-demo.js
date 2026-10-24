// Adaptador de demostración: misma interfaz que Supabase, datos ficticios en localStorage.
// Replica las reglas de negocio de la base de datos (cierre de semana, bloqueo, valores protegidos,
// notificaciones) para que el aplicativo se comporte igual. No aplica seguridad real.
import { uuid, lunes, hoy } from '../core/util.js';
import { crearDatosDemo } from './demo-seed.js';

const CLAVE = 'lpsgt-demo-db';
const CLAVE_SESION = 'lpsgt-demo-usuario';

const DEFECTOS = {
  actividades: { resp2: null, hh_lu: 0, hh_ma: 0, hh_mi: 0, hh_ju: 0, hh_vi: 0, hh_sa: 0, hh_do: 0, hh_real: null,
    tipo: 'programada', comprometida: false, estado_la: 'pendiente', estado: 'programado', cnc_id: null, comentario: null,
    origen: 'manual', origen_id: null, cartera_id: null, semana_original: null, orden: 0, extra: {}, descripcion: '' },
  proyectos: { estado: 'activo', extra: {} },
  cartera: { estado: 'abierta', origen: 'interna', extra: {}, f_solicitud: null },
  restricciones: { estado: 'pendiente', extra: {} },
  cierres: { cerrada: true, automatico: false },
  lista_valores: { activo: true, protegido: false, orden: 0, extra: {} },
  profiles: { rol: 'pendiente', activo: true, gerencia_ids: [], es_admin_principal: false, tour_visto: false },
  notificaciones: { leida: false },
  solicitudes_cambio: { estado: 'recibida', prioridad: 'media' },
  acuerdos: { estado: 'pendiente' },
  hitos: { estado: 'pendiente' },
  columnas_personalizadas: { activa: true, orden: 0 },
  plantillas: { activa: true },
  reuniones: { asistentes: [] },
  comentarios: { menciones: [] },
};

const SIN_ID = new Set(['proyecto_lideres', 'proyecto_favoritos']);

function cargar() {
  try {
    const s = localStorage.getItem(CLAVE);
    if (s) {
      const db = JSON.parse(s);
      // Datos de demo creados antes de la versión con Super administrador (equivale a la migración 009)
      for (const p of db.profiles || []) if (p.es_admin_principal && p.rol === 'admin') p.rol = 'superadmin';
      // "Servicios / Entregables" pasó a llamarse "CET / Servicio" (migración 010)
      for (const l of db.listas || []) if (l.clave === 'servicios' && l.nombre === 'Servicios / Entregables') l.nombre = 'CET / Servicio';
      // Proyectos pegados sin estado (antes una celda vacía lo borraba): quedan activos
      for (const p of db.proyectos || []) if (!p.estado) p.estado = 'activo';
      return db;
    }
  } catch { /* datos corruptos: se regeneran */ }
  const db = crearDatosDemo();
  localStorage.setItem(CLAVE, JSON.stringify(db));
  return db;
}

function cumple(fila, f = {}) {
  for (const [k, v] of Object.entries(f.eq || {})) if (fila[k] !== v) return false;
  for (const [k, v] of Object.entries(f.neq || {})) if (fila[k] === v) return false;
  for (const [k, v] of Object.entries(f.in || {})) if (!v.includes(fila[k])) return false;
  for (const [k, v] of Object.entries(f.gte || {})) if (!(fila[k] >= v)) return false;
  for (const [k, v] of Object.entries(f.lte || {})) if (!(fila[k] <= v)) return false;
  for (const [k, v] of Object.entries(f.is || {})) if ((fila[k] ?? null) !== v) return false;
  return true;
}

const clon = x => JSON.parse(JSON.stringify(x));
const HH = ['hh_lu', 'hh_ma', 'hh_mi', 'hh_ju', 'hh_vi', 'hh_sa', 'hh_do'];

export function crearAdaptadorDemo() {
  let db = cargar();
  const oyentes = new Set();
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('lpsgt-demo') : null;

  function guardar() { localStorage.setItem(CLAVE, JSON.stringify(db)); }
  function tabla(t) { return (db[t] ||= []); }
  function usuarioId() { return localStorage.getItem(CLAVE_SESION); }
  function perfil(id = usuarioId()) { return tabla('profiles').find(p => p.id === id); }

  // Emula public.eliminar_usuario(): borra si no tiene historial; si tiene, conserva el perfil como eliminado
  const esSuper = p => p?.rol === 'superadmin' || !!p?.es_admin_principal;
  const GESTORES = ['superadmin', 'admin', 'delegado'];
  const SIN_HISTORIAL = new Set(['profiles', 'notificaciones', 'proyecto_favoritos', 'vistas', 'proyecto_lideres', 'auditoria']);
  async function eliminarUsuarioDemo(id) {
    db = cargar();
    const yo = perfil();
    const obj = perfil(id);
    if (!yo || !['superadmin', 'admin'].includes(yo.rol)) throw new Error('Solo el administrador puede eliminar usuarios.');
    if (!obj) throw new Error('Usuario no encontrado.');
    if (obj.id === yo.id) throw new Error('No puede eliminarse a sí mismo.');
    if (obj.es_admin_principal) throw new Error('El administrador principal no se puede eliminar.');
    if (['superadmin', 'admin'].includes(obj.rol) && !esSuper(yo)) throw new Error('Solo el super administrador elimina a un administrador.');
    const conHistorial = Object.entries(db).some(([t, filas]) => !SIN_HISTORIAL.has(t) && Array.isArray(filas) &&
      filas.some(f => f && typeof f === 'object' && Object.entries(f).some(([k, v]) => k !== 'id' && v === id)));
    if (!conHistorial) {
      for (const t of ['notificaciones', 'proyecto_favoritos', 'vistas', 'proyecto_lideres']) db[t] = tabla(t).filter(f => f.usuario_id !== id);
      guardar();
      await api.remove('profiles', id);
      return 'eliminado';
    }
    db.proyecto_lideres = tabla('proyecto_lideres').filter(f => f.usuario_id !== id);
    guardar();
    await api.update('profiles', id, { eliminado: true, activo: false, email: null, rol: GESTORES.includes(obj.rol) ? 'lider' : obj.rol });
    return 'desactivado';
  }

  function emitir(ev, local = true) {
    if (local) for (const cb of oyentes) cb(clon(ev));
    canal?.postMessage(ev);
  }
  canal?.addEventListener('message', e => {
    db = cargar();
    for (const cb of oyentes) cb(e.data);
  });
  window.addEventListener('storage', e => { if (e.key === CLAVE) db = cargar(); });

  function semanaCerrada(resp, semana) {
    return tabla('cierres').some(c => c.responsable_id === resp && c.semana === semana && c.cerrada);
  }

  function notificar(usuarios, tipo, texto, ruta) {
    for (const u of usuarios) {
      if (!u || u === usuarioId()) continue;
      const n = { id: uuid(), usuario_id: u, tipo, texto, ruta, leida: false, created_at: new Date().toISOString() };
      tabla('notificaciones').push(n);
      emitir({ tabla: 'notificaciones', tipo: 'INSERT', fila: n });
    }
  }
  const gestores = area => tabla('profiles').filter(p => p.area_id === area && GESTORES.includes(p.rol) && p.activo).map(p => p.id);

  function auditar(t, accion, fila, cambios) {
    if (!['actividades', 'restricciones', 'proyectos', 'cartera', 'cierres', 'profiles', 'permisos', 'parametros', 'lista_valores', 'acuerdos'].includes(t)) return;
    const a = tabla('auditoria');
    a.push({ id: a.length + 1, area_id: fila.area_id, tabla: t, registro_id: fila.id, accion, usuario_id: usuarioId(), cambios, created_at: new Date().toISOString() });
    if (a.length > 3000) a.splice(0, a.length - 3000);
  }

  // Reglas equivalentes a los triggers de la base de datos
  function antes(t, op, nueva, vieja) {
    if (t === 'actividades') {
      if (nueva) {
        if (new Date(nueva.semana + 'T12:00').getDay() !== 1) throw new Error('La semana debe empezar en lunes.');
        nueva.hh_total = HH.reduce((s, k) => s + (Number(nueva[k]) || 0), 0);
      }
      for (const f of [vieja, nueva]) {
        if (f && semanaCerrada(f.responsable_id, f.semana)) {
          throw new Error(`La semana del ${f.semana.split('-').reverse().join('/')} está cerrada. Solo un administrador puede reabrirla.`);
        }
      }
    }
    if (t === 'cierres' && nueva) {
      if (op === 'UPDATE' && vieja.cerrada && !nueva.cerrada) {
        const yo = perfil();
        if (!GESTORES.includes(yo?.rol)) throw new Error('Solo el administrador o el delegado pueden reabrir una semana.');
        nueva.reabierto_at = new Date().toISOString();
        nueva.reabierto_por = usuarioId();
      } else if (nueva.cerrada && !nueva.automatico) {
        const acts = tabla('actividades').filter(a => a.responsable_id === nueva.responsable_id && a.semana === nueva.semana && a.comprometida);
        const sinEstado = acts.filter(a => a.estado === 'programado').length;
        const sinCnc = acts.filter(a => a.estado === 'no_completado' && !a.cnc_id).length;
        if (sinEstado) throw new Error(`Hay ${sinEstado} compromiso(s) sin estado final (Completado / No completado / Cancelado).`);
        if (sinCnc) throw new Error(`Hay ${sinCnc} compromiso(s) no completado(s) sin causa de no cumplimiento (CNC).`);
      }
    }
    if (t === 'lista_valores' && vieja?.protegido) {
      if (op === 'DELETE') throw new Error(`El valor "${vieja.valor}" está protegido: puede renombrarse, pero no eliminarse.`);
      if (nueva.codigo !== vieja.codigo || !nueva.activo) throw new Error(`El valor "${vieja.valor}" está protegido: solo puede cambiar su texto, orden o color.`);
    }
    if (t === 'profiles' && op === 'UPDATE') {
      const yo = perfil();
      if (nueva.es_admin_principal !== vieja.es_admin_principal) throw new Error('El administrador principal solo se cambia desde la base de datos.');
      if (vieja.es_admin_principal && (nueva.rol !== vieja.rol || !nueva.activo)) {
        throw new Error('El administrador principal no puede perder su rol ni desactivarse.');
      }
      if (nueva.rol !== vieja.rol && (GESTORES.includes(nueva.rol) || GESTORES.includes(vieja.rol)) && !esSuper(yo)) {
        throw new Error('Solo el super administrador asigna o retira los roles de super administrador, administrador y delegado.');
      }
      if (nueva.rol === 'delegado' && vieja.rol !== 'delegado') {
        tabla('delegado_historial').push({ id: uuid(), area_id: nueva.area_id, usuario_id: nueva.id, otorgado_por: usuarioId(), desde: new Date().toISOString(), hasta: null });
      } else if (vieja.rol === 'delegado' && nueva.rol !== 'delegado') {
        for (const h of tabla('delegado_historial')) if (h.usuario_id === nueva.id && !h.hasta) h.hasta = new Date().toISOString();
      }
    }
  }

  function despues(t, op, fila, vieja) {
    if (t === 'comentarios' && op === 'INSERT') {
      const autor = perfil(fila.autor_id)?.nombre || 'Alguien';
      notificar(fila.menciones || [], 'mencion', `${autor} te mencionó: ${fila.texto.slice(0, 140)}`, `#/${fila.entidad}/${fila.entidad_id}`);
    }
    if (t === 'proyectos') {
      if (op === 'INSERT' && fila.estado === 'propuesto') {
        notificar(gestores(fila.area_id), 'proyecto_propuesto', `Proyecto propuesto por aprobar: ${fila.codigo} ${fila.nombre_corto}`, `#/proyectos/${fila.id}`);
      } else if (op === 'UPDATE' && vieja.estado === 'propuesto' && ['activo', 'rechazado'].includes(fila.estado) && fila.propuesto_por) {
        notificar([fila.propuesto_por], 'proyecto_' + fila.estado,
          `Tu proyecto ${fila.nombre_corto} ${fila.estado === 'activo' ? 'fue aprobado.' : 'fue rechazado: ' + (fila.motivo_rechazo || '')}`, `#/proyectos/${fila.id}`);
      }
    }
    if (t === 'cartera' && fila.origen === 'solicitud') {
      if (op === 'INSERT') {
        notificar(gestores(fila.area_id), 'solicitud_nueva', `Nueva solicitud de servicio: ${fila.descripcion.slice(0, 120)}`, `#/cartera/${fila.id}`);
        if (fila.responsable_id) notificar([fila.responsable_id], 'solicitud_nueva', `Solicitud de servicio dirigida a ti: ${fila.descripcion.slice(0, 120)}`, `#/cartera/${fila.id}`);
      } else if (op === 'UPDATE' && vieja.estado === 'nueva' && fila.estado !== 'nueva' && fila.solicitante_id) {
        notificar([fila.solicitante_id], 'solicitud_' + fila.estado,
          `Tu solicitud "${fila.descripcion.slice(0, 80)}" fue ${fila.estado === 'rechazada' ? 'rechazada: ' + (fila.motivo_rechazo || '') : 'aceptada.'}`, `#/cartera/${fila.id}`);
      }
    }
  }

  function completar(t, f) {
    const yo = perfil();
    const ahora = new Date().toISOString();
    const fila = { ...clon(DEFECTOS[t] || {}), ...f };
    if (!SIN_ID.has(t) && !fila.id) fila.id = uuid();
    if (!fila.created_at) fila.created_at = ahora;
    fila.updated_at = ahora;
    if ('created_by' in fila || ['actividades', 'proyectos', 'cartera', 'restricciones', 'reuniones', 'acuerdos'].includes(t)) fila.created_by ??= yo?.id ?? null;
    if (t === 'cierres') { fila.cerrado_at ??= ahora; fila.cerrado_por ??= yo?.id ?? null; }
    if (t === 'cartera') fila.f_solicitud ??= hoy();
    if (t === 'restricciones') fila.f_identificada ??= hoy();
    if (t === 'comentarios') fila.autor_id ??= yo?.id;
    if (t === 'solicitudes_cambio') fila.autor_id ??= yo?.id;
    if (t === 'enlaces') fila.autor_id ??= yo?.id;
    return fila;
  }

  const api = {
    tipo: 'demo',

    async list(t, f = {}) {
      let filas = tabla(t).filter(r => cumple(r, f));
      for (const [col, asc] of [...(f.order || [])].reverse()) {
        filas = [...filas].sort((a, b) => {
          const x = a[col] ?? '', y = b[col] ?? '';
          return (x > y ? 1 : x < y ? -1 : 0) * (asc === false ? -1 : 1);
        });
      }
      if (f.limit) filas = filas.slice(0, f.limit);
      return clon(filas);
    },
    async insert(t, filas) {
      db = cargar();
      const arr = (Array.isArray(filas) ? filas : [filas]).map(f => completar(t, f));
      for (const f of arr) antes(t, 'INSERT', f, null);
      tabla(t).push(...arr);
      for (const f of arr) { auditar(t, 'insert', f, f); despues(t, 'INSERT', f, null); }
      guardar();
      for (const f of arr) emitir({ tabla: t, tipo: 'INSERT', fila: f });
      return clon(arr);
    },
    async upsert(t, filas, onConflict) {
      const claves = (onConflict || 'id').split(',');
      const res = [];
      for (const f of Array.isArray(filas) ? filas : [filas]) {
        const ex = tabla(t).find(r => claves.every(k => r[k] === f[k]));
        if (ex && ex.id) res.push(await api.update(t, ex.id, f));
        else if (ex) { Object.assign(ex, f); guardar(); res.push(clon(ex)); }
        else res.push(...await api.insert(t, f));
      }
      return res;
    },
    async update(t, id, cambios) {
      db = cargar();
      const fila = tabla(t).find(r => r.id === id);
      if (!fila) throw new Error('El registro ya no existe.');
      const nueva = { ...clon(fila), ...cambios, updated_at: new Date().toISOString() };
      antes(t, 'UPDATE', nueva, fila);
      const vieja = clon(fila);
      Object.assign(fila, nueva);
      const dif = {};
      for (const k of Object.keys(cambios)) if (JSON.stringify(vieja[k]) !== JSON.stringify(fila[k])) dif[k] = [vieja[k], fila[k]];
      auditar(t, 'update', fila, dif);
      despues(t, 'UPDATE', fila, vieja);
      guardar();
      emitir({ tabla: t, tipo: 'UPDATE', fila: clon(fila), anterior: vieja });
      return clon(fila);
    },
    async updateWhere(t, f, cambios) {
      const res = [];
      for (const r of tabla(t).filter(x => cumple(x, f))) {
        if (r.id) res.push(await api.update(t, r.id, cambios));
        else { Object.assign(r, cambios); res.push(clon(r)); }
      }
      guardar();
      return res;
    },
    async remove(t, id) {
      db = cargar();
      const i = tabla(t).findIndex(r => r.id === id);
      if (i < 0) return;
      const vieja = tabla(t)[i];
      antes(t, 'DELETE', null, vieja);
      tabla(t).splice(i, 1);
      auditar(t, 'delete', vieja, vieja);
      guardar();
      emitir({ tabla: t, tipo: 'DELETE', fila: null, anterior: clon(vieja) });
    },
    async removeWhere(t, f) {
      db = cargar();
      const quitar = tabla(t).filter(x => cumple(x, f));
      for (const v of quitar) antes(t, 'DELETE', null, v);
      db[t] = tabla(t).filter(x => !cumple(x, f));
      guardar();
      for (const v of quitar) emitir({ tabla: t, tipo: 'DELETE', fila: null, anterior: clon(v) });
    },
    async rpc(nombre, args = {}) {
      if (nombre === 'eliminar_usuario') return eliminarUsuarioDemo(args.p_usuario);
      if (nombre === 'eliminar_proyecto_completo') {
        // Emula public.eliminar_proyecto_completo(): borra el proyecto con todo su historial
        db = cargar();
        const id = args.p_proyecto;
        const yo = perfil();
        if (!['superadmin', 'admin'].includes(yo?.rol)) throw new Error('Solo un administrador puede eliminar un proyecto con su historial.');
        const acts = new Set(tabla('actividades').filter(a => a.proyecto_id === id).map(a => a.id));
        const rests = new Set(tabla('restricciones').filter(r => r.proyecto_id === id || acts.has(r.actividad_id)).map(r => r.id));
        const cart = new Set(tabla('cartera').filter(c => c.proyecto_id === id).map(c => c.id));
        const r = { actividades: acts.size, restricciones: rests.size, cartera: cart.size };
        const ent = x => (x.entidad === 'actividad' && acts.has(x.entidad_id)) || (x.entidad === 'restriccion' && rests.has(x.entidad_id)) ||
          (x.entidad === 'cartera' && cart.has(x.entidad_id)) || (x.entidad === 'proyecto' && x.entidad_id === id);
        db.comentarios = tabla('comentarios').filter(x => !ent(x));
        db.enlaces = tabla('enlaces').filter(x => !ent(x));
        db.restricciones = tabla('restricciones').filter(x => !rests.has(x.id));
        db.actividades = tabla('actividades').filter(x => !acts.has(x.id));
        db.cartera = tabla('cartera').filter(x => !cart.has(x.id));
        db.plantilla_items = tabla('plantilla_items').filter(x => x.proyecto_id !== id);
        for (const t of ['hitos', 'proyecto_lideres', 'proyecto_favoritos']) db[t] = tabla(t).filter(x => x.proyecto_id !== id);
        for (const v of tabla('lista_valores')) if (v.extra?.proyecto_id === id) delete v.extra.proyecto_id;
        guardar();
        await api.remove('proyectos', id);
        for (const t of ['actividades', 'restricciones', 'cartera']) emitir({ tabla: t, tipo: 'DELETE', fila: null, anterior: { id: null } });
        return r;
      }
      if (nombre === 'exportar_respaldo') return { generado: new Date().toISOString(), version: 1, modo: 'demo', ...clon(db) };
      if (nombre === 'cerrar_semanas_vencidas') return 0;
      throw new Error(`Función no disponible en modo demo: ${nombre}`);
    },
    // Emula la Edge Function "admin-usuarios" (en demo la contraseña no se usa)
    async adminUsuarios(accion, d = {}) {
      db = cargar();
      const yo = perfil();
      if (!yo || !GESTORES.includes(yo.rol)) throw new Error('No tiene permiso para gestionar usuarios.');
      if (String(d.clave || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      if (accion === 'crear') {
        const email = String(d.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Correo no válido.');
        if (tabla('profiles').some(p => p.email === email)) throw new Error('Ya existe un usuario con ese correo.');
        if (GESTORES.includes(d.rol) && !esSuper(yo)) throw new Error('Solo el super administrador asigna los roles de super administrador, administrador y delegado.');
        const [p] = await api.insert('profiles', { area_id: yo.area_id, email, nombre: String(d.nombre || '').trim(), rol: d.rol || 'lider',
          codigo: d.codigo || null, gerencia_ids: d.gerencia_ids || [], horas_dia: d.horas_dia === '' || d.horas_dia == null ? null : Number(d.horas_dia),
          activo: true, es_admin_principal: false, debe_cambiar_clave: true, tour_visto: false });
        return { id: p.id };
      }
      if (accion === 'clave') {
        const obj = perfil(d.usuario_id);
        if (!obj) throw new Error('Usuario no encontrado.');
        if (obj.id !== yo.id && (obj.es_admin_principal || (GESTORES.includes(obj.rol) && !esSuper(yo)))) throw new Error('No puede restablecer la contraseña de ese usuario.');
        await api.update('profiles', obj.id, { debe_cambiar_clave: obj.id !== yo.id });
        return { ok: true };
      }
      throw new Error('Acción no válida.');
    },
    subscribe(tablas, cb) {
      const f = ev => { if (tablas.includes(ev.tabla)) cb(ev); };
      oyentes.add(f);
      return () => oyentes.delete(f);
    },

    // Herramientas propias del modo demo
    reiniciar() { localStorage.removeItem(CLAVE); db = cargar(); },
    usuariosDemo() { return clon(tabla('profiles')); },

    auth: {
      async usuario() {
        const id = usuarioId();
        const p = id && perfil(id);
        return p ? { id: p.id, email: p.email } : null;
      },
      async ingresar(idOEmail) {
        const p = tabla('profiles').find(x => x.id === idOEmail || x.email === idOEmail);
        if (!p) throw new Error('Usuario de demostración no encontrado.');
        localStorage.setItem(CLAVE_SESION, p.id);
        return { id: p.id, email: p.email };
      },
      async registrar() { throw new Error('En modo demostración elija uno de los usuarios de ejemplo.'); },
      async recuperar() { throw new Error('No disponible en modo demostración.'); },
      async cambiarClave() { const p = perfil(); if (p) await api.update('profiles', p.id, { debe_cambiar_clave: false }); },
      async salir() { localStorage.removeItem(CLAVE_SESION); },
      alCambiar() { /* sin eventos externos en demo */ },
    },
  };
  // Semana de referencia del seed (para reconstruir datos si cambia la semana)
  api.semanaDemo = () => db._semana || lunes();
  return api;
}
