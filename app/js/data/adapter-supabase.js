// Adaptador Supabase: consultas genéricas, autenticación y tiempo real.

function aplicarFiltros(q, f = {}) {
  for (const [k, v] of Object.entries(f.eq || {})) q = q.eq(k, v);
  for (const [k, v] of Object.entries(f.neq || {})) q = q.neq(k, v);
  for (const [k, v] of Object.entries(f.in || {})) q = q.in(k, v);
  for (const [k, v] of Object.entries(f.gte || {})) q = q.gte(k, v);
  for (const [k, v] of Object.entries(f.lte || {})) q = q.lte(k, v);
  for (const [k, v] of Object.entries(f.is || {})) q = q.is(k, v);
  return q;
}

export function crearAdaptadorSupabase(url, key) {
  const sb = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const ok = ({ data, error }) => { if (error) throw error; return data; };

  return {
    tipo: 'supabase',
    cliente: sb,

    async list(tabla, f = {}) {
      let q = sb.from(tabla).select(f.select || '*');
      q = aplicarFiltros(q, f);
      for (const [col, asc] of f.order || []) q = q.order(col, { ascending: asc !== false });
      if (f.limit) q = q.limit(f.limit);
      // Supabase limita a 1000 filas por consulta: se pagina
      if (!f.limit) {
        const filas = [];
        for (let desde = 0; ; desde += 1000) {
          const parte = ok(await q.range(desde, desde + 999));
          filas.push(...parte);
          if (parte.length < 1000) break;
        }
        return filas;
      }
      return ok(await q);
    },
    async insert(tabla, filas) {
      const arr = Array.isArray(filas) ? filas : [filas];
      return ok(await sb.from(tabla).insert(arr).select());
    },
    async upsert(tabla, filas, onConflict) {
      const arr = Array.isArray(filas) ? filas : [filas];
      return ok(await sb.from(tabla).upsert(arr, onConflict ? { onConflict } : undefined).select());
    },
    async update(tabla, id, cambios) {
      const r = ok(await sb.from(tabla).update(cambios).eq('id', id).select());
      if (!r.length) throw new Error('No tiene permiso para modificar este registro o ya no existe.');
      return r[0];
    },
    async updateWhere(tabla, f, cambios) {
      return ok(await aplicarFiltros(sb.from(tabla).update(cambios), f).select());
    },
    async remove(tabla, id) {
      const r = ok(await sb.from(tabla).delete().eq('id', id).select());
      if (!r.length) throw new Error('No tiene permiso para eliminar este registro o ya no existe.');
    },
    async removeWhere(tabla, f) {
      ok(await aplicarFiltros(sb.from(tabla).delete(), f));
    },
    async rpc(nombre, args = {}) {
      return ok(await sb.rpc(nombre, args));
    },

    // Alta de usuarios y restablecimiento de contraseña: Edge Function "admin-usuarios" (servidor)
    async adminUsuarios(accion, datos = {}) {
      const { data, error } = await sb.functions.invoke('admin-usuarios', { body: { accion, ...datos } });
      if (error) {
        const status = error.context?.status;
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* sin cuerpo JSON */ }
        if (status === 404 || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
          msg = 'La función "admin-usuarios" no está instalada en Supabase. Vea el README: "Alta de usuarios por el administrador".';
        }
        throw new Error(msg);
      }
      return data;
    },

    subscribe(tablas, cb) {
      const canal = sb.channel('lpsgt-' + Math.random().toString(36).slice(2));
      for (const t of tablas) {
        canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => {
          cb({ tabla: t, tipo: p.eventType, fila: p.new && Object.keys(p.new).length ? p.new : null, anterior: p.old });
        });
      }
      canal.subscribe();
      return () => sb.removeChannel(canal);
    },

    auth: {
      async usuario() {
        const { data } = await sb.auth.getSession();
        return data.session?.user || null;
      },
      async ingresar(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
      },
      async registrar(email, password, nombre) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        return data;
      },
      async recuperar(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/clave' });
        if (error) throw error;
      },
      async cambiarClave(password) {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        await sb.from('profiles').update({ debe_cambiar_clave: false }).eq('id', data.user.id);
      },
      async salir() { await sb.auth.signOut(); },
      alCambiar(cb) { sb.auth.onAuthStateChange((evento, sesion) => cb(evento, sesion?.user || null)); },
    },
  };
}
