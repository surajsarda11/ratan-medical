create or replace function public.delete_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and owner_id = v_owner
  for update;

  if not found then
    raise exception 'Booking not found or not owned by current user';
  end if;

  -- Remove restrictive references first, within one transaction.
  delete from public.refund_allocations ra
  where ra.owner_id = v_owner
    and (
      ra.payment_id in (select p.id from public.payments p where p.booking_id = p_booking_id and p.owner_id = v_owner)
      or ra.settlement_id in (select s.id from public.settlements s where s.booking_id = p_booking_id and s.owner_id = v_owner)
    );

  delete from public.settlement_payment_allocations spa
  where spa.owner_id = v_owner
    and (
      spa.payment_id in (select p.id from public.payments p where p.booking_id = p_booking_id and p.owner_id = v_owner)
      or spa.settlement_id in (select s.id from public.settlements s where s.booking_id = p_booking_id and s.owner_id = v_owner)
    );

  delete from public.receipt_allocations ra
  where ra.owner_id = v_owner
    and (
      ra.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id and bi.owner_id = v_owner)
      or ra.import_row_id in (select pir.id from public.purchase_import_rows pir where pir.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id and bi.owner_id = v_owner) and pir.owner_id = v_owner)
    );

  delete from public.purchase_import_rows pir
  where pir.owner_id = v_owner
    and pir.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id and bi.owner_id = v_owner);

  delete from public.bookings where id = p_booking_id and owner_id = v_owner;
end;
$$;

revoke all on function public.delete_booking(uuid) from public, anon;
grant execute on function public.delete_booking(uuid) to authenticated;
