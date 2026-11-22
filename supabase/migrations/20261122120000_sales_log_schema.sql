-- Sales log schema: catalog, orders, child tables, RLS, grants, and views.
-- No stock tracking.

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
create index catalog_items_sku_idx on public.catalog_items (sku) where sku is not null;
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

create or replace function private.next_sales_order_no(p_day date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_no integer;
begin
  insert into private.sales_order_counters (day, next_no)
  values (p_day, 2)
  on conflict (day) do update
    set next_no = private.sales_order_counters.next_no + 1
  returning next_no - 1 into v_no;

  return 'SL-' || to_char(p_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function private.next_sales_order_no(date) from public;

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

revoke all on public.v_sales_daily from anon, authenticated;
revoke all on public.v_sales_labor_daily from anon, authenticated;
revoke all on public.v_sales_payments_daily from anon, authenticated;

grant select on public.v_sales_daily to authenticated;
grant select on public.v_sales_labor_daily to authenticated;
grant select on public.v_sales_payments_daily to authenticated;
