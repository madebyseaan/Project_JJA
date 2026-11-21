-- Step 08: owner dashboard, day close, shop settings, and low stock.
-- Expected amounts are computed from signed payments on the Manila business date.

create table public.day_closes (
  id uuid primary key default gen_random_uuid(),
  business_date date unique not null,
  expected_cash_centavos integer not null,
  counted_cash_centavos integer not null check (counted_cash_centavos >= 0),
  variance_centavos integer generated always as (counted_cash_centavos - expected_cash_centavos) stored,
  expected_gcash_centavos integer not null default 0,
  expected_maya_centavos integer not null default 0,
  expected_other_centavos integer not null default 0,
  notes text check (notes is null or char_length(notes) <= 500),
  closed_by uuid not null references public.profiles (id),
  closed_at timestamptz not null default now()
);

comment on table public.day_closes is 'Owner snapshot of expected and counted cash per Manila business date.';

alter table public.day_closes enable row level security;

revoke all on public.day_closes from anon, authenticated;
grant select on public.day_closes to authenticated;

create policy "owner reads day closes"
on public.day_closes for select to authenticated
using (private.is_owner());

create view public.v_low_stock
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.sku,
  p.category,
  p.stock_on_hand,
  p.reserved_qty,
  p.available_qty,
  p.low_stock_threshold
from public.parts p
where p.is_active
  and p.available_qty <= p.low_stock_threshold;

comment on view public.v_low_stock is 'Active parts at or below their low-stock threshold.';

grant select on public.v_low_stock to authenticated;

create or replace function public.update_shop_settings(
  p_shop_name text,
  p_address text,
  p_contact text,
  p_receipt_footer text,
  p_low_stock_default integer
)
returns public.shop_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before public.shop_settings;
  v_after public.shop_settings;
  v_name text := btrim(coalesce(p_shop_name, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_footer text := btrim(coalesce(p_receipt_footer, ''));
begin
  perform private.require_owner();

  if char_length(v_name) not between 1 and 120 then
    raise exception 'INVALID_NAME';
  end if;

  if char_length(v_address) > 300 then
    raise exception 'INVALID_ADDRESS';
  end if;

  if char_length(v_contact) > 120 then
    raise exception 'INVALID_CONTACT';
  end if;

  if char_length(v_footer) > 300 then
    raise exception 'INVALID_FOOTER';
  end if;

  if p_low_stock_default is null or p_low_stock_default < 0 then
    raise exception 'INVALID_THRESHOLD';
  end if;

  select * into v_before from public.shop_settings where id = 1 for update;

  update public.shop_settings
  set
    shop_name = v_name,
    address = v_address,
    contact = v_contact,
    receipt_footer = v_footer,
    low_stock_default = p_low_stock_default,
    updated_by = v_actor
  where id = 1
  returning * into v_after;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (v_actor, 'settings.updated', 'shop_settings', null, to_jsonb(v_before), to_jsonb(v_after));

  return v_after;
end;
$$;

create or replace function public.close_day(
  p_business_date date,
  p_counted_cash integer,
  p_notes text
)
returns public.day_closes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cash integer;
  v_gcash integer;
  v_maya integer;
  v_other integer;
  v_existing public.day_closes;
  v_close public.day_closes;
begin
  perform private.require_owner();

  if p_business_date is null then
    raise exception 'INVALID_DATE';
  end if;

  if p_business_date > v_today then
    raise exception 'INVALID_DATE';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  select
    coalesce(sum(case when method = 'CASH' then amount_centavos end), 0)::integer,
    coalesce(sum(case when method = 'GCASH' then amount_centavos end), 0)::integer,
    coalesce(sum(case when method = 'MAYA' then amount_centavos end), 0)::integer,
    coalesce(sum(case when method = 'OTHER' then amount_centavos end), 0)::integer
  into v_cash, v_gcash, v_maya, v_other
  from public.ticket_payments
  where (received_at at time zone 'Asia/Manila')::date = p_business_date;

  select * into v_existing from public.day_closes where business_date = p_business_date;

  insert into public.day_closes (
    business_date,
    expected_cash_centavos,
    counted_cash_centavos,
    expected_gcash_centavos,
    expected_maya_centavos,
    expected_other_centavos,
    notes,
    closed_by
  )
  values (
    p_business_date,
    v_cash,
    p_counted_cash,
    v_gcash,
    v_maya,
    v_other,
    v_notes,
    v_actor
  )
  on conflict (business_date) do update
  set
    expected_cash_centavos = excluded.expected_cash_centavos,
    counted_cash_centavos = excluded.counted_cash_centavos,
    expected_gcash_centavos = excluded.expected_gcash_centavos,
    expected_maya_centavos = excluded.expected_maya_centavos,
    expected_other_centavos = excluded.expected_other_centavos,
    notes = excluded.notes,
    closed_by = excluded.closed_by,
    closed_at = now()
  returning * into v_close;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    case when v_existing.id is null then 'day.closed' else 'day.corrected' end,
    'day_close',
    v_close.id,
    case when v_existing.id is null then null else to_jsonb(v_existing) end,
    to_jsonb(v_close)
  );

  return v_close;
end;
$$;

create or replace function public.get_daily_summary(p_business_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_date date := coalesce(p_business_date, v_today);
  v_sales record;
  v_payments record;
  v_voids jsonb;
  v_low_stock jsonb;
  v_day_close jsonb;
begin
  perform private.require_owner();

  select
    count(*)::integer as receipt_count,
    coalesce(sum((r.snapshot #>> '{totals,parts_centavos}')::integer), 0)::integer as parts_centavos,
    coalesce(sum((r.snapshot #>> '{totals,labor_centavos}')::integer), 0)::integer as labor_centavos,
    coalesce(sum(r.total_centavos), 0)::integer as total_centavos
  into v_sales
  from public.receipts r
  where r.status = 'ISSUED'
    and (r.issued_at at time zone 'Asia/Manila')::date = v_date;

  select
    coalesce(sum(case when method = 'CASH' then amount_centavos end), 0)::integer as cash_centavos,
    coalesce(sum(case when method = 'GCASH' then amount_centavos end), 0)::integer as gcash_centavos,
    coalesce(sum(case when method = 'MAYA' then amount_centavos end), 0)::integer as maya_centavos,
    coalesce(sum(case when method = 'OTHER' then amount_centavos end), 0)::integer as other_centavos,
    coalesce(sum(amount_centavos), 0)::integer as total_centavos
  into v_payments
  from public.ticket_payments
  where (received_at at time zone 'Asia/Manila')::date = v_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'receipt_no', r.receipt_no,
        'total_centavos', r.total_centavos,
        'voided_at', r.voided_at,
        'void_reason', r.void_reason
      )
      order by r.voided_at desc
    ),
    '[]'::jsonb
  )
  into v_voids
  from public.receipts r
  where r.status = 'VOID'
    and (r.voided_at at time zone 'Asia/Manila')::date = v_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'sku', p.sku,
        'available_qty', p.available_qty,
        'low_stock_threshold', p.low_stock_threshold
      )
      order by p.available_qty, p.name
    ),
    '[]'::jsonb
  )
  into v_low_stock
  from (
    select id, name, sku, available_qty, low_stock_threshold
    from public.v_low_stock
    order by available_qty, name
    limit 50
  ) p;

  select to_jsonb(d) into v_day_close from public.day_closes d where d.business_date = v_date;

  return jsonb_build_object(
    'business_date', v_date,
    'sales', jsonb_build_object(
      'receipt_count', v_sales.receipt_count,
      'parts_centavos', v_sales.parts_centavos,
      'labor_centavos', v_sales.labor_centavos,
      'total_centavos', v_sales.total_centavos
    ),
    'payments', jsonb_build_object(
      'cash_centavos', v_payments.cash_centavos,
      'gcash_centavos', v_payments.gcash_centavos,
      'maya_centavos', v_payments.maya_centavos,
      'other_centavos', v_payments.other_centavos,
      'total_centavos', v_payments.total_centavos
    ),
    'expected_cash_centavos', v_payments.cash_centavos,
    'voids', v_voids,
    'low_stock', v_low_stock,
    'day_close', v_day_close
  );
end;
$$;

revoke all on function public.update_shop_settings(text, text, text, text, integer) from public;
revoke all on function public.close_day(date, integer, text) from public;
revoke all on function public.get_daily_summary(date) from public;

revoke all on function public.update_shop_settings(text, text, text, text, integer) from anon;
revoke all on function public.close_day(date, integer, text) from anon;
revoke all on function public.get_daily_summary(date) from anon;

grant execute on function public.update_shop_settings(text, text, text, text, integer) to authenticated;
grant execute on function public.close_day(date, integer, text) to authenticated;
grant execute on function public.get_daily_summary(date) to authenticated;
