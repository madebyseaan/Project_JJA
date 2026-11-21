-- Step 07: owner-only receipt integrity report.
-- Recomputes every receipt HMAC and finds gaps against the private counter.

create or replace function public.get_receipt_integrity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mismatches jsonb;
  v_missing jsonb;
  v_voided jsonb;
  v_receipt_count integer;
begin
  perform private.require_owner();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'receipt_no', r.receipt_no,
        'issued_at', r.issued_at,
        'total_centavos', r.total_centavos,
        'stored_hash', r.verification_hash,
        'computed_hash', private.receipt_hmac(
          r.receipt_no,
          r.issued_at,
          r.total_centavos,
          r.snapshot
        )
      )
      order by r.issued_at
    ),
    '[]'::jsonb
  )
  into v_mismatches
  from public.receipts r
  where private.receipt_hmac(r.receipt_no, r.issued_at, r.total_centavos, r.snapshot)
    <> r.verification_hash;

  with expected as (
    select
      c.day,
      n as seq,
      to_char(c.day, 'YYYYMMDD') || '-' || lpad(n::text, 4, '0') as receipt_no
    from private.receipt_counters c
    cross join lateral generate_series(1, c.next_no - 1) as n
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('business_date', e.day, 'receipt_no', e.receipt_no)
      order by e.day, e.seq
    ),
    '[]'::jsonb
  )
  into v_missing
  from expected e
  where not exists (
    select 1 from public.receipts r where r.receipt_no = e.receipt_no
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'receipt_no', r.receipt_no,
        'issued_at', r.issued_at,
        'voided_at', r.voided_at,
        'total_centavos', r.total_centavos,
        'void_reason', r.void_reason
      )
      order by r.voided_at desc
    ),
    '[]'::jsonb
  )
  into v_voided
  from public.receipts r
  where r.status = 'VOID';

  select count(*)::integer into v_receipt_count from public.receipts;

  return jsonb_build_object(
    'checked_at', now(),
    'receipt_count', v_receipt_count,
    'mismatches', v_mismatches,
    'missing_numbers', v_missing,
    'voided', v_voided
  );
end;
$$;

revoke all on function public.get_receipt_integrity() from public;
grant execute on function public.get_receipt_integrity() to authenticated;
