-- ScoreSense authentication foundation: application-level profile table for auth.users,
-- kept in sync automatically on signup, with Row Level Security enforced by Postgres
-- (not by application code). Safe to re-run: every statement is idempotent.

-- 1. profiles table -----------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level profile data for each auth.users row. Never stores passwords or auth secrets.';

create index if not exists profiles_email_idx on public.profiles (email);

-- 2. keep updated_at current ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- 3. auto-create a profile whenever a new auth.users row appears ---------------------
-- Runs as the function owner (security definer) so it can insert into public.profiles
-- regardless of the RLS policies below. Reads name/avatar from OAuth provider metadata
-- when present, but never fails signup if that metadata is missing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4. Row Level Security ---------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policies for regular users: profiles are created exclusively by the
-- handle_new_user trigger (security definer) and removed via the auth.users cascade.

-- 5. grants -----------------------------------------------------------------------------
-- RLS above is what actually enforces per-row access; these grants just allow the
-- authenticated/anon roles to reach the table at all (table-level, not row-level).
grant select, update on public.profiles to authenticated;
