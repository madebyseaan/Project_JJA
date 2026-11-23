-- Delete an unpaid job. Paid and exported orders cannot be deleted; their
-- money is already recorded and must stay in reports.
create or replace function public.delete_sales_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.sales_orders;
  v_before jsonb;
begin
  perform private.require_staff();

  select * into v_order from public.sales_orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'OPEN' then
    raise exception 'ORDER_NOT_DELETABLE';
  end if;

  if exists (select 1 from public.sales_payments where order_id = p_order_id) then
    raise exception 'ORDER_NOT_DELETABLE';
  end if;

  v_before := jsonb_build_object(
    'order', to_jsonb(v_order),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(i) order by i.id)
        from public.sales_order_items i
        where i.order_id = p_order_id
      ),
      '[]'::jsonb
    ),
    'labor', coalesce(
      (
        select jsonb_agg(to_jsonb(l) order by l.id)
        from public.sales_labor l
        where l.order_id = p_order_id
      ),
      '[]'::jsonb
    ),
    'extras', coalesce(
      (
        select jsonb_agg(to_jsonb(e) order by e.id)
        from public.sales_extras e
        where e.order_id = p_order_id
      ),
      '[]'::jsonb
    )
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before")
  values (v_actor, 'sales_order.deleted', 'sales_order', p_order_id, v_before);

  delete from public.sales_orders where id = p_order_id;
end;
$$;

revoke all on function public.delete_sales_order(uuid) from public;
revoke all on function public.delete_sales_order(uuid) from anon;
grant execute on function public.delete_sales_order(uuid) to authenticated;
