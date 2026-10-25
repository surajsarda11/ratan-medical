import { createClient } from '@/lib/supabase/server';
import BookingsTable from '@/components/bookings-table';

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{delete?: string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase.from('bookings').select('*,booking_items(*)').order('created_at',{ascending:false}).limit(1000),
    supabase.from('payments').select('booking_id,amount,payment_type').eq('payment_type','advance'),
  ]);
  const advances: Record<string,number> = {};
  (payments||[]).forEach((p:any)=>{ advances[p.booking_id]=(advances[p.booking_id]||0)+Number(p.amount||0); });
  return <>{params.delete === 'success' ? <div className="notice notice-neutral" role="status">Booking deleted successfully.</div> : params.delete === 'error' ? <div className="notice notice-amber" role="alert">The booking could not be deleted. No records were intentionally skipped; check linked records and try again.</div> : params.delete === 'not-found' ? <div className="notice notice-amber" role="alert">That booking was not found or you do not have permission to delete it.</div> : null}<div className="page-heading"><div><div className="kicker">ORDER REGISTER</div><h1>All bookings</h1><p>Find bookings, call customers, open order details, or prepare WhatsApp updates.</p></div></div><BookingsTable bookings={bookings||[]} advancesByBooking={advances} /></>;
}
