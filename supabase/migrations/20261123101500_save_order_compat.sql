-- Compatibility wrapper for the cached one-step frontend. It keeps the old
-- 12-argument call working during the deploy window. The old app always sent a
-- balanced payment, so paid_on defaults to the job date, matching its reports.
-- The new frontend calls the 13-argument version with p_paid_on directly.

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
begin
  return public.save_sales_order(
    p_order_id,
    p_business_date,
    p_customer_name,
    p_bike_model,
    p_main_user_id,
    p_helper_user_id,
    p_items,
    p_labor_total_centavos,
    p_helper_labor_centavos,
    p_extras,
    p_payments,
    p_changes,
    p_business_date
  );
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
