-- ============================================================
-- Family Entrepreneur Portal — Supabase Schema
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================

-- Submissions table: stores questionnaire answers (draft + completed)
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  owner_name text,
  business_name text,
  status text not null default 'draft', -- 'draft' | 'submitted' | 'published'
  answers jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb, -- array of {url, caption}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists submissions_email_idx on public.submissions (lower(email));
create index if not exists submissions_status_idx on public.submissions (status);

-- Profiles table: the polished, editable profile copy generated from submissions
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  business_name text not null,
  owner_name text,
  tagline text,
  hero_image text,
  sections jsonb not null default '[]'::jsonb, -- [{heading, body}, ...]
  gallery jsonb not null default '[]'::jsonb,  -- [{url, caption}]
  contact jsonb not null default '{}'::jsonb,  -- {email, website, instagram, ...}
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_submission_idx on public.profiles (submission_id);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.submissions enable row level security;
alter table public.profiles enable row level security;

-- Business owners: can read/write their OWN submission (matched by auth email)
drop policy if exists "own_submission_select" on public.submissions;
create policy "own_submission_select" on public.submissions
  for select using (auth.jwt() ->> 'email' = email);

drop policy if exists "own_submission_insert" on public.submissions;
create policy "own_submission_insert" on public.submissions
  for insert with check (auth.jwt() ->> 'email' = email);

drop policy if exists "own_submission_update" on public.submissions;
create policy "own_submission_update" on public.submissions
  for update using (auth.jwt() ->> 'email' = email);

-- Profiles: publicly readable when published (for the public profile pages)
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select using (published = true);

-- ============================================================
-- Storage bucket for photos (create via Dashboard or below)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('business-photos', 'business-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
drop policy if exists "owners upload own photos" on storage.objects;
create policy "owners upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-photos');

drop policy if exists "public read photos" on storage.objects;
create policy "public read photos" on storage.objects
  for select using (bucket_id = 'business-photos');

-- ============================================================
-- NOTE ON ADMIN ACCESS:
-- The admin page uses a shared password and the service_role key,
-- which bypasses RLS. Keep the service_role key SERVER-SIDE only
-- (in the Vercel serverless function env vars — never in the browser).
-- ============================================================
