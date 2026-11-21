-- Step 06: payments, completion, cancellation, void sale, and receipts.
-- Completion is one transaction: validate payments, deduct stock, write SALE
-- ledger rows, issue exactly one receipt, and mark the ticket COMPLETED.

-- ---------------------------------------------------------------------------
-- Counters and secrets
-- ---------------------------------------------------------------------------

create table private.receipt_counters (
  day date primary key,
  next_no integer not null check (next_no > 0)
);

create or replace function private.next_receipt_no()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_no integer;
begin
  insert into private.receipt_counters (day, next_no)
  values (v_day, 2)
  on conflict (day) do update
    set next_no = private.receipt_counters.next_no + 1
  returning next_no - 1 into v_no;

  return to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function private.next_receipt_no() from public;

create table private.app_secrets (
  key text primary key,
  value text not null
);

insert into private.app_secrets (key, value)
values ('receipt_hmac_key', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.ticket_payments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id),
  method text not null check (method in ('CASH', 'GCASH', 'MAYA', 'OTHER')),
  amount_centavos integer not null check (amount_centavos <> 0),
  reference_no text check (reference_no is null or char_length(reference_no) <= 60),
  received_by uuid not null references public.profiles (id),
  received_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500)
);

comment on table public.ticket_payments is 'Signed payments: positive received, negative refunded.';

create index ticket_payments_ticket_idx on public.ticket_payments (ticket_id, received_at);
create index ticket_payments_business_day_idx
  on public.ticket_payments (((received_at at time zone 'Asia/Manila')::date));
create index ticket_payments_method_idx on public.ticket_payments (method);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique not null check (receipt_no ~ '^[0-9]{8}-[0-9]{4}$'),
  ticket_id uuid not null references public.tickets (id),
  status text not null default 'ISSUED' check (status in ('ISSUED', 'VOID')),
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.profiles (id),
  snapshot jsonb not null,
  total_centavos integer not null check (total_centavos >= 0),
  verification_hash text not null check (verification_hash ~ '^[0-9a-f]{64}$'),
  verification_code text not null
    check (verification_code ~ '^[0-9A-F]{4}(-[0-9A-F]{4}){3}$'),
  public_token text unique not null check (public_token ~ '^[0-9a-f]{32}$'),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  created_at timestamptz not null default now()
);

create unique index receipts_one_issued_per_ticket
  on public.receipts (ticket_id) where status = 'ISSUED';
create index receipts_issued_at_idx on public.receipts (issued_at desc);
create index receipts_ticket_idx on public.receipts (ticket_id);

alter table public.stock_movements
  add constraint stock_movements_ticket_fk
    foreign key (ticket_id) references public.tickets (id),
  add constraint stock_movements_receipt_fk
    foreign key (receipt_id) references public.receipts (id);

-- ---------------------------------------------------------------------------
-- Receipt hashing
-- ---------------------------------------------------------------------------

create or replace function private.receipt_hmac(
  p_receipt_no text,
  p_issued_at timestamptz,
  p_total_centavos integer,
  p_snapshot jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(
      convert_to(
        p_receipt_no
          || '|'
          || to_char(p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
          || '|'
          || p_total_centavos::text
          || '|'
          || encode(extensions.digest(p_snapshot::text, 'sha256'), 'hex'),
        'UTF8'
      ),
      decode(s.value, 'hex'),
      'sha256'
    ),
    'hex'
  )
  from private.app_secrets s
  where s.key = 'receipt_hmac_key';
$$;

revoke all on function private.receipt_hmac(text, timestamptz, integer, jsonb) from public;

create or replace function private.receipt_code(p_hash text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    upper(left(p_hash, 16)),
    '^(.{4})(.{4})(.{4})(.{4})$',
    '\1-\2-\3-\4'
  );
$$;

revoke all on function private.receipt_code(text) from public;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.v_ticket_balances
with (security_invoker = true)
as
select
  t.id,
  t.ticket_no,
  t.status,
  t.total_centavos,
  coalesce(p.paid_centavos, 0)::integer as paid_centavos,
  (t.total_centavos - coalesce(p.paid_centavos, 0))::integer as balance_centavos
from public.tickets t
left join (
  select ticket_id, sum(amount_centavos)::integer as paid_centavos
  from public.ticket_payments
  group by ticket_id
) p on p.ticket_id = t.id;

comment on view public.v_ticket_balances is 'Ticket total, paid amount, and outstanding balance.';

grant select on public.v_ticket_balances to authenticated;

create or replace view public.v_open_tickets
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
  p.display_name as created_by_name,
  coalesce(b.paid_centavos, 0) as paid_centavos,
  coalesce(b.balance_centavos, t.total_centavos) as balance_centavos
from public.tickets t
join public.profiles p on p.id = t.created_by
left join public.v_ticket_balances b on b.id = t.id
where t.status in ('PENDING', 'VERIFYING', 'IN_PROGRESS', 'READY');

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.ticket_payments enable row level security;
alter table public.receipts enable row level security;

revoke all on public.ticket_payments from anon, authenticated;
revoke all on public.receipts from anon, authenticated;

grant select on public.ticket_payments to authenticated;
grant select on public.receipts to authenticated;

create policy "staff read ticket payments"
on public.ticket_payments for select to authenticated
using (private.is_staff());

create policy "staff read receipts"
on public.receipts for select to authenticated
using (private.is_staff());

-- ---------------------------------------------------------------------------
-- Payment RPCs
-- ---------------------------------------------------------------------------

create or replace function public.record_payment(
  p_ticket_id uuid,
  p_method text,
  p_amount_centavos integer,
  p_reference_no text,
  p_note text
)
returns public.ticket_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_method text := upper(btrim(coalesce(p_method, '')));
  v_reference text := nullif(btrim(coalesce(p_reference_no, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ticket public.tickets;
  v_paid integer;
  v_payment public.ticket_payments;
begin
  perform private.require_staff();

  if v_method not in ('CASH', 'GCASH', 'MAYA', 'OTHER') then
    raise exception 'INVALID_METHOD';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if v_reference is not null and char_length(v_reference) > 60 then
    raise exception 'INVALID_REFERENCE';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  select coalesce(sum(amount_centavos), 0)::integer
  into v_paid
  from public.ticket_payments
  where ticket_id = p_ticket_id;

  if v_paid + p_amount_centavos > v_ticket.total_centavos then
    raise exception 'PAYMENT_MISMATCH'
      using detail = jsonb_build_object(
        'total', v_ticket.total_centavos,
        'paid', v_paid,
        'balance', v_ticket.total_centavos - v_paid
      )::text;
  end if;

  insert into public.ticket_payments (
    ticket_id, method, amount_centavos, reference_no, received_by, note
  )
  values (p_ticket_id, v_method, p_amount_centavos, v_reference, v_actor, v_note)
  returning * into v_payment;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (v_actor, 'ticket.payment_recorded', 'ticket', p_ticket_id, to_jsonb(v_payment));

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Completion
-- ---------------------------------------------------------------------------

create or replace function public.complete_ticket(
  p_ticket_id uuid,
  p_payments jsonb
)
returns public.receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_ticket public.tickets;
  v_payments jsonb := coalesce(p_payments, '[]'::jsonb);
  v_payment record;
  v_paid integer;
  v_new_total integer := 0;
  v_item record;
  v_part public.parts;
  v_receipt_no text;
  v_issued_at timestamptz := now();
  v_snapshot jsonb;
  v_hash text;
  v_receipt public.receipts;
  v_shop public.shop_settings;
begin
  perform private.require_staff();

  if jsonb_typeof(v_payments) <> 'array' then
    raise exception 'INVALID_PAYMENTS';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  if exists (
    select 1 from public.ticket_items
    where ticket_id = p_ticket_id and verified_at is null
  ) then
    raise exception 'NOT_VERIFIED';
  end if;

  select coalesce(sum(amount_centavos), 0)::integer
  into v_paid
  from public.ticket_payments
  where ticket_id = p_ticket_id;

  for v_payment in
    select method, amount_centavos, reference_no, note
    from jsonb_to_recordset(v_payments)
      as x(method text, amount_centavos integer, reference_no text, note text)
  loop
    if upper(btrim(coalesce(v_payment.method, ''))) not in ('CASH', 'GCASH', 'MAYA', 'OTHER') then
      raise exception 'INVALID_METHOD';
    end if;

    if v_payment.amount_centavos is null or v_payment.amount_centavos <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;

    if v_payment.reference_no is not null and char_length(btrim(v_payment.reference_no)) > 60 then
      raise exception 'INVALID_REFERENCE';
    end if;

    if v_payment.note is not null and char_length(btrim(v_payment.note)) > 500 then
      raise exception 'INVALID_NOTE';
    end if;

    v_new_total := v_new_total + v_payment.amount_centavos;
  end loop;

  if v_paid + v_new_total <> v_ticket.total_centavos then
    raise exception 'PAYMENT_MISMATCH'
      using detail = jsonb_build_object(
        'total', v_ticket.total_centavos,
        'paid', v_paid,
        'new_payments', v_new_total,
        'balance', v_ticket.total_centavos - v_paid - v_new_total
      )::text;
  end if;

  for v_payment in
    select method, amount_centavos, reference_no, note
    from jsonb_to_recordset(v_payments)
      as x(method text, amount_centavos integer, reference_no text, note text)
  loop
    insert into public.ticket_payments (
      ticket_id, method, amount_centavos, reference_no, received_by, note
    )
    values (
      p_ticket_id,
      upper(btrim(v_payment.method)),
      v_payment.amount_centavos,
      nullif(btrim(coalesce(v_payment.reference_no, '')), ''),
      v_actor,
      nullif(btrim(coalesce(v_payment.note, '')), '')
    );
  end loop;

  select * into v_shop from public.shop_settings where id = 1;

  v_receipt_no := private.next_receipt_no();

  select jsonb_build_object(
    'shop', jsonb_build_object(
      'name', v_shop.shop_name,
      'address', v_shop.address,
      'contact', v_shop.contact,
      'footer', v_shop.receipt_footer
    ),
    'ticket', jsonb_build_object(
      'no', v_ticket.ticket_no,
      'type', v_ticket.type,
      'customer_name', coalesce(v_ticket.customer_name, ''),
      'bike_model', coalesce(v_ticket.bike_model, ''),
      'created_at', v_ticket.created_at
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', i.part_name_at_time,
            'qty', i.qty,
            'unit_price_centavos', i.unit_price_at_time_centavos,
            'line_total_centavos', i.line_total_centavos
          )
          order by i.created_at, i.id
        )
        from public.ticket_items i
        where i.ticket_id = p_ticket_id
      ),
      '[]'::jsonb
    ),
    'labor', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'description', l.description,
            'amount_centavos', l.amount_centavos
          )
          order by l.created_at, l.id
        )
        from public.ticket_labor l
        where l.ticket_id = p_ticket_id
      ),
      '[]'::jsonb
    ),
    'totals', jsonb_build_object(
      'parts_centavos', v_ticket.parts_total_centavos,
      'labor_centavos', v_ticket.labor_total_centavos,
      'total_centavos', v_ticket.total_centavos
    ),
    'payments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'method', pay.method,
            'amount_centavos', pay.amount_centavos,
            'received_by', pr.display_name
          )
          order by pay.received_at, pay.id
        )
        from public.ticket_payments pay
        join public.profiles pr on pr.id = pay.received_by
        where pay.ticket_id = p_ticket_id
      ),
      '[]'::jsonb
    ),
    'receipt_no', v_receipt_no,
    'issued_at', v_issued_at
  )
  into v_snapshot;

  v_hash := private.receipt_hmac(
    v_receipt_no,
    v_issued_at,
    v_ticket.total_centavos,
    v_snapshot
  );

  insert into public.receipts (
    receipt_no,
    ticket_id,
    status,
    issued_at,
    issued_by,
    snapshot,
    total_centavos,
    verification_hash,
    verification_code,
    public_token
  )
  values (
    v_receipt_no,
    p_ticket_id,
    'ISSUED',
    v_issued_at,
    v_actor,
    v_snapshot,
    v_ticket.total_centavos,
    v_hash,
    private.receipt_code(v_hash),
    encode(extensions.gen_random_bytes(16), 'hex')
  )
  returning * into v_receipt;

  -- Lock parts in a deterministic order, deduct stock, and write the ledger.
  for v_item in
    select part_id, qty
    from public.ticket_items
    where ticket_id = p_ticket_id
    order by part_id
  loop
    select * into v_part from public.parts where id = v_item.part_id for update;

    if not found then
      raise exception 'PART_NOT_FOUND';
    end if;

    if v_part.stock_on_hand < v_item.qty or v_part.reserved_qty < v_item.qty then
      raise exception 'INSUFFICIENT_STOCK'
        using detail = jsonb_build_object(
          'part_id', v_part.id,
          'part_name', v_part.name,
          'available', v_part.available_qty
        )::text;
    end if;

    update public.parts
    set
      stock_on_hand = stock_on_hand - v_item.qty,
      reserved_qty = reserved_qty - v_item.qty,
      updated_by = v_actor,
      updated_at = now()
    where id = v_item.part_id;

    insert into public.stock_movements (
      part_id, delta, reason, ticket_id, receipt_id, actor_id
    )
    values (
      v_item.part_id, -v_item.qty, 'SALE', p_ticket_id, v_receipt.id, v_actor
    );
  end loop;

  update public.tickets
  set status = 'COMPLETED', completed_at = v_issued_at, updated_at = now()
  where id = p_ticket_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (
    v_actor,
    'ticket.completed',
    'ticket',
    p_ticket_id,
    jsonb_build_object(
      'status', 'COMPLETED',
      'receipt_no', v_receipt_no,
      'total_centavos', v_ticket.total_centavos
    )
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "after")
  values (
    v_actor,
    'receipt.issued',
    'receipt',
    v_receipt.id,
    jsonb_build_object('receipt_no', v_receipt_no, 'total_centavos', v_ticket.total_centavos)
  );

  return v_receipt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancellation
-- ---------------------------------------------------------------------------

create or replace function public.cancel_ticket(
  p_ticket_id uuid,
  p_reason text
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_ticket public.tickets;
  v_after public.tickets;
  v_paid integer;
  v_item record;
  v_method record;
begin
  perform private.require_staff();

  if char_length(v_reason) not between 1 and 500 then
    raise exception 'INVALID_REASON';
  end if;

  v_ticket := private.lock_open_ticket(p_ticket_id);

  select coalesce(sum(amount_centavos), 0)::integer
  into v_paid
  from public.ticket_payments
  where ticket_id = p_ticket_id;

  if v_paid <> 0 and not private.is_owner() then
    raise exception 'FORBIDDEN';
  end if;

  for v_item in
    select part_id, qty
    from public.ticket_items
    where ticket_id = p_ticket_id
    order by part_id
  loop
    perform 1 from public.parts where id = v_item.part_id for update;

    update public.parts
    set reserved_qty = reserved_qty - v_item.qty, updated_at = now()
    where id = v_item.part_id;
  end loop;

  if v_paid > 0 then
    for v_method in
      select method, sum(amount_centavos)::integer as amount
      from public.ticket_payments
      where ticket_id = p_ticket_id and amount_centavos > 0
      group by method
      order by method
    loop
      insert into public.ticket_payments (
        ticket_id, method, amount_centavos, reference_no, received_by, note
      )
      values (
        p_ticket_id,
        v_method.method,
        -v_method.amount,
        'CANCELLED',
        v_actor,
        v_reason
      );
    end loop;
  end if;

  update public.tickets
  set status = 'CANCELLED', cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
  where id = p_ticket_id
  returning * into v_after;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'ticket.cancelled',
    'ticket',
    p_ticket_id,
    jsonb_build_object('status', v_ticket.status),
    jsonb_build_object('status', 'CANCELLED', 'reason', v_reason)
  );

  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Void sale
-- ---------------------------------------------------------------------------

create or replace function public.void_sale(
  p_receipt_id uuid,
  p_reason text,
  p_refund_method text
)
returns public.receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_method text := upper(btrim(coalesce(p_refund_method, 'CASH')));
  v_receipt public.receipts;
  v_after public.receipts;
  v_ticket public.tickets;
  v_item record;
  v_paid integer;
begin
  perform private.require_owner();

  if char_length(v_reason) not between 1 and 500 then
    raise exception 'INVALID_REASON';
  end if;

  if v_method not in ('CASH', 'GCASH', 'MAYA', 'OTHER') then
    raise exception 'INVALID_METHOD';
  end if;

  select * into v_receipt from public.receipts where id = p_receipt_id for update;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;

  if v_receipt.status <> 'ISSUED' then
    raise exception 'RECEIPT_NOT_ISSUED';
  end if;

  select * into v_ticket from public.tickets where id = v_receipt.ticket_id for update;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.status <> 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED';
  end if;

  for v_item in
    select part_id, qty
    from public.ticket_items
    where ticket_id = v_ticket.id
    order by part_id
  loop
    perform 1 from public.parts where id = v_item.part_id for update;

    update public.parts
    set
      stock_on_hand = stock_on_hand + v_item.qty,
      updated_by = v_actor,
      updated_at = now()
    where id = v_item.part_id;

    insert into public.stock_movements (
      part_id, delta, reason, ticket_id, receipt_id, actor_id, note
    )
    values (
      v_item.part_id, v_item.qty, 'RETURN', v_ticket.id, v_receipt.id, v_actor, v_reason
    );
  end loop;

  select coalesce(sum(amount_centavos), 0)::integer
  into v_paid
  from public.ticket_payments
  where ticket_id = v_ticket.id;

  if v_paid <> 0 then
    insert into public.ticket_payments (
      ticket_id, method, amount_centavos, reference_no, received_by, note
    )
    values (v_ticket.id, v_method, -v_paid, 'VOID', v_actor, v_reason);
  end if;

  update public.receipts
  set status = 'VOID', voided_at = now(), voided_by = v_actor, void_reason = v_reason
  where id = v_receipt.id
  returning * into v_after;

  update public.tickets
  set status = 'VOIDED', voided_at = now(), void_reason = v_reason, updated_at = now()
  where id = v_ticket.id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'receipt.voided',
    'receipt',
    v_receipt.id,
    jsonb_build_object('status', 'ISSUED'),
    jsonb_build_object('status', 'VOID', 'reason', v_reason)
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, "before", "after")
  values (
    v_actor,
    'ticket.voided',
    'ticket',
    v_ticket.id,
    jsonb_build_object('status', 'COMPLETED'),
    jsonb_build_object('status', 'VOIDED', 'reason', v_reason)
  );

  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public receipt RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_receipt(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_receipt public.receipts;
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into v_receipt from public.receipts where public_token = v_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'receipt_no', v_receipt.receipt_no,
    'status', v_receipt.status,
    'issued_at', v_receipt.issued_at,
    'total_centavos', v_receipt.total_centavos,
    'verification_code', v_receipt.verification_code,
    'void_reason', v_receipt.void_reason,
    'snapshot', v_receipt.snapshot
  );
end;
$$;

create or replace function public.verify_receipt(
  p_receipt_no text,
  p_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receipt_no text := upper(btrim(coalesce(p_receipt_no, '')));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  v_receipt public.receipts;
  v_hash text;
  v_method text;
begin
  if char_length(v_code) <> 16 or v_receipt_no = '' then
    return jsonb_build_object('valid', false, 'status', 'NO_MATCH');
  end if;

  select * into v_receipt from public.receipts where receipt_no = v_receipt_no;

  if not found then
    return jsonb_build_object('valid', false, 'status', 'NO_MATCH');
  end if;

  v_hash := private.receipt_hmac(
    v_receipt.receipt_no,
    v_receipt.issued_at,
    v_receipt.total_centavos,
    v_receipt.snapshot
  );

  if upper(left(v_hash, 16)) <> v_code then
    return jsonb_build_object('valid', false, 'status', 'NO_MATCH');
  end if;

  select string_agg(distinct method, ', ' order by method)
  into v_method
  from public.ticket_payments
  where ticket_id = v_receipt.ticket_id;

  return jsonb_build_object(
    'valid', true,
    'status', v_receipt.status,
    'receipt_no', v_receipt.receipt_no,
    'issued_at', v_receipt.issued_at,
    'total_centavos', v_receipt.total_centavos,
    'payment_method', v_method,
    'void_reason', v_receipt.void_reason
  );
end;
$$;

create or replace function public.ping()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1;
$$;

revoke all on function public.record_payment(uuid, text, integer, text, text) from public;
revoke all on function public.complete_ticket(uuid, jsonb) from public;
revoke all on function public.cancel_ticket(uuid, text) from public;
revoke all on function public.void_sale(uuid, text, text) from public;
revoke all on function public.get_receipt(text) from public;
revoke all on function public.verify_receipt(text, text) from public;
revoke all on function public.ping() from public;

grant execute on function public.record_payment(uuid, text, integer, text, text) to authenticated;
grant execute on function public.complete_ticket(uuid, jsonb) to authenticated;
grant execute on function public.cancel_ticket(uuid, text) to authenticated;
grant execute on function public.void_sale(uuid, text, text) to authenticated;
grant execute on function public.get_receipt(text) to anon, authenticated;
grant execute on function public.verify_receipt(text, text) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
