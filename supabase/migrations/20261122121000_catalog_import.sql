-- Catalog import from a QuickBooks Item List export.
-- No stock quantities are imported.

create or replace function public.import_catalog_items(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item record;
  v_id uuid;
  v_name text;
  v_description text;
  v_sku text;
  v_type text;
  v_income text;
  v_cogs text;
  v_asset text;
  v_vendor text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  perform private.require_staff();

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as x(
        name text,
        description text,
        sku text,
        base_price_centavos integer,
        item_type text,
        income_account text,
        cogs_account text,
        asset_account text,
        preferred_vendor text,
        is_active boolean
      )
  loop
    v_name := btrim(coalesce(v_item.name, ''));

    if char_length(v_name) not between 1 and 120 then
      raise exception 'INVALID_NAME';
    end if;

    if v_item.base_price_centavos is null or v_item.base_price_centavos < 0 then
      raise exception 'INVALID_PRICE';
    end if;

    v_description := btrim(coalesce(v_item.description, ''));
    v_sku := nullif(btrim(coalesce(v_item.sku, '')), '');
    v_type := btrim(coalesce(nullif(v_item.item_type, ''), 'INVENTORY_PART'));
    v_income := btrim(coalesce(v_item.income_account, ''));
    v_cogs := btrim(coalesce(v_item.cogs_account, ''));
    v_asset := btrim(coalesce(v_item.asset_account, ''));
    v_vendor := btrim(coalesce(v_item.preferred_vendor, ''));

    if char_length(v_description) > 300 then
      raise exception 'INVALID_DESCRIPTION';
    end if;

    if v_sku is not null and char_length(v_sku) > 60 then
      raise exception 'INVALID_SKU';
    end if;

    if char_length(v_type) > 40
      or char_length(v_income) > 120
      or char_length(v_cogs) > 120
      or char_length(v_asset) > 120
      or char_length(v_vendor) > 120 then
      raise exception 'INVALID_ITEM_FIELD';
    end if;

    select id into v_id
    from public.catalog_items
    where lower(name) = lower(v_name)
    for update;

    if found then
      update public.catalog_items
      set
        description = v_description,
        sku = v_sku,
        base_price_centavos = v_item.base_price_centavos,
        item_type = v_type,
        income_account = v_income,
        cogs_account = v_cogs,
        asset_account = v_asset,
        preferred_vendor = v_vendor,
        is_active = coalesce(v_item.is_active, true),
        source = 'quickbooks',
        imported_at = now(),
        updated_at = now()
      where id = v_id;

      v_updated := v_updated + 1;
    else
      insert into public.catalog_items (
        name,
        description,
        sku,
        base_price_centavos,
        item_type,
        income_account,
        cogs_account,
        asset_account,
        preferred_vendor,
        is_active,
        source
      )
      values (
        v_name,
        v_description,
        v_sku,
        v_item.base_price_centavos,
        v_type,
        v_income,
        v_cogs,
        v_asset,
        v_vendor,
        coalesce(v_item.is_active, true),
        'quickbooks'
      );

      v_inserted := v_inserted + 1;
    end if;
  end loop;

  insert into public.audit_events (actor_id, action, entity_type, "after")
  values (
    v_actor,
    'catalog.imported',
    'catalog',
    jsonb_build_object(
      'inserted', v_inserted,
      'updated', v_updated,
      'skipped', v_skipped
    )
  );

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.import_catalog_items(jsonb) from public;
revoke all on function public.import_catalog_items(jsonb) from anon;
grant execute on function public.import_catalog_items(jsonb) to authenticated;
