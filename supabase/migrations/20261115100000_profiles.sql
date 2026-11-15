-- Step 01: staff profiles, role helpers, and the auth-user trigger.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_id text not null unique check (employee_id ~ '^[A-Z0-9-]{2,20}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  role text not null default 'mechanic' check (role in ('owner', 'mechanic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Staff identity for the shop app.';
comment on column public.profiles.employee_id is 'Staff login ID. The hidden auth email is derived from it.';
comment on column public.profiles.role is 'owner manages the shop; mechanic works the bay.';

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Role helpers used by RLS in this and later steps.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_owner() from public;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_owner() to authenticated;

create policy "staff can read profiles"
on public.profiles
for select
to authenticated
using (private.is_staff());

-- A new auth user gets a profile automatically.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, employee_id, display_name)
  values (
    new.id,
    upper(split_part(coalesce(new.email, ''), '@', 1)),
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(upper(split_part(coalesce(new.email, ''), '@', 1)), ''),
        'Staff'
      ),
      80
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Keep updated_at honest.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
