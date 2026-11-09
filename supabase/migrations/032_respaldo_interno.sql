-- 032 — Foto diaria completa de la base (resguardo ante errores del aplicativo o de una migración).
-- No modifica ningún dato de negocio: solo LEE las tablas de public y guarda una copia en el esquema aparte «respaldo»,
-- que el aplicativo y la API no ven (sin permisos para anon / authenticated).
-- Se puede ejecutar más de una vez. Las fotos no se borran solas.
create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;

create table if not exists respaldo.fotos (
  id      bigserial primary key,
  tomada  timestamptz not null default now(),
  motivo  text not null,          -- 'diaria', 'antes de <cambio>', 'manual'
  conteos jsonb not null,         -- filas por tabla
  datos   jsonb not null          -- todas las filas de todas las tablas de public
);
revoke all on respaldo.fotos from public, anon, authenticated;
revoke all on sequence respaldo.fotos_id_seq from public, anon, authenticated;

create or replace function respaldo.tomar_foto(p_motivo text default 'manual')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t text; v jsonb := '{}'::jsonb; c jsonb := '{}'::jsonb; tmp jsonb; n bigint;
begin
  for t in select k.relname from pg_class k join pg_namespace s on s.oid = k.relnamespace
            where s.nspname = 'public' and k.relkind in ('r', 'p') order by 1 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) from public.%I x', t) into tmp, n;
    v := v || jsonb_build_object(t, tmp);
    c := c || jsonb_build_object(t, n);
  end loop;
  insert into respaldo.fotos (motivo, conteos, datos) values (coalesce(nullif(p_motivo, ''), 'manual'), c, v);
  return c;
end $$;
revoke all on function respaldo.tomar_foto(text) from public, anon, authenticated;

-- Solo la hora de la última foto (sin datos), para que el respaldo externo avise si la foto diaria dejó de tomarse
create or replace function public.ultima_foto_respaldo()
returns timestamptz language sql stable security definer set search_path = public, pg_temp as $$
  select max(tomada) from respaldo.fotos
$$;
revoke all on function public.ultima_foto_respaldo() from public, anon, authenticated;
grant execute on function public.ultima_foto_respaldo() to service_role;

-- Exportación completa (todas las tablas de public) para el respaldo externo diario. Solo con la clave secreta
-- (service_role): ni anon ni los usuarios del aplicativo pueden ejecutarla.
create or replace function public.respaldo_completo()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t text; v jsonb := jsonb_build_object('generado', now(), 'version', 2); tmp jsonb;
begin
  for t in select k.relname from pg_class k join pg_namespace s on s.oid = k.relnamespace
            where s.nspname = 'public' and k.relkind in ('r', 'p') order by 1 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into tmp;
    v := v || jsonb_build_object(t, tmp);
  end loop;
  return v;
end $$;
revoke all on function public.respaldo_completo() from public, anon, authenticated;
grant execute on function public.respaldo_completo() to service_role;

-- Programación diaria (23:37 hora de Lima) con pg_cron, si el servidor lo ofrece
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'respaldo-diario';
    perform cron.schedule('respaldo-diario', '37 4 * * *', $c$select respaldo.tomar_foto('diaria')$c$);
  else
    raise notice '032: pg_cron no disponible; la foto diaria no quedó programada';
  end if;
end $$;
