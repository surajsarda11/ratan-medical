import BookingForm from '@/components/booking-form';
export default function NewBookingPage() {
  return <><div className="page-heading"><div><div className="kicker">NEW CUSTOMER ORDER</div><h1>Register a booking</h1><p>Capture the customer contact, exact medicine identity, quantity and any advance received. A WhatsApp confirmation draft will be available after saving.</p></div></div><div style={{maxWidth:1000,margin:'0 auto'}}><BookingForm /></div></>;
}
