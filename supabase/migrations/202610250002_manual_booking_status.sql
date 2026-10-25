-- Let the authenticated shopkeeper explicitly choose the booking status.
-- Stock and settlement workflows still validate their own transactions; this RPC only
-- updates the status label and records the manual decision in the booking timeline.
create or replace function public.set_booking_status_manual(p_booking_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_old_status text;
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in (
    'Awaiting Stock',
    'Partially Received',
    'Ready for Pickup',
    'Partially Collected',
    'Completed',
    'Cancelled',
    'Returned / Refunded'
  ) then
    raise exception 'Invalid booking status';
  end if;

  select status into v_old_status
  from public.bookings
  where id = p_booking_id and owner_id = v_owner
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  update public.bookings
  set status = p_status, updated_at = now()
  where id = p_booking_id and owner_id = v_owner;

  insert into public.booking_events(owner_id, booking_id, event_type, summary, payload, actor_user_id)
  values (
    v_owner,
    p_booking_id,
    'booking_status_manually_changed',
    'Shopkeeper manually changed status from ' || coalesce(v_old_status, 'Unknown') || ' to ' || p_status,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status, 'manual_override', true),
    v_owner
  );
end;
$$;

revoke all on function public.set_booking_status_manual(uuid, text) from public, anon;
grant execute on function public.set_booking_status_manual(uuid, text) to authenticated;
