-- Dashboard-V22: Supabase setup
-- Run this entire script in Supabase > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('present','absent')),
  check_in time,
  check_out time,
  total_hours numeric(7,2) not null default 0,
  overtime_hours numeric(7,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (department_id, employee_id, work_date)
);

create table if not exists public.production_entries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  orders_quantity integer not null default 0 check (orders_quantity >= 0),
  idc_quantity integer not null default 0 check (idc_quantity >= 0),
  rejection_quantity integer not null default 0 check (rejection_quantity >= 0),
  total_quantity integer not null default 0 check (total_quantity >= 0),
  percentage numeric(7,2) not null default 0 check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now(),
  unique (department_id, work_date)
);

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.production_entries enable row level security;

drop policy if exists "Department manages own employees" on public.employees;
create policy "Department manages own employees" on public.employees
for all to authenticated using (department_id = auth.uid()) with check (department_id = auth.uid());

drop policy if exists "Department manages own attendance" on public.attendance;
create policy "Department manages own attendance" on public.attendance
for all to authenticated using (department_id = auth.uid()) with check (department_id = auth.uid());

drop policy if exists "Department manages own production" on public.production_entries;
create policy "Department manages own production" on public.production_entries
for all to authenticated using (department_id = auth.uid()) with check (department_id = auth.uid());

create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists attendance_department_date_idx on public.attendance(department_id, work_date);
create index if not exists production_department_date_idx on public.production_entries(department_id, work_date desc);

-- Enable realtime updates for shared devices. Safe to run more than once.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employees') then
    alter publication supabase_realtime add table public.employees;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance') then
    alter publication supabase_realtime add table public.attendance;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_entries') then
    alter publication supabase_realtime add table public.production_entries;
  end if;
end $$;
