-- Run once in Supabase SQL Editor to enable accurate last-saved timestamps.
alter table public.employees
  add column if not exists updated_at timestamptz not null default now();
alter table public.attendance
  add column if not exists updated_at timestamptz not null default now();
alter table public.production_entries
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

drop trigger if exists production_entries_set_updated_at on public.production_entries;
create trigger production_entries_set_updated_at
before update on public.production_entries
for each row execute function public.set_updated_at();
