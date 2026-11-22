-- GCash balances and transfers. Requires the sales log schema and order function.

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
  incoming as (
    select counterparty_user_id as user_id, sum(amount_centavos)::integer as amount
    from public.gcash_transfers
    where destination = 'USER'
    group by counterparty_user_id
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
        'labor_held_centavos',
          coalesce(a.labor_share, 0) + coalesce(i.amount, 0) - coalesce(t.labor_transfers, 0),
        'labor_earned_centavos', coalesce(e.amount, 0) + coalesce(x.amount, 0)
      )
      order by p.employee_id
    ),
    '[]'::jsonb
  )
  from public.profiles p
  left join allocations a on a.recipient_id = p.id
  left join transfers t on t.user_id = p.id
  left join incoming i on i.user_id = p.id
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
  v_shop_share integer;
  v_labor_share integer;
  v_shop_transferred integer;
  v_labor_out integer;
  v_labor_in integer;
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

  select
    coalesce(sum(shop_share_centavos), 0)::integer,
    coalesce(sum(labor_share_centavos), 0)::integer
  into v_shop_share, v_labor_share
  from public.sales_gcash_allocations
  where recipient_id = p_user_id;

  select
    coalesce(sum(case when destination = 'SHOP_BANK' then amount_centavos else 0 end), 0)::integer,
    coalesce(sum(case when destination = 'USER' then amount_centavos else 0 end), 0)::integer
  into v_shop_transferred, v_labor_out
  from public.gcash_transfers
  where user_id = p_user_id;

  select coalesce(sum(amount_centavos), 0)::integer
  into v_labor_in
  from public.gcash_transfers
  where destination = 'USER' and counterparty_user_id = p_user_id;

  if v_destination = 'SHOP_BANK'
    and p_amount_centavos > v_shop_share - v_shop_transferred then
    raise exception 'INSUFFICIENT_GCASH'
      using detail = jsonb_build_object(
        'held', v_shop_share - v_shop_transferred
      )::text;
  end if;

  if v_destination = 'USER'
    and p_amount_centavos > v_labor_share + v_labor_in - v_labor_out then
    raise exception 'INSUFFICIENT_GCASH'
      using detail = jsonb_build_object(
        'held', v_labor_share + v_labor_in - v_labor_out
      )::text;
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
