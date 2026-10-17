import BookingForm from '@/components/booking-form';

export default function NewBookingPage() {
  return (
    <div className="quick-booking-page">
      <div className="page-heading">
        <div>
          <div className="kicker">COUNTER WORKFLOW</div>
          <h1>Quick booking</h1>
          <p>Record the customer number, medicine request and any advance paid. After saving, the form resets for the next customer.</p>
        </div>
      </div>
      <BookingForm />
    </div>
  );
}
