-- Ratan Medical Hall: owner-scoped pharmacy booking and settlement data.
-- Run this migration in Supabase SQL Editor or with `supabase db push`.
create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_code text not null,
  customer_name text,
  customer_phone text not null,
  status text not null default 'Awaiting Stock' check (status in ('Awaiting Stock','Partially Received','Ready for Pickup','Partially Collected','Completed','Cancelled','Returned / Refunded')),
  expected_arrival_date date,
  next_reminder_at timestamptz,
  last_contact_at timestamptz,
  last_whatsapp_draft_opened_at timestamptz,
  notes text,
  prescription_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, booking_code),
  unique(id, owner_id)
);
create index if not exists bookings_owner_created_idx on public.bookings(owner_id, created_at desc);
create index if not exists bookings_owner_status_idx on public.bookings(owner_id, status);
create index if not exists bookings_owner_phone_idx on public.bookings(owner_id, customer_phone);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  product_code text,
  product_name text not null,
  generic_name text,
  strength text,
  dosage_form text,
  brand text,
  pack_size text,
  requested_quantity numeric(12,3) not null check (requested_quantity > 0),
  received_quantity numeric(12,3) not null default 0 check (received_quantity >= 0),
  collected_quantity numeric(12,3) not null default 0 check (collected_quantity >= 0),
  unit_label text not null default 'packs',
  verified_mrp numeric(12,2),
  mrp_verified boolean not null default false,
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_items_booking_owner_fk foreign key (booking_id, owner_id) references public.bookings(id, owner_id) on delete cascade,
  unique(id, owner_id),
  constraint booking_items_qty_check check (collected_quantity <= received_quantity),
  constraint booking_items_verified_mrp_check check (not mrp_verified or (verified_mrp is not null and verified_mrp > 0))
);
create index if not exists booking_items_owner_name_idx on public.booking_items(owner_id, product_name);
create index if not exists booking_items_booking_idx on public.booking_items(booking_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  payment_type text not null check (payment_type in ('advance','additional','refund','adjustment')),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'Cash',
  note text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint payments_booking_owner_fk foreign key (booking_id, owner_id) references public.bookings(id, owner_id) on delete cascade,
  unique(id, owner_id)
);
create index if not exists payments_booking_idx on public.payments(booking_id, created_at);

create table if not exists public.purchase_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  file_name text not null,
  fingerprint text not null,
  status text not null default 'Draft' check (status in ('Draft','Partially Posted','Posted','Cancelled')),
  row_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique(id, owner_id)
);
create index if not exists purchase_imports_owner_created_idx on public.purchase_imports(owner_id, created_at desc);
-- Stops duplicate supplier invoice imports even when a request is retried concurrently.
create unique index if not exists purchase_imports_owner_fingerprint_uniq
  on public.purchase_imports(owner_id, fingerprint) where status <> 'Cancelled';
create unique index if not exists purchase_imports_owner_invoice_uniq
  on public.purchase_imports(owner_id, lower(coalesce(supplier_name,'')), lower(invoice_number), invoice_date)
  where invoice_number is not null and invoice_date is not null and status <> 'Cancelled';

create table if not exists public.purchase_import_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null,
  row_number integer not null,
  sku text,
  source_name text not null,
  generic_name text,
  strength text,
  dosage_form text,
  brand text,
  pack_size text,
  batch_number text,
  expiry_date date,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  free_quantity numeric(12,3) not null default 0 check (free_quantity >= 0),
  purchase_rate numeric(12,2),
  mrp numeric(12,2),
  booking_item_id uuid,
  allocated_quantity numeric(12,3) not null default 0 check (allocated_quantity >= 0),
  review_status text not null default 'Unmatched' check (review_status in ('Unmatched','Possible Match','Exact Match','Partially Allocated','Allocated','Ignored')),
  review_note text,
  created_at timestamptz not null default now(),
  constraint import_rows_import_owner_fk foreign key (import_id, owner_id) references public.purchase_imports(id, owner_id) on delete cascade,
  unique(id, owner_id),
  constraint import_rows_booking_item_owner_fk foreign key (booking_item_id, owner_id) references public.booking_items(id, owner_id),
  constraint import_rows_allocation_check check (allocated_quantity <= quantity + free_quantity)
);
create index if not exists purchase_rows_import_idx on public.purchase_import_rows(import_id, row_number);

create table if not exists public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  import_row_id uuid not null,
  booking_item_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  verified_mrp numeric(12,2),
  mrp_verified boolean not null default false,
  batch_number text,
  expiry_date date,
  allocated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint allocations_import_row_owner_fk foreign key (import_row_id, owner_id) references public.purchase_import_rows(id, owner_id),
  constraint allocations_booking_item_owner_fk foreign key (booking_item_id, owner_id) references public.booking_items(id, owner_id)
);
create index if not exists receipt_allocations_row_idx on public.receipt_allocations(import_row_id);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  gross_total numeric(12,2) not null,
  discount_total numeric(12,2) not null default 0,
  net_sale_value numeric(12,2) not null,
  advance_applied numeric(12,2) not null default 0,
  additional_payment numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  refund_due numeric(12,2) not null default 0,
  items_json jsonb not null default '[]'::jsonb,
  message_text text not null default '',
  customer_note text,
  status text not null check (status in ('Settled','Balance Due','Refund Due')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint settlements_booking_owner_fk foreign key (booking_id, owner_id) references public.bookings(id, owner_id) on delete cascade,
  unique(id, owner_id)
);
create index if not exists settlements_booking_idx on public.settlements(booking_id, created_at desc);

create table if not exists public.settlement_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  settlement_id uuid not null,
  payment_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint settlement_alloc_settlement_owner_fk foreign key (settlement_id, owner_id) references public.settlements(id, owner_id),
  constraint settlement_alloc_payment_owner_fk foreign key (payment_id, owner_id) references public.payments(id, owner_id)
);
create index if not exists settlement_allocations_payment_idx on public.settlement_payment_allocations(payment_id);

-- Explicitly records whether a customer refund clears a settlement refund due or returns an unused advance.
-- This prevents one refund payment from being counted against both sources.
create table if not exists public.refund_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null,
  settlement_id uuid,
  source_type text not null check (source_type in ('SettlementRefundDue','UnusedAdvance')),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint refund_alloc_payment_owner_fk foreign key (payment_id, owner_id) references public.payments(id, owner_id),
  constraint refund_alloc_settlement_owner_fk foreign key (settlement_id, owner_id) references public.settlements(id, owner_id),
  constraint refund_alloc_source_check check ((source_type='SettlementRefundDue' and settlement_id is not null) or (source_type='UnusedAdvance' and settlement_id is null))
);
create index if not exists refund_allocations_payment_idx on public.refund_allocations(payment_id);
create index if not exists refund_allocations_owner_source_idx on public.refund_allocations(owner_id, source_type);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  reason text not null,
  due_at timestamptz not null,
  status text not null default 'Pending' check (status in ('Pending','Snoozed','Done','Dismissed')),
  last_contact_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_booking_owner_fk foreign key (booking_id, owner_id) references public.bookings(id, owner_id) on delete cascade
);
create index if not exists reminders_due_idx on public.reminders(owner_id, status, due_at);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  event_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint booking_events_booking_owner_fk foreign key (booking_id, owner_id) references public.bookings(id, owner_id) on delete cascade
);
create index if not exists booking_events_timeline_idx on public.booking_events(booking_id, created_at desc);

create table if not exists public.shop_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  shop_name text not null default 'Ratan Medical Hall',
  shop_phone text,
  default_footer text not null default E'Regards,\nRatan Medical Hall',
  reminder_interval_days integer not null default 2 check (reminder_interval_days between 1 and 60),
  updated_at timestamptz not null default now()
);

-- RLS on every exposed table. Authenticated users can access only their own shop data.
do $$ declare t text; begin
  foreach t in array array['bookings','booking_items','payments','purchase_imports','purchase_import_rows','receipt_allocations','settlements','settlement_payment_allocations','refund_allocations','reminders','booking_events','shop_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- Atomic booking creation, with initial advance and audit event.
create or replace function public.create_booking_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_expected_arrival_date date,
  p_notes text,
  p_prescription_verified boolean,
  p_advance numeric,
  p_advance_method text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking_id uuid; v_code text; v_item jsonb; v_item_count int := 0;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_customer_phone,''))) < 10 then raise exception 'A valid customer phone number is required'; end if;
  if p_advance is null or p_advance < 0 or p_advance > 10000000 or (p_advance>0 and round(p_advance,2)=0) then raise exception 'Advance must be ₹0 or at least ₹0.01 and no more than ₹10,000,000'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one medicine'; end if;
  v_code := 'RMH-' || to_char(now() at time zone 'Asia/Kolkata','YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.bookings(owner_id, booking_code, customer_name, customer_phone, expected_arrival_date, notes, prescription_verified, status, next_reminder_at)
  values (v_owner, v_code, nullif(trim(p_customer_name),''), trim(p_customer_phone), p_expected_arrival_date, nullif(trim(p_notes),''), coalesce(p_prescription_verified,false), 'Awaiting Stock',
    case when p_expected_arrival_date is null then null else (p_expected_arrival_date::timestamp + interval '10 hours') at time zone 'Asia/Kolkata' end)
  returning id into v_booking_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if nullif(trim(v_item->>'product_name'),'') is null or coalesce((v_item->>'requested_quantity')::numeric,0) <= 0 then
      raise exception 'Each medicine needs a name and quantity greater than zero';
    end if;
    insert into public.booking_items(owner_id, booking_id, product_code, product_name, generic_name, strength, dosage_form, brand, pack_size, requested_quantity, unit_label)
    values (v_owner, v_booking_id, nullif(trim(v_item->>'product_code'),''), trim(v_item->>'product_name'), nullif(trim(v_item->>'generic_name'),''), nullif(trim(v_item->>'strength'),''), nullif(trim(v_item->>'dosage_form'),''), nullif(trim(v_item->>'brand'),''), nullif(trim(v_item->>'pack_size'),''), (v_item->>'requested_quantity')::numeric, coalesce(nullif(trim(v_item->>'unit_label'),''),'packs'));
    v_item_count := v_item_count + 1;
  end loop;
  if p_advance > 0 then
    insert into public.payments(owner_id, booking_id, payment_type, amount, method, note, recorded_by)
    values (v_owner, v_booking_id, 'advance', round(p_advance,2), coalesce(nullif(trim(p_advance_method),''),'Cash'), 'Advance received at booking', v_owner);
  end if;
  insert into public.booking_events(owner_id, booking_id, event_type, summary, payload, actor_user_id)
  values (v_owner, v_booking_id, 'booking_created', 'Booking created with ' || v_item_count || ' medicine item(s)', jsonb_build_object('advance_received',round(p_advance,2)), v_owner);
  if p_expected_arrival_date is not null then
    insert into public.reminders(owner_id, booking_id, reason, due_at)
    values (v_owner, v_booking_id, 'Check expected stock arrival', (p_expected_arrival_date::timestamp + interval '10 hours') at time zone 'Asia/Kolkata');
  end if;
  return v_booking_id;
end;
$$;

-- Allocate invoice units exactly once; the row quantity and requested booking quantity are both checked.
create or replace function public.allocate_invoice_receipt(
  p_row_id uuid, p_booking_item_id uuid, p_quantity numeric, p_verified_mrp numeric,
  p_mrp_verified boolean, p_batch_number text, p_expiry_date date
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_row public.purchase_import_rows%rowtype; v_item public.booking_items%rowtype; v_booking public.bookings%rowtype; v_remaining numeric; v_request_remaining numeric;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Allocation quantity must be greater than zero'; end if;
  if coalesce(p_mrp_verified,false) and (p_verified_mrp is null or p_verified_mrp <= 0) then raise exception 'A verified MRP must be a positive amount'; end if;
  select * into v_row from public.purchase_import_rows where id=p_row_id and owner_id=v_owner for update;
  if not found then raise exception 'Invoice row not found'; end if;
  select * into v_item from public.booking_items where id=p_booking_item_id and owner_id=v_owner;
  if not found then raise exception 'Booking medicine not found'; end if;
  select * into v_booking from public.bookings where id=v_item.booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status in ('Cancelled','Returned / Refunded','Completed') then raise exception 'Cannot receive stock against a cancelled, returned, or completed booking'; end if;
  -- Use the same booking-before-item lock order as settlement to avoid receipt/settlement deadlocks.
  select * into v_item from public.booking_items where id=p_booking_item_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking medicine not found'; end if;
  if v_row.review_status='Ignored' then raise exception 'This invoice row is marked Ignored. Change its review status before allocating stock'; end if;
  if coalesce(p_mrp_verified,false) and v_item.mrp_verified and v_item.received_quantity>0 and round(p_verified_mrp,2)<>v_item.verified_mrp then
    raise exception 'Verified MRP differs from the price already recorded for this medicine line. Create/review a separate line for the different pack price before allocating it';
  end if;
  v_remaining := v_row.quantity + v_row.free_quantity - v_row.allocated_quantity;
  v_request_remaining := v_item.requested_quantity - v_item.received_quantity;
  if p_quantity > v_remaining then raise exception 'That exceeds the invoice row quantity still available'; end if;
  if p_quantity > v_request_remaining then raise exception 'That exceeds the remaining quantity requested on this booking'; end if;
  update public.purchase_import_rows set booking_item_id=p_booking_item_id,
    allocated_quantity=allocated_quantity+p_quantity,
    review_status=case when allocated_quantity+p_quantity >= quantity+free_quantity then 'Allocated' else 'Partially Allocated' end,
    review_note=case when p_mrp_verified and p_verified_mrp is not null then 'Receipt approved; MRP verified' else 'Receipt approved; MRP still needs verification before settlement' end
  where id=p_row_id;
  insert into public.receipt_allocations(owner_id, import_row_id, booking_item_id, quantity, verified_mrp, mrp_verified, batch_number, expiry_date, allocated_by)
  values (v_owner, p_row_id, p_booking_item_id, p_quantity, case when p_mrp_verified then p_verified_mrp else null end, coalesce(p_mrp_verified,false), coalesce(nullif(trim(p_batch_number),''),v_row.batch_number), coalesce(p_expiry_date,v_row.expiry_date), v_owner);
  update public.booking_items set received_quantity=received_quantity+p_quantity,
    verified_mrp=case when p_mrp_verified and p_verified_mrp is not null then p_verified_mrp else verified_mrp end,
    mrp_verified=case when p_mrp_verified and p_verified_mrp is not null then true else mrp_verified end,
    updated_at=now()
  where id=p_booking_item_id;
  update public.bookings b set status=case
    when not exists (select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.received_quantity < i.requested_quantity) and exists (select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.collected_quantity > 0) then 'Partially Collected'
    when not exists (select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.received_quantity < i.requested_quantity) then 'Ready for Pickup'
    when exists (select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.received_quantity > 0) then 'Partially Received'
    else 'Awaiting Stock' end, updated_at=now()
  where b.id=v_item.booking_id and b.owner_id=v_owner and b.status not in ('Completed','Cancelled','Returned / Refunded');
  insert into public.booking_events(owner_id, booking_id, event_type, summary, payload, actor_user_id)
  values(v_owner, v_item.booking_id, 'stock_received', 'Approved receipt of '||p_quantity||' '||v_item.unit_label||' for '||v_item.product_name,
    jsonb_build_object('import_row_id',p_row_id,'quantity',p_quantity,'mrp_verified',coalesce(p_mrp_verified,false)),v_owner);
  update public.purchase_imports set status=case when not exists(select 1 from public.purchase_import_rows r where r.import_id=v_row.import_id and r.owner_id=v_owner and r.review_status not in ('Allocated','Ignored')) then 'Posted' else 'Partially Posted' end,
    posted_at=case when not exists(select 1 from public.purchase_import_rows r where r.import_id=v_row.import_id and r.owner_id=v_owner and r.review_status not in ('Allocated','Ignored')) then now() else posted_at end
  where id=v_row.import_id and owner_id=v_owner;
end;
$$;

-- Status changes are validated server-side; receipt and pickup statuses cannot be forged
-- through a direct table update. Only explicit cancellation/return actions are manual.
create or replace function public.set_booking_status(p_booking_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking public.bookings%rowtype; v_any_received boolean; v_all_received boolean; v_any_collected boolean; v_all_collected boolean;
  v_advance_paid numeric := 0; v_advance_applied numeric := 0; v_unused_advance_refunded numeric := 0;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Awaiting Stock','Partially Received','Ready for Pickup','Partially Collected','Completed','Cancelled','Returned / Refunded') then raise exception 'Invalid booking status'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status in ('Cancelled','Returned / Refunded') and p_status not in ('Cancelled','Returned / Refunded') then raise exception 'A cancelled or returned booking cannot be reactivated here'; end if;
  if v_booking.status='Completed' and p_status not in ('Completed','Returned / Refunded') then raise exception 'A completed booking cannot be moved to this status'; end if;
  select coalesce(bool_or(received_quantity>0),false), coalesce(bool_and(received_quantity>=requested_quantity),false),
         coalesce(bool_or(collected_quantity>0),false), coalesce(bool_and(collected_quantity>=requested_quantity),false)
    into v_any_received,v_all_received,v_any_collected,v_all_collected
  from public.booking_items where booking_id=p_booking_id and owner_id=v_owner;
  if p_status='Awaiting Stock' and v_any_received then raise exception 'This booking already has a receipt; use the receipt workflow to set its status'; end if;
  if p_status='Partially Received' and (not v_any_received or v_all_received or v_any_collected) then raise exception 'Partially Received does not match the current receipt and pickup quantities'; end if;
  if p_status='Ready for Pickup' and (not v_all_received or v_any_collected) then raise exception 'Ready for Pickup requires all requested stock received and no prior pickup'; end if;
  if p_status='Partially Collected' and (not v_any_collected or v_all_collected) then raise exception 'Partially Collected does not match the current pickup quantities'; end if;
  if p_status='Completed' and not v_all_collected then raise exception 'Completed requires every requested quantity to be collected'; end if;
  if p_status='Returned / Refunded' then
    if v_any_collected or exists(select 1 from public.settlements where booking_id=p_booking_id and owner_id=v_owner) then
      raise exception 'A picked-up sale cannot be marked returned/refunded without an audited sale-reversal workflow; this release only supports refunds of unused advances on uncollected bookings';
    end if;
    select coalesce(sum(amount),0) into v_advance_paid from public.payments where booking_id=p_booking_id and owner_id=v_owner and payment_type='advance';
    select coalesce(sum(advance_applied),0) into v_advance_applied from public.settlements where booking_id=p_booking_id and owner_id=v_owner;
    select coalesce(sum(ra.amount),0) into v_unused_advance_refunded
      from public.refund_allocations ra join public.payments p on p.id=ra.payment_id and p.owner_id=ra.owner_id
      where p.booking_id=p_booking_id and ra.owner_id=v_owner and ra.source_type='UnusedAdvance';
    if exists(select 1 from public.settlements where booking_id=p_booking_id and owner_id=v_owner and (balance_due>0 or refund_due>0))
      or v_advance_paid-v_advance_applied-v_unused_advance_refunded>0 then raise exception 'Resolve all outstanding balances and unused advances before marking returned/refunded'; end if;
  end if;
  update public.bookings set status=p_status,updated_at=now() where id=p_booking_id and owner_id=v_owner;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,actor_user_id)
    values(v_owner,p_booking_id,'status_changed','Booking status changed to '||p_status,v_owner);
end;
$$;

-- Manually verified pack MRP is recorded server-side and added to the booking timeline.
create or replace function public.verify_booking_item_mrp(p_booking_id uuid,p_item_id uuid,p_mrp numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_item public.booking_items%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_mrp is null or p_mrp<=0 or p_mrp>10000000 then raise exception 'Verified MRP must be greater than ₹0 and at most ₹10,000,000'; end if;
  perform 1 from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  select * into v_item from public.booking_items where id=p_item_id and booking_id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Medicine item not found'; end if;
  update public.booking_items set verified_mrp=round(p_mrp,2),mrp_verified=true,updated_at=now() where id=p_item_id and owner_id=v_owner;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,payload,actor_user_id)
    values(v_owner,p_booking_id,'mrp_verified','MRP verified for '||v_item.product_name||': ₹'||to_char(round(p_mrp,2),'FM999999990.00'),jsonb_build_object('item_id',p_item_id,'previous_mrp',v_item.verified_mrp,'verified_mrp',round(p_mrp,2)),v_owner);
end;
$$;

-- Record an additional advance outside a settlement without exposing direct INSERT on payments.
create or replace function public.record_advance_payment(p_booking_id uuid,p_amount numeric,p_method text,p_note text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking public.bookings%rowtype; v_payment_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_amount is null or round(p_amount,2)<=0 or p_amount>10000000 then raise exception 'Advance must be at least ₹0.01 and at most ₹10,000,000'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status in ('Cancelled','Returned / Refunded','Completed') then raise exception 'Cannot add an advance to a cancelled, returned, or completed booking'; end if;
  insert into public.payments(owner_id,booking_id,payment_type,amount,method,note,recorded_by)
    values(v_owner,p_booking_id,'advance',round(p_amount,2),coalesce(nullif(trim(p_method),''),'Cash'),nullif(trim(p_note),''),v_owner) returning id into v_payment_id;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,payload,actor_user_id)
    values(v_owner,p_booking_id,'payment_recorded','Advance of ₹'||to_char(round(p_amount,2),'FM999999990.00')||' recorded',jsonb_build_object('payment_id',v_payment_id,'amount',round(p_amount,2),'method',coalesce(nullif(trim(p_method),''),'Cash')),v_owner);
  return v_payment_id;
end;
$$;

-- Clean up a failed draft only when no invoice rows were saved; posted data cannot be deleted.
create or replace function public.cancel_empty_import_draft(p_import_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_import public.purchase_imports%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  select * into v_import from public.purchase_imports where id=p_import_id and owner_id=v_owner for update;
  if not found then raise exception 'Import draft not found'; end if;
  if exists(select 1 from public.purchase_import_rows where import_id=p_import_id and owner_id=v_owner) then raise exception 'This import contains rows and cannot be cancelled by the failed-upload cleanup'; end if;
  if v_import.status<>'Draft' then raise exception 'Only an empty draft can be cancelled'; end if;
  update public.purchase_imports set status='Cancelled' where id=p_import_id and owner_id=v_owner;
end;
$$;

-- Exact dashboard totals are computed in the database (not from a limited page of rows).
create or replace function public.get_dashboard_summary()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'total_bookings', (select count(*) from public.bookings b where b.owner_id=auth.uid()),
    'active_bookings', (select count(*) from public.bookings b where b.owner_id=auth.uid() and b.status not in ('Completed','Cancelled','Returned / Refunded')),
    'awaiting_stock', (select count(*) from public.bookings b where b.owner_id=auth.uid() and b.status='Awaiting Stock'),
    'partially_received', (select count(*) from public.bookings b where b.owner_id=auth.uid() and b.status='Partially Received'),
    'ready_for_pickup', (select count(*) from public.bookings b where b.owner_id=auth.uid() and b.status='Ready for Pickup'),
    'overdue_reminders', (select count(*) from public.reminders r where r.owner_id=auth.uid() and r.status in ('Pending','Snoozed') and r.due_at<now()),
    'advances_held', coalesce((
      select sum(greatest(coalesce(p.advance_total,0)-coalesce(s.applied_total,0)-coalesce(r.refunded_unused_advance,0),0))
      from public.bookings b
      left join (select booking_id, sum(amount) as advance_total
                 from public.payments where owner_id=auth.uid() and payment_type='advance' group by booking_id) p on p.booking_id=b.id
      left join (select booking_id,sum(advance_applied) as applied_total from public.settlements where owner_id=auth.uid() group by booking_id) s on s.booking_id=b.id
      left join (select pay.booking_id, sum(ra.amount) as refunded_unused_advance
                 from public.refund_allocations ra join public.payments pay on pay.id=ra.payment_id and pay.owner_id=ra.owner_id
                 where ra.owner_id=auth.uid() and ra.source_type='UnusedAdvance' group by pay.booking_id) r on r.booking_id=b.id
      where b.owner_id=auth.uid() and b.status not in ('Completed','Cancelled','Returned / Refunded')
    ),0),
    'outstanding_balance', coalesce((select sum(s.balance_due) from public.settlements s where s.owner_id=auth.uid()),0),
    'refund_due', coalesce((select sum(s.refund_due) from public.settlements s where s.owner_id=auth.uid()),0),
    'needs_invoice_review', (select count(*) from public.purchase_import_rows r join public.purchase_imports i on i.id=r.import_id and i.owner_id=r.owner_id
      where r.owner_id=auth.uid() and i.status<>'Cancelled' and r.review_status in ('Unmatched','Possible Match','Exact Match','Partially Allocated'))
  );
$$;

-- Atomic settlement: prices and quantities come from saved records, never client-supplied prices.
create or replace function public.finalize_settlement(
  p_booking_id uuid, p_items jsonb, p_advance_applied numeric, p_additional_payment numeric,
  p_discount numeric, p_customer_note text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking public.bookings%rowtype; v_item public.booking_items%rowtype; v_req jsonb; v_line_no int := 0; v_pickup_status text;
  v_qty numeric; v_gross numeric := 0; v_line numeric; v_discount numeric := round(coalesce(p_discount,0),2); v_net numeric;
  v_advance_paid numeric := 0; v_advance_refunded numeric := 0; v_advance_previously_applied numeric := 0; v_available_advance numeric;
  v_additional numeric := round(coalesce(p_additional_payment,0),2); v_advance_use numeric := round(coalesce(p_advance_applied,0),2);
  v_balance numeric; v_refund numeric; v_settlement_id uuid; v_items jsonb := '[]'::jsonb; v_message text; v_item_count int := 0;
  v_footer text := E'Regards,\nRatan Medical Hall'; v_shop_name text := 'Ratan Medical Hall'; v_status text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status in ('Cancelled','Returned / Refunded') then raise exception 'Cannot settle a cancelled or returned booking'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Select at least one received item for pickup'; end if;
  if v_discount < 0 or v_additional < 0 or v_advance_use < 0 then raise exception 'Amounts cannot be negative'; end if;
  if coalesce(p_additional_payment,0)>0 and v_additional=0 then raise exception 'Additional payment must be at least ₹0.01'; end if;
  if coalesce(p_advance_applied,0)>0 and v_advance_use=0 then raise exception 'Applied advance must be at least ₹0.01'; end if;
  for v_req in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_req->>'quantity')::numeric,0);
    if v_qty <= 0 then continue; end if;
    select * into v_item from public.booking_items where id=(v_req->>'item_id')::uuid and booking_id=p_booking_id and owner_id=v_owner for update;
    if not found then raise exception 'Selected item does not belong to this booking'; end if;
    if exists(select 1 from jsonb_array_elements(v_items) prior where prior->>'item_id'=v_item.id::text) then raise exception 'A booking item was submitted more than once; combine its pickup quantity into one line'; end if;
    if not v_item.mrp_verified or v_item.verified_mrp is null or v_item.verified_mrp <= 0 then raise exception 'Verify MRP for % before settlement',v_item.product_name; end if;
    if v_qty > v_item.received_quantity-v_item.collected_quantity then raise exception 'Pickup quantity exceeds available received stock for %',v_item.product_name; end if;
    v_line := round(v_item.verified_mrp*v_qty,2);
    v_gross := v_gross+v_line;
    v_items := v_items || jsonb_build_array(jsonb_build_object('item_id',v_item.id,'product_name',v_item.product_name,'strength',v_item.strength,'dosage_form',v_item.dosage_form,'brand',v_item.brand,'pack_size',v_item.pack_size,'unit_label',v_item.unit_label,'quantity',v_qty,'mrp',v_item.verified_mrp,'amount',v_line));
    v_item_count := v_item_count+1;
  end loop;
  if v_item_count=0 then raise exception 'Enter a pickup quantity for at least one medicine'; end if;
  if v_discount > v_gross then raise exception 'Discount cannot exceed gross sale value'; end if;
  select coalesce(sum(amount),0) into v_advance_paid from public.payments where booking_id=p_booking_id and owner_id=v_owner and payment_type='advance';
  select coalesce(sum(advance_applied),0) into v_advance_previously_applied from public.settlements where booking_id=p_booking_id and owner_id=v_owner;
  select coalesce(sum(amount),0) into v_advance_refunded from public.payments where booking_id=p_booking_id and owner_id=v_owner and payment_type='refund';
  v_available_advance := greatest(v_advance_paid-v_advance_refunded-v_advance_previously_applied,0);
  if v_advance_use > v_available_advance then raise exception 'Advance applied exceeds unused advance received'; end if;
  v_net := v_gross-v_discount;
  v_balance := greatest(v_net-v_advance_use-v_additional,0);
  v_refund := greatest(v_advance_use+v_additional-v_net,0);
  v_status := case when v_balance>0 then 'Balance Due' when v_refund>0 then 'Refund Due' else 'Settled' end;
  select coalesce(shop_name,'Ratan Medical Hall'), coalesce(default_footer,E'Regards,\nRatan Medical Hall') into v_shop_name,v_footer from public.shop_settings where owner_id=v_owner;
  select case when exists(select 1 from public.booking_items i where i.booking_id=p_booking_id and i.owner_id=v_owner and i.collected_quantity + coalesce((select sum((x->>'quantity')::numeric) from jsonb_array_elements(p_items) x where x->>'item_id'=i.id::text),0) < i.requested_quantity) then 'Partially collected' else 'Collected' end into v_pickup_status;
  if v_shop_name is null then v_shop_name := 'Ratan Medical Hall'; end if;
  v_message := '*'||v_shop_name||'*' || E'\nMedicine Order Update' || E'\nBooking ID: '||v_booking.booking_code || E'\nCustomer: '||coalesce(v_booking.customer_name,'Customer') || E'\nDate: '||to_char(now() at time zone 'Asia/Kolkata','DD Mon YYYY') || E'\n\nItems:';
  for v_req in select * from jsonb_array_elements(v_items) loop
    v_line_no := v_line_no + 1;
    v_message := v_message || E'\n' || v_line_no::text || '.';
    -- Sequence numbers are display-only; item data and totals are computed here.
    v_message := v_message || ' ' || (v_req->>'product_name') || coalesce(' '||nullif(v_req->>'strength',''),'') || coalesce(' ('||nullif(v_req->>'pack_size','')||')','') || E'\n   Quantity: '||(v_req->>'quantity')||' '||coalesce(nullif(v_req->>'unit_label',''),'packs')||E'\n   MRP per unit/pack: ₹'||to_char((v_req->>'mrp')::numeric,'FM999999990.00')||E'\n   Amount: ₹'||to_char((v_req->>'amount')::numeric,'FM999999990.00');
  end loop;
  v_message := v_message || E'\n\nGross total: ₹'||to_char(v_gross,'FM999999990.00')||E'\nDiscount: ₹'||to_char(v_discount,'FM999999990.00')||E'\nNet sale value: ₹'||to_char(v_net,'FM999999990.00')||E'\nAdvance received: ₹'||to_char(v_advance_paid,'FM999999990.00')||E'\nAdvance applied: ₹'||to_char(v_advance_use,'FM999999990.00')||E'\nAdditional payment: ₹'||to_char(v_additional,'FM999999990.00');
  if v_balance>0 then v_message := v_message||E'\nBalance payable: ₹'||to_char(v_balance,'FM999999990.00'); end if;
  if v_refund>0 then v_message := v_message||E'\nRefund due: ₹'||to_char(v_refund,'FM999999990.00'); end if;
  v_message := v_message||E'\nStatus: '||v_pickup_status||case when v_balance>0 then ' · Balance payable' when v_refund>0 then ' · Refund pending' else '' end||E'\n\n'||coalesce(nullif(trim(p_customer_note),''),'')||case when coalesce(nullif(trim(p_customer_note),''),'')='' then '' else E'\n' end||coalesce(v_footer,'Regards,\nRatan Medical Hall')||E'\n\nThank you for visiting '||v_shop_name||'.';
  insert into public.settlements(owner_id,booking_id,gross_total,discount_total,net_sale_value,advance_applied,additional_payment,balance_due,refund_due,items_json,message_text,customer_note,status,created_by)
  values(v_owner,p_booking_id,v_gross,v_discount,v_net,v_advance_use,v_additional,v_balance,v_refund,v_items,v_message,nullif(trim(p_customer_note),''),v_status,v_owner)
  returning id into v_settlement_id;
  if v_additional>0 then insert into public.payments(owner_id,booking_id,payment_type,amount,method,note,recorded_by) values(v_owner,p_booking_id,'additional',v_additional,'As recorded','Additional payment during settlement',v_owner); end if;
  for v_req in select * from jsonb_array_elements(v_items) loop
    update public.booking_items set collected_quantity=collected_quantity+(v_req->>'quantity')::numeric,updated_at=now() where id=(v_req->>'item_id')::uuid and owner_id=v_owner;
  end loop;
  update public.bookings b set status=case
    when not exists(select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.collected_quantity < i.requested_quantity) then 'Completed'
    when exists(select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.collected_quantity > 0) then 'Partially Collected'
    when not exists(select 1 from public.booking_items i where i.booking_id=b.id and i.owner_id=v_owner and i.received_quantity < i.requested_quantity) then 'Ready for Pickup'
    else 'Partially Received' end, updated_at=now() where id=p_booking_id and owner_id=v_owner;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,payload,actor_user_id)
  values(v_owner,p_booking_id,'settlement_created','Settlement recorded: '||v_status,jsonb_build_object('settlement_id',v_settlement_id,'net_sale_value',v_net,'balance_due',v_balance,'refund_due',v_refund),v_owner);
  return jsonb_build_object('id',v_settlement_id,'gross_total',v_gross,'net_sale_value',v_net,'balance_due',v_balance,'refund_due',v_refund,'status',v_status,'message_text',v_message);
end;
$$;

-- Record a payment against already recorded balance due, oldest settlement first.
create or replace function public.record_additional_payment(
  p_booking_id uuid, p_amount numeric, p_method text, p_note text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking public.bookings%rowtype; v_due numeric := 0; v_remaining numeric; v_apply numeric; v_settlement public.settlements%rowtype; v_payment_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_amount is null or round(p_amount,2) <= 0 or p_amount > 10000000 then raise exception 'Payment must be at least ₹0.01 and at most ₹10,000,000'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  select coalesce(sum(balance_due),0) into v_due from public.settlements where booking_id=p_booking_id and owner_id=v_owner;
  if round(p_amount,2) > v_due then raise exception 'Additional payment exceeds the recorded balance due. Record an extra amount as a new advance instead.'; end if;
  insert into public.payments(owner_id,booking_id,payment_type,amount,method,note,recorded_by)
  values(v_owner,p_booking_id,'additional',round(p_amount,2),coalesce(nullif(trim(p_method),''),'Cash'),nullif(trim(p_note),''),v_owner) returning id into v_payment_id;
  v_remaining := round(p_amount,2);
  for v_settlement in select * from public.settlements where booking_id=p_booking_id and owner_id=v_owner and balance_due>0 order by created_at,id for update loop
    exit when v_remaining<=0;
    v_apply := least(v_settlement.balance_due,v_remaining);
    update public.settlements set balance_due=balance_due-v_apply,
      status=case when balance_due-v_apply>0 then 'Balance Due' when refund_due>0 then 'Refund Due' else 'Settled' end
    where id=v_settlement.id and owner_id=v_owner;
    insert into public.settlement_payment_allocations(owner_id,settlement_id,payment_id,amount) values(v_owner,v_settlement.id,v_payment_id,v_apply);
    v_remaining := v_remaining-v_apply;
  end loop;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,payload,actor_user_id)
  values(v_owner,p_booking_id,'additional_payment_recorded','Additional payment of ₹'||to_char(round(p_amount,2),'FM999999990.00')||' recorded and allocated to outstanding balances',jsonb_build_object('payment_id',v_payment_id,'amount',round(p_amount,2)),v_owner);
  return v_payment_id;
end;
$$;

-- Record a refund actually paid. Existing settlement refund dues are cleared first; any remainder
-- can refund unused advance. The function refuses to refund more than the due plus unused advance.
create or replace function public.record_refund_payment(
  p_booking_id uuid, p_amount numeric, p_method text, p_note text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid := auth.uid(); v_booking public.bookings%rowtype; v_refund_due numeric := 0; v_advance_paid numeric := 0; v_advance_applied numeric := 0; v_unused_advance_refunded numeric := 0; v_unused_advance numeric := 0; v_remaining numeric; v_apply numeric; v_settlement public.settlements%rowtype; v_payment_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_amount is null or round(p_amount,2) <= 0 or p_amount > 10000000 then raise exception 'Refund must be at least ₹0.01 and at most ₹10,000,000'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and owner_id=v_owner for update;
  if not found then raise exception 'Booking not found'; end if;
  select coalesce(sum(refund_due),0) into v_refund_due from public.settlements where booking_id=p_booking_id and owner_id=v_owner;
  select coalesce(sum(amount),0) into v_advance_paid from public.payments where booking_id=p_booking_id and owner_id=v_owner and payment_type='advance';
  select coalesce(sum(advance_applied),0) into v_advance_applied from public.settlements where booking_id=p_booking_id and owner_id=v_owner;
  select coalesce(sum(ra.amount),0) into v_unused_advance_refunded
    from public.refund_allocations ra join public.payments p on p.id=ra.payment_id and p.owner_id=ra.owner_id
    where p.booking_id=p_booking_id and ra.owner_id=v_owner and ra.source_type='UnusedAdvance';
  v_unused_advance := greatest(v_advance_paid-v_advance_applied-v_unused_advance_refunded,0);
  if round(p_amount,2) > v_refund_due+v_unused_advance then raise exception 'Refund exceeds recorded refund due plus unused advance'; end if;
  insert into public.payments(owner_id,booking_id,payment_type,amount,method,note,recorded_by)
  values(v_owner,p_booking_id,'refund',round(p_amount,2),coalesce(nullif(trim(p_method),''),'Cash'),nullif(trim(p_note),''),v_owner) returning id into v_payment_id;
  v_remaining := round(p_amount,2);
  for v_settlement in select * from public.settlements where booking_id=p_booking_id and owner_id=v_owner and refund_due>0 order by created_at,id for update loop
    exit when v_remaining<=0;
    v_apply := least(v_settlement.refund_due,v_remaining);
    update public.settlements set refund_due=refund_due-v_apply,
      status=case when balance_due>0 then 'Balance Due' when refund_due-v_apply>0 then 'Refund Due' else 'Settled' end
    where id=v_settlement.id and owner_id=v_owner;
    insert into public.refund_allocations(owner_id,payment_id,settlement_id,source_type,amount)
      values(v_owner,v_payment_id,v_settlement.id,'SettlementRefundDue',v_apply);
    v_remaining := v_remaining-v_apply;
  end loop;
  if v_remaining>0 then
    insert into public.refund_allocations(owner_id,payment_id,settlement_id,source_type,amount)
      values(v_owner,v_payment_id,null,'UnusedAdvance',v_remaining);
  end if;
  insert into public.booking_events(owner_id,booking_id,event_type,summary,payload,actor_user_id)
  values(v_owner,p_booking_id,'refund_paid','Refund of ₹'||to_char(round(p_amount,2),'FM999999990.00')||' recorded as paid',jsonb_build_object('payment_id',v_payment_id,'amount',round(p_amount,2)),v_owner);
  return v_payment_id;
end;
$$;

-- Restrict RPC entry points to signed-in users; each function derives owner_id from auth.uid().
revoke all on function public.get_dashboard_summary() from public;
grant execute on function public.get_dashboard_summary() to authenticated;
revoke all on function public.set_booking_status(uuid,text) from public;
grant execute on function public.set_booking_status(uuid,text) to authenticated;
revoke all on function public.verify_booking_item_mrp(uuid,uuid,numeric) from public;
grant execute on function public.verify_booking_item_mrp(uuid,uuid,numeric) to authenticated;
revoke all on function public.record_advance_payment(uuid,numeric,text,text) from public;
grant execute on function public.record_advance_payment(uuid,numeric,text,text) to authenticated;
revoke all on function public.cancel_empty_import_draft(uuid) from public;
grant execute on function public.cancel_empty_import_draft(uuid) to authenticated;
revoke all on function public.create_booking_with_items(text,text,date,text,boolean,numeric,text,jsonb) from public;
grant execute on function public.create_booking_with_items(text,text,date,text,boolean,numeric,text,jsonb) to authenticated;
revoke all on function public.allocate_invoice_receipt(uuid,uuid,numeric,numeric,boolean,text,date) from public;
grant execute on function public.allocate_invoice_receipt(uuid,uuid,numeric,numeric,boolean,text,date) to authenticated;
revoke all on function public.finalize_settlement(uuid,jsonb,numeric,numeric,numeric,text) from public;
grant execute on function public.finalize_settlement(uuid,jsonb,numeric,numeric,numeric,text) to authenticated;
revoke all on function public.record_additional_payment(uuid,numeric,text,text) from public;
grant execute on function public.record_additional_payment(uuid,numeric,text,text) to authenticated;
revoke all on function public.record_refund_payment(uuid,numeric,text,text) from public;
grant execute on function public.record_refund_payment(uuid,numeric,text,text) to authenticated;

-- Remove broad default API grants. Critical stock, payment, settlement and status writes
-- are only possible through owner-checked RPCs above.
revoke all on public.bookings, public.booking_items, public.payments, public.purchase_imports, public.purchase_import_rows, public.receipt_allocations, public.settlements, public.settlement_payment_allocations, public.refund_allocations, public.reminders, public.booking_events, public.shop_settings from anon, authenticated;
grant select on public.bookings, public.booking_items, public.payments, public.purchase_imports, public.purchase_import_rows, public.receipt_allocations, public.settlements, public.settlement_payment_allocations, public.refund_allocations, public.reminders, public.booking_events, public.shop_settings to authenticated;
-- Non-financial contact metadata can be updated directly by the signed-in shopkeeper.
grant update(last_contact_at,last_whatsapp_draft_opened_at,updated_at) on public.bookings to authenticated;
-- Import draft upload and manual review; allocated quantities and posted statuses are RPC-only.
grant insert(owner_id,supplier_name,invoice_number,invoice_date,file_name,fingerprint,row_count,created_by) on public.purchase_imports to authenticated;
grant insert(owner_id,import_id,row_number,sku,source_name,generic_name,strength,dosage_form,brand,pack_size,batch_number,expiry_date,quantity,free_quantity,purchase_rate,mrp) on public.purchase_import_rows to authenticated;
grant update(review_status,review_note) on public.purchase_import_rows to authenticated;
-- Reminder editing, but no modification of ownership or booking links.
grant insert(owner_id,booking_id,reason,due_at,note) on public.reminders to authenticated;
grant update(reason,due_at,status,last_contact_at,note,updated_at) on public.reminders to authenticated;
-- Saved shop signature/settings.
grant insert on public.shop_settings to authenticated;
grant update(shop_name,shop_phone,default_footer,reminder_interval_days,updated_at) on public.shop_settings to authenticated;
-- Customer-approved editing of the text draft is separate from financial settlement fields.
grant update(message_text) on public.settlements to authenticated;
-- Booking timeline is append-only from the web app; no UPDATE or DELETE privilege is granted.
grant insert(owner_id,booking_id,event_type,summary,payload,actor_user_id) on public.booking_events to authenticated;
