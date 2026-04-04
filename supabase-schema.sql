-- Run in Supabase SQL Editor

-- 1. Vehicles table (permanent fleet)
create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  company text not null,
  name text not null,
  vehicle_type text not null default 'ריקון',
  division text,
  note text,
  is_available boolean default true,
  created_at timestamptz default now()
);
alter table vehicles enable row level security;
create policy "Allow all vehicles" on vehicles for all using (true);
grant all on vehicles to anon;
grant all on vehicles to authenticated;

-- 2. Personnel table
create table if not exists personnel (
  id uuid primary key default uuid_generate_v4(),
  company text not null,
  name text not null,
  role text not null default 'מחלץ',
  phone text,
  training_level text,
  vehicle_id uuid references vehicles(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table personnel enable row level security;
create policy "Allow all personnel" on personnel for all using (true);
grant all on personnel to anon;
grant all on personnel to authenticated;

-- 3. Event vehicles (assigned to specific incident)
create table if not exists event_vehicles (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references reports(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  vehicle_name text not null,
  company text,
  status text default 'בדרך',
  assigned_at timestamptz default now(),
  notes text
);
alter table event_vehicles enable row level security;
create policy "Allow all event_vehicles" on event_vehicles for all using (true);
grant all on event_vehicles to anon;
grant all on event_vehicles to authenticated;

-- Enable realtime
alter publication supabase_realtime add table vehicles;
alter publication supabase_realtime add table personnel;
alter publication supabase_realtime add table event_vehicles;

-- Ensure existing columns
alter table reports add column if not exists assigned_company text;
alter table reports add column if not exists close_reason text;
alter table reports add column if not exists shift_id uuid;
alter table reports add column if not exists merged_with uuid[];
alter table reports add column if not exists is_merged boolean default false;
alter table event_log add column if not exists reported_by_role text;
alter table event_log add column if not exists diary_date date;
