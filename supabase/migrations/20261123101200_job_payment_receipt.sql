-- Public receipts are only issued for paid orders. Requires the job/payment
-- schema migration.

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

  select * into v_order
  from public.sales_orders
  where public_token = v_token
    and status in ('PAID', 'EXPORTED');

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
    'paid_on', v_order.paid_on,
    'status', v_order.status,
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
    'extras_total_centavos', coalesce(
      (
        select sum(e.amount_centavos)::integer
        from public.sales_extras e
        where e.order_id = v_order.id
      ),
      0
    ),
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
    ),
    'changes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('method', c.method, 'amount_centavos', c.amount_centavos)
          order by c.created_at, c.id
        )
        from public.sales_changes c
        where c.order_id = v_order.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_sales_receipt(text) from public;
grant execute on function public.get_sales_receipt(text) to anon, authenticated;
