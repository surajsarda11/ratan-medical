-- Allow the authenticated shopkeeper to append booking activity events.
-- The existing owner_all RLS policy still requires owner_id = auth.uid().
-- Only columns written by application audit-event inserts are granted.
grant insert (owner_id, booking_id, event_type, summary, payload, actor_user_id)
on public.booking_events
to authenticated;
