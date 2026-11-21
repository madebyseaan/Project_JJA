-- Step 05: bay tickets, items, labor, reservations, and status flow.
-- Stock is reserved when a line is added and released when it is removed or
-- the ticket is cancelled. Totals are always recalculated by the database.

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

create table private.ticket_counters (
  day date primary key,
  next_no integer not null check (next_no > 0)
);

create or replace function private.next_ticket_no()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_no integer;
begin
  insert into private.ticket_counters (day, next_no)
  values (v_day, 2)
  on conflict (day) do update
    set next_no = private.ticket_counters.next_no + 1
  returning next_no - 1 into v_no;

  return 'TK-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function private.next_ticket_no() from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null,
  type text not null check (type in ('REPAIR', 'SALE')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VERIFYING', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED')),
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  bike_model text check (bike_model is null or char_length(bike_model) <= 120),
  notes text check (notes is null or char_length(notes) <= 500),
  parts_total_centavos integer not null default 0 check (parts_total_centavos >= 0),
  labor_total_centavos integer not null default 0 check (labor_total_centavos >= 0),
  total_centavos integer generated always as (parts_total_centavos + labor_total_centavos) stored,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500)
);

comment on table public.tickets is 'Walk-in repair or over-the-counter sale. Editable only while open.';
comment on column public.tickets.total_centavos is 'Database-computed parts + labor total. The client never supplies it.';

create index tickets_status_idx on public.tickets (status);
create index tickets_created_at_idx on public.tickets (created_at desc);
create index tickets_business_day_idx on public.tickets (((created_at at time zone 'Asia/Manila')::date));
create index tickets_created_by_idx on public.tickets (created_by);

create table public.ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete restrict,
  part_id uuid not null references public.parts (id),
  part_name_at_time text not null check (char_length(part_name_at_time) between 1 and 120),
  qty integer not null check (qty > 0),
  unit_price_at_time_centavos integer not null check (unit_price_at_time_centavos >= 0),
  unit_cost_at_time_centavos integer not null check (unit_cost_at_time_centavos >= 0),
  line_total_centavos integer generated always as (qty * unit_price_at_time_centavos) stored,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (ticket_id, part_id)
);

create index ticket_items_ticket_idx on public.ticket_items (ticket_id);
create index ticket_items_part_idx on public.ticket_items (part_id);

create table public.ticket_labor (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount_centavos integer not null check (amount_centavos >= 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index ticket_labor_ticket_idx on public.ticket_labor (ticket_id);

create trigger set_tickets_updated_at
before update on public.tickets
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.v_open_tickets
with (security_invoker = true)
as
select
  t.id,
  t.ticket_no,
  t.type,
  t.status,
  t.customer_name,
  t.bike_model,
  t.notes,
  t.parts_total_centavos,
  t.labor_total_centavos,
  t.total_centavos,
  t.created_by,
  t.created_at,
  t.updated_at,
  p.display_name as created_by_name
from public.tickets t
join public.profiles p on p.id = t.created_by
where t.status in ('PENDING', 'VERIFYING', 'IN_PROGRESS', 'READY');

comment on view public.v_open_tickets is 'Open bay queue with the creator display name.';

grant select on public.v_open_tickets to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.tickets enable row level security;
alter table public.ticket_items enable row level security;
alter table public.ticket_labor enable row level security;

revoke all on public.tickets from anon, authenticated;
revoke all on public.ticket_items from anon, authenticated;
revoke all on public.ticket_labor from anon, authenticated;

grant select on public.tickets to authenticated;
grant select on public.ticket_items to authenticated;
grant select on public.ticket_labor to authenticated;

create policy "staff read tickets"
on public.tickets for select to authenticated
using (private.is_staff());

create policy "staff read ticket items"
on public.ticket_items for select to authenticated
using (private.is_staff());

create policy "staff read ticket labor"
on public.ticket_labor for select to authenticated
using (private.is_staff());

-- Realtime powers the bay queue.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_items'
  ) then
    alter publication supabase_realtime add table public.ticket_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_labor'
  ) then
    alter publication supabase_realtime add table public.ticket_labor;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function private.recalc_ticket_totals(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets
  set
    parts_total_centavos = coalesce(
      (select sum(i.line_total_centavos) from public.ticket_items i where i.ticket_id = p_ticket_id),
      0
    ),
    labor_total_centavos = coalesce(
      (select sum(l.amount_centavos) from public.ticket_labor l where l.ticket_id = p_ticket_id),
      0
    ),
    updated_at = now()
  where id = p_ticket_id;
end;
$$;

revoke all on function private.recalc_ticket_totals(uuid) from public;

create or replace function private.lock_open_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.status not in ('PENDING', 'VERIFYING', 'IN_PROGRESS', 'READY') then
    raise exception 'TICKET_NOT_OPEN';
  end if;

  return v_ticket;
end;
$$;

revoke all on function private.lock_open_ticket(uuid) from public;

-- ---------------------------------------------------------------------------
-- Ticket RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_ticket(
  p_type text,
  p_customer_name text,
  p_bike_model text,
  p_notes text,
  p_items jsonb,
  p_labor jsonb
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_type text := upper(btrim(coalesce(p_type, 'REPAIR')));
  v_customer text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_bike text := nullif(btrim(coalesce(p_bike_model, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_labor jsonb := coalesce(p_labor, '[]'::jsonb);
  v_ticket public.tickets;
  v_ticket_id uuid;
  v_item record;
  v_labor_item record;
  v_part public.parts;
  v_item_count integer := 0;
  v_labor_count integer := 0;
begin
  perform private.require_staff();

  if v_type not in ('REPAIR', 'SALE') then
    raise exception 'INVALID_TYPE';
  end if;

  if v_customer is not null and char_length(v_customer) > 120 then
    raise exception 'INVALID_CUSTOMER';
  end if;

  if v_bike is not null and char_length(v_bike) > 120 then
    raise exception 'INVALID_BIKE';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_typeof(v_labor) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;

  insert into public.tickets (ticket_no, type, customer_name, bike_model, notes, created_by)
  values (private.next_ticket_no(), v_type, v_customer, v_bike, v_notes, v_actor)
  returning * into v_ticket;

  v_ticket_id := v_ticket.id;

  -- Lock parts in a deterministic order, then reserve each line.
  for v_item in
    select part_id, sum(qty)::integer as qty
    from jsonb_to_recordset(v_items) as x(part_id uuid, qty integer)
    group by part_id
    order by part_id
  loop
    if v_item.part_id is null or v_item.qty is null or v_item.qty <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select * into v_part from public.parts where id = v_item.part_id for update;

    if not found then
      raise exception 'PART_NOT_FOUND';
    end if;

    if not v_part.is_active then
      raise exception 'PART_INACTIVE';
    end if;

    if v_part.available_qty < v_item.qty then
      raise exception 'INSUFFICIENT_STOCK'
        using detail = jsonb_build_object(
          'part_id', v_part.id,
          'part_name', v_part.name,
          'available', v_part.available_qty
        )::text;
    end if;

    insert into public.ticket_items (
      ticket_id,
      part_id,
      part_name_at_time,
      qty,
      unit_price_at_time_centavos,
      unit_cost_at_time_centavos
    )
    values (
      v_ticket_id,
      v_part.id,
      v_part.name,
      v_item.qty,
      v_part.unit_price_centavos,
      v_part.cost_price_centavos
    );

    update public.parts
    set reserved_qty = reserved_qty + v_item.qty, updated_at = now()
    where id = v_part.id;

    v_item_count := v_item_count + 1;
  end loop;

  for v_labor_item in
    select description, amount_centavos
    from jsonb_to_recordset(v_labor) as x(description text, amount_centavos integer)
    order by description
  loop
    if v_labor_item.description is null
      or char_length(btrim(v_labor_item.description)) not between 1 and 120 then
      raise exception 'INVALID_DESCRIPTION';
    end if;

    if v_labor_item.amount_centavos is null or v_labor_item.amount_centavos < 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    insert into public.ticket_labor (ticket_id, description, amount_centavos, created_by)
    values (v_ticket_id, btrim(v_labor_item.description), v_labor_item.amount_centavos, v_actor);

    v_labor_count := v_labor_count + 1;
  end loop;

  if v_item_count = 0 and v_labor_count = 0 then
    raise exception 'EMPTY_TICKET';
  end if;

  perform private.recalc_ticket_totals(v_ticket_id);

  select * into v_ticket from public.tickets where id = v_ticket_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.created', 'ticket', v_ticket_id, to_jsonb(v_ticket));

  return v_ticket;
end;
$$;

create or replace function public.add_ticket_item(
  p_ticket_id uuid,
  p_part_id uuid,
  p_qty integer
)
returns public.ticket_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_part public.parts;
  v_item public.ticket_items;
  v_existing public.ticket_items;
begin
  perform private.require_staff();

  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  select * into v_part from public.parts where id = p_part_id for update;

  if not found then
    raise exception 'PART_NOT_FOUND';
  end if;

  if not v_part.is_active then
    raise exception 'PART_INACTIVE';
  end if;

  if v_part.available_qty < p_qty then
    raise exception 'INSUFFICIENT_STOCK'
      using detail = jsonb_build_object(
        'part_id', v_part.id,
        'part_name', v_part.name,
        'available', v_part.available_qty
      )::text;
  end if;

  select * into v_existing
  from public.ticket_items
  where ticket_id = p_ticket_id and part_id = p_part_id
  for update;

  if found then
    update public.ticket_items
    set qty = qty + p_qty
    where id = v_existing.id
    returning * into v_item;
  else
    insert into public.ticket_items (
      ticket_id,
      part_id,
      part_name_at_time,
      qty,
      unit_price_at_time_centavos,
      unit_cost_at_time_centavos
    )
    values (
      p_ticket_id,
      v_part.id,
      v_part.name,
      p_qty,
      v_part.unit_price_centavos,
      v_part.cost_price_centavos
    )
    returning * into v_item;
  end if;

  update public.parts
  set reserved_qty = reserved_qty + p_qty, updated_at = now()
  where id = p_part_id;

  perform private.recalc_ticket_totals(p_ticket_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.item_added', 'ticket', p_ticket_id, to_jsonb(v_item));

  return v_item;
end;
$$;

create or replace function public.set_ticket_item_qty(
  p_ticket_id uuid,
  p_part_id uuid,
  p_qty integer
)
returns public.ticket_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_part public.parts;
  v_item public.ticket_items;
  v_delta integer;
begin
  perform private.require_staff();

  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  select * into v_item
  from public.ticket_items
  where ticket_id = p_ticket_id and part_id = p_part_id
  for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  select * into v_part from public.parts where id = p_part_id for update;

  if not found then
    raise exception 'PART_NOT_FOUND';
  end if;

  v_delta := p_qty - v_item.qty;

  if v_delta > 0 and v_part.available_qty < v_delta then
    raise exception 'INSUFFICIENT_STOCK'
      using detail = jsonb_build_object(
        'part_id', v_part.id,
        'part_name', v_part.name,
        'available', v_part.available_qty
      )::text;
  end if;

  update public.ticket_items set qty = p_qty where id = v_item.id returning * into v_item;

  update public.parts
  set reserved_qty = reserved_qty + v_delta, updated_at = now()
  where id = p_part_id;

  perform private.recalc_ticket_totals(p_ticket_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.item_qty_changed', 'ticket', p_ticket_id, to_jsonb(v_item));

  return v_item;
end;
$$;

create or replace function public.remove_ticket_item(
  p_ticket_id uuid,
  p_part_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_item public.ticket_items;
begin
  perform private.require_staff();

  v_ticket := private.lock_open_ticket(p_ticket_id);

  select * into v_item
  from public.ticket_items
  where ticket_id = p_ticket_id and part_id = p_part_id
  for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  perform 1 from public.parts where id = p_part_id for update;

  update public.parts
  set reserved_qty = reserved_qty - v_item.qty, updated_at = now()
  where id = p_part_id;

  delete from public.ticket_items where id = v_item.id;

  perform private.recalc_ticket_totals(p_ticket_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before")
  values (v_actor, 'ticket.item_removed', 'ticket', p_ticket_id, to_jsonb(v_item));
end;
$$;

create or replace function public.add_ticket_labor(
  p_ticket_id uuid,
  p_description text,
  p_amount_centavos integer
)
returns public.ticket_labor
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_description text := btrim(coalesce(p_description, ''));
  v_labor public.ticket_labor;
begin
  perform private.require_staff();

  if char_length(v_description) not between 1 and 120 then
    raise exception 'INVALID_DESCRIPTION';
  end if;

  if p_amount_centavos is null or p_amount_centavos < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  insert into public.ticket_labor (ticket_id, description, amount_centavos, created_by)
  values (p_ticket_id, v_description, p_amount_centavos, v_actor)
  returning * into v_labor;

  perform private.recalc_ticket_totals(p_ticket_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.labor_added', 'ticket', p_ticket_id, to_jsonb(v_labor));

  return v_labor;
end;
$$;

create or replace function public.remove_ticket_labor(p_labor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_labor public.ticket_labor;
begin
  perform private.require_staff();

  select * into v_labor from public.ticket_labor where id = p_labor_id;

  if not found then
    raise exception 'LABOR_NOT_FOUND';
  end if;

  perform private.lock_open_ticket(v_labor.ticket_id);

  delete from public.ticket_labor where id = p_labor_id;

  perform private.recalc_ticket_totals(v_labor.ticket_id);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before")
  values (v_actor, 'ticket.labor_removed', 'ticket', v_labor.ticket_id, to_jsonb(v_labor));
end;
$$;

create or replace function public.verify_ticket_item(
  p_ticket_id uuid,
  p_part_id uuid
)
returns public.ticket_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_item public.ticket_items;
begin
  perform private.require_staff();

  v_ticket := private.lock_open_ticket(p_ticket_id);

  update public.ticket_items
  set verified_at = coalesce(verified_at, now()), verified_by = coalesce(verified_by, v_actor)
  where ticket_id = p_ticket_id and part_id = p_part_id
  returning * into v_item;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.item_verified', 'ticket', p_ticket_id, to_jsonb(v_item));

  return v_item;
end;
$$;

create or replace function public.verify_all_ticket_items(p_ticket_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_count integer;
begin
  perform private.require_staff();

  v_ticket := private.lock_open_ticket(p_ticket_id);

  update public.ticket_items
  set verified_at = now(), verified_by = v_actor
  where ticket_id = p_ticket_id and verified_at is null;

  get diagnostics v_count = row_count;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (
    v_actor,
    'ticket.items_verified',
    'ticket',
    p_ticket_id,
    jsonb_build_object('verified_count', v_count)
  );

  return v_count;
end;
$$;

create or replace function public.update_ticket_status(
  p_ticket_id uuid,
  p_status text
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status text := upper(btrim(coalesce(p_status, '')));
  v_before public.tickets;
  v_after public.tickets;
  v_allowed boolean := false;
begin
  perform private.require_staff();

  v_before := private.lock_open_ticket(p_ticket_id);

  if v_status in ('COMPLETED', 'CANCELLED', 'VOIDED') then
    raise exception 'INVALID_STATUS';
  end if;

  v_allowed :=
    (v_before.status = 'PENDING' and v_status in ('VERIFYING', 'IN_PROGRESS'))
    or (v_before.status = 'VERIFYING' and v_status = 'IN_PROGRESS')
    or (v_before.status = 'IN_PROGRESS' and v_status = 'READY')
    or (v_before.status = 'READY' and v_status = 'IN_PROGRESS');

  if not v_allowed then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.tickets set status = v_status where id = p_ticket_id returning * into v_after;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'ticket.status_changed',
    'ticket',
    p_ticket_id,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_after.status)
  );

  return v_after;
end;
$$;

revoke all on function public.create_ticket(text, text, text, text, jsonb, jsonb) from public;
revoke all on function public.add_ticket_item(uuid, uuid, integer) from public;
revoke all on function public.set_ticket_item_qty(uuid, uuid, integer) from public;
revoke all on function public.remove_ticket_item(uuid, uuid) from public;
revoke all on function public.add_ticket_labor(uuid, text, integer) from public;
revoke all on function public.remove_ticket_labor(uuid) from public;
revoke all on function public.verify_ticket_item(uuid, uuid) from public;
revoke all on function public.verify_all_ticket_items(uuid) from public;
revoke all on function public.update_ticket_status(uuid, text) from public;

grant execute on function public.create_ticket(text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.add_ticket_item(uuid, uuid, integer) to authenticated;
grant execute on function public.set_ticket_item_qty(uuid, uuid, integer) to authenticated;
grant execute on function public.remove_ticket_item(uuid, uuid) to authenticated;
grant execute on function public.add_ticket_labor(uuid, text, integer) to authenticated;
grant execute on function public.remove_ticket_labor(uuid) to authenticated;
grant execute on function public.verify_ticket_item(uuid, uuid) to authenticated;
grant execute on function public.verify_all_ticket_items(uuid) to authenticated;
grant execute on function public.update_ticket_status(uuid, text) to authenticated;
