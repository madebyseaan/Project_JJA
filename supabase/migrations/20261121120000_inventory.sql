-- Step 04: parts catalog, stock ledger, audit trail, and shop settings.
-- Writes are owner-only RPCs. Every stock change writes a stock_movements row
-- in the same transaction, and every mutation writes an audit_events row.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

create or replace function private.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

revoke all on function private.require_staff() from public;
revoke all on function private.require_owner() from public;
grant execute on function private.require_staff() to authenticated;
grant execute on function private.require_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.shop_settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text not null default 'J.J.A Motor Accessories and Motorcycle Repair Shop'
    check (char_length(btrim(shop_name)) between 1 and 120),
  address text not null default '' check (char_length(address) <= 300),
  contact text not null default '' check (char_length(contact) <= 120),
  receipt_footer text not null default '' check (char_length(receipt_footer) <= 300),
  low_stock_default integer not null default 3 check (low_stock_default >= 0),
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  currency text not null default 'PHP' check (currency = 'PHP'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sku text unique check (sku is null or char_length(btrim(sku)) between 1 and 60),
  category text not null default 'General'
    check (char_length(btrim(category)) between 1 and 60),
  compatible_models text[] not null default '{}',
  unit_price_centavos integer not null check (unit_price_centavos >= 0),
  cost_price_centavos integer not null default 0 check (cost_price_centavos >= 0),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  reserved_qty integer not null default 0
    check (reserved_qty >= 0 and reserved_qty <= stock_on_hand),
  available_qty integer generated always as (stock_on_hand - reserved_qty) stored,
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  image_path text,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parts is 'Parts catalog. Stock is only changed by owner RPCs.';
comment on column public.parts.available_qty is 'stock_on_hand - reserved_qty; reserved stock belongs to open tickets.';

create index parts_name_lower_idx on public.parts (lower(name));
create index parts_sku_idx on public.parts (sku) where sku is not null;
create index parts_category_idx on public.parts (category);
create index parts_compatible_models_idx on public.parts using gin (compatible_models);
create index parts_active_idx on public.parts (is_active) where is_active;

create table public.stock_movements (
  id bigserial primary key,
  part_id uuid not null references public.parts (id),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('INITIAL', 'RESTOCK', 'ADJUSTMENT', 'SALE', 'RETURN')),
  ticket_id uuid,
  receipt_id uuid,
  actor_id uuid not null references public.profiles (id),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.stock_movements is 'Append-only stock ledger. Every stock change writes one row.';

create index stock_movements_part_idx on public.stock_movements (part_id, created_at desc);
create index stock_movements_ticket_idx on public.stock_movements (ticket_id)
  where ticket_id is not null;
create index stock_movements_created_idx on public.stock_movements (created_at desc);

create table public.audit_events (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  action text not null check (char_length(btrim(action)) between 1 and 100),
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 60),
  entity_id uuid,
  "before" jsonb,
  "after" jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_events is 'Append-only audit trail. Owner-only read.';

create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_action_idx on public.audit_events (action);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

create or replace function private.set_shop_settings_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_shop_settings_updated_at() from public;

create trigger set_shop_settings_updated_at
before update on public.shop_settings
for each row execute function private.set_shop_settings_updated_at();

create trigger set_parts_updated_at
before update on public.parts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.parts enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_events enable row level security;
alter table public.shop_settings enable row level security;

revoke all on public.parts from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;
revoke all on public.shop_settings from anon, authenticated;

grant select on public.parts to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.shop_settings to authenticated;

create policy "staff read parts"
on public.parts for select to authenticated
using (private.is_staff());

create policy "owner reads stock ledger"
on public.stock_movements for select to authenticated
using (private.is_owner());

create policy "owner reads audit events"
on public.audit_events for select to authenticated
using (private.is_owner());

create policy "staff read shop settings"
on public.shop_settings for select to authenticated
using (private.is_staff());

-- ---------------------------------------------------------------------------
-- Part RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_part(
  p_name text,
  p_sku text,
  p_category text,
  p_compatible_models text[],
  p_unit_price_centavos integer,
  p_cost_price_centavos integer,
  p_stock_on_hand integer,
  p_low_stock_threshold integer
)
returns public.parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  v_category text := btrim(coalesce(nullif(p_category, ''), 'General'));
  v_models text[];
  v_part public.parts;
  v_id uuid;
begin
  perform private.require_owner();

  if char_length(v_name) not between 1 and 120 then
    raise exception 'INVALID_NAME';
  end if;

  if v_sku is not null and char_length(v_sku) not between 1 and 60 then
    raise exception 'INVALID_SKU';
  end if;

  if char_length(v_category) not between 1 and 60 then
    raise exception 'INVALID_CATEGORY';
  end if;

  if p_unit_price_centavos is null or p_unit_price_centavos < 0 then
    raise exception 'INVALID_PRICE';
  end if;

  if p_cost_price_centavos is null or p_cost_price_centavos < 0 then
    raise exception 'INVALID_COST';
  end if;

  if p_stock_on_hand is null or p_stock_on_hand < 0 then
    raise exception 'INVALID_STOCK';
  end if;

  if p_low_stock_threshold is null or p_low_stock_threshold < 0 then
    raise exception 'INVALID_THRESHOLD';
  end if;

  v_models := coalesce(
    (
      select array_agg(btrim(model))
      from unnest(coalesce(p_compatible_models, '{}')) as model
      where btrim(model) <> ''
    ),
    '{}'
  );

  if cardinality(v_models) > 20 then
    raise exception 'INVALID_MODELS';
  end if;

  if exists (select 1 from unnest(v_models) as model where char_length(model) > 60) then
    raise exception 'INVALID_MODELS';
  end if;

  insert into public.parts (
    name,
    sku,
    category,
    compatible_models,
    unit_price_centavos,
    cost_price_centavos,
    stock_on_hand,
    low_stock_threshold,
    created_by,
    updated_by
  )
  values (
    v_name,
    v_sku,
    v_category,
    v_models,
    p_unit_price_centavos,
    p_cost_price_centavos,
    p_stock_on_hand,
    p_low_stock_threshold,
    v_actor,
    v_actor
  )
  returning id into v_id;

  if p_stock_on_hand > 0 then
    insert into public.stock_movements (part_id, delta, reason, actor_id, note)
    values (v_id, p_stock_on_hand, 'INITIAL', v_actor, 'Opening stock');
  end if;

  select * into v_part from public.parts where id = v_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'part.created', 'part', v_id, to_jsonb(v_part));

  return v_part;
end;
$$;

create or replace function public.update_part(
  p_part_id uuid,
  p_name text,
  p_sku text,
  p_category text,
  p_compatible_models text[],
  p_unit_price_centavos integer,
  p_cost_price_centavos integer,
  p_low_stock_threshold integer,
  p_is_active boolean
)
returns public.parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_sku text := nullif(btrim(coalesce(p_sku, '')), '');
  v_category text := btrim(coalesce(nullif(p_category, ''), 'General'));
  v_models text[];
  v_before public.parts;
  v_after public.parts;
begin
  perform private.require_owner();

  if p_part_id is null then
    raise exception 'INVALID_PART';
  end if;

  select * into v_before from public.parts where id = p_part_id for update;

  if not found then
    raise exception 'PART_NOT_FOUND';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'INVALID_NAME';
  end if;

  if v_sku is not null and char_length(v_sku) not between 1 and 60 then
    raise exception 'INVALID_SKU';
  end if;

  if char_length(v_category) not between 1 and 60 then
    raise exception 'INVALID_CATEGORY';
  end if;

  if p_unit_price_centavos is null or p_unit_price_centavos < 0 then
    raise exception 'INVALID_PRICE';
  end if;

  if p_cost_price_centavos is null or p_cost_price_centavos < 0 then
    raise exception 'INVALID_COST';
  end if;

  if p_low_stock_threshold is null or p_low_stock_threshold < 0 then
    raise exception 'INVALID_THRESHOLD';
  end if;

  v_models := coalesce(
    (
      select array_agg(btrim(model))
      from unnest(coalesce(p_compatible_models, '{}')) as model
      where btrim(model) <> ''
    ),
    '{}'
  );

  if cardinality(v_models) > 20 then
    raise exception 'INVALID_MODELS';
  end if;

  if exists (select 1 from unnest(v_models) as model where char_length(model) > 60) then
    raise exception 'INVALID_MODELS';
  end if;

  update public.parts
  set
    name = v_name,
    sku = v_sku,
    category = v_category,
    compatible_models = v_models,
    unit_price_centavos = p_unit_price_centavos,
    cost_price_centavos = p_cost_price_centavos,
    low_stock_threshold = p_low_stock_threshold,
    is_active = coalesce(p_is_active, is_active),
    updated_by = v_actor,
    updated_at = now()
  where id = p_part_id
  returning * into v_after;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    case
      when v_before.unit_price_centavos <> v_after.unit_price_centavos
        or v_before.cost_price_centavos <> v_after.cost_price_centavos
      then 'part.price_changed'
      else 'part.updated'
    end,
    'part',
    p_part_id,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

create or replace function public.adjust_stock(
  p_part_id uuid,
  p_delta integer,
  p_reason text,
  p_note text
)
returns public.parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := upper(btrim(coalesce(p_reason, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_before public.parts;
  v_after public.parts;
  v_new_stock integer;
begin
  perform private.require_owner();

  if p_part_id is null then
    raise exception 'INVALID_PART';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if v_reason not in ('RESTOCK', 'ADJUSTMENT') then
    raise exception 'INVALID_REASON';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  select * into v_before from public.parts where id = p_part_id for update;

  if not found then
    raise exception 'PART_NOT_FOUND';
  end if;

  v_new_stock := v_before.stock_on_hand + p_delta;

  if v_new_stock < 0 then
    raise exception 'INVALID_STOCK';
  end if;

  if v_new_stock < v_before.reserved_qty then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.parts
  set stock_on_hand = v_new_stock, updated_by = v_actor, updated_at = now()
  where id = p_part_id
  returning * into v_after;

  insert into public.stock_movements (part_id, delta, reason, actor_id, note)
  values (p_part_id, p_delta, v_reason, v_actor, v_note);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'part.stock_adjusted',
    'part',
    p_part_id,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;

revoke all on function public.create_part(
  text, text, text, text[], integer, integer, integer, integer
) from public;
revoke all on function public.update_part(
  uuid, text, text, text, text[], integer, integer, integer, boolean
) from public;
revoke all on function public.adjust_stock(uuid, integer, text, text) from public;

grant execute on function public.create_part(
  text, text, text, text[], integer, integer, integer, integer
) to authenticated;
grant execute on function public.update_part(
  uuid, text, text, text, text[], integer, integer, integer, boolean
) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text, text) to authenticated;
