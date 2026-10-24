'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { invoiceFingerprint } from '@/lib/invoice-fingerprint';
import { normalizeIndianMobile } from '@/lib/phone-number';

export type BookingSnapshot = {
  bookingCode: string;
  customerName: string | null;
  customerPhone: string;
  status: string;
  createdAt: string;
  whatsappConsent: boolean;
  items: Array<{
    product_name: string;
    requested_quantity: number;
    unit_label: string;
    strength: string | null;
    pack_size: string | null;
  }>;
  advance: number;
  advanceMethod: string | null;
  shopName: string;
  footer: string;
};

export type ActionState = {
  error?: string;
  success?: string;
  bookingId?: string;
  booking?: BookingSnapshot;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return { supabase, user };
}

function safeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : (error && typeof error === 'object' && 'message' in error ? String((error as {message?:unknown}).message ?? '') : String(error ?? ''));
  if (/duplicate key|unique constraint/i.test(message)) return 'This invoice appears to have been imported already. Check Import History before uploading again.';
  return message.replace(/^Error:\s*/i, '').slice(0, 240) || fallback;
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let supabase;
  try { supabase = await createClient(); } catch (e) { return { error: safeError(e, 'Supabase configuration is missing.') }; }
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Login failed. Check the email/password and confirm that the shopkeeper account exists in Supabase Auth.' };
  redirect('/landing');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function createBookingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const customerName = String(formData.get('customer_name') || '').trim();
  const phoneInput = String(formData.get('customer_phone') || '').trim();
  const phone = normalizeIndianMobile(phoneInput);
  const notes = String(formData.get('notes') || '').trim();
  const prescriptionVerified = formData.get('prescription_verified') === 'on';
  const whatsappConsent = String(formData.get('whatsapp_consent') || '').trim();
  const advanceText = String(formData.get('advance_amount') || '0').trim();
  const advance = Number(advanceText || 0);
  const method = String(formData.get('advance_method') || 'Cash');
  let items: unknown;
  try { items = JSON.parse(String(formData.get('items_json') || '[]')); }
  catch { return { error: 'The medicine list could not be read. Please review the medicine rows.' }; }

  if (!phone) return { error: 'Enter a valid Indian mobile number: 10 digits, or include +91.' };
  if (!['yes', 'no'].includes(whatsappConsent)) return { error: 'Record whether the customer agreed to WhatsApp messages.' };
  if (!Number.isFinite(advance) || advance < 0 || advance > 10000000) return { error: 'Advance must be a valid amount of ₹0 or more.' };
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) return { error: 'Add between 1 and 20 medicine lines.' };

  const validItems = items.map((item: any) => ({
    product_name: String(item.product_name || '').trim().slice(0,180),
    product_code: String(item.product_code || '').trim().slice(0,100),
    generic_name: String(item.generic_name || '').trim().slice(0,180),
    strength: String(item.strength || '').trim().slice(0,80),
    dosage_form: String(item.dosage_form || '').trim().slice(0,80),
    brand: String(item.brand || '').trim().slice(0,120),
    pack_size: String(item.pack_size || '').trim().slice(0,80),
    requested_quantity: Number(item.requested_quantity),
    unit_label: String(item.unit_label || 'packs').trim().slice(0,40) || 'packs',
  }));
  if (validItems.some((item) => !item.product_name || !Number.isFinite(item.requested_quantity) || item.requested_quantity <= 0 || item.requested_quantity > 100000)) {
    return { error: 'Each medicine needs a product name and quantity greater than zero.' };
  }

  const { data, error } = await supabase.rpc('create_booking_with_consent', {
    p_customer_name: customerName || null,
    p_customer_phone: phone,
    p_expected_arrival_date: null,
    p_notes: notes || null,
    p_prescription_verified: prescriptionVerified,
    p_advance: advance,
    p_advance_method: method,
    p_items: validItems,
    p_whatsapp_consent: whatsappConsent === 'yes',
  });
  if (error || !data) return { error: safeError(error, 'Could not save this booking. Check the database migration and try again.') };

  const bookingId = String(data);
  const [
    { data: savedBooking, error: bookingReadError },
    { data: savedItems, error: itemReadError },
    { data: savedPayments, error: paymentReadError },
    { data: settings },
  ] = await Promise.all([
    supabase.from('bookings')
      .select('id,booking_code,customer_name,customer_phone,status,created_at,whatsapp_consent')
      .eq('id', bookingId).eq('owner_id', user.id).maybeSingle(),
    supabase.from('booking_items')
      .select('product_name,requested_quantity,unit_label,strength,pack_size')
      .eq('booking_id', bookingId).eq('owner_id', user.id).order('created_at'),
    supabase.from('payments')
      .select('payment_type,amount,method')
      .eq('booking_id', bookingId).eq('owner_id', user.id),
    supabase.from('shop_settings')
      .select('shop_name,default_footer')
      .eq('owner_id', user.id).maybeSingle(),
  ]);

  let booking: BookingSnapshot | undefined;
  if (savedBooking && !bookingReadError && !itemReadError) {
    const advancePayments = (savedPayments || []).filter((payment: any) => payment.payment_type === 'advance');
    const recordedAdvance = paymentReadError
      ? advance
      : advancePayments.reduce((total: number, payment: any) => total + Number(payment.amount || 0), 0);
    booking = {
      bookingCode: String(savedBooking.booking_code || ''),
      customerName: savedBooking.customer_name ? String(savedBooking.customer_name) : null,
      customerPhone: String(savedBooking.customer_phone || phone),
      status: String(savedBooking.status || 'Awaiting Stock'),
      createdAt: String(savedBooking.created_at || new Date().toISOString()),
      whatsappConsent: savedBooking.whatsapp_consent === true,
      items: (savedItems || []).map((item: any) => ({
        product_name: String(item.product_name || ''),
        requested_quantity: Number(item.requested_quantity || 0),
        unit_label: String(item.unit_label || 'packs'),
        strength: item.strength == null ? null : String(item.strength),
        pack_size: item.pack_size == null ? null : String(item.pack_size),
      })),
      advance: recordedAdvance,
      advanceMethod: advancePayments[0]?.method ? String(advancePayments[0].method) : (advance > 0 ? method : null),
      shopName: String(settings?.shop_name || 'Ratan Medical Hall'),
      footer: String(settings?.default_footer || 'Regards,\nRatan Medical Hall'),
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/bookings');
  revalidatePath('/ready');
  return {
    success: 'Booking confirmed and saved.',
    bookingId,
    booking,
  };
}
export async function updateWhatsAppConsentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  const choice = String(formData.get('whatsapp_consent') || '');
  if (!bookingId || !['yes', 'no'].includes(choice)) redirect('/bookings?consent=error');

  const { error } = await supabase.rpc('set_booking_whatsapp_consent', {
    p_booking_id: bookingId,
    p_agreed: choice === 'yes',
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/ready');
  if (error) redirect(`/bookings/${bookingId}?consent=error`);
  redirect(`/bookings/${bookingId}?consent=saved`);
}

export async function updateBookingStatusAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get('booking_id') || '');
  const status = String(formData.get('status') || '');
  const allowed = ['Awaiting Stock','Partially Received','Ready for Pickup','Partially Collected','Completed','Cancelled','Returned / Refunded'];
  if (!id || !allowed.includes(status)) redirect('/bookings');
  const { error } = await supabase.rpc('set_booking_status', { p_booking_id: id, p_status: status });
  if (error) {
    const statusCode = /Ready for Pickup/i.test(error.message) ? 'needs_stock' : /Completed/i.test(error.message) ? 'needs_pickup' : 'error';
    redirect(`/bookings/${id}?status=${statusCode}`);
  }
  revalidatePath('/dashboard'); revalidatePath('/bookings'); revalidatePath(`/bookings/${id}`); revalidatePath('/ready');
  redirect(`/bookings/${id}?status=updated&value=${encodeURIComponent(status)}`);
}

export async function addPaymentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  const amount = Number(formData.get('amount'));
  const method = String(formData.get('method') || 'Cash');
  const type = String(formData.get('payment_type') || 'advance');
  const note = String(formData.get('note') || '').trim().slice(0,500);
  if (!bookingId || !Number.isFinite(amount) || amount <= 0 || amount > 10000000 || !['advance','additional','refund'].includes(type)) redirect('/bookings');
  const { data: booking } = await supabase.from('bookings').select('id').eq('id', bookingId).eq('owner_id', user.id).maybeSingle();
  if (!booking) redirect('/bookings');
  let error: any = null;
  if (type === 'additional') {
    const result = await supabase.rpc('record_additional_payment', { p_booking_id:bookingId, p_amount:amount, p_method:method, p_note:note || null });
    error = result.error;
  } else if (type === 'refund') {
    const result = await supabase.rpc('record_refund_payment', { p_booking_id:bookingId, p_amount:amount, p_method:method, p_note:note || null });
    error = result.error;
  } else {
    const result = await supabase.rpc('record_advance_payment', { p_booking_id:bookingId, p_amount:amount, p_method:method, p_note:note || null });
    error = result.error;
  }
  revalidatePath(`/bookings/${bookingId}`); revalidatePath('/settlements'); revalidatePath('/dashboard');
  redirect(`/bookings/${bookingId}?payment=${error ? 'error' : 'saved'}`);
}

export async function createSettlementAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  let items: unknown;
  try { items = JSON.parse(String(formData.get('items_json') || '[]')); } catch { return { error: 'Could not read the pickup quantities. Refresh the page and try again.' }; }
  const advanceApplied = Number(formData.get('advance_applied') || 0);
  const additionalPayment = Number(formData.get('additional_payment') || 0);
  const customerNote = String(formData.get('customer_note') || '').slice(0,500);
  if (!bookingId || !Array.isArray(items)) return { error: 'Booking details are missing.' };
  if (![advanceApplied, additionalPayment].every((n) => Number.isFinite(n) && n >= 0)) return { error: 'Advance and additional payment amounts must be valid non-negative numbers.' };
  const safeItems = items.filter((x: any) => Number(x.quantity) > 0).map((x: any) => ({ item_id: String(x.item_id), quantity: Number(x.quantity) }));
  if (!safeItems.length) return { error: 'Enter a pickup quantity for at least one medicine.' };
  const { data, error } = await supabase.rpc('finalize_settlement', {
    p_booking_id: bookingId,
    p_items: safeItems,
    p_advance_applied: advanceApplied,
    p_additional_payment: additionalPayment,
    p_discount: 0,
    p_customer_note: customerNote || null,
  });
  if (error || !data?.id) return { error: safeError(error, 'Could not save the settlement. Confirm all picked medicines have verified MRP and enough received stock.') };
  revalidatePath('/dashboard'); revalidatePath('/bookings'); revalidatePath(`/bookings/${bookingId}`); revalidatePath('/settlements'); revalidatePath('/ready');
  redirect(`/settlements/${data.id}?created=1`);
}

export async function saveMessageDraftAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const settlementId = String(formData.get('settlement_id') || '');
  const message = String(formData.get('message_text') || '').slice(0,12000);
  if (!settlementId || !message.trim()) return { error: 'Message cannot be empty.' };
  const { error } = await supabase.from('settlements').update({ message_text: message }).eq('id', settlementId).eq('owner_id', user.id);
  if (error) return { error: 'Could not save this message draft.' };
  revalidatePath(`/settlements/${settlementId}`);
  return { success: 'Message draft saved. Review it before sending through WhatsApp.' };
}

export async function createImportDraftAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const fileName = String(formData.get('file_name') || 'purchase-invoice.csv').slice(0,255);
  const supplier = String(formData.get('supplier_name') || '').trim().slice(0,180);
  const invoiceNumber = String(formData.get('invoice_number') || '').trim().slice(0,120);
  const invoiceDate = String(formData.get('invoice_date') || '').trim() || null;
  let rows: any[];
  try { rows = JSON.parse(String(formData.get('rows_json') || '[]')); } catch { return { error: 'CSV rows were not valid JSON. Upload the file again.' }; }
  if (!Array.isArray(rows) || rows.length < 1) return { error: 'No data rows found in the CSV.' };
  if (rows.length > 5000) return { error: 'This import has more than 5,000 rows. Split the CSV into smaller files.' };
  const cleanRows = rows.map((row, index) => ({
    row_number: index + 2,
    sku: String(row.sku || '').trim().slice(0,100) || null,
    source_name: String(row.source_name || '').trim().slice(0,180),
    generic_name: String(row.generic_name || '').trim().slice(0,180) || null,
    strength: String(row.strength || '').trim().slice(0,80) || null,
    dosage_form: String(row.dosage_form || '').trim().slice(0,80) || null,
    brand: String(row.brand || '').trim().slice(0,120) || null,
    pack_size: String(row.pack_size || '').trim().slice(0,80) || null,
    batch_number: String(row.batch_number || '').trim().slice(0,100) || null,
    expiry_date: String(row.expiry_date || '').trim() || null,
    quantity: Number(row.quantity || 0),
    free_quantity: Number(row.free_quantity || 0),
    purchase_rate: row.purchase_rate === '' || row.purchase_rate == null ? null : Number(row.purchase_rate),
    mrp: row.mrp === '' || row.mrp == null ? null : Number(row.mrp),
  }));
  if (cleanRows.some((r) => !r.source_name || !Number.isFinite(r.quantity) || r.quantity < 0 || !Number.isFinite(r.free_quantity) || r.free_quantity < 0 || (r.quantity + r.free_quantity) <= 0)) return { error: 'Every invoice row needs a product name and a positive purchased-plus-free quantity.' };
  if (cleanRows.some((r) => (r.mrp != null && (!Number.isFinite(r.mrp) || r.mrp < 0)) || (r.purchase_rate != null && (!Number.isFinite(r.purchase_rate) || r.purchase_rate < 0)))) return { error: 'The CSV contains an invalid price. Review the source file and upload again.' };
  const fingerprint = invoiceFingerprint({ supplier, invoiceNumber, invoiceDate, rows: cleanRows });
  const { data: existing } = await supabase.from('purchase_imports').select('id').eq('owner_id', user.id).eq('fingerprint', fingerprint).maybeSingle();
  if (existing) return { error: 'This exact invoice file has already been imported. Open Import History to continue its reconciliation.' };
  if (invoiceNumber && invoiceDate) {
    let sameInvoiceQuery = supabase.from('purchase_imports').select('id').eq('owner_id',user.id).ilike('invoice_number',invoiceNumber).eq('invoice_date',invoiceDate);
    if (supplier) sameInvoiceQuery = sameInvoiceQuery.ilike('supplier_name',supplier);
    const { data: sameInvoice } = await sameInvoiceQuery.maybeSingle();
    if (sameInvoice) return { error: 'An invoice with this supplier, invoice number and date was already imported. Open Import History and review the existing record instead of importing it twice.' };
  }
  const { data: imported, error } = await supabase.from('purchase_imports').insert({ owner_id: user.id, supplier_name: supplier || null, invoice_number: invoiceNumber || null, invoice_date: invoiceDate, file_name: fileName, fingerprint, row_count: cleanRows.length, created_by: user.id }).select('id').single();
  if (error || !imported) return { error: safeError(error, 'Could not create import draft. Check the database migration.') };
  const batch = cleanRows.map((r) => ({ ...r, owner_id: user.id, import_id: imported.id }));
  const { error: rowError } = await supabase.from('purchase_import_rows').insert(batch);
  if (rowError) {
    await supabase.rpc('cancel_empty_import_draft', { p_import_id: imported.id });
    return { error: 'The import draft was created but its rows could not be saved. It was marked cancelled. Check the CSV fields and database migration before retrying.' };
  }
  revalidatePath('/imports');
  redirect(`/imports/${imported.id}?toast=import-created`);
}

export async function allocateInvoiceRowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const rowId = String(formData.get('row_id') || '');
  const importId = String(formData.get('import_id') || '');
  const itemId = String(formData.get('booking_item_id') || '');
  const quantity = Number(formData.get('quantity') || 0);
  const mrpText = String(formData.get('verified_mrp') || '').trim();
  const mrp = mrpText === '' ? null : Number(mrpText);
  const mrpVerified = formData.get('mrp_verified') === 'on';
  const batch = String(formData.get('batch_number') || '').trim();
  const expiry = String(formData.get('expiry_date') || '').trim() || null;
  if (!rowId || !importId || !itemId || !Number.isFinite(quantity) || quantity <= 0) return { error: 'Select a booking match and enter a receipt quantity greater than zero.' };
  if (mrpVerified && (mrp == null || !Number.isFinite(mrp) || mrp <= 0)) return { error: 'Enter a valid MRP before marking it verified.' };
  const { error } = await supabase.rpc('allocate_invoice_receipt', { p_row_id: rowId, p_booking_item_id: itemId, p_quantity: quantity, p_verified_mrp: mrp, p_mrp_verified: mrpVerified, p_batch_number: batch || null, p_expiry_date: expiry });
  if (error) return { error: safeError(error, 'Receipt allocation failed. Check invoice quantity and the booking quantity still outstanding.') };
  revalidatePath(`/imports/${importId}`); revalidatePath('/imports'); revalidatePath('/dashboard'); revalidatePath('/ready'); revalidatePath('/bookings');
  return { success: 'Receipt allocation saved and the booking quantity updated.' };
}

export async function updateImportRowAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const rowId = String(formData.get('row_id') || ''); const importId = String(formData.get('import_id') || '');
  const status = String(formData.get('review_status') || 'Unmatched');
  if (!['Unmatched','Possible Match','Exact Match','Ignored'].includes(status)) redirect('/imports');
  const { data: row } = await supabase.from('purchase_import_rows').select('allocated_quantity').eq('id',rowId).eq('owner_id',user.id).maybeSingle();
  if (!row) redirect('/imports');
  if (status === 'Ignored' && Number(row.allocated_quantity||0)>0) redirect(`/imports/${importId}?review=partial`);
  const { error: updateError } = await supabase.from('purchase_import_rows').update({ review_status: status, review_note: status === 'Ignored' ? 'Ignored by shopkeeper; no stock posted' : null }).eq('id',rowId).eq('owner_id',user.id);
  if (updateError) redirect(`/imports/${importId}?toast=import-row-error`);
  revalidatePath(`/imports/${importId}`); revalidatePath('/imports');
  redirect(`/imports/${importId}?toast=import-row-ignored`);
}

export async function saveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const shopName = String(formData.get('shop_name') || 'Ratan Medical Hall').trim().slice(0,120) || 'Ratan Medical Hall';
  const phone = String(formData.get('shop_phone') || '').trim().slice(0,30);
  const footer = String(formData.get('default_footer') || '').trim().slice(0,1000) || `Regards,\n${shopName}`;
  const interval = Number(formData.get('reminder_interval_days') || 2);
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) return { error: 'Reminder interval must be between 1 and 60 days.' };
  const { error } = await supabase.from('shop_settings').upsert({ owner_id: user.id, shop_name: shopName, shop_phone: phone || null, default_footer: footer, reminder_interval_days: interval, updated_at: new Date().toISOString() });
  if (error) return { error: 'Settings could not be saved. Check the database migration and try again.' };
  revalidatePath('/settings'); revalidatePath('/dashboard');
  return { success: 'Shop settings saved.' };
}

export async function updateReminderAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('reminder_id') || '');
  const status = String(formData.get('status') || 'Done');
  const allowed = ['Pending','Snoozed','Done','Dismissed'];
  if (!id || !allowed.includes(status)) redirect('/reminders?reminder=error');
  const dueAtText = String(formData.get('due_at') || '').trim();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'Snoozed') {
    if (!dueAtText) redirect('/reminders?reminder=invalid');
    const dueAt = new Date(`${dueAtText}:00+05:30`);
    if (Number.isNaN(dueAt.getTime())) redirect('/reminders?reminder=invalid');
    updates.due_at = dueAt.toISOString();
  }
  if (status === 'Done') updates.last_contact_at = new Date().toISOString();
  const { data: reminder, error } = await supabase.from('reminders')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('booking_id')
    .maybeSingle();
  if (error || !reminder) redirect('/reminders?reminder=error');

  if (status === 'Done') {
    const completedAt = new Date().toISOString();
    await supabase.from('bookings').update({ last_contact_at: completedAt }).eq('id', reminder.booking_id).eq('owner_id', user.id);
    await supabase.from('booking_events').insert({ owner_id: user.id, booking_id: reminder.booking_id, event_type: 'reminder_completed', summary: 'Reminder marked done', actor_user_id: user.id });
  }
  revalidatePath('/reminders'); revalidatePath('/dashboard'); revalidatePath('/bookings');
  redirect(`/reminders?reminder=updated&value=${encodeURIComponent(status)}`);
}

export async function createFollowupReminderAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  const reason = String(formData.get('reason') || 'Customer follow-up').trim().slice(0,180);
  const dueDate = String(formData.get('due_at') || '').trim();
  if (!bookingId || !dueDate) redirect('/reminders?reminder=invalid');
  const dueAt = new Date(`${dueDate}:00+05:30`);
  if (Number.isNaN(dueAt.getTime())) redirect(`/bookings/${bookingId}?reminder=invalid`);
  const { data: booking } = await supabase.from('bookings').select('id').eq('id', bookingId).eq('owner_id', user.id).maybeSingle();
  if (!booking) redirect('/reminders?reminder=error');
  const { error } = await supabase.from('reminders').insert({ owner_id: user.id, booking_id: bookingId, reason, due_at: dueAt.toISOString() });
  if (error) redirect(`/bookings/${bookingId}?reminder=error`);
  await supabase.from('booking_events').insert({ owner_id: user.id, booking_id: bookingId, event_type: 'reminder_created', summary: `Reminder created: ${reason}`, actor_user_id: user.id });
  revalidatePath('/reminders'); revalidatePath(`/bookings/${bookingId}`);
  redirect('/reminders?reminder=created');
}

export async function markWhatsAppOpenedAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  const kind = String(formData.get('kind') || 'follow_up').slice(0,40);
  if (!bookingId) return;
  const { data: booking } = await supabase.from('bookings').select('id,whatsapp_consent').eq('id', bookingId).eq('owner_id', user.id).maybeSingle();
  if (!booking || booking.whatsapp_consent !== true) return;
  const { error: updateError } = await supabase.from('bookings').update({ last_whatsapp_draft_opened_at: new Date().toISOString() }).eq('id', bookingId).eq('owner_id', user.id);
  if (updateError) return;
  await supabase.from('booking_events').insert({ owner_id: user.id, booking_id: bookingId, event_type: 'whatsapp_draft_opened', summary: `WhatsApp ${kind} draft opened; send status not confirmed`, payload: { send_status: 'opened_not_confirmed' }, actor_user_id: user.id });
  revalidatePath(`/bookings/${bookingId}`); revalidatePath('/dashboard'); revalidatePath('/reminders');
}

export async function verifyItemMrpAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const itemId = String(formData.get('item_id') || '');
  const bookingId = String(formData.get('booking_id') || '');
  const mrp = Number(formData.get('verified_mrp') || 0);
  const verified = formData.get('mrp_verified') === 'on';
  if (!itemId || !bookingId || !Number.isFinite(mrp) || mrp <= 0 || mrp > 10000000 || !verified) redirect(`/bookings/${bookingId}`);
  const { error } = await supabase.rpc('verify_booking_item_mrp', { p_booking_id:bookingId, p_item_id:itemId, p_mrp:mrp });
  revalidatePath(`/bookings/${bookingId}`); revalidatePath('/ready'); revalidatePath('/dashboard');
  redirect(`/bookings/${bookingId}?mrp=${error?'error':'saved'}`);
}

export async function markWhatsAppSentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bookingId = String(formData.get('booking_id') || '');
  const kind = String(formData.get('kind') || 'customer_message').slice(0,40);
  const requestedPath = String(formData.get('return_path') || '');
  if (!bookingId) redirect('/bookings');

  let returnPath = `/bookings/${bookingId}`;
  if (requestedPath === '/ready') returnPath = '/ready';
  else if (requestedPath === `/bookings/${bookingId}`) returnPath = requestedPath;
  else if (/^\/settlements\/[0-9a-f-]+$/i.test(requestedPath)) returnPath = requestedPath;

  const { data: booking } = await supabase.from('bookings').select('id,whatsapp_consent').eq('id',bookingId).eq('owner_id',user.id).maybeSingle();
  if (!booking) redirect(`${returnPath}?whatsapp=error`);
  if (booking.whatsapp_consent !== true) redirect(`${returnPath}?whatsapp=consent-required`);

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from('bookings').update({ last_contact_at: now }).eq('id',bookingId).eq('owner_id',user.id);
  if (updateError) redirect(`${returnPath}?whatsapp=error`);

  const { error: eventError } = await supabase.from('booking_events').insert({
    owner_id:user.id,
    booking_id:bookingId,
    event_type:'manual_message_marked_sent',
    summary:`Shopkeeper manually confirmed ${kind.replaceAll('_',' ')} was sent`,
    payload:{send_status:'manually_confirmed_by_shopkeeper',kind},
    actor_user_id:user.id
  });
  revalidatePath(`/bookings/${bookingId}`); revalidatePath('/dashboard'); revalidatePath('/ready'); revalidatePath('/reminders');
  if (eventError) redirect(`${returnPath}?whatsapp=log-error`);
  redirect(`${returnPath}?whatsapp=marked-sent`);
}
