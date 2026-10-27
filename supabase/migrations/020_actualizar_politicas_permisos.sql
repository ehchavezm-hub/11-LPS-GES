-- LPS-GES · 020_actualizar_politicas_permisos.sql
-- Actualiza funciones y políticas RLS que usaban nombres de acción anteriores
-- (gestionar_usuarios, crear_proyecto, etc.) a los nuevos nombres del PPT v5.

-- ============================================================
-- 1. Función tg_proteger_perfil: gestionar_usuarios → mi_rol() = 'admin'
-- ============================================================
create or replace function public.tg_proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo public.profiles;
begin
  if new.rol = 'delegado' and old.rol <> 'delegado' then
    insert into public.delegado_historial (area_id, usuario_id, otorgado_por) values (new.area_id, new.id, auth.uid());
  elsif old.rol = 'delegado' and new.rol <> 'delegado' then
    update public.delegado_historial set hasta = now() where usuario_id = new.id and hasta is null;
  end if;

  if auth.uid() is null then return new; end if;
  select * into v_yo from public.profiles where id = auth.uid();

  if new.es_admin_principal is distinct from old.es_admin_principal then
    raise exception 'El administrador principal solo se cambia desde la base de datos.';
  end if;

  if (new.rol, new.activo, new.area_id, new.gerencia_ids)
     is distinct from (old.rol, old.activo, old.area_id, old.gerencia_ids) then
    if public.mi_rol() <> 'admin' then
      raise exception 'No tiene permiso para cambiar roles, gerencias o el estado de usuarios.';
    end if;
    if old.es_admin_principal and not v_yo.es_admin_principal then
      raise exception 'Solo el administrador principal puede modificar su propio rol o estado.';
    end if;
    if (old.rol in ('admin','delegado') or new.rol in ('admin','delegado'))
       and new.rol is distinct from old.rol and not v_yo.es_admin_principal then
      raise exception 'Solo el administrador principal asigna o retira los roles de administrador y delegado.';
    end if;
  end if;

  return new;
end $$;

-- ============================================================
-- 2. Función tg_validar_cierre: reabrir_semana → esGestor (admin o delegado)
-- ============================================================
create or replace function public.tg_validar_cierre() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sin_estado int;
  v_sin_cnc int;
begin
  if tg_op = 'UPDATE' and new.cerrada = false and old.cerrada then
    if auth.uid() is not null and public.mi_rol() not in ('admin','delegado') then
      raise exception 'Solo el administrador o el delegado pueden reabrir una semana.';
    end if;
    new.reabierto_at := now();
    new.reabierto_por := auth.uid();
    return new;
  end if;
  if new.cerrada and not new.automatico then
    select count(*) filter (where estado = 'programado'),
           count(*) filter (where estado = 'no_completado' and cnc_id is null)
      into v_sin_estado, v_sin_cnc
      from public.actividades
     where responsable_id = new.responsable_id and semana = new.semana and comprometida;
    if v_sin_estado > 0 then
      raise exception 'Faltan % compromisos por registrar estado antes de cerrar.', v_sin_estado;
    end if;
    if v_sin_cnc > 0 then
      raise exception 'Faltan % compromisos no cumplidos sin causa de no cumplimiento.', v_sin_cnc;
    end if;
  end if;
  return new;
end $$;

-- ============================================================
-- 3. Políticas RLS — drop y recrear con nuevos nombres
-- ============================================================

-- profiles
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated
  using (id = auth.uid() or (area_id = public.mi_area() and public.mi_rol() = 'admin'))
  with check (id = auth.uid() or (area_id = public.mi_area() and public.mi_rol() = 'admin'));

-- listas
drop policy if exists listas_ins on public.listas;
drop policy if exists listas_upd on public.listas;
drop policy if exists listas_del on public.listas;
create policy listas_ins on public.listas for insert to authenticated
  with check (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));
create policy listas_upd on public.listas for update to authenticated
  using (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));
create policy listas_del on public.listas for delete to authenticated
  using (area_id = public.mi_area() and not sistema and public.mi_rol() in ('admin','delegado'));

-- lista_valores
drop policy if exists valores_ins on public.lista_valores;
drop policy if exists valores_upd on public.lista_valores;
drop policy if exists valores_del on public.lista_valores;
create policy valores_ins on public.lista_valores for insert to authenticated
  with check (exists (select 1 from public.listas l where l.id = lista_id and l.area_id = public.mi_area())
              and public.mi_rol() in ('admin','delegado'));
create policy valores_upd on public.lista_valores for update to authenticated
  using (exists (select 1 from public.listas l where l.id = lista_id and l.area_id = public.mi_area())
         and public.mi_rol() in ('admin','delegado'));
create policy valores_del on public.lista_valores for delete to authenticated
  using (exists (select 1 from public.listas l where l.id = lista_id and l.area_id = public.mi_area())
         and public.mi_rol() in ('admin','delegado'));

-- parametros
drop policy if exists parametros_ins on public.parametros;
drop policy if exists parametros_upd on public.parametros;
create policy parametros_ins on public.parametros for insert to authenticated
  with check (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));
create policy parametros_upd on public.parametros for update to authenticated
  using (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));

-- proyectos: crear_proyecto → esGestor; proponer_proyecto → puede('crear_cartera'); aprobar_proyecto → esGestor
drop policy if exists proyectos_ins on public.proyectos;
drop policy if exists proyectos_upd on public.proyectos;
create policy proyectos_ins on public.proyectos for insert to authenticated
  with check (area_id = public.mi_area() and (
    public.mi_rol() in ('admin','delegado')
    or (public.puede('crear_cartera') and estado = 'propuesto' and propuesto_por = auth.uid())));
create policy proyectos_upd on public.proyectos for update to authenticated
  using (area_id = public.mi_area() and (
    public.mi_rol() in ('admin','delegado')
    or (estado = 'propuesto' and propuesto_por = auth.uid())))
  with check (area_id = public.mi_area() and (
    public.mi_rol() in ('admin','delegado')
    or (estado = 'propuesto' and propuesto_por = auth.uid())));

drop policy if exists proy_lideres_all on public.proyecto_lideres;
create policy proy_lideres_all on public.proyecto_lideres for all to authenticated
  using (public.mi_rol() in ('admin','delegado'))
  with check (public.mi_rol() in ('admin','delegado'));

-- cartera: registrar_solicitud → crear_solicitud; aceptar_solicitudes → ver_solicitud
drop policy if exists cartera_ins on public.cartera;
drop policy if exists cartera_upd on public.cartera;
create policy cartera_ins on public.cartera for insert to authenticated
  with check (area_id = public.mi_area() and (
    (public.es_staff() and origen = 'interna')
    or (public.puede('crear_solicitud') and origen = 'solicitud' and estado = 'nueva' and solicitante_id = auth.uid())));
create policy cartera_upd on public.cartera for update to authenticated
  using (area_id = public.mi_area() and (
    public.es_gestor() or responsable_id = auth.uid() or created_by = auth.uid()
    or (estado = 'nueva' and public.puede('ver_solicitud'))))
  with check (area_id = public.mi_area() and public.es_staff());

-- actividades: editar_actividades_otros → esGestor
drop policy if exists act_ins on public.actividades;
drop policy if exists act_upd on public.actividades;
drop policy if exists act_del on public.actividades;
create policy act_ins on public.actividades for insert to authenticated
  with check (area_id = public.mi_area() and public.es_staff()
              and (responsable_id = auth.uid() or public.mi_rol() in ('admin','delegado')));
create policy act_upd on public.actividades for update to authenticated
  using (area_id = public.mi_area() and (responsable_id = auth.uid() or public.mi_rol() in ('admin','delegado')))
  with check (area_id = public.mi_area() and (responsable_id = auth.uid() or public.mi_rol() in ('admin','delegado')));
create policy act_del on public.actividades for delete to authenticated
  using (area_id = public.mi_area() and (responsable_id = auth.uid() or public.mi_rol() in ('admin','delegado')));

-- cierres: cerrar_semana_otros → cerrar_semana; reabrir_semana → esGestor
drop policy if exists cierres_ins on public.cierres;
drop policy if exists cierres_upd on public.cierres;
create policy cierres_ins on public.cierres for insert to authenticated
  with check (area_id = public.mi_area() and (responsable_id = auth.uid() or public.puede('cerrar_semana')));
create policy cierres_upd on public.cierres for update to authenticated
  using (area_id = public.mi_area() and (public.mi_rol() in ('admin','delegado')
         or ((responsable_id = auth.uid() or public.puede('cerrar_semana')) and not cerrada)));

-- pac_historico: importar_historico → importar_datos
drop policy if exists pac_hist_all on public.pac_historico;
create policy pac_hist_all on public.pac_historico for all to authenticated
  using (area_id = public.mi_area() and public.puede('importar_datos'))
  with check (area_id = public.mi_area() and public.puede('importar_datos'));

-- plantillas: gestionar_plantillas_servicio y editar_actividades_otros → esGestor
drop policy if exists plant_all on public.plantillas;
drop policy if exists plant_items_all on public.plantilla_items;
create policy plant_all on public.plantillas for all to authenticated
  using (area_id = public.mi_area() and ((tipo = 'recurrente' and propietario_id = auth.uid())
         or public.mi_rol() in ('admin','delegado')))
  with check (area_id = public.mi_area() and ((tipo = 'recurrente' and propietario_id = auth.uid())
         or public.mi_rol() in ('admin','delegado')));
create policy plant_items_all on public.plantilla_items for all to authenticated
  using (exists (select 1 from public.plantillas p where p.id = plantilla_id and p.area_id = public.mi_area()
         and ((p.tipo = 'recurrente' and p.propietario_id = auth.uid())
              or public.mi_rol() in ('admin','delegado'))))
  with check (exists (select 1 from public.plantillas p where p.id = plantilla_id and p.area_id = public.mi_area()
         and ((p.tipo = 'recurrente' and p.propietario_id = auth.uid())
              or public.mi_rol() in ('admin','delegado'))));

-- reuniones y acuerdos: gestionar_reuniones → esGestor
drop policy if exists reun_all on public.reuniones;
drop policy if exists acu_ins on public.acuerdos;
drop policy if exists acu_upd on public.acuerdos;
drop policy if exists acu_del on public.acuerdos;
create policy reun_all on public.reuniones for all to authenticated
  using (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'))
  with check (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));
create policy acu_ins on public.acuerdos for insert to authenticated
  with check (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));
create policy acu_upd on public.acuerdos for update to authenticated
  using (area_id = public.mi_area() and (public.mi_rol() in ('admin','delegado') or responsable_id = auth.uid()));
create policy acu_del on public.acuerdos for delete to authenticated
  using (area_id = public.mi_area() and public.mi_rol() in ('admin','delegado'));

-- comentarios: comentar → esStaff (todos los miembros activos)
drop policy if exists com_ins on public.comentarios;
create policy com_ins on public.comentarios for insert to authenticated
  with check (area_id = public.mi_area() and autor_id = auth.uid() and public.es_staff());
