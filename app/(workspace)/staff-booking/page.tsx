import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StaffQuickBookingForm from '@/components/staff-quick-booking-form';

export default async function StaffBookingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership, error: membershipError } = await supabase
    .from('staff_memberships')
    .select('display_name, is_active')
    .eq('member_user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership) redirect('/dashboard');
  if (!membership.is_active) {
    await supabase.auth.signOut();
    redirect('/login?access=disabled');
  }

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_name, customer_phone, status, created_at, booking_items(product_name, requested_quantity, unit_label)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return <>
    <div className="page-heading"><div><div className="kicker">STAFF QUICK MODE</div><h1>Register a booking</h1><p>Fill the three required fields and save. The owner can handle stock matching, verification and settlement later.</p></div></div>
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <StaffQuickBookingForm />
      <section className="card" style={{ marginTop: 22 }}>
        <div className="card-header"><div><div className="card-title">Your recent bookings</div><div className="card-description">Only bookings created by your login are shown here.</div></div></div>
        {!recentBookings?.length ? <div className="empty-state">Your saved bookings will appear here.</div> : <div className="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Medicine</th><th>Status</th><th>Time</th></tr></thead><tbody>
          {recentBookings.map((booking: any) => <tr key={booking.id}>
            <td><div className="table-primary">{booking.booking_code}</div></td>
            <td><div className="table-primary">{booking.customer_name || 'Customer'}</div><div className="table-secondary">{booking.customer_phone}</div></td>
            <td>{(booking.booking_items || []).map((item: any) => `${item.product_name} × ${item.requested_quantity} ${item.unit_label}`).join(', ')}</td>
            <td><span className="status">{booking.status}</span></td>
            <td>{new Date(booking.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          </tr>)}
        </tbody></table></div>}
      </section>
      <p className="tiny muted" style={{ marginTop: 15 }}>Need stock or settlement changes? Ask the owner. Staff mode does not grant those permissions.</p>
    </div>
  </>;
}
