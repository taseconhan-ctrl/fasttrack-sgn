-- Fast Track SGN - Supabase schema
-- Run this file in Supabase Dashboard > SQL Editor.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  agency text not null default '',
  flight text not null default '',
  guest_name text not null default '',
  service_time text not null default '',
  service_type text not null default '',
  order_id text not null default '',
  assigned_staff text not null default '',
  service_date date,
  status text not null default 'Chưa phân công'
    check (status in ('Chưa phân công','Đã phân công','Đang đón','Đã đón','Không gặp khách')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists bookings_service_date_idx on public.bookings(service_date);
create index if not exists bookings_service_type_idx on public.bookings(service_type);
create index if not exists bookings_assigned_staff_idx on public.bookings(assigned_staff);
create index if not exists bookings_order_id_idx on public.bookings(order_id);

create or replace function public.set_booking_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_audit_fields on public.bookings;
create trigger bookings_audit_fields
before insert or update on public.bookings
for each row execute function public.set_booking_audit_fields();

alter table public.bookings enable row level security;

drop policy if exists "Authenticated users can view bookings" on public.bookings;
drop policy if exists "Authenticated users can insert bookings" on public.bookings;
drop policy if exists "Authenticated users can update bookings" on public.bookings;
drop policy if exists "Authenticated users can delete bookings" on public.bookings;
drop policy if exists "Public access to bookings" on public.bookings;

-- Public mode: anyone holding the website URL can read and modify all bookings.
-- WARNING: this intentionally allows anonymous read/insert/update/delete access.
create policy "Public access to bookings"
on public.bookings for all to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.bookings to anon, authenticated;

-- Enable Supabase Realtime for this table (safe to run more than once).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
