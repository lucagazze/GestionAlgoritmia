-- Create Role Table
create table public."Role" (
  id uuid not null default gen_random_uuid (),
  department text not null,
  "roleName" text not null,
  description text null,
  tasks text null,
  "currentOwner" text null,
  "hiringTrigger" text null,
  priority text null,
  created_at timestamp with time zone not null default now(),
  constraint Role_pkey primary key (id)
);
