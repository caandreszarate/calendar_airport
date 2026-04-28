create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 0 and 11),
  status text not null default 'draft',
  ram_days integer[] not null default '{}',
  pe_days integer[] not null default '{}',
  morning_shift text[] not null default '{}',
  night_shift text[] not null default '{}',
  ram_rotation jsonb not null default '{}'::jsonb,
  last_ram_input jsonb not null default '{}'::jsonb,
  last_ram_result jsonb not null default '{}'::jsonb,
  grid jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table if not exists public.schedule_change_logs (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 0 and 11),
  technician text not null,
  day integer not null,
  previous_assignment text,
  new_assignment text,
  changed_by text,
  changed_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values (
  'ram_continuity',
  '{
    "2026-3": {
      "morning": "Teodora",
      "night": "Vicente"
    }
  }'::jsonb
)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
alter table public.calendars enable row level security;
alter table public.schedule_change_logs enable row level security;

drop policy if exists "Allow shared app settings access" on public.app_settings;
create policy "Allow shared app settings access"
on public.app_settings
for all
using (true)
with check (true);

drop policy if exists "Allow shared calendars access" on public.calendars;
create policy "Allow shared calendars access"
on public.calendars
for all
using (true)
with check (true);

drop policy if exists "Allow shared schedule change logs access" on public.schedule_change_logs;
create policy "Allow shared schedule change logs access"
on public.schedule_change_logs
for all
using (true)
with check (true);
