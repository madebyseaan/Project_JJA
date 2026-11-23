-- Job / payment split: an order can be saved unpaid (OPEN) and paid later
-- (PAID). Sales reports and receipts use the payment date.

alter table public.sales_orders add column paid_on date;

alter table public.sales_orders drop constraint sales_orders_status_check;
alter table public.sales_orders add constraint sales_orders_status_check
  check (status in ('OPEN', 'PAID', 'EXPORTED'));

-- Existing orders came from the one-step flow, so every order with payments
-- is already paid. Backfill before adding the consistency checks.
update public.sales_orders o
set status = 'PAID', paid_on = o.business_date
where o.status = 'OPEN'
  and exists (select 1 from public.sales_payments p where p.order_id = o.id);

update public.sales_orders
set paid_on = business_date
where status in ('PAID', 'EXPORTED') and paid_on is null;

alter table public.sales_orders add constraint sales_orders_paid_state_check
  check (
    (status = 'OPEN' and paid_on is null)
    or (status in ('PAID', 'EXPORTED') and paid_on is not null)
  );

alter table public.sales_orders add constraint sales_orders_paid_on_check
  check (paid_on is null or paid_on >= business_date);

create index sales_orders_paid_on_idx on public.sales_orders (paid_on)
  where paid_on is not null;
create index sales_orders_status_idx on public.sales_orders (status);

-- Recreate the report views against paid_on. Output column names change, so
-- replace is not enough.
drop view public.v_sales_daily;
drop view public.v_sales_labor_daily;
drop view public.v_sales_payments_daily;

create view public.v_sales_daily
with (security_invoker = true)
as
select
  o.paid_on,
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
where o.paid_on is not null
group by o.paid_on;

create view public.v_sales_labor_daily
with (security_invoker = true)
as
select
  o.paid_on,
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
where o.paid_on is not null
group by o.paid_on, l.user_id, p.display_name;

create view public.v_sales_payments_daily
with (security_invoker = true)
as
select
  paid_on,
  method,
  sum(received_centavos)::integer as received_centavos,
  sum(change_centavos)::integer as change_centavos,
  (sum(received_centavos) - sum(change_centavos))::integer as net_centavos
from (
  select o.paid_on, p.method, p.amount_centavos as received_centavos, 0 as change_centavos
  from public.sales_payments p
  join public.sales_orders o on o.id = p.order_id
  where o.paid_on is not null
  union all
  select o.paid_on, c.method, 0 as received_centavos, c.amount_centavos as change_centavos
  from public.sales_changes c
  join public.sales_orders o on o.id = c.order_id
  where o.paid_on is not null
) x
group by paid_on, method;

revoke all on public.v_sales_daily from anon, authenticated;
revoke all on public.v_sales_labor_daily from anon, authenticated;
revoke all on public.v_sales_payments_daily from anon, authenticated;

grant select on public.v_sales_daily to authenticated;
grant select on public.v_sales_labor_daily to authenticated;
grant select on public.v_sales_payments_daily to authenticated;
