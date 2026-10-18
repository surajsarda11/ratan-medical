-- Track explicit permission before preparing customer WhatsApp messages.
-- Existing bookings remain NULL until consent is collected; do not assume past consent.
alter table public.bookings
  add column if not exists whatsapp_consent boolean,
  add column if not exists whatsapp_consent_updated_at timestamptz,
  add column if not exists whatsapp_consent_updated_by uuid references auth.users(id);

-- Atomic consent update and audit trail.
create or replace function public.set_booking_whatsapp_consent(
  p_booking_id uuid,
  p_agreed boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_agreed is null then raise exception 'Choose whether the customer agreed to WhatsApp messages'; end if;

  update public.bookings
  set whatsapp_consent = p_agreed,
      whatsapp_consent_updated_at = now(),
      whatsapp_consent_updated_by = v_owner,
      updated_at = now()
  where id = p_booking_id and owner_id = v_owner;

  if not found then raise exception 'Booking not found'; end if;

  insert into public.booking_events(owner_id, booking_id, event_type, summary, payload, actor_user_id)
  values (
    v_owner,
    p_booking_id,
    'whatsapp_consent_updated',
    case when p_agreed then 'Customer agreed to WhatsApp messages' else 'Customer did not agree to WhatsApp messages' end,
    jsonb_build_object('agreed', p_agreed, 'recorded_at', now()),
    v_owner
  );
end;
$$;

-- Create booking + consent as one database transaction.
create or replace function public.create_booking_with_consent(
  p_customer_name text,
  p_customer_phone text,
  p_expected_arrival_date date,
  p_notes text,
  p_prescription_verified boolean,
  p_advance numeric,
  p_advance_method text,
  p_items jsonb,
  p_whatsapp_consent boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_booking_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_whatsapp_consent is null then raise exception 'Choose whether the customer agreed to WhatsApp messages'; end if;

  v_booking_id := public.create_booking_with_items(
    p_customer_name,
    p_customer_phone,
    p_expected_arrival_date,
    p_notes,
    p_prescription_verified,
    p_advance,
    p_advance_method,
    p_items
  );

  update public.bookings
  set whatsapp_consent = p_whatsapp_consent,
      whatsapp_consent_updated_at = now(),
      whatsapp_consent_updated_by = v_owner,
      updated_at = now()
  where id = v_booking_id and owner_id = v_owner;

  if not found then raise exception 'Booking not found while saving WhatsApp consent'; end if;

  insert into public.booking_events(owner_id, booking_id, event_type, summary, payload, actor_user_id)
  values (
    v_owner,
    v_booking_id,
    'whatsapp_consent_recorded',
    case when p_whatsapp_consent then 'Customer agreed to WhatsApp messages' else 'Customer did not agree to WhatsApp messages' end,
    jsonb_build_object('agreed', p_whatsapp_consent, 'recorded_at', now()),
    v_owner
  );

  return v_booking_id;
end;
$$;

revoke all on function public.set_booking_whatsapp_consent(uuid, boolean) from public;
grant execute on function public.set_booking_whatsapp_consent(uuid, boolean) to authenticated;
revoke all on function public.create_booking_with_consent(text, text, date, text, boolean, numeric, text, jsonb, boolean) from public;
grant execute on function public.create_booking_with_consent(text, text, date, text, boolean, numeric, text, jsonb, boolean) to authenticated;
