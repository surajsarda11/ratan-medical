import Link from 'next/link';

export default function ImportsPage() {
  return <div className="page-heading"><div><div className="kicker">ADVANCE ORDER WORKFLOW</div><h1>Manual order handling</h1><p>CSV stock importing has been retired. Add customer orders manually and update each order from its booking details.</p><div className="inline-form" style={{marginTop:16}}><Link className="btn btn-primary" href="/bookings/new">＋ New booking</Link><Link className="btn btn-secondary" href="/bookings">All bookings →</Link></div></div></div>;
}
