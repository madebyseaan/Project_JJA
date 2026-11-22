-- Full-list catalog sync: deactivate items that disappeared from the
-- QuickBooks Item List. Orders keep their snapshots, so historical sales are
-- unaffected.

create or replace function public.deactivate_missing_catalog_items(p_names text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_names text[];
  v_count integer := 0;
begin
  perform private.require_staff();

  if p_names is null or cardinality(p_names) = 0 then
    raise exception 'INVALID_NAMES';
  end if;

  select array_agg(distinct lower(btrim(name)))
  into v_names
  from unnest(p_names) as name
  where btrim(name) <> '';

  if v_names is null then
    raise exception 'INVALID_NAMES';
  end if;

  with updated as (
    update public.catalog_items c
    set is_active = false
    where c.is_active
      and not exists (
        select 1 from unnest(v_names) as name where lower(c.name) = name
      )
    returning 1
  )
  select count(*)::integer into v_count from updated;

  insert into public.audit_events (actor_id, action, entity_type, "after")
  values (
    v_actor,
    'catalog.deactivated',
    'catalog',
    jsonb_build_object('deactivated', v_count)
  );

  return jsonb_build_object('deactivated', v_count);
end;
$$;

revoke all on function public.deactivate_missing_catalog_items(text[]) from public;
revoke all on function public.deactivate_missing_catalog_items(text[]) from anon;
grant execute on function public.deactivate_missing_catalog_items(text[]) to authenticated;
