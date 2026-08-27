-- ScoreSense user-uploaded pieces: metadata table + private Storage bucket, replacing
-- the old client-only IndexedDB store so the 25-piece-per-account cap (MAX_UPLOADS_PER_USER
-- in lib/uploads/constants.ts — kept in sync with the trigger below by hand, since SQL can't
-- import a TS constant) is a real, server-enforced limit rather than a per-browser one.
-- Safe to re-run: every statement is idempotent.

-- 1. piece_uploads table ---------------------------------------------------------------
create table if not exists public.piece_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  extension text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

comment on table public.piece_uploads is
  'Metadata for user-uploaded MIDI/MusicXML files. Actual bytes live in the private
   "piece-uploads" Storage bucket at storage_path (convention: "<user_id>/<id><extension>").
   Capped at 25 rows per user by piece_uploads_enforce_cap below.';

create index if not exists piece_uploads_user_id_idx on public.piece_uploads (user_id);

-- 2. Row Level Security ---------------------------------------------------------------
alter table public.piece_uploads enable row level security;

drop policy if exists "Users can view own uploads" on public.piece_uploads;
create policy "Users can view own uploads"
  on public.piece_uploads
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own uploads" on public.piece_uploads;
create policy "Users can insert own uploads"
  on public.piece_uploads
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own uploads" on public.piece_uploads;
create policy "Users can delete own uploads"
  on public.piece_uploads
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- No update policy: uploads are immutable once created — replace by deleting and
-- re-uploading rather than editing a row in place.

grant select, insert, delete on public.piece_uploads to authenticated;

-- 3. hard cap: 25 uploads per user, enforced in the database regardless of what the
--    application layer checks first (defense in depth against races / bypass) ----------
create or replace function public.piece_uploads_enforce_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.piece_uploads where user_id = new.user_id) >= 25 then
    raise exception 'upload_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists piece_uploads_cap on public.piece_uploads;
create trigger piece_uploads_cap
  before insert on public.piece_uploads
  for each row
  execute function public.piece_uploads_enforce_cap();

-- 4. Storage bucket + policies ----------------------------------------------------------
-- If your Supabase plan/role can't insert into storage.buckets from the SQL editor,
-- create a private bucket named "piece-uploads" by hand via Dashboard -> Storage
-- instead, then run just the policy statements below.
insert into storage.buckets (id, name, public)
values ('piece-uploads', 'piece-uploads', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own upload objects" on storage.objects;
create policy "Users manage own upload objects"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'piece-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'piece-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
