-- Staff accounts and fast booking mode for Ratan Medical Hall.
-- Apply this migration in Supabase SQL Editor before using Staff Members.

create table if not exists public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_memberships_owner_not_member check (owner_id <> member_user_id)
);

create index if not exists staff_memberships_owner_created_idx
  on public.staff_memberships(owner_id, created_at desc);
create index if not exists staff_memberships_owner_active_idx
  on public.staff_memberships(owner_id, is_active);
create unique index if not exists staff_memberships_owner_email_uniq
  on public.staff_memberships(owner_id, lower(email));

alter table public.bookings
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

alter table public.staff_memberships enable row level security;
revoke all on table public.staff_memberships from anon, authenticated;
grant select on table public.staff_memberships to authenticated;
grant all on table public.staff_memberships to service_role;

drop policy if exists staff_memberships_select on public.staff_memberships;
create policy staff_memberships_select
  on public.staff_memberships
  for select to authenticated
  using (owner_id = auth.uid() or member_user_id = auth.uid());

-- Staff can see only bookings they created, not the owner's historical register.
drop policy if exists staff_read_own_bookings on public.bookings;
create policy staff_read_own_bookings
  on public.bookings for select to authenticated
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.staff_memberships m
      where m.member_user_id = auth.uid()
        and m.owner_id = bookings.owner_id
        and m.is_active
    )
  );

drop policy if exists staff_read_own_booking_items on public.booking_items;
create policy staff_read_own_booking_items
  on public.booking_items for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.staff_memberships m
        on m.owner_id = b.owner_id
       and m.member_user_id = auth.uid()
       and m.is_active
      where b.id = booking_items.booking_id
        and b.owner_id = booking_items.owner_id
        and b.created_by = auth.uid()
    )
  );

-- This RPC is the only way a staff account can create shop-owned bookings.
-- It always attributes the booking to the authenticated staff member and saves
-- the data under the shop owner's ID, preserving the existing owner-scoped model.
create or replace function public.create_staff_booking(
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_advance numeric,
  p_advance_method text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_staff_name text;
  v_booking_id uuid;
  v_code text;
  v_item jsonb;
  v_item_count integer := 0;
  v_advance numeric := coalesce(p_advance, 0);
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select m.owner_id, m.display_name into v_owner, v_staff_name
  from public.staff_memberships m
  where m.member_user_id = v_actor and m.is_active
  limit 1;

  if v_owner is null then
    raise exception 'Active staff membership is required to create a staff booking';
  end if;

  if length(trim(coalesce(p_customer_phone, ''))) < 10 then
    raise exception 'A valid customer phone number is required';
  end if;
  if v_advance < 0 or v_advance > 10000000 or (v_advance > 0 and round(v_advance, 2) = 0) then
    raise exception 'Advance must be ₹0 or at least ₹0.01 and no more than ₹10,000,000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Add at least one medicine';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Add between 1 and 20 medicine lines';
  end if;

  v_code := 'RMH-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') ||
    '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings(
    owner_id, booking_code, customer_name, customer_phone, notes,
    status, created_by
  ) values (
    v_owner, v_code, nullif(trim(p_customer_name), ''),
    trim(p_customer_phone), nullif(trim(p_notes), ''),
    'Awaiting Stock', v_actor
  ) returning id into v_booking_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if nullif(trim(v_item->>'product_name'), '') is null then
      raise exception 'Each medicine needs a product name';
    end if;
    if coalesce((v_item->>'requested_quantity')::numeric, 0) <= 0
      or coalesce((v_item->>'requested_quantity')::numeric, 0) > 100000 then
      raise exception 'Each medicine needs a quantity greater than zero';
    end if;

    insert into public.booking_items(
      owner_id, booking_id, product_name, strength, brand, pack_size,
      requested_quantity, unit_label
    ) values (
      v_owner, v_booking_id,
      trim(v_item->>'product_name'),
      nullif(trim(v_item->>'strength'), ''),
      nullif(trim(v_item->>'brand'), ''),
      nullif(trim(v_item->>'pack_size'), ''),
      (v_item->>'requested_quantity')::numeric,
      coalesce(nullif(trim(v_item->>'unit_label'), ''), 'packs')
    );
    v_item_count := v_item_count + 1;
  end loop;

  if v_advance > 0 then
    insert into public.payments(
      owner_id, booking_id, payment_type, amount, method, note, recorded_by
    ) values (
      v_owner, v_booking_id, 'advance', round(v_advance, 2),
      coalesce(nullif(trim(p_advance_method), ''), 'Cash'),
      'Advance received at staff booking', v_actor
    );
  end if;

  insert into public.booking_events(
    owner_id, booking_id, event_type, summary, payload, actor_user_id
  ) values (
    v_owner, v_booking_id, 'booking_created',
    'Staff ' || coalesce(v_staff_name, 'member') || ' created a booking with ' || v_item_count || ' medicine item(s)',
    jsonb_build_object('advance_received', round(v_advance, 2), 'created_by_staff', true, 'created_by_name', v_staff_name),
    v_actor
  );

  return jsonb_build_object('id', v_booking_id, 'booking_code', v_code);
end;
$$;

revoke all on function public.create_staff_booking(text, text, text, numeric, text, jsonb) from public;
grant execute on function public.create_staff_booking(text, text, text, numeric, text, jsonb) to authenticated;
