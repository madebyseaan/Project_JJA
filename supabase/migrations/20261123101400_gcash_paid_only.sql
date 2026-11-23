-- Labor earned and extras only count when the order has been paid. Open jobs
-- carry labor rows for the report snapshot but are not a sale yet.

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
    select l.user_id, sum(l.amount_centavos)::integer as amount
    from public.sales_labor l
    join public.sales_orders o on o.id = l.order_id
    where o.paid_on is not null
    group by l.user_id
  ),
  extra_earned as (
    select x.user_id, sum(x.amount_centavos)::integer as amount
    from public.sales_extras x
    join public.sales_orders o on o.id = x.order_id
    where o.paid_on is not null
    group by x.user_id
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
