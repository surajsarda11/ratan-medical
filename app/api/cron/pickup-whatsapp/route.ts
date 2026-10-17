import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_DAILY_ATTEMPTS = 3;
const RETRY_AFTER_MS = 23 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

function startOfCurrentIstDayUtc(now = new Date()) {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightAsUtc = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
    0, 0, 0, 0,
  );
  return new Date(midnightAsUtc - IST_OFFSET_MS).toISOString();
}

function normalizeWhatsAppNumber(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = '91' + digits;
  return /^\d{10,15}$/.test(digits) ? digits : '';
}

function text(value: unknown, max = 900) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== 'Bearer ' + cronSecret) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_PICKUP_TEMPLATE_NAME || 'pickup_ready_notification';
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

  if (!accessToken || !phoneNumberId) {
    return Response.json({
      error: 'WhatsApp Cloud API is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
    }, { status: 503 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Supabase admin client is not configured.',
    }, { status: 503 });
  }

  const now = new Date();
  const readyBefore = startOfCurrentIstDayUtc(now);
  const retryBefore = new Date(now.getTime() - RETRY_AFTER_MS).toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,owner_id,booking_code,customer_name,customer_phone,status,customer_no_smartphone,customer_whatsapp_opt_in,ready_for_pickup_at,pickup_whatsapp_sent_at,pickup_whatsapp_attempted_at,pickup_whatsapp_attempt_count,booking_items(product_name,strength,pack_size,requested_quantity,received_quantity,collected_quantity,unit_label)')
    .in('status', ['Ready for Pickup', 'Partially Collected'])
    .eq('customer_no_smartphone', false)
    .eq('customer_whatsapp_opt_in', true)
    .is('pickup_whatsapp_sent_at', null)
    .lt('ready_for_pickup_at', readyBefore)
    .lt('pickup_whatsapp_attempt_count', MAX_DAILY_ATTEMPTS)
    .order('ready_for_pickup_at', { ascending: true })
    .limit(500);

  if (error) {
    return Response.json({ error: 'Could not load pickup notification queue.' }, { status: 500 });
  }

  const ownerIds = [...new Set((bookings || []).map((booking: any) => booking.owner_id))];
  const settingsByOwner = new Map<string, { shop_name?: string | null; default_footer?: string | null }>();
  if (ownerIds.length) {
    const { data: settings } = await supabase
      .from('shop_settings')
      .select('owner_id,shop_name,default_footer')
      .in('owner_id', ownerIds);
    for (const setting of settings || []) settingsByOwner.set(setting.owner_id, setting);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const failures: { bookingCode: string; reason: string }[] = [];

  for (const booking of bookings || []) {
    const recipient = normalizeWhatsAppNumber(booking.customer_phone || '');
    const items = ((booking as any).booking_items || [])
      .map((item: any) => ({
        name: text([item.product_name, item.strength, item.pack_size].filter(Boolean).join(' '), 120),
        quantity: Math.max(0, Number(item.received_quantity || 0) - Number(item.collected_quantity || 0)),
        unit: text(item.unit_label || 'packs', 30),
      }))
      .filter((item: any) => item.quantity > 0);

    if (!recipient || !items.length) {
      skipped += 1;
      continue;
    }

    // Claim the row atomically so concurrent invocations do not send the same notification.
    const attemptNumber = Number(booking.pickup_whatsapp_attempt_count || 0) + 1;
    const { data: claim } = await supabase
      .from('bookings')
      .update({
        pickup_whatsapp_attempted_at: now.toISOString(),
        pickup_whatsapp_attempt_count: attemptNumber,
        pickup_whatsapp_last_error: null,
      })
      .eq('id', booking.id)
      .eq('owner_id', booking.owner_id)
      .eq('customer_whatsapp_opt_in', true)
      .eq('customer_no_smartphone', false)
      .is('pickup_whatsapp_sent_at', null)
      .lt('ready_for_pickup_at', readyBefore)
      .lt('pickup_whatsapp_attempt_count', MAX_DAILY_ATTEMPTS)
      .or('pickup_whatsapp_attempted_at.is.null,pickup_whatsapp_attempted_at.lt.' + retryBefore)
      .select('id')
      .maybeSingle();

    if (!claim) {
      skipped += 1;
      continue;
    }

    const settings = settingsByOwner.get(booking.owner_id);
    const shopName = text(settings?.shop_name || 'Ratan Medical Hall', 120);
    const customerName = text(booking.customer_name || 'Customer', 120);
    const itemSummary = text(items.map((item: any) => item.name + ' × ' + item.quantity + ' ' + item.unit).join('; '), 900);

    try {
      const response = await fetch(
        'https://graph.facebook.com/' + graphVersion + '/' + phoneNumberId + '/messages',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'template',
            template: {
              name: templateName,
              language: { code: templateLanguage },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: customerName },
                  { type: 'text', text: text(booking.booking_code, 60) },
                  { type: 'text', text: shopName },
                  { type: 'text', text: itemSummary },
                ],
              }],
            },
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.messages?.[0]?.id) {
        const reason = text(payload?.error?.message || 'WhatsApp API rejected the template message.', 500);
        throw new Error(reason);
      }

      const messageId = String(payload.messages[0].id);
      const { error: saveError } = await supabase
        .from('bookings')
        .update({
          pickup_whatsapp_sent_at: new Date().toISOString(),
          pickup_whatsapp_message_id: messageId,
          pickup_whatsapp_last_error: null,
        })
        .eq('id', booking.id)
        .eq('owner_id', booking.owner_id)
        .is('pickup_whatsapp_sent_at', null);

      if (saveError) {
        // The provider accepted the message. Report a persistence issue rather than claiming send failed.
        console.error('Pickup WhatsApp accepted but its message ID could not be stored for booking', booking.booking_code);
      } else {
        await supabase.from('booking_events').insert({
          owner_id: booking.owner_id,
          booking_id: booking.id,
          event_type: 'pickup_whatsapp_api_accepted',
          summary: 'Pickup WhatsApp template accepted by Meta; delivery status may update separately',
          payload: { whatsapp_message_id: messageId, trigger: 'daily_10am_ist_cron' },
          actor_user_id: null,
        });
      }

      sent += 1;
    } catch (error) {
      const reason = text(error instanceof Error ? error.message : 'Unknown WhatsApp delivery error.', 500);
      await supabase.from('bookings').update({
        pickup_whatsapp_last_error: reason,
      }).eq('id', booking.id).eq('owner_id', booking.owner_id).is('pickup_whatsapp_sent_at', null);
      failed += 1;
      failures.push({ bookingCode: booking.booking_code, reason });
    }
  }

  return Response.json({
    ok: true,
    scheduleTimezone: 'Asia/Kolkata',
    readyBeforeIstDay: readyBefore,
    selected: bookings?.length || 0,
    sent,
    failed,
    skipped,
    failures,
  });
}
