-- Pruebas de reglas de negocio y seguridad (se ejecutan con run.sh)
\set ON_ERROR_STOP 1

create or replace function public.debe_fallar(p_sql text, p_msg text default '') returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_msg <> '' and position(p_msg in sqlerrm) = 0 then
      raise exception 'Falló con un mensaje inesperado: % (esperado: %)', sqlerrm, p_msg;
    end if;
    return;
  end;
  raise exception 'Se esperaba un error y no ocurrió: %', p_sql;
end $$;
grant execute on function public.debe_fallar(text, text) to authenticated;

create or replace function public.como(p_email text) returns void language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
end $$;
grant execute on function public.como(text) to authenticated;

-- Usuarios: el primero es administrador principal
insert into auth.users (email, raw_user_meta_data) values
  ('admin@x.pe', '{"nombre":"Admin"}'), ('lider1@x.pe', '{"nombre":"Lider Uno"}'),
  ('lider2@x.pe', '{"nombre":"Lider Dos"}'), ('consulta@x.pe', '{}'), ('delegado@x.pe', '{}');

do $$
begin
  assert (select rol from profiles p join auth.users u on u.id = p.id where u.email = 'admin@x.pe') = 'admin', 'primer usuario no es admin';
  assert (select es_admin_principal from profiles p join auth.users u on u.id = p.id where u.email = 'admin@x.pe'), 'no es principal';
  assert (select rol from profiles p join auth.users u on u.id = p.id where u.email = 'lider1@x.pe') = 'pendiente', 'segundo no pendiente';
  assert (select count(*) from notificaciones where tipo = 'usuario_nuevo') = 4, 'faltan avisos de usuario nuevo';
  assert (select count(*) from listas) >= 18, 'listas no sembradas';
  assert (select count(*) from permisos) = 60, 'matriz de permisos incompleta';
end $$;

-- Datos base (como superusuario)
update profiles set rol = 'lider' where email in ('lider1@x.pe', 'lider2@x.pe');
update profiles set rol = 'delegado' where email = 'delegado@x.pe';
update profiles set rol = 'consulta',
  gerencia_ids = array[(select lv.id from lista_valores lv join listas l on l.id = lv.lista_id where l.clave = 'gerencias' and lv.codigo = 'GI')]
  where email = 'consulta@x.pe';

insert into proyectos (area_id, codigo, nombre_corto, gerencia_id, estado)
select a.id, 'P-1', 'Proyecto GI', (select lv.id from lista_valores lv join listas l on l.id = lv.lista_id where l.clave='gerencias' and lv.codigo='GI'), 'activo' from areas a;
insert into proyectos (area_id, codigo, nombre_corto, gerencia_id, estado)
select a.id, 'P-2', 'Proyecto GOC', (select lv.id from lista_valores lv join listas l on l.id = lv.lista_id where l.clave='gerencias' and lv.codigo='GOC'), 'activo' from areas a;

-- ---------- Líder ----------
set role authenticated;
select como('lider1@x.pe');

insert into actividades (area_id, semana, responsable_id, proyecto_id, descripcion, comprometida, hh_lu)
values (mi_area(), date_trunc('week', current_date)::date, auth.uid(),
        (select id from proyectos where codigo = 'P-1'), 'Actividad propia', true, 2);

select debe_fallar($q$
  insert into actividades (area_id, semana, responsable_id, descripcion)
  values (mi_area(), date_trunc('week', current_date)::date,
          (select id from profiles where email = 'lider2@x.pe'), 'Para otro líder') $q$, 'row-level security');

select debe_fallar($q$ insert into actividades (area_id, semana, responsable_id, descripcion)
  values (mi_area(), current_date - extract(isodow from current_date)::int + 2, auth.uid(), 'No es lunes') $q$);

do $$ begin assert (select hh_total from actividades where descripcion = 'Actividad propia') = 2, 'hh_total'; end $$;

-- Cierre: no se puede con compromisos sin estado
select debe_fallar($q$ insert into cierres (area_id, responsable_id, semana)
  values (mi_area(), auth.uid(), date_trunc('week', current_date)::date) $q$, 'sin estado final');

update actividades set estado = 'no_completado' where descripcion = 'Actividad propia';
select debe_fallar($q$ insert into cierres (area_id, responsable_id, semana)
  values (mi_area(), auth.uid(), date_trunc('week', current_date)::date) $q$, 'sin causa');

update actividades set cnc_id = (select lv.id from lista_valores lv join listas l on l.id = lv.lista_id
  where l.clave = 'cnc' order by lv.orden limit 1) where descripcion = 'Actividad propia';
insert into cierres (area_id, responsable_id, semana) values (mi_area(), auth.uid(), date_trunc('week', current_date)::date);

select debe_fallar($q$ update actividades set descripcion = 'cambio' where descripcion = 'Actividad propia' $q$, 'está cerrada');
update cierres set cerrada = false;  -- el líder no reabre: RLS no le muestra la fila para actualizar
do $$ begin assert (select cerrada from cierres limit 1), 'el líder reabrió la semana'; end $$;

-- Proyectos: el líder propone, no crea activos
insert into proyectos (area_id, codigo, nombre_corto, estado, propuesto_por)
values (mi_area(), 'P-3', 'Propuesto por líder', 'propuesto', auth.uid());
select debe_fallar($q$ insert into proyectos (area_id, codigo, nombre_corto, estado)
  values (mi_area(), 'P-4', 'Activo directo', 'activo') $q$, 'row-level security');

-- Listas: el líder no edita
select debe_fallar($q$ insert into lista_valores (lista_id, valor)
  values ((select id from listas where clave = 'cnc'), 'Nueva causa') $q$, 'row-level security');

-- Comentario con mención
insert into comentarios (area_id, entidad, entidad_id, texto, menciones)
values (mi_area(), 'actividad', (select id from actividades limit 1), 'Revisar @Lider Dos',
        array[(select id from profiles where email = 'lider2@x.pe')]);

select debe_fallar($q$ select exportar_respaldo() $q$, 'Solo el administrador');

-- ---------- Delegado ----------
select como('delegado@x.pe');
select debe_fallar($q$ update profiles set rol = 'lider' where email = 'admin@x.pe' $q$, 'administrador principal');
select debe_fallar($q$ update profiles set rol = 'delegado' where email = 'lider2@x.pe' $q$, 'administrador principal');
update profiles set nombre = 'Líder Dos' where email = 'lider2@x.pe';
update cierres set cerrada = false;
do $$ begin assert not (select cerrada from cierres limit 1), 'el delegado no pudo reabrir'; end $$;
update proyectos set estado = 'activo', aprobado_por = auth.uid(), aprobado_at = now() where codigo = 'P-3';
delete from profiles where email = 'lider2@x.pe';  -- RLS: el delegado no elimina usuarios
do $$ begin assert (select count(*) from profiles where email = 'lider2@x.pe') = 1, 'el delegado eliminó un usuario'; end $$;

-- Valores protegidos
select debe_fallar($q$ delete from lista_valores where codigo = 'completado' $q$, 'protegido');
update lista_valores set valor = 'Hecho' where codigo = 'completado';

-- ---------- Consulta ----------
select como('consulta@x.pe');
do $$ begin
  assert (select count(*) from proyectos) = 1, 'consulta ve proyectos de otras gerencias';
  assert (select count(*) from actividades) = 1, 'consulta no ve actividades de su gerencia';
  assert (select count(*) from restricciones) = 0, 'consulta ve restricciones';
end $$;
insert into cartera (area_id, descripcion, origen, estado, solicitante_id)
values (mi_area(), 'Necesito metrados', 'solicitud', 'nueva', auth.uid());
select debe_fallar($q$ insert into cartera (area_id, descripcion) values (mi_area(), 'interna') $q$, 'row-level security');

-- ---------- Líder 2: notificaciones ----------
select como('lider2@x.pe');
do $$ begin
  assert (select count(*) from notificaciones where tipo = 'mencion') = 1, 'no llegó la mención';
  assert (select count(*) from actividades where descripcion = 'Actividad propia') = 1, 'líder no ve actividades del equipo';
end $$;
update actividades set descripcion = 'x' where descripcion = 'Actividad propia';
do $$ begin assert (select count(*) from actividades where descripcion = 'x') = 0, 'líder editó actividad ajena'; end $$;

-- ---------- Admin ----------
select como('admin@x.pe');
do $$ begin
  assert (select count(*) from notificaciones where tipo = 'proyecto_propuesto') = 1, 'sin aviso de proyecto propuesto';
  assert (select count(*) from notificaciones where tipo = 'solicitud_nueva') = 1, 'sin aviso de solicitud';
  assert jsonb_array_length(exportar_respaldo()->'actividades') = 1, 'respaldo incompleto';
  assert (select count(*) from auditoria where tabla = 'actividades') >= 3, 'auditoría vacía';
end $$;
update profiles set rol = 'delegado' where email = 'lider2@x.pe';
do $$ begin assert (select count(*) from delegado_historial where hasta is null) = 2, 'historial de delegado'; end $$;

-- ---------- Cierre automático ----------
reset role;
insert into actividades (area_id, semana, responsable_id, descripcion, comprometida)
select area_id, date_trunc('week', current_date)::date - 14, id, 'Semana vencida sin reportar', true
  from profiles where email = 'lider1@x.pe';
do $$ begin
  assert cerrar_semanas_vencidas() >= 1, 'no cerró semanas vencidas';
  assert (select estado from actividades where descripcion = 'Semana vencida sin reportar') = 'no_completado', 'estado no actualizado';
  assert (select lv.codigo from actividades a join lista_valores lv on lv.id = a.cnc_id
           where a.descripcion = 'Semana vencida sin reportar') = 'no_reportado', 'CNC no reportado';
end $$;

\echo 'Todas las pruebas pasaron'
