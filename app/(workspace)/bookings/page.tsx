import { createClient } from '@/lib/supabase/server';
import BookingsTable from '@/components/bookings-table';

export default async function BookingsPage() {
  const supabase = await createClient();
  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase.from('bookings').select('*,booking_items(*)').order('created_at',{ascending:false}).limit(1000),
    supabase.from('payments').select('booking_id,amount,payment_type').eq('payment_type','advance'),
  ]);
  const advances: Record<string,number> = {};
  (payments||[]).forEach((p:any)=>{ advances[p.booking_id]=(advances[p.booking_id]||0)+Number(p.amount||0); });
  return <><div className="page-heading"><div><div className="kicker">ORDER REGISTER</div><h1>All bookings</h1><p>Find bookings quickly, call customers directly, and cancel eligible uncollected requests while keeping the booking and audit history.</p></div></div><BookingsTable bookings={bookings||[]} advancesByBooking={advances} /></>;
}
