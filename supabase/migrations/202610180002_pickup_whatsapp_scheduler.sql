-- Customer contact preference, phone follow-up queue and scheduled WhatsApp pickup notifications.
-- Apply after 202610180001_initial_schema.sql.

alter table public.bookings
  add column if not exists customer_no_smartphone boolean not null default false,
  add column if not exists customer_whatsapp_opt_in boolean not null default false,
  add column if not exists phone_followup_completed_at timestamptz,
  add column if not exists ready_for_pickup_at timestamptz,
  add column if not exists pickup_whatsapp_attempted_at timestamptz,
  add column if not exists pickup_whatsapp_attempt_count integer not null default 0,
  add column if not exists pickup_whatsapp_sent_at timestamptz,
  add column if not exists pickup_whatsapp_message_id text,
  add column if not exists pickup_whatsapp_last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_contact_preference_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_contact_preference_check
      check (not customer_no_smartphone or not customer_whatsapp_opt_in);
  end if;
end $$;

create index if not exists bookings_pickup_whatsapp_due_idx
  on public.bookings(status, ready_for_pickup_at)
  where pickup_whatsapp_sent_at is null and customer_whatsapp_opt_in = true and customer_no_smartphone = false;

create index if not exists bookings_phone_followup_due_idx
  on public.bookings(status, created_at)
  where customer_no_smartphone = true and phone_followup_completed_at is null;

-- Status writes are already performed by validated database functions. Stamp the first moment
-- a booking reaches a pickup-ready state; the cron job only sends on a later IST calendar day.
create or replace function public.track_booking_pickup_ready_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('Ready for Pickup', 'Partially Collected')
     and old.status not in ('Ready for Pickup', 'Partially Collected') then
    new.ready_for_pickup_at := now();
    new.pickup_whatsapp_attempted_at := null;
    new.pickup_whatsapp_attempt_count := 0;
    new.pickup_whatsapp_sent_at := null;
    new.pickup_whatsapp_message_id := null;
    new.pickup_whatsapp_last_error := null;
    new.phone_followup_completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_track_pickup_ready_at on public.bookings;
create trigger bookings_track_pickup_ready_at
before update of status on public.bookings
for each row execute function public.track_booking_pickup_ready_at();

-- The app can update only customer contact preferences and the phone follow-up completion date.
-- Scheduling fields remain writable only by trusted database triggers / the server-side cron job.
grant update(customer_no_smartphone, customer_whatsapp_opt_in, phone_followup_completed_at)
  on public.bookings to authenticated;

