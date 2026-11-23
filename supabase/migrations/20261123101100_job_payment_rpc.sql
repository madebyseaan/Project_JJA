-- Save an order in either the job step (no payment) or the payment step.
-- Requires 20261123101000_job_payment_schema.sql.

drop function if exists public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb
);

create or replace function public.save_sales_order(
  p_order_id uuid,
  p_business_date date,
  p_customer_name text,
  p_bike_model text,
  p_main_user_id uuid,
  p_helper_user_id uuid,
  p_items jsonb,
  p_labor_total_centavos integer,
  p_helper_labor_centavos integer,
  p_extras jsonb,
  p_payments jsonb,
  p_changes jsonb,
  p_paid_on date
)
returns public.sales_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_customer text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_bike text := nullif(btrim(coalesce(p_bike_model, '')), '');
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_extras jsonb := coalesce(p_extras, '[]'::jsonb);
  v_payments jsonb := coalesce(p_payments, '[]'::jsonb);
  v_changes jsonb := coalesce(p_changes, '[]'::jsonb);
  v_order public.sales_orders;
  v_order_no text;
  v_before jsonb;
  v_order_id uuid;
  v_order_was_paid boolean := false;
  v_item record;
  v_extra record;
  v_payment record;
  v_change record;
  v_catalog public.catalog_items;
  v_name text;
  v_parts integer := 0;
  v_extra_total integer := 0;
  v_paid integer := 0;
  v_change_total integer := 0;
  v_main_labor integer;
  v_pay integer;
  v_cash_pay integer := 0;
  v_cash_change integer := 0;
  v_gcash_pay integer := 0;
  v_gcash_change integer := 0;
  v_method text;
  v_recipient record;
  v_net integer;
  v_ratio numeric;
  v_shop integer;
  v_labor integer;
  v_recipient_pay integer;
  v_recipient_change integer;
  v_status text;
  v_paid_on date;
  v_has_payment boolean;
  v_summary jsonb;
begin
  perform private.require_staff();

  if p_business_date is null or p_business_date > v_today then
    raise exception 'INVALID_DATE';
  end if;

  if p_business_date < date '2000-01-01' then
    raise exception 'INVALID_DATE';
  end if;

  if p_main_user_id is null or not exists (
    select 1 from public.profiles where id = p_main_user_id
  ) then
    raise exception 'INVALID_MAIN_USER';
  end if;

  if p_helper_user_id is not null then
    if p_helper_user_id = p_main_user_id then
      raise exception 'INVALID_HELPER';
    end if;

    if not exists (select 1 from public.profiles where id = p_helper_user_id) then
      raise exception 'INVALID_HELPER';
    end if;
  end if;

  if p_labor_total_centavos is null or p_labor_total_centavos < 0 then
    raise exception 'INVALID_LABOR';
  end if;

  if p_helper_labor_centavos is null or p_helper_labor_centavos < 0 then
    raise exception 'INVALID_LABOR';
  end if;

  if p_helper_user_id is null and p_helper_labor_centavos <> 0 then
    raise exception 'INVALID_LABOR_SPLIT';
  end if;

  if p_helper_labor_centavos > p_labor_total_centavos then
    raise exception 'INVALID_LABOR_SPLIT';
  end if;

  if jsonb_typeof(v_items) <> 'array'
    or jsonb_typeof(v_extras) <> 'array'
    or jsonb_typeof(v_payments) <> 'array'
    or jsonb_typeof(v_changes) <> 'array' then
    raise exception 'INVALID_ORDER_DATA';
  end if;

  if p_order_id is null then
    insert into public.sales_orders (
      order_no,
      business_date,
      customer_name,
      bike_model,
      main_user_id,
      helper_user_id,
      labor_total_centavos,
      status,
      created_by,
      reviewed_by,
      reviewed_at
    )
    values (
      private.next_sales_order_no(p_business_date),
      p_business_date,
      v_customer,
      v_bike,
      p_main_user_id,
      p_helper_user_id,
      p_labor_total_centavos,
      'OPEN',
      v_actor,
      v_actor,
      now()
    )
    returning * into v_order;
    v_order_id := v_order.id;
  else
    select * into v_order from public.sales_orders where id = p_order_id for update;

    if not found then
      raise exception 'ORDER_NOT_FOUND';
    end if;

    if v_order.status = 'EXPORTED' then
      raise exception 'ORDER_LOCKED';
    end if;

    v_order_was_paid := v_order.status = 'PAID';
    v_before := to_jsonb(v_order);
    v_order_id := p_order_id;
    v_order_no := case
      when v_order.business_date = p_business_date then v_order.order_no
      else private.next_sales_order_no(p_business_date)
    end;

    delete from public.sales_gcash_allocations where order_id = p_order_id;
    delete from public.sales_changes where order_id = p_order_id;
    delete from public.sales_payments where order_id = p_order_id;
    delete from public.sales_extras where order_id = p_order_id;
    delete from public.sales_labor where order_id = p_order_id;
    delete from public.sales_order_items where order_id = p_order_id;

    update public.sales_orders
    set
      order_no = v_order_no,
      business_date = p_business_date,
      customer_name = v_customer,
      bike_model = v_bike,
      main_user_id = p_main_user_id,
      helper_user_id = p_helper_user_id,
      labor_total_centavos = p_labor_total_centavos,
      reviewed_by = v_actor,
      reviewed_at = now(),
      updated_at = now()
    where id = p_order_id
    returning * into v_order;
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(v_items)
      as x(catalog_item_id uuid, item_name text, qty integer, unit_price_centavos integer, is_custom boolean)
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'INVALID_QTY';
    end if;

    if v_item.unit_price_centavos is null or v_item.unit_price_centavos < 0 then
      raise exception 'INVALID_PRICE';
    end if;

    if coalesce(v_item.is_custom, false) then
      if v_item.catalog_item_id is not null then
        raise exception 'INVALID_ITEM';
      end if;

      v_name := btrim(coalesce(v_item.item_name, ''));

      if char_length(v_name) not between 1 and 120 then
        raise exception 'INVALID_ITEM_NAME';
      end if;

      insert into public.sales_order_items (
        order_id, catalog_item_id, item_name_at_time, qty,
        unit_price_at_time_centavos, is_custom
      )
      values (v_order_id, null, v_name, v_item.qty, v_item.unit_price_centavos, true);
    else
      if v_item.catalog_item_id is null then
        raise exception 'INVALID_ITEM';
      end if;

      select * into v_catalog
      from public.catalog_items
      where id = v_item.catalog_item_id and is_active;

      if not found then
        raise exception 'ITEM_NOT_FOUND';
      end if;

      insert into public.sales_order_items (
        order_id, catalog_item_id, item_name_at_time, qty,
        unit_price_at_time_centavos, is_custom
      )
      values (
        v_order_id, v_catalog.id, v_catalog.name, v_item.qty,
        v_item.unit_price_centavos, false
      );
    end if;

    v_parts := v_parts + v_item.qty * v_item.unit_price_centavos;
  end loop;

  v_main_labor := p_labor_total_centavos - p_helper_labor_centavos;

  insert into public.sales_labor (order_id, user_id, amount_centavos, is_main)
  values (v_order_id, p_main_user_id, v_main_labor, true);

  if p_helper_user_id is not null then
    insert into public.sales_labor (order_id, user_id, amount_centavos, is_main)
    values (v_order_id, p_helper_user_id, p_helper_labor_centavos, false);
  end if;

  for v_extra in
    select *
    from jsonb_to_recordset(v_extras)
      as x(user_id uuid, amount_centavos integer, note text)
  loop
    if v_extra.user_id is null
      or (v_extra.user_id <> p_main_user_id and v_extra.user_id is distinct from p_helper_user_id) then
      raise exception 'INVALID_EXTRA_USER';
    end if;

    if v_extra.amount_centavos is null or v_extra.amount_centavos <= 0 then
      raise exception 'INVALID_EXTRA';
    end if;

    if v_extra.note is not null and char_length(btrim(v_extra.note)) > 120 then
      raise exception 'INVALID_NOTE';
    end if;

    insert into public.sales_extras (order_id, user_id, amount_centavos, note, created_by)
    values (v_order_id, v_extra.user_id, v_extra.amount_centavos,
      nullif(btrim(coalesce(v_extra.note, '')), ''), v_actor);

    v_extra_total := v_extra_total + v_extra.amount_centavos;
  end loop;

  for v_payment in
    select *
    from jsonb_to_recordset(v_payments)
      as x(method text, amount_centavos integer, gcash_recipient_id uuid)
  loop
    v_method := upper(btrim(coalesce(v_payment.method, '')));

    if v_method not in ('CASH', 'GCASH') then
      raise exception 'INVALID_METHOD';
    end if;

    if v_payment.amount_centavos is null or v_payment.amount_centavos <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    if v_method = 'GCASH' then
      if v_payment.gcash_recipient_id is null
        or not exists (select 1 from public.profiles where id = v_payment.gcash_recipient_id) then
        raise exception 'INVALID_GCASH_RECIPIENT';
      end if;
      v_gcash_pay := v_gcash_pay + v_payment.amount_centavos;
    else
      if v_payment.gcash_recipient_id is not null then
        raise exception 'INVALID_CASH_RECIPIENT';
      end if;
      v_cash_pay := v_cash_pay + v_payment.amount_centavos;
    end if;

    insert into public.sales_payments (
      order_id, method, amount_centavos, gcash_recipient_id, received_by
    )
    values (
      v_order_id,
      v_method,
      v_payment.amount_centavos,
      v_payment.gcash_recipient_id,
      v_actor
    );

    v_paid := v_paid + v_payment.amount_centavos;
  end loop;

  for v_change in
    select *
    from jsonb_to_recordset(v_changes)
      as x(method text, amount_centavos integer, gcash_recipient_id uuid)
  loop
    v_method := upper(btrim(coalesce(v_change.method, '')));

    if v_method not in ('CASH', 'GCASH') then
      raise exception 'INVALID_METHOD';
    end if;

    if v_change.amount_centavos is null or v_change.amount_centavos <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    if v_method = 'GCASH' then
      if v_change.gcash_recipient_id is null
        or not exists (select 1 from public.profiles where id = v_change.gcash_recipient_id) then
        raise exception 'INVALID_GCASH_RECIPIENT';
      end if;
      v_gcash_change := v_gcash_change + v_change.amount_centavos;
    else
      if v_change.gcash_recipient_id is not null then
        raise exception 'INVALID_CASH_RECIPIENT';
      end if;
      v_cash_change := v_cash_change + v_change.amount_centavos;
    end if;

    insert into public.sales_changes (
      order_id, method, amount_centavos, gcash_recipient_id, created_by
    )
    values (
      v_order_id,
      v_method,
      v_change.amount_centavos,
      v_change.gcash_recipient_id,
      v_actor
    );

    v_change_total := v_change_total + v_change.amount_centavos;
  end loop;

  if v_cash_change > v_cash_pay then
    raise exception 'CHANGE_TOO_LARGE';
  end if;

  if v_gcash_change > v_gcash_pay then
    raise exception 'CHANGE_TOO_LARGE';
  end if;

  -- GCash change must come back from an account that received a GCash payment,
  -- and cannot exceed that recipient's own payment.
  for v_recipient in
    select distinct gcash_recipient_id as recipient_id
    from public.sales_changes
    where order_id = v_order_id and method = 'GCASH'
  loop
    select coalesce(sum(amount_centavos), 0)::integer
    into v_recipient_pay
    from public.sales_payments
    where order_id = v_order_id
      and method = 'GCASH'
      and gcash_recipient_id = v_recipient.recipient_id;

    select coalesce(sum(amount_centavos), 0)::integer
    into v_recipient_change
    from public.sales_changes
    where order_id = v_order_id
      and method = 'GCASH'
      and gcash_recipient_id = v_recipient.recipient_id;

    if v_recipient_pay = 0 or v_recipient_change > v_recipient_pay then
      raise exception 'CHANGE_TOO_LARGE';
    end if;
  end loop;

  if v_parts = 0 and p_labor_total_centavos = 0 and v_extra_total = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  v_has_payment := v_paid > 0 or v_change_total > 0;

  if v_has_payment then
    if v_paid = 0 then
      raise exception 'PAYMENT_REQUIRED';
    end if;

    if v_paid <> v_parts + p_labor_total_centavos + v_extra_total + v_change_total then
      raise exception 'PAYMENT_MISMATCH'
        using detail = jsonb_build_object(
          'parts', v_parts,
          'labor', p_labor_total_centavos,
          'extras', v_extra_total,
          'paid', v_paid,
          'change', v_change_total
        )::text;
    end if;

    v_paid_on := coalesce(p_paid_on, case
      when v_order_was_paid then v_order.paid_on
      else v_today
    end);

    if v_paid_on is null
      or v_paid_on > v_today
      or v_paid_on < p_business_date
      or v_paid_on < date '2000-01-01' then
      raise exception 'INVALID_DATE';
    end if;

    v_status := 'PAID';
  else
    if v_extra_total > 0 then
      raise exception 'PAYMENT_REQUIRED';
    end if;

    if v_order_was_paid then
      raise exception 'PAYMENT_REQUIRED';
    end if;

    v_status := 'OPEN';
    v_paid_on := null;
  end if;

  update public.sales_orders
  set
    parts_total_centavos = v_parts,
    status = v_status,
    paid_on = v_paid_on,
    updated_at = now()
  where id = v_order_id
  returning * into v_order;

  -- Allocate each GCash recipient's net cash between shop parts and labor/extras.
  if v_status = 'PAID' then
    for v_recipient in
      select gcash_recipient_id as recipient_id
      from public.sales_payments
      where order_id = v_order_id and method = 'GCASH'
      group by gcash_recipient_id
    loop
      select coalesce(sum(amount), 0)::integer
      into v_net
      from (
        select amount_centavos as amount
        from public.sales_payments
        where order_id = v_order_id
          and method = 'GCASH'
          and gcash_recipient_id = v_recipient.recipient_id
        union all
        select -amount_centavos as amount
        from public.sales_changes
        where order_id = v_order_id
          and method = 'GCASH'
          and gcash_recipient_id = v_recipient.recipient_id
      ) x;

      if v_net > 0 then
        v_ratio := v_parts::numeric / (v_parts + p_labor_total_centavos + v_extra_total);
        v_shop := round(v_net * v_ratio);
        v_labor := v_net - v_shop;

        insert into public.sales_gcash_allocations (
          order_id, recipient_id, net_gcash_centavos,
          shop_share_centavos, labor_share_centavos
        )
        values (v_order_id, v_recipient.recipient_id, v_net, v_shop, v_labor);
      end if;
    end loop;
  end if;

  v_summary := jsonb_build_object(
    'order_no', v_order.order_no,
    'status', v_status,
    'paid_on', v_paid_on,
    'parts', v_parts,
    'labor', p_labor_total_centavos,
    'extras', v_extra_total,
    'paid', v_paid,
    'change', v_change_total
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'sales_order.saved',
    'sales_order',
    v_order_id,
    v_before,
    v_summary
  );

  return v_order;
end;
$$;

revoke all on function public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb, date
) from public;
revoke all on function public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb, date
) from anon;
grant execute on function public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb, date
) to authenticated;
