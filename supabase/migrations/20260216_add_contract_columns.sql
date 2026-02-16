alter table "Client" add column if not exists "contract_end_date" timestamp with time zone;
alter table "Client" add column if not exists "billing_day" integer;
alter table "Client" add column if not exists "service_details" text;
