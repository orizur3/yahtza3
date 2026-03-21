-- Run in Supabase SQL Editor

-- Ensure all columns exist
alter table reports add column if not exists assigned_company text;
alter table reports add column if not exists shift_id uuid;
alter table reports add column if not exists merged_with uuid[];
alter table reports add column if not exists is_merged boolean default false;
alter table reports add column if not exists priority text default 'רגיל';
alter table reports add column if not exists assigned_unit text;
alter table reports add column if not exists close_reason text;

-- Audit log table
create table if not exists report_audit (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references reports(id) on delete cascade,
  changed_by text default 'מערכת',
  changed_by_role text,
  field_name text,
  old_value text,
  new_value text,
  action text default 'update',
  created_at timestamptz default now()
);
alter table report_audit enable row level security;
create policy "Allow all audit" on report_audit for all using (true);
grant all on report_audit to anon;
grant all on report_audit to authenticated;

-- Event log additions
alter table event_log add column if not exists reported_by_role text;

-- Shifts table
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  date date default current_date,
  started_at timestamptz default now(),
  ended_at timestamptz,
  is_active boolean default true,
  created_by text default 'מפעיל',
  notes text
);
alter table shifts enable row level security;
create policy "Allow all shifts" on shifts for all using (true);
grant all on shifts to anon;
grant all on shifts to authenticated;

-- Comments
create table if not exists report_comments (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references reports(id) on delete cascade,
  content text not null,
  created_by text default 'מפעיל',
  created_at timestamptz default now()
);
alter table report_comments enable row level security;
create policy "Allow all comments" on report_comments for all using (true);
grant all on report_comments to anon;
grant all on report_comments to authenticated;

-- Event log
create table if not exists event_log (
  id uuid primary key default uuid_generate_v4(),
  entry_type text default 'manual',
  content text not null,
  created_by text default 'מפעיל',
  related_report_id uuid references reports(id) on delete set null,
  shift_id uuid references shifts(id) on delete set null,
  reported_by_role text,
  created_at timestamptz default now()
);
alter table event_log enable row level security;
create policy "Allow all logs" on event_log for all using (true);
grant all on event_log to anon;
grant all on event_log to authenticated;

-- Enable realtime
alter publication supabase_realtime add table shifts;
alter publication supabase_realtime add table report_comments;
alter publication supabase_realtime add table event_log;
alter publication supabase_realtime add table report_audit;

-- Fix statuses
update reports set status = 'חדש' where status = 'פתוח' or status is null;
update reports set status = 'הושלם' where status = 'סגור' or status = 'בטיפול' or status = 'הוקצה';
update reports set priority = 'רגיל' where priority is null;
update reports set is_merged = false where is_merged is null;
