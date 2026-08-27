-- ScoreSense billing: tracks each user's Stripe customer + subscription status.
-- Written exclusively by server-side code (the checkout-session action and the
-- Stripe webhook handler, both using the service-role client) — regular users
-- can only read their own row. Safe to re-run: every statement is idempotent.

-- 1. subscriptions table --------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete'
    check (status in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'One row per Supabase user who has started or completed Stripe checkout. Written
   exclusively by the Stripe webhook handler (service role) and by the checkout-session
   server action when first creating the Stripe customer — never by direct user writes.';

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

-- 2. keep updated_at current (reuses the trigger function from 0001) -------------------
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

-- 3. Row Level Security ---------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policy for `authenticated`: all writes come from the
-- service-role client (webhook handler, checkout-session action), which bypasses
-- RLS entirely. Regular users can never modify their own billing status directly.

-- 4. grants -----------------------------------------------------------------------------
grant select on public.subscriptions to authenticated;
