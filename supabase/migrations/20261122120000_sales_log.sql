-- Sales log core: catalog, orders, labor split, extras, payments, change,
-- GCash allocations, and digital receipts. No stock tracking.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  sku text check (sku is null or char_length(btrim(sku)) between 1 and 60),
  base_price_centavos integer not null default 0 check (base_price_centavos >= 0),
  item_type text not null default 'INVENTORY_PART'
    check (char_length(btrim(item_type)) between 1 and 40),
  income_account text not null default '' check (char_length(income_account) <= 120),
  cogs_account text not null default '' check (char_length(cogs_account) <= 120),
  asset_account text not null default '' check (char_length(asset_account) <= 120),
  preferred_vendor text not null default '' check (char_length(preferred_vendor) <= 120),
  is_active boolean not null default true,
  source text not null default 'quickbooks' check (source in ('quickbooks', 'manual')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalog_items_name_lower_idx on public.catalog_items (lower(name));
create unique index catalog_items_sku_idx on public.catalog_items (sku) where sku is not null;
create index catalog_items_active_idx on public.catalog_items (is_active) where is_active;
create index catalog_items_description_lower_idx on public.catalog_items (lower(description));

create trigger set_catalog_items_updated_at
before update on public.catalog_items
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

create table private.sales_order_counters (
  day date primary key,
  next_no integer not null check (next_no > 0)
);

create or replace function private.next_sales_order_no()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_no integer;
begin
  insert into private.sales_order_counters (day, next_no)
  values (v_day, 2)
  on conflict (day) do update
    set next_no = private.sales_order_counters.next_no + 1
  returning next_no - 1 into v_no;

  return 'SL-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function private.next_sales_order_no() from public;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  business_date date not null,
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  bike_model text check (bike_model is null or char_length(bike_model) <= 120),
  main_user_id uuid not null references public.profiles (id),
  helper_user_id uuid references public.profiles (id),
  parts_total_centavos integer not null default 0 check (parts_total_centavos >= 0),
  labor_total_centavos integer not null default 0 check (labor_total_centavos >= 0),
  total_centavos integer generated always as (parts_total_centavos + labor_total_centavos) stored,
  status text not null default 'OPEN' check (status in ('OPEN', 'EXPORTED')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  public_token text unique not null
    default encode(extensions.gen_random_bytes(16), 'hex')
    check (public_token ~ '^[0-9a-f]{32}$'),
  check (helper_user_id is null or helper_user_id <> main_user_id)
);

create index sales_orders_date_idx on public.sales_orders (business_date);
create index sales_orders_main_user_idx on public.sales_orders (main_user_id);
create index sales_orders_helper_user_idx on public.sales_orders (helper_user_id)
  where helper_user_id is not null;

create trigger set_sales_orders_updated_at
before update on public.sales_orders
for each row execute function private.set_updated_at();

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  catalog_item_id uuid references public.catalog_items (id),
  item_name_at_time text not null check (char_length(btrim(item_name_at_time)) between 1 and 120),
  qty integer not null check (qty > 0),
  unit_price_at_time_centavos integer not null check (unit_price_at_time_centavos >= 0),
  line_total_centavos integer generated always as (qty * unit_price_at_time_centavos) stored,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_custom and catalog_item_id is null)
    or (not is_custom and catalog_item_id is not null)
  ),
  unique (order_id, catalog_item_id)
);

create index sales_order_items_order_idx on public.sales_order_items (order_id);

create table public.sales_labor (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount_centavos integer not null check (amount_centavos >= 0),
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, user_id)
);

create index sales_labor_order_idx on public.sales_labor (order_id);
create index sales_labor_user_idx on public.sales_labor (user_id);

create table public.sales_extras (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount_centavos integer not null check (amount_centavos > 0),
  note text check (note is null or char_length(note) <= 120),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index sales_extras_order_idx on public.sales_extras (order_id);
create index sales_extras_user_idx on public.sales_extras (user_id);

create table public.sales_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  method text not null check (method in ('CASH', 'GCASH')),
  amount_centavos integer not null check (amount_centavos > 0),
  gcash_recipient_id uuid references public.profiles (id),
  received_by uuid not null references public.profiles (id),
  received_at timestamptz not null default now(),
  check (
    (method = 'CASH' and gcash_recipient_id is null)
    or (method = 'GCASH' and gcash_recipient_id is not null)
  )
);

create index sales_payments_order_idx on public.sales_payments (order_id);
create index sales_payments_method_idx on public.sales_payments (method);

create table public.sales_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  method text not null check (method in ('CASH', 'GCASH')),
  amount_centavos integer not null check (amount_centavos > 0),
  gcash_recipient_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (
    (method = 'CASH' and gcash_recipient_id is null)
    or (method = 'GCASH' and gcash_recipient_id is not null)
  )
);

create index sales_changes_order_idx on public.sales_changes (order_id);

create table public.sales_gcash_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id),
  net_gcash_centavos integer not null check (net_gcash_centavos >= 0),
  shop_share_centavos integer not null check (shop_share_centavos >= 0),
  labor_share_centavos integer not null check (labor_share_centavos >= 0),
  unique (order_id, recipient_id),
  check (shop_share_centavos + labor_share_centavos = net_gcash_centavos)
);

create index sales_gcash_allocations_recipient_idx
  on public.sales_gcash_allocations (recipient_id);

create table public.gcash_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  amount_centavos integer not null check (amount_centavos > 0),
  destination text not null check (destination in ('SHOP_BANK', 'USER')),
  counterparty_user_id uuid references public.profiles (id),
  reference text check (reference is null or char_length(reference) <= 120),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (
    (destination = 'SHOP_BANK' and counterparty_user_id is null)
    or (destination = 'USER' and counterparty_user_id is not null and counterparty_user_id <> user_id)
  )
);

create index gcash_transfers_user_idx on public.gcash_transfers (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.catalog_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_labor enable row level security;
alter table public.sales_extras enable row level security;
alter table public.sales_payments enable row level security;
alter table public.sales_changes enable row level security;
alter table public.sales_gcash_allocations enable row level security;
alter table public.gcash_transfers enable row level security;

revoke all on public.catalog_items from anon, authenticated;
revoke all on public.sales_orders from anon, authenticated;
revoke all on public.sales_order_items from anon, authenticated;
revoke all on public.sales_labor from anon, authenticated;
revoke all on public.sales_extras from anon, authenticated;
revoke all on public.sales_payments from anon, authenticated;
revoke all on public.sales_changes from anon, authenticated;
revoke all on public.sales_gcash_allocations from anon, authenticated;
revoke all on public.gcash_transfers from anon, authenticated;

grant select on public.catalog_items to authenticated;
grant select on public.sales_orders to authenticated;
grant select on public.sales_order_items to authenticated;
grant select on public.sales_labor to authenticated;
grant select on public.sales_extras to authenticated;
grant select on public.sales_payments to authenticated;
grant select on public.sales_changes to authenticated;
grant select on public.sales_gcash_allocations to authenticated;
grant select on public.gcash_transfers to authenticated;

create policy "staff read catalog"
on public.catalog_items for select to authenticated
using (private.is_staff());

create policy "staff read sales orders"
on public.sales_orders for select to authenticated
using (private.is_staff());

create policy "staff read sales order items"
on public.sales_order_items for select to authenticated
using (private.is_staff());

create policy "staff read sales labor"
on public.sales_labor for select to authenticated
using (private.is_staff());

create policy "staff read sales extras"
on public.sales_extras for select to authenticated
using (private.is_staff());

create policy "staff read sales payments"
on public.sales_payments for select to authenticated
using (private.is_staff());

create policy "staff read sales changes"
on public.sales_changes for select to authenticated
using (private.is_staff());

create policy "staff read gcash allocations"
on public.sales_gcash_allocations for select to authenticated
using (private.is_staff());

create policy "staff read gcash transfers"
on public.gcash_transfers for select to authenticated
using (private.is_staff());

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.v_sales_daily
with (security_invoker = true)
as
select
  o.business_date,
  count(*)::integer as order_count,
  coalesce(sum(o.parts_total_centavos), 0)::integer as parts_total_centavos,
  coalesce(sum(o.labor_total_centavos), 0)::integer as labor_total_centavos,
  coalesce(sum(o.total_centavos), 0)::integer as total_centavos,
  coalesce(sum(e.extras_total_centavos), 0)::integer as extras_total_centavos
from public.sales_orders o
left join (
  select order_id, sum(amount_centavos)::integer as extras_total_centavos
  from public.sales_extras
  group by order_id
) e on e.order_id = o.id
group by o.business_date;

create view public.v_sales_labor_daily
with (security_invoker = true)
as
select
  o.business_date,
  l.user_id,
  p.display_name,
  coalesce(sum(l.amount_centavos), 0)::integer as base_labor_centavos,
  coalesce(sum(x.extras_centavos), 0)::integer as extras_centavos,
  (coalesce(sum(l.amount_centavos), 0) + coalesce(sum(x.extras_centavos), 0))::integer
    as labor_payout_centavos
from public.sales_labor l
join public.sales_orders o on o.id = l.order_id
join public.profiles p on p.id = l.user_id
left join (
  select order_id, user_id, sum(amount_centavos)::integer as extras_centavos
  from public.sales_extras
  group by order_id, user_id
) x on x.order_id = l.order_id and x.user_id = l.user_id
group by o.business_date, l.user_id, p.display_name;

create view public.v_sales_payments_daily
with (security_invoker = true)
as
select
  business_date,
  method,
  sum(received_centavos)::integer as received_centavos,
  sum(change_centavos)::integer as change_centavos,
  (sum(received_centavos) - sum(change_centavos))::integer as net_centavos
from (
  select o.business_date, p.method, p.amount_centavos as received_centavos, 0 as change_centavos
  from public.sales_payments p
  join public.sales_orders o on o.id = p.order_id
  union all
  select o.business_date, c.method, 0 as received_centavos, c.amount_centavos as change_centavos
  from public.sales_changes c
  join public.sales_orders o on o.id = c.order_id
) x
group by business_date, method;

grant select on public.v_sales_daily to authenticated;
grant select on public.v_sales_labor_daily to authenticated;
grant select on public.v_sales_payments_daily to authenticated;

-- ---------------------------------------------------------------------------
-- Save order
-- ---------------------------------------------------------------------------

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
  p_changes jsonb
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
  v_before jsonb;
  v_order_id uuid;
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
  v_recipient record;
  v_net integer;
  v_ratio numeric;
  v_shop integer;
  v_labor integer;
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
      created_by,
      reviewed_by,
      reviewed_at
    )
    values (
      private.next_sales_order_no(),
      p_business_date,
      v_customer,
      v_bike,
      p_main_user_id,
      p_helper_user_id,
      p_labor_total_centavos,
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

    if v_order.status <> 'OPEN' then
      raise exception 'ORDER_LOCKED';
    end if;

    v_before := to_jsonb(v_order);
    v_order_id := p_order_id;

    delete from public.sales_gcash_allocations where order_id = p_order_id;
    delete from public.sales_changes where order_id = p_order_id;
    delete from public.sales_payments where order_id = p_order_id;
    delete from public.sales_extras where order_id = p_order_id;
    delete from public.sales_labor where order_id = p_order_id;
    delete from public.sales_order_items where order_id = p_order_id;

    update public.sales_orders
    set
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
    if upper(btrim(coalesce(v_payment.method, ''))) not in ('CASH', 'GCASH') then
      raise exception 'INVALID_METHOD';
    end if;

    if v_payment.amount_centavos is null or v_payment.amount_centavos <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    if upper(v_payment.method) = 'GCASH' then
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
      upper(v_payment.method),
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
    if upper(btrim(coalesce(v_change.method, ''))) not in ('CASH', 'GCASH') then
      raise exception 'INVALID_METHOD';
    end if;

    if v_change.amount_centavos is null or v_change.amount_centavos <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    if upper(v_change.method) = 'GCASH' then
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
      upper(v_change.method),
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

  if v_parts = 0 and p_labor_total_centavos = 0 and v_extra_total = 0 then
    raise exception 'EMPTY_ORDER';
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

  update public.sales_orders
  set parts_total_centavos = v_parts, updated_at = now()
  where id = v_order_id
  returning * into v_order;

  -- Allocate each GCash recipient's net cash between shop parts and labor/extras.
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

  v_summary := jsonb_build_object(
    'order_no', v_order.order_no,
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
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb
) from public;
revoke all on function public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb
) from anon;
grant execute on function public.save_sales_order(
  uuid, date, text, text, uuid, uuid, jsonb, integer, integer, jsonb, jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- GCash balances
-- ---------------------------------------------------------------------------

create or replace function public.get_gcash_balances()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with allocations as (
    select
      recipient_id,
      sum(shop_share_centavos)::integer as shop_share,
      sum(labor_share_centavos)::integer as labor_share
    from public.sales_gcash_allocations
    group by recipient_id
  ),
  transfers as (
    select
      user_id,
      sum(case when destination = 'SHOP_BANK' then amount_centavos else 0 end)::integer
        as shop_transfers,
      sum(case when destination = 'USER' then amount_centavos else 0 end)::integer
        as labor_transfers
    from public.gcash_transfers
    group by user_id
  ),
  earned as (
    select user_id, sum(amount_centavos)::integer as amount
    from public.sales_labor
    group by user_id
  ),
  extra_earned as (
    select user_id, sum(amount_centavos)::integer as amount
    from public.sales_extras
    group by user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', p.id,
        'display_name', p.display_name,
        'shop_share_centavos', coalesce(a.shop_share, 0),
        'shop_transfers_centavos', coalesce(t.shop_transfers, 0),
        'shop_held_centavos', coalesce(a.shop_share, 0) - coalesce(t.shop_transfers, 0),
        'labor_share_centavos', coalesce(a.labor_share, 0),
        'labor_transfers_centavos', coalesce(t.labor_transfers, 0),
        'labor_held_centavos', coalesce(a.labor_share, 0) - coalesce(t.labor_transfers, 0),
        'labor_earned_centavos', coalesce(e.amount, 0) + coalesce(x.amount, 0)
      )
      order by p.employee_id
    ),
    '[]'::jsonb
  )
  from public.profiles p
  left join allocations a on a.recipient_id = p.id
  left join transfers t on t.user_id = p.id
  left join earned e on e.user_id = p.id
  left join extra_earned x on x.user_id = p.id;
$$;

revoke all on function public.get_gcash_balances() from public;
revoke all on function public.get_gcash_balances() from anon;
grant execute on function public.get_gcash_balances() to authenticated;

-- ---------------------------------------------------------------------------
-- GCash transfers
-- ---------------------------------------------------------------------------

create or replace function public.record_gcash_transfer(
  p_user_id uuid,
  p_amount_centavos integer,
  p_destination text,
  p_counterparty_user_id uuid,
  p_reference text,
  p_note text
)
returns public.gcash_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_destination text := upper(btrim(coalesce(p_destination, '')));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_transfer public.gcash_transfers;
begin
  perform private.require_staff();

  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'INVALID_USER';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if v_destination not in ('SHOP_BANK', 'USER') then
    raise exception 'INVALID_DESTINATION';
  end if;

  if v_destination = 'USER' then
    if p_counterparty_user_id is null or p_counterparty_user_id = p_user_id
      or not exists (select 1 from public.profiles where id = p_counterparty_user_id) then
      raise exception 'INVALID_COUNTERPARTY';
    end if;
  elsif p_counterparty_user_id is not null then
    raise exception 'INVALID_COUNTERPARTY';
  end if;

  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'INVALID_REFERENCE';
  end if;

  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'INVALID_NOTE';
  end if;

  insert into public.gcash_transfers (
    user_id, amount_centavos, destination, counterparty_user_id,
    reference, note, created_by
  )
  values (
    p_user_id, p_amount_centavos, v_destination, p_counterparty_user_id,
    v_reference, v_note, v_actor
  )
  returning * into v_transfer;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'gcash.transferred', 'gcash_transfer', v_transfer.id, to_jsonb(v_transfer));

  return v_transfer;
end;
$$;

revoke all on function public.record_gcash_transfer(uuid, integer, text, uuid, text, text) from public;
revoke all on function public.record_gcash_transfer(uuid, integer, text, uuid, text, text) from anon;
grant execute on function public.record_gcash_transfer(uuid, integer, text, uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Public digital receipt
-- ---------------------------------------------------------------------------

create or replace function public.get_sales_receipt(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_order public.sales_orders;
  v_shop public.shop_settings;
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into v_order from public.sales_orders where public_token = v_token;

  if not found then
    return null;
  end if;

  select * into v_shop from public.shop_settings where id = 1;

  return jsonb_build_object(
    'shop', jsonb_build_object(
      'name', v_shop.shop_name,
      'address', v_shop.address,
      'contact', v_shop.contact,
      'footer', v_shop.receipt_footer
    ),
    'order_no', v_order.order_no,
    'business_date', v_order.business_date,
    'customer_name', v_order.customer_name,
    'bike_model', v_order.bike_model,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', i.item_name_at_time,
            'qty', i.qty,
            'unit_price_centavos', i.unit_price_at_time_centavos,
            'line_total_centavos', i.line_total_centavos
          )
          order by i.created_at, i.id
        )
        from public.sales_order_items i
        where i.order_id = v_order.id
      ),
      '[]'::jsonb
    ),
    'labor_total_centavos', v_order.labor_total_centavos,
    'total_centavos', v_order.total_centavos,
    'payments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('method', p.method, 'amount_centavos', p.amount_centavos)
          order by p.received_at, p.id
        )
        from public.sales_payments p
        where p.order_id = v_order.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_sales_receipt(text) from public;
grant execute on function public.get_sales_receipt(text) to anon, authenticated;
